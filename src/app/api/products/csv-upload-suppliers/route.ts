import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils/uuid";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);

    // Parse the form data
    const formData = await req.formData();
    const supplierId = formData.get('supplierId') as string;
    const file = formData.get('file') as File;
    const delimiter = (formData.get('delimiter') as string) || ',';

    // Validate required fields
    if (!supplierId || !file) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Read and parse the CSV file
    const fileContent = await file.text();

    // CSV parser implementation that handles quoted fields
    const parseCSV = (csvText: string, delimiter: string = ',') => {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) {
        return { data: [], errors: [{ message: 'Empty CSV file' }] };
      }

      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
      const data = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Simple CSV parsing - handle quoted fields
        const values = [];
        let currentValue = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim());

        if (values.length !== headers.length) {
          errors.push({ message: `Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}` });
          continue;
        }

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.replace(/"/g, '') || '';
        });

        data.push(row);
      }

      return { data, errors: [] };
    };

    const parsedCsv = parseCSV(fileContent, delimiter);

    if (parsedCsv.errors.length > 0) {
      return NextResponse.json(
        { error: `CSV parsing error: ${parsedCsv.errors[0].message}` },
        { status: 400 }
      );
    }

    // Use the admin client to bypass RLS
    const supabase = createSupabaseAdminClient();

    // Get supplier info
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', supplierId)
      .eq('user_id', userId)
      .single();

    if (supplierError) {
      return NextResponse.json(
        { error: `Failed to get supplier: ${supplierError.message}` },
        { status: 400 }
      );
    }

    // Process each row in the CSV and insert into temp_suppliers_scraped_data
    const now = new Date().toISOString();
    let recordsInserted = 0;
    const runId = `csv_upload_${Date.now()}`; // Generate a unique run_id for CSV uploads

    for (const row of parsedCsv.data) {
      // Skip empty rows
      if (!row.name || row.name.trim() === '') {
        continue;
      }

      // Parse prices
      const supplierPrice = row.supplier_price ? parseFloat(row.supplier_price) : null;
      const supplierRecommendedPrice = row.supplier_recommended_price ? parseFloat(row.supplier_recommended_price) : null;

      // Insert into temp_suppliers_scraped_data - let the database trigger handle everything
      const { error: insertError } = await supabase
        .from('temp_suppliers_scraped_data')
        .insert({
          user_id: userId,
          supplier_id: supplierId,
          scraper_id: supplierId, // Use supplier_id as scraper_id for CSV uploads
          run_id: runId,
          name: row.name.trim(),
          sku: row.sku || null,
          ean: row.ean || null,
          brand: row.brand || null,
          supplier_price: supplierPrice,
          supplier_recommended_price: supplierRecommendedPrice,
          currency_code: row.currency_code ? row.currency_code.toUpperCase() : 'SEK',
          url: row.url || null,
          image_url: row.image_url || null,
          minimum_order_quantity: row.minimum_order_quantity ? parseInt(row.minimum_order_quantity) : 1,
          lead_time_days: row.lead_time_days ? parseInt(row.lead_time_days) : null,
          product_description: row.description || null,
          category: row.category || null,
          scraped_at: now,
          processed: false
        });

      if (insertError) {
        console.error(`Failed to insert row: ${insertError.message}`);
        continue; // Skip to next row
      }

      recordsInserted++;
    }

    return NextResponse.json({
      success: true,
      recordsInserted,
      message: `Successfully processed CSV file. Inserted ${recordsInserted} records into staging for supplier ${supplier.name}.`
    });

  } catch (error) {
    console.error("Error in supplier CSV upload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
