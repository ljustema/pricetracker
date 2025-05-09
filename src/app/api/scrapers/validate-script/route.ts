import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperExecutionService } from "@/lib/services/scraper-execution-service"; // Import the service
import { ValidationResponse } from "@/lib/services/scraper-types"; // Import shared types

// Define expected request body structure
type ValidateScriptRequestBody = {
  scraper_type: 'python' | 'typescript'; // Enforce specific types
  scriptContent: string;
  // Add other potential context flags if needed for validation later
  // filter_by_active_brands?: boolean;
  // scrape_only_own_products?: boolean;
};

// Note: ValidationProduct and ValidationLog interfaces are now imported from scraper-types.ts
// Note: ValidationResponse type is now imported from scraper-types.ts

export async function POST(req: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // const userId = session.user.id; // Store if needed for context later

    // 2. Parse and validate request body
    let body: ValidateScriptRequestBody;
    try {
      body = await req.json();
    } catch (_parseError) { // Prefix unused variable with underscore
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    const { scraper_type, scriptContent } = body;

    if (!scraper_type || (scraper_type !== 'python' && scraper_type !== 'typescript')) {
      return NextResponse.json({ error: "Missing or invalid 'scraper_type' (must be 'python' or 'typescript')" }, { status: 400 });
    }
    if (!scriptContent || typeof scriptContent !== 'string' || scriptContent.trim() === '') {
      return NextResponse.json({ error: "Missing or empty 'scriptContent'" }, { status: 400 });
    }

    // 3. Call the synchronous validation service
    console.log(`Calling validation service for ${scraper_type} script...`);
    const validationResult: ValidationResponse = await ScraperExecutionService.validateScriptSynchronously(
      scraper_type,
      scriptContent
      // Pass context flags here if implemented in the service method
    );
    console.log(`Validation service returned: valid=${validationResult.valid}, error=${validationResult.error}`);

    // 4. Return the validation result from the service
    return NextResponse.json(validationResult);

  } catch (error) {
    console.error("Error in POST /api/scrapers/validate-script:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred during validation request.";
    // Ensure the response adheres to ValidationResponse structure even on errors
    const errorResponse: ValidationResponse = {
        valid: false,
        error: `API Error: ${errorMessage}`,
        products: [],
        logs: [{
            ts: new Date().toISOString(),
            lvl: "ERROR",
            phase: "API_HANDLER",
            msg: `Unhandled exception in API route: ${errorMessage}`,
            data: error instanceof Error ? { stack: error.stack } : undefined
        }]
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}