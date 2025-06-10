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

export async function POST(_req: NextRequest, context: Params) {
  const routeContext = 'API:scrapers/[scraperId]/run-test';
  logger.info(routeContext, 'Received scraper test run request');
  
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
    logger.info(routeContext, `Processing test run for scraper ID: ${scraperId}`);
    
    if (!scraperId) {
      logger.warn(routeContext, 'Missing scraperId in request');
      return NextResponse.json({ error: "Scraper ID is required" }, { status: 400 });
    }
    
    // Use the runScraper method with isTestRun=true flag
    logger.info(routeContext, `Initiating test run for scraper ${scraperId}`);
    const { runId } = await ScraperExecutionService.runScraper(scraperId, undefined, true);
    
    // Log the runId for debugging
    logger.info(routeContext, `Started test run for scraper ${scraperId} with runId ${runId}`);
    
    // Return 202 Accepted with the runId for polling
    return NextResponse.json({ runId }, { status: 202 });
  } catch (error) {
    logger.error(routeContext, `Error starting scraper test run: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
