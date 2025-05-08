import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import logger from "@/lib/utils/logger";

// This is a temporary API endpoint to update a TypeScript scraper
export async function POST(req: NextRequest) {
  const routeContext = 'API:scrapers/update-typescript-scraper';
  logger.info(routeContext, 'Received update TypeScript scraper request');

  try {
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error(routeContext, 'Missing Supabase credentials');
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the scraper ID from the request
    const { scraperId, scriptPath } = await req.json();

    if (!scraperId) {
      logger.warn(routeContext, 'Missing scraperId in request');
      return NextResponse.json({ error: "Scraper ID is required" }, { status: 400 });
    }

    if (!scriptPath) {
      logger.warn(routeContext, 'Missing scriptPath in request');
      return NextResponse.json({ error: "Script path is required" }, { status: 400 });
    }

    // Read the script content
    const fullPath = path.join(process.cwd(), scriptPath);
    logger.info(routeContext, `Reading script from ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
      logger.error(routeContext, `Script file not found at ${fullPath}`);
      return NextResponse.json({ error: "Script file not found" }, { status: 404 });
    }
    
    const scriptContent = fs.readFileSync(fullPath, 'utf8');
    logger.info(routeContext, `Read ${scriptContent.length} characters from script file`);

    // Update the scraper with the TypeScript code
    const { data, error } = await supabase
      .from('scrapers')
      .update({ typescript_script: scriptContent })
      .eq('id', scraperId)
      .select('id, name');

    if (error) {
      logger.error(routeContext, `Error updating scraper: ${error.message}`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info(routeContext, `Successfully updated scraper ${scraperId}`);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error(routeContext, `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
