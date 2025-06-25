import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import crypto from 'crypto';
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { BrandService } from "@/lib/services/brand-service";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure the user ID is in UUID format for consistent handling
    const ensureUUID = (id: string): string => {
      // Check if the ID is already a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        return id;
      }

      // If not a UUID, create a deterministic UUID v5 from the ID
      return crypto.createHash('md5').update(id).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    };

    const userId = ensureUUID(session.user.id);

    // Parse the form data
    const formData = await req.formData();
    const competitorId = formData.get('competitorId') as string;
    const file = formData.get('file') as File;
    const delimiter = (formData.get('delimiter') as string) || ',';

    // Validate required fields
    if (!competitorId || !file) {
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

      // Helper function to parse a CSV line with proper handling of quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            // Toggle quote state
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            // End of field
            result.push(currentField.trim());
            currentField = '';
          } else {
            // Add character to current field
            currentField += char;
          }
        }

        // Add the last field
        result.push(currentField.trim());

        // Remove quotes from quoted fields
        return result.map(field => {
          if (field.startsWith('"') && field.endsWith('"')) {
            return field.substring(1, field.length - 1);
          }
          return field;
        });
      };

      // Parse header row
      const headers = parseCSVLine(lines[0]);

      // Check for required headers
      const requiredHeaders = ['name', 'competitor_price'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        return {
          data: [],
          errors: [{
            message: `Missing required headers: ${missingHeaders.join(', ')}`
          }]
        };
      }

      // Parse data rows
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          return {
            data,
            errors: [{
              message: `Row ${i+1} has ${values.length} fields, expected ${headers.length}`
            }]
          };
        }

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
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

    // Get competitor info
    const { data: _competitor, error: competitorError } = await supabase
      .from('competitors')
      .select('name')
      .eq('id', competitorId)
      .single();

    if (competitorError) {
      return NextResponse.json(
        { error: `Failed to get competitor: ${competitorError.message}` },
        { status: 400 }
      );
    }

    // Process each row in the CSV
    const now = new Date().toISOString();
    let productsAdded = 0;
    let pricesUpdated = 0;

    for (const row of parsedCsv.data) {
      // Validate required fields
      if (!row.name || !row.competitor_price) {
        continue; // Skip rows with missing required fields
      }

      // Try to find an existing product by EAN or Brand+SKU
      let productId: string | null = null;

      if (row.ean) {
        // Try to match by EAN
        const { data: matchedProducts } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId)
          .eq('ean', row.ean)
          .limit(1);

        if (matchedProducts && matchedProducts.length > 0) {
          productId = matchedProducts[0].id;
        }
      } else if (row.brand && row.sku) {
        // Try to match by brand and SKU
        const { data: matchedProducts } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId)
          .eq('brand', row.brand)
          .eq('sku', row.sku)
          .limit(1);

        if (matchedProducts && matchedProducts.length > 0) {
          productId = matchedProducts[0].id;
        }
      }

      // If no product found, create a new one
      if (!productId) {
        // Handle brand standardization if brand text is provided
        let brandId = null;
        if (row.brand) {
          const brandService = new BrandService();
          try {
            // Find or create the brand and get its ID
            const brand = await brandService.findOrCreateBrandByName(userId, row.brand);
            if (brand?.id) {
              brandId = brand.id;
            } else {
              console.warn(`Could not find or create brand for name "${row.brand}" during CSV import.`);
            }
          } catch (brandError) {
            console.error(`Error processing brand "${row.brand}" during CSV import:`, brandError);
          }
        }

        const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          user_id: userId,
          name: row.name,
          sku: row.sku || null,
          ean: row.ean || null,
          brand: row.brand || null,
          brand_id: brandId, // Set the brand_id from the brand service
          image_url: row.image_url || null,
          url: row.url || null,
          currency_code: row.currency_code ? row.currency_code.toUpperCase() : 'SEK',
          is_active: true,
          created_at: now,
          updated_at: now,
        })
          .select('id')
          .single();

        if (productError) {
          console.error(`Failed to create product: ${productError.message}`);
          continue; // Skip to next row
        }

        productId = newProduct.id;
        productsAdded++;
      }

      // Insert into temp_competitors_scraped_data instead of direct price_changes insertion
      const competitorPrice = parseFloat(row.competitor_price);
      if (isNaN(competitorPrice)) {
        continue; // Skip if competitor_price is not a valid number
      }

      // Insert into temp table - the trigger will handle processing and price change logic
      const { error: tempInsertError } = await supabase
        .from('temp_competitors_scraped_data')
        .insert({
          user_id: userId,
          competitor_id: competitorId,
          product_id: productId, // We already have the product ID from above
          name: row.name,
          competitor_price: competitorPrice,
          sku: row.sku || null,
          ean: row.ean || null,
          brand: row.brand || null,
          competitor_url: row.competitor_url || row.url || null, // Updated field name, support both old and new
          image_url: row.image_url || null,
          currency_code: row.currency_code ? row.currency_code.toUpperCase() : 'SEK',
          raw_data: row, // Include all CSV data as raw_data for custom fields processing
          scraped_at: now
        });

      if (tempInsertError) {
        console.error(`Failed to insert into temp table: ${tempInsertError.message}`);
        continue; // Skip to next row
      }

      pricesUpdated++;
    }

    return NextResponse.json({
      success: true,
      productsAdded,
      pricesUpdated,
      message: `Successfully processed CSV file. Added ${productsAdded} new products and updated ${pricesUpdated} prices.`
    });
  } catch (error) {
    console.error("Error processing CSV upload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}