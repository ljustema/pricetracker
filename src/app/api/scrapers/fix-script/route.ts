import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { validateAndFixScriptStructure } from "@/lib/services/scraper-validation-helper";

// Define expected request body structure
type FixScriptRequestBody = {
  scraper_type: 'typescript'; // Currently only supports TypeScript
  scriptContent: string;
};

/**
 * POST /api/scrapers/fix-script
 * Fixes common issues in scraper scripts to help them pass validation
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json() as FixScriptRequestBody;
    
    if (!body.scraper_type || body.scraper_type !== 'typescript') {
      return NextResponse.json({ error: "Currently only 'typescript' scripts are supported" }, { status: 400 });
    }
    
    if (!body.scriptContent || typeof body.scriptContent !== 'string' || body.scriptContent.trim() === '') {
      return NextResponse.json({ error: "Missing or empty 'scriptContent'" }, { status: 400 });
    }

    // 3. Apply fixes to the script
    console.log(`Fixing ${body.scraper_type} script...`);
    const { fixedScript, appliedFixes, isValid } = validateAndFixScriptStructure(body.scriptContent);

    // 4. Return the fixed script and list of applied fixes
    return NextResponse.json({
      fixedScript,
      appliedFixes,
      isValid,
      originalLength: body.scriptContent.length,
      fixedLength: fixedScript.length
    });
    
  } catch (error) {
    console.error("Error in POST /api/scrapers/fix-script:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
