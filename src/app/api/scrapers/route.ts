import { NextRequest, NextResponse } from 'next/server';
import { ScraperMetadata } from '@/lib/services/scraper-types';
// Import ScraperCreationService directly for static validation
import { ScraperCreationService } from "@/lib/services/scraper-creation-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import crypto from 'crypto';
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Define expected request body structure
type CreateScraperRequestBody = {
  competitor_id: string;
  schedule: string;
  scraper_type: 'python' | 'typescript';
  python_script?: string;
  typescript_script?: string;
  url?: string; // Optional initial URL, might be derived from metadata
  filter_by_active_brands?: boolean;
  scrape_only_own_products?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure the user ID is in UUID format for consistent handling
    const ensureUUID = (id: string): string => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        return id;
      }
      return crypto.createHash('md5').update(id).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    };

    const userId = ensureUUID(session.user.id);

    // 2. Parse and validate request body
    let data: CreateScraperRequestBody;
    try {
      data = await req.json();
    } catch (_parseError) { // Prefix unused variable with underscore
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    const {
      competitor_id,
      schedule,
      scraper_type,
      python_script,
      typescript_script,
      url, // Optional initial URL
      filter_by_active_brands = false, // Default to false
      scrape_only_own_products = false, // Default to false
    } = data;

    const scriptContent = scraper_type === 'python' ? python_script : typescript_script;

    // Basic validation
    if (!competitor_id || !schedule || !scraper_type || !scriptContent) {
      return NextResponse.json(
        { error: "Missing required fields (competitor_id, schedule, scraper_type, scriptContent)" },
        { status: 400 }
      );
    }
    if (scraper_type !== 'python' && scraper_type !== 'typescript') {
       return NextResponse.json({ error: "Invalid scraper_type (must be 'python' or 'typescript')" }, { status: 400 });
    }

    // 3. Perform static validation and metadata extraction (if applicable)
    const supabase = createSupabaseAdminClient();
    let scriptMetadata: ScraperMetadata | null = null;
    let targetUrl = url; // Default to provided URL

    if (scraper_type === 'python') {
        // Perform static structure validation using the method directly from ScraperCreationService
        const staticValidationResult = ScraperCreationService.validatePythonScriptStructure(scriptContent);
        if (!staticValidationResult.valid) {
            return NextResponse.json(
                { error: `Invalid Python script structure: ${staticValidationResult.error}` },
                { status: 400 }
            );
        }
        // Try to extract metadata from script if possible
        const urlMatch = scriptContent.match(/target_url\s*[:=]\s*["']([^"']+)["']/);
        if (urlMatch && urlMatch[1]) {
          targetUrl = urlMatch[1];
        }
        scriptMetadata = {
             name: 'Python Scraper (Metadata Pending)', description: 'Metadata to be extracted during validation/run', version: '1.0.0',
             author: 'User', target_url: targetUrl || url || '', required_libraries: []
        };
        targetUrl = scriptMetadata?.target_url || url; // Use metadata URL if available

    } else if (scraper_type === 'typescript') {
        // TODO: Add basic static validation for TS (e.g., check for required functions)
        // Example: if (!scriptContent.includes("async function getMetadata():") || ...) return error;

        // Placeholder metadata for TypeScript/Crawlee until dynamic extraction is implemented
        scriptMetadata = {
             name: 'TypeScript Scraper', description: 'A TypeScript scraper', version: '1.0.0',
             author: 'User', target_url: url || '', required_libraries: [] // TS deps managed by npm/package.json
        };
        targetUrl = url; // Use provided URL for TS
        console.log("Creating TypeScript scraper, using placeholder metadata.");
    }

    // Ensure metadata is not null before proceeding
     if (!scriptMetadata) {
       scriptMetadata = {
         name: scraper_type === 'python' ? 'Unknown Python Scraper' : 'Unknown TypeScript Scraper',
         description: `A ${scraper_type} scraper`,
         version: '1.0.0', author: 'Unknown', target_url: targetUrl || '', required_libraries: [],
       };
     }

    // 4. Generate scraper name
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .select('name')
      .eq('id', competitor_id)
      .single();

    if (competitorError || !competitor) {
      console.error("Failed to get competitor:", competitorError);
      return NextResponse.json({ error: "Failed to find competitor for naming." }, { status: 404 });
    }

    const typeSuffix = scraper_type === 'python' ? 'Python' : 'TypeScript';
    const baseScraperName = `${competitor.name} ${typeSuffix} Scraper`;
    const { data: existingScrapers, error: existingScrapersError } = await supabase
      .from('scrapers')
      .select('name')
      .eq('competitor_id', competitor_id)
      .eq('scraper_type', scraper_type) // Check only for the same type
      .ilike('name', `${baseScraperName}%`)
      .order('name', { ascending: true });

    if (existingScrapersError) {
      console.error("Failed to check existing scrapers:", existingScrapersError);
      return NextResponse.json({ error: "Database error checking existing scrapers." }, { status: 500 });
    }

    let highestNumber = 0;
    for (const scraper of existingScrapers || []) {
      const match = scraper.name.match(new RegExp(`${baseScraperName} (\\d+)`));
      if (match && match[1]) {
        const number = parseInt(match[1], 10);
        if (number > highestNumber) {
          highestNumber = number;
        }
      }
    }
    const scraperName = `${baseScraperName} ${highestNumber + 1}`;

    // 5. Create scraper record in DB
    const now = new Date().toISOString();
    const scraperConfig = {
      user_id: userId,
      competitor_id: competitor_id,
      name: scraperName,
      url: targetUrl, // Use potentially updated URL from metadata
      scraper_type: scraper_type,
      python_script: scraper_type === 'python' ? scriptContent : null,
      typescript_script: scraper_type === 'typescript' ? scriptContent : null,
      script_metadata: scriptMetadata,
      schedule: schedule,
      is_active: false,
      is_approved: false,
      created_at: now,
      updated_at: now,
      status: 'idle' as const,
      filter_by_active_brands: filter_by_active_brands, // Save new flag
      scrape_only_own_products: scrape_only_own_products, // Save new flag
    };

    const { data: newScraper, error: insertError } = await supabase
      .from('scrapers')
      .insert(scraperConfig)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create scraper:", insertError);
      // Provide more specific feedback if possible (e.g., unique constraint violation)
      if (insertError.code === '23505') { // Check for unique violation code
           return NextResponse.json({ error: `Failed to create scraper: A scraper with a similar configuration might already exist. Details: ${insertError.message}` }, { status: 409 }); // 409 Conflict
      }
      return NextResponse.json({ error: `Failed to create scraper: ${insertError.message}` }, { status: 500 });
    }

    console.log(`Successfully created ${scraper_type} scraper: ${newScraper.id} - ${scraperName}`);
    return NextResponse.json(newScraper);

  } catch (error) {
    console.error("Error creating scraper:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}