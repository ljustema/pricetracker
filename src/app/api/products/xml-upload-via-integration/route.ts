import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import crypto from 'crypto';
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { XMLParser } from 'fast-xml-parser';

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

    // Read and parse the XML file
    const fileContent = await file.text();

    // Parse XML with fast-xml-parser
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '_',
      parseAttributeValue: true,
      processEntities: false,
      htmlEntities: false,
    });

    let parsedXml;
    try {
      parsedXml = parser.parse(fileContent);
    } catch (error) {
      return NextResponse.json(
        { error: `XML parsing error: ${error instanceof Error ? error.message : 'Invalid XML format'}` },
        { status: 400 }
      );
    }

    // Extract items from the XML structure
    let items: Record<string, unknown>[] = [];
    
    // Handle different XML structures
    if (parsedXml.rss?.channel?.item) {
      items = Array.isArray(parsedXml.rss.channel.item) 
        ? parsedXml.rss.channel.item 
        : [parsedXml.rss.channel.item];
    } else if (parsedXml.feed?.entry) {
      items = Array.isArray(parsedXml.feed.entry) 
        ? parsedXml.feed.entry 
        : [parsedXml.feed.entry];
    } else if (parsedXml.channel?.item) {
      items = Array.isArray(parsedXml.channel.item) 
        ? parsedXml.channel.item 
        : [parsedXml.channel.item];
    } else {
      return NextResponse.json(
        { error: "No product items found in XML feed. Expected RSS/channel/item or feed/entry structure." },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No product items found in XML feed" },
        { status: 400 }
      );
    }

    // Create an integration run to track this XML upload
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
          phase: 'XML_UPLOAD',
          message: `XML upload initiated: ${file.name}`
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

    // Process each item in the XML and insert into temp_integrations_scraped_data
    const now = new Date().toISOString();
    let recordsInserted = 0;

    for (const item of items) {
      // Extract product data from XML item
      const extractedData = extractProductDataFromXmlItem(item);
      
      // Skip items without required data
      if (!extractedData.name || extractedData.name.trim() === '') {
        continue;
      }

      // Insert into temp_integrations_scraped_data
      const { error: insertError } = await supabase
        .from('temp_integrations_scraped_data')
        .insert({
          integration_run_id: integrationRun.id,
          integration_id: integrationId,
          user_id: userId,
          name: extractedData.name.trim(),
          sku: extractedData.sku || null,
          ean: extractedData.ean || null,
          brand: extractedData.brand || null,
          our_retail_price: extractedData.our_retail_price,
          our_wholesale_price: extractedData.our_wholesale_price,
          image_url: extractedData.image_url || null,
          our_url: extractedData.url || null, // Updated field name to match database schema
          currency_code: extractedData.currency_code || 'SEK',
          raw_data: item, // Store the entire XML item for reference
          status: 'conflict_check', // Use special status to prevent automatic processing
          created_at: now
        });

      if (insertError) {
        console.error(`Failed to insert XML item: ${insertError.message}`);
        continue; // Skip to next item
      }

      recordsInserted++;
    }

    // Get all the inserted record IDs for conflict detection
    const { data: insertedRecords, error: recordsError } = await supabase
      .from('temp_integrations_scraped_data')
      .select('id')
      .eq('integration_run_id', integrationRun.id)
      .eq('status', 'conflict_check');

    if (recordsError) {
      console.error('Error fetching inserted records:', recordsError);
      return NextResponse.json(
        { error: 'Failed to fetch inserted records for conflict detection' },
        { status: 500 }
      );
    }

    // Run conflict detection before processing
    if (insertedRecords && insertedRecords.length > 0) {
      const { data: conflictResult, error: conflictError } = await supabase.rpc(
        'detect_ean_conflicts_and_create_reviews',
        {
          p_user_id: userId,
          p_source_table: 'temp_integrations_scraped_data',
          p_batch_ids: insertedRecords.map(r => r.id)
        }
      );

      if (conflictError) {
        console.error('Error detecting conflicts:', conflictError);
        // Don't fail the entire upload, just log the error
      } else {
        console.log('Conflict detection completed:', conflictResult);
      }

      // Update status to 'pending' so records can be processed
      await supabase
        .from('temp_integrations_scraped_data')
        .update({ status: 'pending' })
        .eq('integration_run_id', integrationRun.id)
        .eq('status', 'conflict_check');
    }

    // Process the staged data using the database function
    const { data: processResult, error: processError } = await supabase
      .rpc('process_all_pending_temp_integrations', { p_user_id: userId });

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
      message: `Successfully processed XML file. Inserted ${recordsInserted} records into staging.`
    });

  } catch (error) {
    console.error("Error processing XML upload via integration:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Extract product data from XML item based on Google Feed format
 */
function extractProductDataFromXmlItem(item: Record<string, unknown>) {
  // Helper function to get value from XML item, handling both direct values and CDATA
  const getValue = (obj: Record<string, unknown> | null, key: string): string | null => {
    if (!obj || typeof obj !== 'object') return null;

    const value = obj[key];
    if (value === undefined || value === null) return null;

    // Handle CDATA sections and direct values
    if (typeof value === 'string') {
      return value.trim();
    }

    // Handle objects with text content
    if (typeof value === 'object' && value && '#text' in value) {
      const textValue = (value as Record<string, unknown>)['#text'];
      return textValue ? textValue.toString().trim() : null;
    }

    return value.toString().trim();
  };

  // Helper function to parse price from string (e.g., "350 SEK" -> 350)
  const parsePrice = (priceStr: string | null): number | null => {
    if (!priceStr) return null;
    
    // Extract numeric value from price string
    const match = priceStr.match(/[\d,]+\.?\d*/);
    if (match) {
      const numericValue = match[0].replace(/,/g, '');
      const parsed = parseFloat(numericValue);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  };

  // Extract data according to the mapping specified in the user request
  const title = getValue(item, 'title');
  const link = getValue(item, 'link');
  const imageLink = getValue(item, 'g:image_link');
  const price = getValue(item, 'g:price');
  const salePrice = getValue(item, 'g:sale_price'); // Use sale price if available
  const costOfGoodsSold = getValue(item, 'g:cost_of_goods_sold');
  const gtin = getValue(item, 'g:gtin');
  const brand = getValue(item, 'g:brand');
  const mpn = getValue(item, 'g:mpn');

  // Determine which price to use (sale price takes priority)
  const finalPrice = salePrice || price;
  const retailPrice = parsePrice(finalPrice);
  const wholesalePrice = parsePrice(costOfGoodsSold);

  return {
    name: title,
    url: link,
    image_url: imageLink,
    our_retail_price: retailPrice,
    our_wholesale_price: wholesalePrice,
    ean: gtin,
    brand: brand,
    sku: mpn,
    currency_code: 'SEK' // Default to SEK, could be extracted from price string if needed
  };
}
