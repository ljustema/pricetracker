import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import fs from "fs";
import path from "path";

export async function GET(_req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read the template file
    const templatePath = path.join(process.cwd(), 'src', 'scraper_templates', 'crawlee_typescript_template.ts');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Return the template as a downloadable file
    return new NextResponse(templateContent, {
      headers: {
        "Content-Type": "text/typescript",
        "Content-Disposition": "attachment; filename=pricetracker_crawlee_template.ts",
      },
    });
  } catch (error) {
    console.error("Error serving Crawlee template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
