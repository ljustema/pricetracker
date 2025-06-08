import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperDataExtractionService } from "@/lib/services/scraper-data-extraction-service";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import { SiteAnalysisResult } from "@/lib/services/scraper-analysis-service";
import logger from "@/lib/utils/logger";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const routeContext = 'API:scrapers/ai/extract-data';
  logger.info(routeContext, 'Received data extraction request');

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request body
    let body: { sessionId: string; sampleUrls?: string[]; userFeedback?: string };
    try {
      body = await request.json();
    } catch (_error) {
      logger.warn(routeContext, 'Invalid request body: Malformed JSON');
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    const { sessionId, sampleUrls, userFeedback } = body;

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

    // 5. Check if the URL collection phase is complete
    if (!session_data.urlCollectionData || !session_data.urlCollectionData.approved) {
      logger.warn(routeContext, `URL collection phase not complete for session: ${sessionId}`);
      return NextResponse.json(
        { error: "URL collection phase must be completed and approved before data extraction" },
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
      productPages: session_data.analysisData?.productListingPages || [],
      apiEndpoints: apiEndpoints,
      proposedStrategy: session_data.analysisData.proposedStrategy as 'api' | 'scraping',
      strategyDescription: session_data.analysisData?.strategyDescription || '',
      htmlSample: '', // This is not needed for data extraction
      productSelectors: {
        listItem: '',
        name: '',
        price: '',
        imageUrl: '',
        link: ''
      }
    };

    // 7. Use provided sample URLs or get them from the session
    const urlsToUse = sampleUrls || session_data.urlCollectionData.sampleUrls || [];

    if (urlsToUse.length === 0) {
      logger.warn(routeContext, `No sample URLs available for session: ${sessionId}`);
      return NextResponse.json(
        { error: "No sample URLs available for data extraction" },
        { status: 400 }
      );
    }

    // 8. Generate data extraction code
    logger.info(routeContext, `Generating data extraction code for session: ${sessionId}`);
    const generatedCode = await ScraperDataExtractionService.generateDataExtractionCode(
      analysisResult,
      urlsToUse,
      userFeedback
    );

    // 9. Execute the data extraction code
    logger.info(routeContext, `Executing data extraction code for session: ${sessionId}`);
    const extractionResult = await ScraperDataExtractionService.executeDataExtractionCode(
      generatedCode,
      urlsToUse
    );

    // 10. Update the session with the data extraction results
    logger.info(routeContext, `Updating session ${sessionId} with data extraction results`);

    // Create an extraction ID for the record
    const extractionId = randomUUID();

    await ScraperSessionService.updateDataExtractionData(
      sessionId,
      extractionResult,
      extractionId
    );

    // 11. Return the data extraction results
    logger.info(routeContext, `Data extraction completed successfully for session: ${sessionId}`);
    return NextResponse.json({
      generatedCode: generatedCode,
      extractedProducts: extractionResult.products,
      executionLog: extractionResult.executionLog
    });
  } catch (error) {
    logger.error(routeContext, `Error in data extraction: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
