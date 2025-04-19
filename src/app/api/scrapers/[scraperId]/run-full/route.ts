import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperExecutionService } from "@/lib/services/scraper-execution-service";
import logger from "@/lib/utils/logger";

// In Next.js App Router, the params are passed as a Promise
type Params = {
  params: Promise<{
    scraperId: string;
  }>;
};

export async function POST(req: NextRequest, context: Params) {
  const routeContext = 'API:scrapers/[scraperId]/run-full';
  logger.info(routeContext, 'Received scraper full run request');
  
  try {
    // Check authentication
    logger.debug(routeContext, 'Verifying authentication');
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    logger.debug(routeContext, `User authenticated: ${userId}`);

    // In Next.js App Router, we need to await the params
    logger.debug(routeContext, 'Awaiting params from context');
    const params = await context.params;
    const { scraperId } = params;
    logger.info(routeContext, `Processing full run for scraper ID: ${scraperId}`);
    
    if (!scraperId) {
      logger.warn(routeContext, 'Missing scraperId in request');
      return NextResponse.json({ error: "Scraper ID is required" }, { status: 400 });
    }
    
    // Use the runScraper method with isTestRun=false flag
    logger.info(routeContext, `Initiating full run for scraper ${scraperId}`);
    const { runId } = await ScraperExecutionService.runScraper(scraperId, undefined, false);
    
    // Log the runId for debugging
    logger.info(routeContext, `Started full run for scraper ${scraperId} with runId ${runId}`);
    
    // Return 202 Accepted with the runId for polling
    return NextResponse.json({ 
      success: true,
      message: "Scraper run initiated successfully.",
      runId 
    }, { status: 202 });
  } catch (error) {
    logger.error(routeContext, `Error starting scraper full run: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
