import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperAssemblyService } from "@/lib/services/scraper-assembly-service";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import { SiteAnalysisResult } from "@/lib/services/scraper-analysis-service";
import { UrlCollectionResult } from "@/lib/services/scraper-url-collection-service";
import { DataExtractionResult } from "@/lib/services/scraper-data-extraction-service";
import logger from "@/lib/utils/logger";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const routeContext = 'API:scrapers/ai/assemble-script';
  logger.info(routeContext, 'Received script assembly request');

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request body
    let body: { sessionId: string; createScraper?: boolean };
    try {
      body = await request.json();
    } catch (_error) {
      logger.warn(routeContext, 'Invalid request body: Malformed JSON');
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    const { sessionId, createScraper = false } = body;

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

    // 5. Check if the data extraction phase is complete
    if (!session_data.dataExtractionData || !session_data.dataExtractionData.approved) {
      logger.warn(routeContext, `Data extraction phase not complete for session: ${sessionId}`);
      return NextResponse.json(
        { error: "Data extraction phase must be completed and approved before script assembly" },
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
      htmlSample: '', // This is not needed for assembly
      productSelectors: {
        listItem: '',
        name: '',
        price: '',
        image: '',
        link: ''
      }
    };

    // 7. Assemble the script
    logger.info(routeContext, `Assembling script for session: ${sessionId}`);

    // Create mock UrlCollectionResult and DataExtractionResult objects
    const urlCollectionResult: UrlCollectionResult = {
      urls: session_data.urlCollectionData?.collectedUrls || [],
      totalCount: session_data.urlCollectionData?.totalUrlCount || 0,
      sampleUrls: session_data.urlCollectionData?.sampleUrls || [],
      executionLog: [],
      generatedCode: session_data.urlCollectionData?.generatedCode || ''
    };

    const dataExtractionResult: DataExtractionResult = {
      products: session_data.dataExtractionData?.extractedProducts || [],
      executionLog: [],
      generatedCode: session_data.dataExtractionData?.generatedCode || ''
    };

    const assemblyResult = await ScraperAssemblyService.assembleScript(
      analysisResult,
      urlCollectionResult,
      dataExtractionResult,
      session_data.competitorId,
      session_data.userId
    );

    // 8. Validate the assembled script
    logger.info(routeContext, `Validating assembled script for session: ${sessionId}`);
    const validationResult = await ScraperAssemblyService.validateScript(assemblyResult.assembledScript);

    // 9. Create a scraper if requested and validation passed
    let scraperId: string | undefined;
    if (createScraper && validationResult.valid) {
      logger.info(routeContext, `Creating scraper for session: ${sessionId}`);
      scraperId = await ScraperAssemblyService.storeAssembledScript(
        assemblyResult.assembledScript,
        analysisResult,
        session_data.userId,
        session_data.competitorId
      );
    }

    // 10. Update the session with the assembly results
    logger.info(routeContext, `Updating session ${sessionId} with assembly results`);

    // Create an assembly ID for the record
    const assemblyId = randomUUID();

    // Create a script assembly result object
    const scriptAssemblyResult = {
      assembledScript: assemblyResult.assembledScript,
      validationResult: validationResult,
      scraperId: scraperId
    };

    await ScraperSessionService.updateAssemblyData(
      sessionId,
      scriptAssemblyResult,
      assemblyId
    );

    // 11. Return the assembly results
    logger.info(routeContext, `Script assembly completed successfully for session: ${sessionId}`);
    return NextResponse.json({
      assembledScript: assemblyResult.assembledScript,
      validationResult: validationResult,
      scraperId: scraperId
    });
  } catch (error) {
    logger.error(routeContext, `Error in script assembly: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
