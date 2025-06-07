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
    const file = formData.get('file') as File;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: "Missing CSV file" },
        { status: 400 }
      );
    }

    // Read and parse the CSV file
    const fileContent = await file.text();

    // CSV parser implementation that handles quoted fields
    const parseCSV = (csvText: string) => {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) {
        return { data: [], errors: [{ message: 'Empty CSV file' }] };
      }

      // Parse a single CSV line, handling quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped quote
              current += '"';
              i += 2;
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
              i++;
            }
          } else if (char === ',' && !inQuotes) {
            // Field separator
            result.push(current.trim());
            current = '';
            i++;
          } else {
            current += char;
            i++;
          }
        }

        // Add the last field
        result.push(current.trim());
        return result;
      };

      // Parse header row
      const headers = parseCSVLine(lines[0]);

      // Check for required headers (only name is required for own products)
      const requiredHeaders = ['name'];
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

    const parsedCsv = parseCSV(fileContent);

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
          { error: "CSV file is missing required headers: either 'our_retail_price' (or 'our_price') or 'our_wholesale_price' (or 'wholesale_price') is required for own products" },
          { status: 400 }
        );
      }
    }

    // Use the admin client to bypass RLS
    const supabase = createSupabaseAdminClient();

    // Process each row in the CSV
    const now = new Date().toISOString();
    let productsAdded = 0;
    let pricesUpdated = 0;

    for (const row of parsedCsv.data) {
      // Skip empty rows
      if (!row.name || row.name.trim() === '') {
        continue;
      }

      // Handle brand creation/lookup
      let brandId = null;
      if (row.brand && row.brand.trim() !== '') {
        try {
          const brandService = new BrandService();
          const brand = await brandService.findOrCreateBrandByName(userId, row.brand.trim());
          brandId = brand?.id || null;
        } catch (error) {
          console.error(`Failed to get/create brand: ${error}`);
          // Continue without brand_id if brand creation fails
        }
      }

      // Check if product already exists by EAN or SKU+Brand
      let productId = null;
      let existingProduct = null;

      // First try to find by EAN
      if (row.ean && row.ean.trim() !== '') {
        const { data: eanProduct } = await supabase
          .from('products')
          .select('id, our_retail_price, our_wholesale_price')
          .eq('user_id', userId)
          .eq('ean', row.ean.trim())
          .single();

        if (eanProduct) {
          existingProduct = eanProduct;
          productId = eanProduct.id;
        }
      }

      // If not found by EAN, try SKU + Brand
      if (!productId && row.sku && row.sku.trim() !== '' && brandId) {
        const { data: skuProduct } = await supabase
          .from('products')
          .select('id, our_retail_price, our_wholesale_price')
          .eq('user_id', userId)
          .eq('sku', row.sku.trim())
          .eq('brand_id', brandId)
          .single();

        if (skuProduct) {
          existingProduct = skuProduct;
          productId = skuProduct.id;
        }
      }

      // Parse prices (support both old and new column names)
      const ourRetailPrice = row.our_retail_price ? parseFloat(row.our_retail_price) :
                             (row.our_price ? parseFloat(row.our_price) : null);
      const ourWholesalePrice = row.our_wholesale_price ? parseFloat(row.our_wholesale_price) :
                               (row.wholesale_price ? parseFloat(row.wholesale_price) : null);

      if (productId) {
        // Update existing product
        const updateData: any = {
          name: row.name,
          updated_at: now,
        };

        // Update optional fields if provided
        if (row.sku) updateData.sku = row.sku;
        if (row.ean) updateData.ean = row.ean;
        if (row.brand) updateData.brand = row.brand;
        if (brandId) updateData.brand_id = brandId;
        if (row.category) updateData.category = row.category;
        if (row.description) updateData.description = row.description;
        if (row.image_url) updateData.image_url = row.image_url;
        if (row.url) updateData.url = row.url;
        if (row.currency_code) updateData.currency_code = row.currency_code.toUpperCase();

        // Update prices if provided
        if (ourRetailPrice !== null) updateData.our_retail_price = ourRetailPrice;
        if (ourWholesalePrice !== null) updateData.our_wholesale_price = ourWholesalePrice;

        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', productId);

        if (updateError) {
          console.error(`Failed to update product: ${updateError.message}`);
          continue;
        }

        // Check if prices changed
        if ((ourRetailPrice !== null && existingProduct && ourRetailPrice !== existingProduct.our_retail_price) ||
            (ourWholesalePrice !== null && existingProduct && ourWholesalePrice !== existingProduct.our_wholesale_price)) {
          pricesUpdated++;
        }
      } else {
        // Create new product
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            user_id: userId,
            name: row.name,
            sku: row.sku || null,
            ean: row.ean || null,
            brand: row.brand || null,
            brand_id: brandId,
            category: row.category || null,
            description: row.description || null,
            image_url: row.image_url || null,
            url: row.url || null,
            our_retail_price: ourRetailPrice,
            our_wholesale_price: ourWholesalePrice,
            currency_code: row.currency_code ? row.currency_code.toUpperCase() : 'SEK',
            is_active: true,
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single();

        if (productError) {
          console.error(`Failed to create product: ${productError.message}`);
          continue;
        }

        productsAdded++;
      }
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
