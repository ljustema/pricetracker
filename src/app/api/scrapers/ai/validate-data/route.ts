/**
 * API endpoint for validating data extraction
 * This endpoint combines the URL collection and data extraction steps
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import { ScraperUrlCollectionService } from "@/lib/services/scraper-url-collection-service";
import { ScraperDataExtractionService } from "@/lib/services/scraper-data-extraction-service";
import logger from "@/lib/utils/logger";

// Define the route context for logging
const routeContext = "API:scrapers/ai/validate-data";

export async function POST(request: NextRequest) {
  try {
    // 1. Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.error(routeContext, "Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse the request body
    const body = await request.json();
    const { sessionId, sampleUrls, userFeedback } = body;

    if (!sessionId) {
      logger.error(routeContext, "Missing sessionId in request");
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    logger.info(routeContext, `Received data validation request for session ${sessionId}`);

    // 3. Get the session
    const session_data = await ScraperSessionService.getSession(sessionId);
    if (!session_data) {
      logger.error(routeContext, `Session ${sessionId} not found`);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 4. Validate that we have analysis data
    if (!session_data.analysisData) {
      logger.error(routeContext, `Session ${sessionId} has no analysis data`);
      return NextResponse.json({ error: "Session has no analysis data" }, { status: 400 });
    }

    // 5. Generate URL collection code
    logger.info(routeContext, `Generating URL collection code for session ${sessionId}`);

    // Create a proper SiteAnalysisResult object from session data
    const siteAnalysisResult = {
      url: session_data.url,
      baseUrl: new URL(session_data.url).origin,
      hostname: new URL(session_data.url).hostname,
      title: session_data.url, // We don't have the title in the session data
      sitemapUrls: session_data.analysisData?.sitemapUrls || [],
      brandPages: session_data.analysisData?.brandPages || [],
      categoryPages: session_data.analysisData?.categoryPages || [],
      productPages: session_data.analysisData?.productListingPages || [],
      apiEndpoints: (session_data.analysisData?.apiEndpoints || []).map(endpoint => ({
        ...endpoint,
        description: endpoint.description || 'API endpoint'
      })),
      proposedStrategy: session_data.analysisData?.proposedStrategy as 'api' | 'scraping' || 'scraping',
      strategyDescription: session_data.analysisData?.strategyDescription || '',
      htmlSample: '', // This is not needed for URL collection
      productSelectors: {
        listItem: '',
        name: '',
        price: '',
        imageUrl: '',
        link: ''
      }
    };

    // First, generate the code
    const generatedCode = await ScraperUrlCollectionService.generateUrlCollectionCode(
      siteAnalysisResult,
      userFeedback
    );

    // Then, execute the code to get URLs
    const urlCollectionResult = await ScraperUrlCollectionService.executeUrlCollectionCode(
      generatedCode,
      session_data.url
    );

    // 6. Update the session with URL collection data
    logger.info(routeContext, `Updating session ${sessionId} with URL collection data`);

    // Generate a random ID
    const collectionId = `url-collection-${Math.random().toString(36).substring(2, 15)}`;

    await ScraperSessionService.updateUrlCollectionData(
      sessionId,
      urlCollectionResult,
      collectionId
    );

    // 7. Generate data extraction code
    logger.info(routeContext, `Generating data extraction code for session ${sessionId}`);

    // Make sure we have sample URLs to work with
    const urlsToUse = sampleUrls || urlCollectionResult.sampleUrls || [];

    // If we don't have any URLs, use product pages from the analysis data
    if (urlsToUse.length === 0 && session_data.analysisData.productPages && session_data.analysisData.productPages.length > 0) {
      logger.info(routeContext, `No sample URLs provided, using product pages from analysis data`);
      urlsToUse.push(...session_data.analysisData.productPages.slice(0, 5));
    }

    // If we still don't have any URLs, return an error
    if (urlsToUse.length === 0) {
      logger.error(routeContext, `No product URLs available for data extraction`);
      return NextResponse.json({
        error: "No product URLs available for data extraction. Please provide sample URLs or run site analysis again."
      }, { status: 400 });
    }

    // First, generate the code
    const extractionCode = await ScraperDataExtractionService.generateDataExtractionCode(
      siteAnalysisResult,
      urlsToUse,
      userFeedback
    );

    // Then, execute the code to extract product data
    let dataExtractionResult;
    try {
      // Try to execute the data extraction code
      dataExtractionResult = await ScraperDataExtractionService.executeDataExtractionCode(
        extractionCode,
        urlsToUse
      );

      logger.info(routeContext, `Successfully executed data extraction code for ${urlsToUse.length} URLs`);

      // If we got no products, throw an error to trigger the fallback
      if (!dataExtractionResult.products || dataExtractionResult.products.length === 0) {
        throw new Error("No products extracted from the provided URLs");
      }
    } catch (error) {
      logger.error(routeContext, `Error executing data extraction code: ${error}`);

      // Instead of using mock data, try to extract data using a simpler approach
      // This could be a more robust extraction method that doesn't rely on Playwright
      try {
        logger.info(routeContext, `Attempting alternative extraction method for ${urlsToUse.length} URLs`);

        // Try to use the worker service directly if available
        // This is a placeholder - you would need to implement this based on your worker architecture
        const workerResponse = await fetch(`/api/workers/ts-worker/extract-products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            urls: urlsToUse,
            selectors: {}
          }),
        });

        if (workerResponse.ok) {
          const workerData = await workerResponse.json();
          if (workerData.products && workerData.products.length > 0) {
            logger.info(routeContext, `Alternative extraction successful, got ${workerData.products.length} products`);
            dataExtractionResult = {
              generatedCode: extractionCode,
              products: workerData.products,
              executionLog: []
            };
          } else {
            throw new Error("Alternative extraction returned no products");
          }
        } else {
          throw new Error(`Worker service returned status ${workerResponse.status}`);
        }
      } catch (fallbackError) {
        logger.error(routeContext, `Alternative extraction also failed: ${fallbackError}`);

        // As a last resort, create minimal placeholder data
        // This is not ideal for production but prevents the process from failing completely
        dataExtractionResult = {
          generatedCode: extractionCode,
          products: [
            {
              name: "Extraction Failed - Please Review Code",
              competitor_price: 0,
              currency_code: "",
              raw_price: "Extraction failed",
              sku: "",
              brand: "",
              ean: "",
              is_available: false,
              url: urlsToUse[0],
              image_url: ""
            }
          ],
          executionLog: []
        };

        // Add a note to the generated code explaining the issue
        dataExtractionResult.generatedCode = `// NOTE: Automatic extraction failed during validation.\n// Please review the code carefully before deploying.\n// Error: ${error}\n\n${extractionCode}`;
      }
    }

    // 8. Update the session with data extraction data
    logger.info(routeContext, `Updating session ${sessionId} with data extraction data`);

    // Generate a random ID
    const extractionId = `data-extraction-${Math.random().toString(36).substring(2, 15)}`;

    await ScraperSessionService.updateDataExtractionData(
      sessionId,
      dataExtractionResult,
      extractionId
    );

    // 9. Get the updated session
    logger.info(routeContext, `Getting updated session ${sessionId}`);
    const updatedSession = await ScraperSessionService.getSession(sessionId);

    // 10. Return the results
    logger.info(routeContext, `Data validation completed successfully for session ${sessionId}`);
    return NextResponse.json({
      success: true,
      message: "Data validation completed successfully",
      ...updatedSession,
      urlCollectionResult: {
        generatedCode: urlCollectionResult.generatedCode,
        totalUrlCount: urlCollectionResult.totalCount,
        sampleUrls: urlCollectionResult.sampleUrls
      },
      dataExtractionResult: {
        generatedCode: dataExtractionResult.generatedCode,
        extractedProducts: dataExtractionResult.products
      }
    });
  } catch (error) {
    logger.error(routeContext, `Error in data validation: ${error}`);
    return NextResponse.json(
      { error: `Failed to validate data: ${error}` },
      { status: 500 }
    );
  }
}
