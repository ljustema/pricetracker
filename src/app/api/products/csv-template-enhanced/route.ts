import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Get the product type from query parameters
    const { searchParams } = new URL(req.url);
    const productType = searchParams.get('type') || 'competitor';

    // Helper function to properly quote CSV values
    const escapeCSVValue = (value: string) => {
      // If the value contains commas, quotes, or newlines, wrap it in quotes
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        // Double up any quotes within the value
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    let headers: string[];
    let exampleRows: string[][];
    let filename: string;

    if (productType === 'own') {
      // Template for own products
      headers = [
        "name",
        "our_retail_price",
        "our_wholesale_price",
        "currency_code",
        "sku",
        "brand",
        "ean",
        "category",
        "description",
        "image_url",
        "url"
      ];

      exampleRows = [
        [
          "Example Product 1",
          "199.99",
          "149.99",
          "SEK",
          "SKU123",
          "Example Brand",
          "1234567890123",
          "Electronics",
          "High-quality example product with advanced features",
          "https://example.com/images/product1.jpg",
          "https://example.com/product1"
        ],
        [
          "Example Product 2",
          "299.99",
          "229.99",
          "SEK",
          "SKU456",
          "Example Brand",
          "2345678901234",
          "Home & Garden",
          "Premium example product for home use",
          "https://example.com/images/product2.jpg",
          "https://example.com/product2"
        ]
      ];

      filename = "own_products_template.csv";
    } else if (productType === 'competitor') {
      // Template for competitor products (updated to use competitor_price)
      headers = [
        "name",
        "competitor_price",
        "currency_code",
        "sku",
        "brand",
        "ean",
        "image_url",
        "url"
      ];

      exampleRows = [
        [
          "Example Product 1",
          "19.99",
          "SEK",
          "SKU123",
          "Example Brand",
          "1234567890123",
          "https://example.com/images/product1.jpg",
          "https://example.com/product1"
        ],
        [
          "Example Product 2",
          "29.99",
          "SEK",
          "SKU456",
          "Example Brand",
          "2345678901234",
          "https://example.com/images/product2.jpg",
          "https://example.com/product2"
        ]
      ];

      filename = "competitor_products_template.csv";
    } else {
      // Supplier products template
      headers = [
        "name",
        "supplier_price",
        "supplier_recommended_price",
        "currency_code",
        "sku",
        "brand",
        "ean",
        "image_url",
        "url",
        "minimum_order_quantity",
        "lead_time_days"
      ];

      exampleRows = [
        [
          "Supplier Product 1",
          "149.99",
          "249.99",
          "SEK",
          "SUPP-SKU-001",
          "Supplier Brand",
          "1234567890123",
          "https://supplier.com/images/product1.jpg",
          "https://supplier.com/product1",
          "10",
          "7"
        ],
        [
          "Supplier Product 2",
          "199.99",
          "349.99",
          "SEK",
          "SUPP-SKU-002",
          "Supplier Brand",
          "2345678901234",
          "https://supplier.com/images/product2.jpg",
          "https://supplier.com/product2",
          "5",
          "14"
        ]
      ];

      filename = "supplier_products_template.csv";
    }

    // Build the CSV content
    let csvContent = headers.join(",") + "\n";
    exampleRows.forEach(row => {
      // Properly escape each value in the row
      const escapedRow = row.map(value => escapeCSVValue(value));
      csvContent += escapedRow.join(",") + "\n";
    });

    // Set the response headers for a CSV file download
    const headers_response = new Headers();
    headers_response.set("Content-Type", "text/csv");
    headers_response.set("Content-Disposition", `attachment; filename=${filename}`);

    return new NextResponse(csvContent, {
      status: 200,
      headers: headers_response
    });
  } catch (error) {
    console.error("Error generating CSV template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
