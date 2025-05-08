import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperUrlCollectionService } from "@/lib/services/scraper-url-collection-service";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import { SiteAnalysisResult } from "@/lib/services/scraper-analysis-service";
import logger from "@/lib/utils/logger";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const routeContext = 'API:scrapers/ai/collect-urls';
  logger.info(routeContext, 'Received URL collection request');

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request body
    let body: { sessionId: string; strategy?: string; userFeedback?: string };
    try {
      body = await request.json();
    } catch (_error) {
      logger.warn(routeContext, 'Invalid request body: Malformed JSON');
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    const { sessionId, strategy, userFeedback } = body;

    if (!sessionId) {
      logger.warn(routeContext, 'Missing required field: sessionId');
      return NextResponse.json(
        { error: "Missing required field: sessionId" },
        { status: 400 }
      );
    }

    // 3. Get the session data
    logger.info(routeContext, `Getting session data for sessionId: ${sessionId}`);
    const session_data = await ScraperSessionService.getSession(sessionId);

    if (!session_data) {
      logger.warn(routeContext, `Session not found: ${sessionId}`);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // 4. Check if the session belongs to the user
    if (session_data.userId !== session.user.id) {
      logger.warn(routeContext, `Unauthorized access to session: ${sessionId}`);
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 401 }
      );
    }

    // 5. Check if the analysis phase is complete
    if (!session_data.analysisData || !session_data.analysisData.approved) {
      logger.warn(routeContext, `Analysis phase not complete for session: ${sessionId}`);
      return NextResponse.json(
        { error: "Analysis phase must be completed and approved before URL collection" },
        { status: 400 }
      );
    }

    // 6. Create a site analysis result object from the session data
    // Ensure we have valid data for the required fields
    if (!session_data.analysisData?.proposedStrategy) {
      logger.warn(routeContext, `Missing required analysis data for session: ${sessionId}`);
      return NextResponse.json(
        { error: "Missing required analysis data. Please complete the analysis phase first." },
        { status: 400 }
      );
    }

    // Create a properly typed ApiEndpointInfo array
    const apiEndpoints = (session_data.analysisData?.apiEndpoints || []).map(endpoint => ({
      url: endpoint.url,
      method: endpoint.method,
      parameters: endpoint.parameters,
      headers: endpoint.headers,
      description: endpoint.description || 'API endpoint',
      isProductList: endpoint.isProductList,
      isProductDetail: endpoint.isProductDetail
    }));

    const analysisResult: SiteAnalysisResult = {
      url: session_data.url,
      baseUrl: new URL(session_data.url).origin,
      hostname: new URL(session_data.url).hostname,
      title: session_data.url, // We don't have the title in the session data
      sitemapUrls: session_data.analysisData?.sitemapUrls || [],
      brandPages: session_data.analysisData?.brandPages || [],
      categoryPages: session_data.analysisData?.categoryPages || [],
      productListingPages: session_data.analysisData?.productListingPages || [],
      apiEndpoints: apiEndpoints,
      proposedStrategy: session_data.analysisData.proposedStrategy as 'api' | 'scraping',
      strategyDescription: session_data.analysisData?.strategyDescription || '',
      htmlSample: '', // This is not needed for URL collection
      productSelectors: {
        listItem: '',
        name: '',
        price: '',
        image: '',
        link: ''
      }
    };

    // 7. Generate URL collection code
    logger.info(routeContext, `Generating URL collection code for session: ${sessionId}`);

    // Combine strategy and user feedback if both are provided
    const combinedFeedback = userFeedback
      ? `${strategy ? 'Strategy: ' + strategy + '. ' : ''}User feedback: ${userFeedback}`
      : strategy;

    const generatedCode = await ScraperUrlCollectionService.generateUrlCollectionCode(
      analysisResult,
      combinedFeedback
    );

    // 8. Execute the URL collection code
    logger.info(routeContext, `Executing URL collection code for session: ${sessionId}`);
    const collectionResult = await ScraperUrlCollectionService.executeUrlCollectionCode(
      generatedCode,
      session_data.url
    );

    // 9. Update the session with the URL collection results
    logger.info(routeContext, `Updating session ${sessionId} with URL collection results`);

    // Create a collection ID for the record
    const collectionId = randomUUID();

    await ScraperSessionService.updateUrlCollectionData(
      sessionId,
      collectionResult,
      collectionId
    );

    // 10. Return the URL collection results
    logger.info(routeContext, `URL collection completed successfully for session: ${sessionId}`);
    return NextResponse.json({
      generatedCode: generatedCode,
      collectedUrls: collectionResult.sampleUrls,
      totalUrlCount: collectionResult.totalCount,
      executionLog: collectionResult.executionLog
    });
  } catch (error) {
    logger.error(routeContext, `Error in URL collection: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
