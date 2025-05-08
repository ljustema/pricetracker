import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import logger from "@/lib/utils/logger";

// Type for the route parameters
type Params = {
  params: Promise<{
    sessionId: string;
  }>;
};

// GET handler to retrieve a specific session
export async function GET(_request: NextRequest, { params }: Params) {
  // Extract sessionId from params - using await for Next.js 15 compatibility
  const { sessionId } = await params;
  const routeContext = `API:scrapers/ai/sessions/${sessionId}`;
  logger.info(routeContext, `Received request to get session: ${sessionId}`);

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get the session
    logger.info(routeContext, `Getting session: ${sessionId}`);
    const sessionData = await ScraperSessionService.getSession(sessionId);

    if (!sessionData) {
      logger.warn(routeContext, `Session not found: ${sessionId}`);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // 3. Check if the session belongs to the user
    if (sessionData.userId !== session.user.id) {
      logger.warn(routeContext, `Unauthorized access to session: ${sessionId}`);
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 401 }
      );
    }

    // 4. Return the session data
    logger.info(routeContext, `Retrieved session: ${sessionId}`);
    return NextResponse.json(sessionData);
  } catch (error) {
    logger.error(routeContext, `Error getting session: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH handler to update a specific session
export async function PATCH(request: NextRequest, { params }: Params) {
  // Extract sessionId from params - using await for Next.js 15 compatibility
  const { sessionId } = await params;
  const routeContext = `API:scrapers/ai/sessions/${sessionId}`;
  logger.info(routeContext, `Received request to update session: ${sessionId}`);

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get the session to check ownership
    logger.info(routeContext, `Getting session: ${sessionId}`);
    const sessionData = await ScraperSessionService.getSession(sessionId);

    if (!sessionData) {
      logger.warn(routeContext, `Session not found: ${sessionId}`);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // 3. Check if the session belongs to the user
    if (sessionData.userId !== session.user.id) {
      logger.warn(routeContext, `Unauthorized access to session: ${sessionId}`);
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 401 }
      );
    }

    // 4. Parse and validate request body
    let body: {
      currentPhase?: 'analysis' | 'url-collection' | 'data-extraction' | 'assembly' | 'complete';
      analysisData?: {
        approved?: boolean;
        userFeedback?: string;
      };
      urlCollectionData?: {
        approved?: boolean;
        userFeedback?: string;
      };
      dataExtractionData?: {
        approved?: boolean;
        userFeedback?: string;
      };
    };

    try {
      body = await request.json();
    } catch (_error) {
      logger.warn(routeContext, 'Invalid request body: Malformed JSON');
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    // 5. Update the session
    logger.info(routeContext, `Updating session: ${sessionId}`);

    // Get the current session
    const currentSession = await ScraperSessionService.getSession(sessionId);

    // Create a Supabase client for direct updates
    const supabase = createSupabaseAdminClient();

    // Update current phase if provided
    if (body.currentPhase) {
      logger.info(routeContext, `Updating phase to: ${body.currentPhase}`);
      await supabase
        .from('scraper_ai_sessions')
        .update({
          current_phase: body.currentPhase,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    }

    // Update analysis data if provided
    if (body.analysisData) {
      if (body.analysisData.approved !== undefined) {
        logger.info(routeContext, `Setting analysis approval to: ${body.analysisData.approved}`);
        await ScraperSessionService.approveAnalysisData(
          sessionId,
          body.analysisData.userFeedback
        );
      } else if (body.analysisData.userFeedback) {
        logger.info(routeContext, `Updating analysis feedback`);
        // Update just the feedback without changing approval status
        const updatedAnalysisData = {
          ...currentSession.analysisData,
          userFeedback: body.analysisData.userFeedback
        };

        await supabase
          .from('scraper_ai_sessions')
          .update({
            analysis_data: updatedAnalysisData,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      }
    }

    // Update URL collection data if provided
    if (body.urlCollectionData) {
      if (body.urlCollectionData.approved !== undefined) {
        logger.info(routeContext, `Setting URL collection approval to: ${body.urlCollectionData.approved}`);
        await ScraperSessionService.approveUrlCollectionData(
          sessionId,
          body.urlCollectionData.userFeedback
        );
      } else if (body.urlCollectionData.userFeedback) {
        logger.info(routeContext, `Updating URL collection feedback`);
        // Update just the feedback without changing approval status
        const updatedUrlCollectionData = {
          ...currentSession.urlCollectionData,
          userFeedback: body.urlCollectionData.userFeedback
        };

        await supabase
          .from('scraper_ai_sessions')
          .update({
            url_collection_data: updatedUrlCollectionData,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      }
    }

    // Update data extraction data if provided
    if (body.dataExtractionData) {
      if (body.dataExtractionData.approved !== undefined) {
        logger.info(routeContext, `Setting data extraction approval to: ${body.dataExtractionData.approved}`);
        await ScraperSessionService.approveDataExtractionData(
          sessionId,
          body.dataExtractionData.userFeedback
        );
      } else if (body.dataExtractionData.userFeedback) {
        logger.info(routeContext, `Updating data extraction feedback`);
        // Update just the feedback without changing approval status
        const updatedDataExtractionData = {
          ...currentSession.dataExtractionData,
          userFeedback: body.dataExtractionData.userFeedback
        };

        await supabase
          .from('scraper_ai_sessions')
          .update({
            data_extraction_data: updatedDataExtractionData,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      }
    }

    // 6. Get the updated session
    const updatedSession = await ScraperSessionService.getSession(sessionId);

    // 7. Return the updated session
    logger.info(routeContext, `Updated session: ${sessionId}`);
    return NextResponse.json(updatedSession);
  } catch (error) {
    logger.error(routeContext, `Error updating session: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a specific session
export async function DELETE(_request: NextRequest, { params }: Params) {
  // Extract sessionId from params - using await for Next.js 15 compatibility
  const { sessionId } = await params;
  const routeContext = `API:scrapers/ai/sessions/${sessionId}`;
  logger.info(routeContext, `Received request to delete session: ${sessionId}`);

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get the session to check ownership
    logger.info(routeContext, `Getting session: ${sessionId}`);
    const sessionData = await ScraperSessionService.getSession(sessionId);

    if (!sessionData) {
      logger.warn(routeContext, `Session not found: ${sessionId}`);
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // 3. Check if the session belongs to the user
    if (sessionData.userId !== session.user.id) {
      logger.warn(routeContext, `Unauthorized access to session: ${sessionId}`);
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 401 }
      );
    }

    // 4. Delete the session
    logger.info(routeContext, `Deleting session: ${sessionId}`);
    await ScraperSessionService.deleteSession(sessionId);

    // 5. Return success
    logger.info(routeContext, `Deleted session: ${sessionId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(routeContext, `Error deleting session: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
