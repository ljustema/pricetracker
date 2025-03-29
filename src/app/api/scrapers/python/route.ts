import { NextRequest, NextResponse } from "next/server";
import { ScraperService } from "@/lib/services/scraper-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import crypto from 'crypto';
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

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
    
    // Validate required fields
    if (!data.competitor_id || !data.url || !data.python_script || !data.schedule) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create the Python scraper using the admin client to bypass RLS
    const supabase = createSupabaseAdminClient();
    
    const now = new Date().toISOString();
    // We need to extract the actual metadata from the script by executing it
    // Create a temporary directory for the script
    const tempDir = path.join(os.tmpdir(), "pricetracker-" + randomUUID());
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Write the script to a temporary file
    const scriptPath = path.join(tempDir, "script.py");
    fs.writeFileSync(scriptPath, data.python_script);
    
    // Execute the metadata command to get the script metadata
    const pythonCommands = ['python', 'python3', 'py'];
    let scriptMetadata = null;
    
    for (const cmd of pythonCommands) {
      try {
        const result = await execPromise(`${cmd} -c "import sys; sys.stdout.reconfigure(encoding='utf-8'); exec(open('${scriptPath.replace(/\\/g, '\\\\')}', encoding='utf-8').read())" metadata`, { encoding: 'utf-8' });
        const metadataOutput = result.stdout.trim();
        scriptMetadata = JSON.parse(metadataOutput);
        break;
      } catch (_error) {
        // Try the next command if this one fails
        continue;
      }
    }
    
    // Clean up the temporary files
    try {
      fs.unlinkSync(scriptPath);
      fs.rmdirSync(tempDir, { recursive: true });
    } catch (error) {
      console.error("Error cleaning up temporary files:", error);
    }
    
    // If we couldn't extract the metadata, use a default object
    if (!scriptMetadata) {
      scriptMetadata = {
        name: 'Unknown Scraper',
        description: 'A Python scraper',
        version: '1.0.0',
        author: 'Unknown',
        target_url: '',
        required_libraries: [],
      };
    }
    
    // Use target_url from metadata if available, otherwise use the provided URL
    // This ensures synchronization between metadata and the database URL
    const targetUrl = scriptMetadata.target_url || data.url;
    
    // Also validate the script structure
    const validationResult = await ScraperService.validatePythonScraper(data.python_script);
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: `Invalid Python script: ${validationResult.error}` },
        { status: 400 }
      );
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
    const baseScraperName = `${competitor.name} Python Scraper`;
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
      scraper_type: 'python' as const,
      python_script: data.python_script,
      script_metadata: scriptMetadata, // Use the actual metadata extracted from the script
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