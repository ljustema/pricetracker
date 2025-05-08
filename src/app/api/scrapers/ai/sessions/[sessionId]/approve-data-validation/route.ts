/**
 * API endpoint for approving data validation
 * This endpoint approves the data validation and advances to the assembly phase
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import logger from "@/lib/utils/logger";

// Define the route context for logging
const routeContext = "API:scrapers/ai/sessions/[sessionId]/approve-data-validation";

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // 1. Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.error(routeContext, "Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get the session ID from the URL
    const { sessionId } = await params;
    if (!sessionId) {
      logger.error(routeContext, "Missing sessionId in URL");
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // 3. Parse the request body
    const body = await request.json();
    const { userFeedback } = body;

    logger.info(routeContext, `Received approval request for session ${sessionId}`);

    // 4. Get the session
    const session_data = await ScraperSessionService.getSession(sessionId);
    if (!session_data) {
      logger.error(routeContext, `Session ${sessionId} not found`);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 5. Validate that we have data extraction data
    if (!session_data.dataExtractionData) {
      logger.error(routeContext, `Session ${sessionId} has no data extraction data`);
      return NextResponse.json({ error: "Session has no data extraction data" }, { status: 400 });
    }

    // 6. Approve the data extraction data
    logger.info(routeContext, `Approving data extraction data for session ${sessionId}`);
    const updatedSession = await ScraperSessionService.approveDataExtractionData(
      sessionId,
      userFeedback
    );

    // 7. Return the updated session
    logger.info(routeContext, `Data validation approved successfully for session ${sessionId}`);
    return NextResponse.json({
      success: true,
      message: "Data validation approved successfully",
      session: updatedSession
    });
  } catch (error) {
    logger.error(routeContext, `Error approving data validation: ${error}`);
    return NextResponse.json(
      { error: `Failed to approve data validation: ${error}` },
      { status: 500 }
    );
  }
}
