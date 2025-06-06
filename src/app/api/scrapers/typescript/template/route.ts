import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get template type from query params
    const { searchParams } = new URL(req.url);
    const templateType = searchParams.get('type') || 'competitor';

    // Determine template file based on type
    let templateFileName: string;
    let downloadFileName: string;

    if (templateType === 'supplier') {
      templateFileName = 'supplier_typescript_template.ts';
      downloadFileName = 'pricetracker_supplier_scraper_template.ts';
    } else {
      templateFileName = 'typescript_template.ts';
      downloadFileName = 'pricetracker_scraper_template.ts';
    }

    // Read the template file
    const templatePath = path.join(process.cwd(), 'src', 'scraper_templates', templateFileName);
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Return the template as a downloadable file
    return new NextResponse(templateContent, {
      headers: {
        "Content-Type": "text/typescript",
        "Content-Disposition": `attachment; filename=${downloadFileName}`,
      },
    });
  } catch (error) {
    console.error("Error generating TypeScript template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}