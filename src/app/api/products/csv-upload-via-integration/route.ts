import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import crypto from 'crypto';
import { createSupabaseAdminClient } from "@/lib/supabase/server";


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
    const integrationId = formData.get('integrationId') as string;
    const file = formData.get('file') as File;
    const delimiter = (formData.get('delimiter') as string) || ',';

    // Validate required fields
    if (!integrationId || !file) {
      return NextResponse.json(
        { error: "Missing required fields: integrationId, file" },
        { status: 400 }
      );
    }

    // Use the admin client to bypass RLS
    const supabase = createSupabaseAdminClient();

    // Verify the integration exists and belongs to the user
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('id, name')
      .eq('id', integrationId)
      .eq('user_id', userId)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: "Integration not found or access denied" },
        { status: 404 }
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

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }

        result.push(currentField.trim());

        return result.map(field => {
          if (field.startsWith('"') && field.endsWith('"')) {
            return field.substring(1, field.length - 1);
          }
          return field;
        });
      };

      // Parse header row
      const headers = parseCSVLine(lines[0]);

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

    // Validate headers for own products (support both old and new column names)
    if (parsedCsv.data.length > 0) {
      const headers = Object.keys(parsedCsv.data[0]);
      const hasOurPrice = headers.includes('our_price') || headers.includes('our_retail_price');
      const hasWholesalePrice = headers.includes('wholesale_price') || headers.includes('our_wholesale_price');

      if (!hasOurPrice && !hasWholesalePrice) {
        return NextResponse.json(
          { error: "CSV file is missing required headers: either 'our_price'/'our_retail_price' or 'wholesale_price'/'our_wholesale_price' is required for own products" },
          { status: 400 }
        );
      }
    }

    // Create an integration run to track this CSV upload
    const { data: integrationRun, error: runError } = await supabase
      .from('integration_runs')
      .insert({
        integration_id: integrationId,
        user_id: userId,
        status: 'pending',
        products_processed: 0,
        products_updated: 0,
        products_created: 0,
        log_details: JSON.stringify([{
          timestamp: new Date().toISOString(),
          level: 'info',
          phase: 'CSV_UPLOAD',
          message: `CSV upload initiated: ${file.name}`
        }])
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating integration run:', runError);
      return NextResponse.json(
        { error: 'Failed to create integration run' },
        { status: 500 }
      );
    }

    // Process each row in the CSV and insert into temp_integrations_scraped_data
    const now = new Date().toISOString();
    let recordsInserted = 0;

    for (const row of parsedCsv.data) {
      // Skip empty rows
      if (!row.name || row.name.trim() === '') {
        continue;
      }

      // Parse prices (support both old and new column names for backward compatibility)
      const ourRetailPrice = row.our_retail_price ? parseFloat(row.our_retail_price) :
                             (row.our_price ? parseFloat(row.our_price) : null);
      const ourWholesalePrice = row.our_wholesale_price ? parseFloat(row.our_wholesale_price) :
                               (row.wholesale_price ? parseFloat(row.wholesale_price) : null);

      // Insert into temp_integrations_scraped_data (including all fields in raw_data)
      const { error: insertError } = await supabase
        .from('temp_integrations_scraped_data')
        .insert({
          integration_run_id: integrationRun.id,
          integration_id: integrationId,
          user_id: userId,
          name: row.name.trim(),
          sku: row.sku || null,
          ean: row.ean || null,
          brand: row.brand || null,
          our_retail_price: ourRetailPrice, // Use our_retail_price as the main price
          our_wholesale_price: ourWholesalePrice,
          image_url: row.image_url || null,
          url: row.url || null,
          currency_code: row.currency_code ? row.currency_code.toUpperCase() : 'SEK',
          raw_data: row, // Store all CSV data including custom fields
          status: 'pending',
          created_at: now
        });

      if (insertError) {
        console.error(`Failed to insert row: ${insertError.message}`);
        continue; // Skip to next row
      }

      recordsInserted++;
    }

    // Process the staged data using the database function
    const { data: processResult, error: processError } = await supabase
      .rpc('process_pending_integration_products', { run_id: integrationRun.id });

    if (processError) {
      console.error('Error processing integration products:', processError);
      return NextResponse.json(
        { error: 'Failed to process uploaded products' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      productsAdded: processResult?.products_created || 0,
      pricesUpdated: processResult?.products_updated || 0,
      message: `Successfully processed CSV file. Inserted ${recordsInserted} records into staging.`
    });

  } catch (error) {
    console.error("Error processing CSV upload via integration:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
