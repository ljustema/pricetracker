import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import logger from "@/lib/utils/logger";

// Type for the route parameters
type Params = {
  params: Promise<{
    sessionId: string;
  }>;
};

// POST handler to approve the data extraction phase
export async function POST(request: NextRequest, { params }: Params) {
  // Extract sessionId from params - using await for Next.js 15 compatibility
  const { sessionId } = await params;
  const routeContext = `API:scrapers/ai/sessions/${sessionId}/approve-data-extraction`;
  logger.info(routeContext, `Received request to approve data extraction for session: ${sessionId}`);

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body for user feedback
    let body: { userFeedback?: string } = {};
    try {
      body = await request.json();
    } catch (_error) {
      // If parsing fails, assume empty body
      logger.warn(routeContext, 'Failed to parse request body, assuming no feedback');
    }

    // 3. Get the session to check ownership
    logger.info(routeContext, `Getting session: ${sessionId}`);
    const sessionData = await ScraperSessionService.getSession(sessionId);

    if (!sessionData) {
      logger.warn(routeContext, `Session not found: ${sessionId}`);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // 4. Check if the session belongs to the user
    if (sessionData.userId !== session.user.id) {
      logger.warn(routeContext, `Unauthorized access to session: ${sessionId}`);
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 401 }
      );
    }

    // 5. Approve the data extraction data and advance to the next phase
    logger.info(routeContext, `Approving data extraction data for session: ${sessionId}`);
    const updatedSession = await ScraperSessionService.approveDataExtractionData(
      sessionId,
      body.userFeedback
    );

    // 6. Return the updated session
    logger.info(routeContext, `Data extraction approved successfully for session: ${sessionId}`);
    return NextResponse.json(updatedSession);
  } catch (error) {
    logger.error(routeContext, `Error approving data extraction: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
