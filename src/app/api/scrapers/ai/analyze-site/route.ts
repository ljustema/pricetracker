import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperAnalysisService } from "@/lib/services/scraper-analysis-service";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import logger from "@/lib/utils/logger";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Helper function to ensure user ID is a valid UUID
function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }

  // If not a UUID, create a deterministic UUID v5 from the ID
  return randomUUID();
}

export async function POST(request: NextRequest) {
  const routeContext = 'API:scrapers/ai/analyze-site';
  logger.info(routeContext, 'Received site analysis request');

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);

    // 2. Parse and validate request body
    let body: {
      url: string;
      competitorId: string;
      sitemapUrl?: string;
      categoryPageUrl?: string;
      productPageUrl?: string;
    };
    try {
      body = await request.json();
    } catch (_error) {
      logger.warn(routeContext, 'Invalid request body: Malformed JSON');
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    const { url, competitorId, sitemapUrl, categoryPageUrl, productPageUrl } = body;

    if (!url || !competitorId) {
      logger.warn(routeContext, 'Missing required fields: url, competitorId');
      return NextResponse.json(
        { error: "Missing required fields: url, competitorId" },
        { status: 400 }
      );
    }

    // 3. Create a new session for this scraper generation process
    logger.info(routeContext, `Creating new session for URL: ${url}, competitorId: ${competitorId}`);
    const sessionData = await ScraperSessionService.createSession(userId, competitorId, url);
    const sessionId = sessionData.id;
    logger.info(routeContext, `Created session with ID: ${sessionId}`);

    // 4. Analyze the site
    logger.info(routeContext, `Analyzing site: ${url}`);

    // Log additional URLs if provided
    if (sitemapUrl) logger.info(routeContext, `Using provided sitemap URL: ${sitemapUrl}`);
    if (categoryPageUrl) logger.info(routeContext, `Using provided category page URL: ${categoryPageUrl}`);
    if (productPageUrl) logger.info(routeContext, `Using provided product page URL: ${productPageUrl}`);

    // Pass additional URLs to the analysis service
    const analysisResult = await ScraperAnalysisService.analyzeSite(
      url,
      userId,
      competitorId,
      {
        sitemapUrl,
        categoryPageUrl,
        productPageUrl
      }
    );

    // 5. Update the session with the analysis results
    logger.info(routeContext, `Updating session ${sessionId} with analysis results`);

    // Create an analysis ID for the record
    const analysisId = randomUUID();

    // Create analysis data object
    const analysisData = {
      analysisId,
      sitemapUrls: analysisResult.sitemapUrls,
      brandPages: analysisResult.brandPages,
      categoryPages: analysisResult.categoryPages,
      productListingPages: analysisResult.productPages, // Use the new field name
      productPages: analysisResult.productPages, // Also include with the new field name
      apiEndpoints: analysisResult.apiEndpoints,
      proposedStrategy: analysisResult.proposedStrategy,
      strategyDescription: analysisResult.strategyDescription,
      htmlSample: analysisResult.htmlSample,
      productSelectors: analysisResult.productSelectors,
      approved: false
    };

    // Update the session in the database
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('scraper_ai_sessions')
      .update({
        analysis_data: analysisData,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    // 6. Return the session ID and analysis results
    logger.info(routeContext, `Site analysis completed successfully for ${url}`);
    return NextResponse.json({
      sessionId: sessionId, // Ensure this is a string, not an object
      analysisData: {
        sitemapUrls: analysisResult.sitemapUrls,
        brandPages: analysisResult.brandPages,
        categoryPages: analysisResult.categoryPages,
        productListingPages: analysisResult.productPages, // Use the new field name
        productPages: analysisResult.productPages, // Also include with the new field name
        apiEndpoints: analysisResult.apiEndpoints,
        proposedStrategy: analysisResult.proposedStrategy,
        strategyDescription: analysisResult.strategyDescription,
        productSelectors: analysisResult.productSelectors
      }
    });
  } catch (error) {
    logger.error(routeContext, `Error in site analysis: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
