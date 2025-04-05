import { NextRequest, NextResponse } from 'next/server';
import { ScraperMetadata } from '@/lib/services/scraper-types'; // Import the type
import { ScraperService } from "@/lib/services/scraper-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import crypto from 'crypto';
import { createSupabaseAdminClient } from "@/lib/supabase/server";
// Remove unused imports: fs, path, randomUUID, os
// import fs from 'fs';
// import path from 'path';
// import { randomUUID } from 'crypto';
// import os from 'os';
import { exec } from 'child_process'; // Keep exec as it's used by _execPromise
import util from 'util';

const _execPromise = util.promisify(exec); // Prefix unused variable

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
    const data = await req.json();
    const scraperType = data.scraper_type || 'python'; // Get type, default to python
    const scriptContent = scraperType === 'python' ? data.python_script : data.typescript_script;

    // Validate required fields
    // Remove !data.url check, as URL might be derived from metadata later or be optional initially
    if (!data.competitor_id || !scriptContent || !data.schedule) {
      return NextResponse.json(
        { error: "Missing required fields (competitor_id, script content, schedule)" },
        { status: 400 }
      );
    }

    // Create the Python scraper using the admin client to bypass RLS
    const supabase = createSupabaseAdminClient();
    
    const now = new Date().toISOString();
    let scriptMetadata: ScraperMetadata | null = null;
    let targetUrl = data.url; // Default to provided URL

    if (scraperType === 'python') {
        // --- Python Specific Validation & Metadata Extraction ---
        // Validate structure first
        const validationResult = await ScraperService.validatePythonScraper(scriptContent);
        if (!validationResult.valid || validationResult.error) {
            return NextResponse.json(
                { error: `Invalid Python script: ${validationResult.error || 'Structure validation failed.'}` },
                { status: 400 }
            );
        }
        // If structure is valid, use metadata from validation
        scriptMetadata = validationResult.metadata ?? null;
        // Use target_url from metadata if available
        targetUrl = scriptMetadata?.target_url || data.url;

    } else if (scraperType === 'crawlee') {
        // --- Crawlee Specific Setup ---
        // Skip Python validation. Metadata might come from validation step later,
        // or use placeholders for now.
        scriptMetadata = { // Placeholder metadata for Crawlee
             name: 'Crawlee Scraper (TS)', description: 'A Crawlee/TypeScript scraper', version: '1.0.0',
             author: 'User', target_url: data.url, required_libraries: []
        };
        targetUrl = data.url; // Use provided URL for Crawlee
        console.log("Creating Crawlee scraper, skipping Python validation/metadata extraction.");
    } else {
         return NextResponse.json({ error: "Invalid scraper_type specified" }, { status: 400 });
    }

    // Ensure metadata is not null before proceeding (use default if Python extraction failed)
     if (!scriptMetadata) {
       scriptMetadata = {
         name: scraperType === 'python' ? 'Unknown Python Scraper' : 'Unknown Crawlee Scraper',
         description: `A ${scraperType} scraper`,
         version: '1.0.0', author: 'Unknown', target_url: targetUrl, required_libraries: [],
       };
     }
    
    // Get competitor name for the naming convention
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .select('name')
      .eq('id', data.competitor_id)
      .single();
    
    if (competitorError) {
      throw new Error(`Failed to get competitor: ${competitorError.message}`);
    }
    
    // Check if a scraper with a similar name already exists
    const typeSuffix = scraperType === 'python' ? 'Python' : 'Crawlee';
    const baseScraperName = `${competitor.name} ${typeSuffix} Scraper`;
    const { data: existingScrapers, error: existingScrapersError } = await supabase
      .from('scrapers')
      .select('name')
      .eq('competitor_id', data.competitor_id)
      .ilike('name', `${baseScraperName}%`)
      .order('name', { ascending: true });
    
    if (existingScrapersError) {
      throw new Error(`Failed to check existing scrapers: ${existingScrapersError.message}`);
    }
    
    // Find the highest number used in existing scraper names
    let highestNumber = 0;
    for (const scraper of existingScrapers) {
      const match = scraper.name.match(new RegExp(`${baseScraperName} (\\d+)`));
      if (match && match[1]) {
        const number = parseInt(match[1], 10);
        if (number > highestNumber) {
          highestNumber = number;
        }
      }
    }
    
    // Generate scraper name with the next available number
    const scraperName = `${baseScraperName} ${highestNumber + 1}`;
    
    const scraperConfig = {
      user_id: userId,
      competitor_id: data.competitor_id,
      name: scraperName, // Use the generated name following the convention
      url: targetUrl, // Use the synchronized URL
      scraper_type: scraperType, // Use dynamic type
      python_script: scraperType === 'python' ? scriptContent : null, // Assign to correct field
      typescript_script: scraperType === 'crawlee' ? scriptContent : null, // Assign to correct field
      script_metadata: scriptMetadata, // Use extracted or placeholder metadata
      // Add empty selectors object since the database might require it
      selectors: {}, // Empty object for Python scrapers since they don't use selectors
      schedule: data.schedule,
      is_active: false, // Default to inactive until tested and approved
      is_approved: false, // Default to not approved until tested
      created_at: now,
      updated_at: now,
      status: 'idle' as const,
    };
    
    const { data: scraper, error } = await supabase
      .from('scrapers')
      .insert(scraperConfig)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create scraper: ${error.message}`);
    }

    return NextResponse.json(scraper);
  } catch (error) {
    console.error("Error creating Python scraper:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}