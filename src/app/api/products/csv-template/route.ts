import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    // Create a CSV template with headers and example data
    const headers = [
      "name",
      "price",
      "currency_code",
      "sku",
      "brand",
      "ean",
      "image_url",
      "url"
    ];

    // Example data rows
    const exampleRows = [
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

    // Helper function to properly quote CSV values
    const escapeCSVValue = (value: string) => {
      // If the value contains commas, quotes, or newlines, wrap it in quotes
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        // Double up any quotes within the value
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

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
    headers_response.set("Content-Disposition", "attachment; filename=product_price_template.csv");

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