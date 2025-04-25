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

    // Validate required fields
    if (!competitorId || !file) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Read and parse the CSV file
    const fileContent = await file.text();

    // Simple CSV parser implementation
    const parseCSV = (csvText: string) => {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) {
        return { data: [], errors: [{ message: 'Empty CSV file' }] };
      }

      // Parse header row
      const headers = lines[0].split(',').map(header => header.trim());

      // Check for required headers
      const requiredHeaders = ['name', 'price'];
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
        const values = lines[i].split(',').map(value => value.trim());
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

    const parsedCsv = parseCSV(fileContent);

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
      if (!row.name || !row.price) {
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

      // Insert directly to price_changes instead of scraped_products
      const price = parseFloat(row.price);
      if (isNaN(price)) {
        continue; // Skip if price is not a valid number
      }

      // Get the last price for this product from this competitor (if any)
      const { data: lastPriceData } = await supabase
        .from('price_changes')
        .select('new_price')
        .eq('product_id', productId)
        .eq('competitor_id', competitorId)
        .order('changed_at', { ascending: false })
        .limit(1);

      const lastPrice = lastPriceData && lastPriceData.length > 0
        ? parseFloat(lastPriceData[0].new_price)
        : price; // Use current price if no previous price exists

      // Calculate price change percentage
      const priceChangePercentage = lastPrice !== 0
        ? ((price - lastPrice) / lastPrice) * 100
        : 0;

      // Insert the price change
      const { error: priceChangeError } = await supabase
        .from('price_changes')
        .insert({
          user_id: userId,
          product_id: productId,
          competitor_id: competitorId,
          old_price: lastPrice,
          new_price: price,
          price_change_percentage: priceChangePercentage,
          changed_at: now
        });

      if (priceChangeError) {
        console.error(`Failed to insert price change: ${priceChangeError.message}`);
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