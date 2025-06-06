import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils/uuid";
import { BrandService } from "@/lib/services/brand-service";

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
    const parseCSV = (csvText: string) => {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) {
        return { data: [], errors: [{ message: 'Empty CSV file' }] };
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
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
          } else if (char === ',' && !inQuotes) {
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

    const parsedCsv = parseCSV(fileContent);

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

    // Initialize brand service
    const brandService = new BrandService();

    // Process each row in the CSV
    const now = new Date().toISOString();
    let productsAdded = 0;
    let pricesUpdated = 0;

    for (const row of parsedCsv.data) {
      // Skip rows without required fields
      if (!row.name || !row.price) {
        console.log(`Skipping row with missing name or price: ${JSON.stringify(row)}`);
        continue;
      }

      // Parse price
      const price = parseFloat(row.price);
      if (isNaN(price)) {
        console.log(`Skipping row with invalid price: ${row.price}`);
        continue;
      }

      // Handle brand
      let brandId = null;
      if (row.brand) {
        try {
          const brand = await brandService.findOrCreateBrand(userId, row.brand);
          brandId = brand.id;
        } catch (error) {
          console.error(`Failed to handle brand ${row.brand}:`, error);
          // Continue without brand
        }
      }

      // Check if product already exists (by EAN or SKU+brand)
      let productId = null;
      let existingProduct = null;

      if (row.ean) {
        const { data: productByEan } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId)
          .eq('ean', row.ean)
          .single();
        
        if (productByEan) {
          existingProduct = productByEan;
          productId = productByEan.id;
        }
      }

      if (!existingProduct && row.sku && row.brand) {
        const { data: productBySkuBrand } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId)
          .eq('sku', row.sku)
          .eq('brand', row.brand)
          .single();
        
        if (productBySkuBrand) {
          existingProduct = productBySkuBrand;
          productId = productBySkuBrand.id;
        }
      }

      // Create product if it doesn't exist
      if (!existingProduct) {
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            user_id: userId,
            name: row.name,
            sku: row.sku || null,
            ean: row.ean || null,
            brand: row.brand || null,
            brand_id: brandId,
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

      // Get the current supplier price for this product
      const { data: currentPrice } = await supabase
        .from('price_changes_suppliers')
        .select('new_price, new_wholesale_price')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .eq('supplier_id', supplierId)
        .order('changed_at', { ascending: false })
        .limit(1)
        .single();

      // Calculate price change percentage
      let priceChangePercentage = null;
      if (currentPrice?.new_price && price) {
        priceChangePercentage = ((price - currentPrice.new_price) / currentPrice.new_price) * 100;
      }

      // Add supplier price change
      const { error: priceError } = await supabase
        .from('price_changes_suppliers')
        .insert({
          user_id: userId,
          product_id: productId,
          supplier_id: supplierId,
          old_price: currentPrice?.new_price || null,
          new_price: price,
          old_wholesale_price: currentPrice?.new_wholesale_price || null,
          new_wholesale_price: row.wholesale_price ? parseFloat(row.wholesale_price) : null,
          price_change_percentage: priceChangePercentage,
          currency_code: row.currency_code ? row.currency_code.toUpperCase() : 'SEK',
          url: row.url || null,
          minimum_order_quantity: row.minimum_order_quantity ? parseInt(row.minimum_order_quantity) : 1,
          lead_time_days: row.lead_time_days ? parseInt(row.lead_time_days) : null,
          changed_at: now,
          change_source: 'csv',
        });

      if (priceError) {
        console.error(`Failed to create supplier price change: ${priceError.message}`);
        continue;
      }

      pricesUpdated++;
    }

    return NextResponse.json({
      success: true,
      productsAdded,
      pricesUpdated,
      message: `Successfully processed ${productsAdded} new products and ${pricesUpdated} price updates for supplier ${supplier.name}`
    });

  } catch (error) {
    console.error("Error in supplier CSV upload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
