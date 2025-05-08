import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperSessionService } from "@/lib/services/scraper-session-service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import logger from "@/lib/utils/logger";
import { randomUUID } from "crypto";

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

// GET handler to list all sessions for the authenticated user
export async function GET(request: NextRequest) {
  const routeContext = 'API:scrapers/ai/sessions';
  logger.info(routeContext, 'Received request to list sessions');

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);

    // 2. Get query parameters
    const { searchParams } = new URL(request.url);
    const competitorId = searchParams.get('competitorId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 3. Get sessions for the user
    logger.info(routeContext, `Getting sessions for user: ${userId}`);

    // Create a Supabase client for direct queries
    const supabase = createSupabaseAdminClient();

    // Build the query
    let query = supabase
      .from('scraper_ai_sessions')
      .select()
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add competitor filter if provided
    if (competitorId) {
      query = query.eq('competitor_id', competitorId);
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      logger.error(routeContext, `Error fetching sessions: ${error.message}`);
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    // Convert the database records to session objects
    const sessions = data.map(record => ({
      id: record.id,
      userId: record.user_id,
      competitorId: record.competitor_id,
      url: record.url,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      currentPhase: record.current_phase,
      analysisData: record.analysis_data,
      urlCollectionData: record.url_collection_data,
      dataExtractionData: record.data_extraction_data,
      assemblyData: record.assembly_data
    }));

    // 4. Return the sessions
    logger.info(routeContext, `Retrieved ${sessions.length} sessions for user: ${userId}`);
    return NextResponse.json(sessions);
  } catch (error) {
    logger.error(routeContext, `Error listing sessions: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST handler to create a new session
export async function POST(request: NextRequest) {
  const routeContext = 'API:scrapers/ai/sessions';
  logger.info(routeContext, 'Received request to create a new session');

  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(routeContext, 'Unauthorized access attempt');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);

    // 2. Parse and validate request body
    let body: { competitorId: string; url: string };
    try {
      body = await request.json();
    } catch (_error) {
      logger.warn(routeContext, 'Invalid request body: Malformed JSON');
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    const { competitorId, url } = body;

    if (!competitorId || !url) {
      logger.warn(routeContext, 'Missing required fields: competitorId, url');
      return NextResponse.json(
        { error: "Missing required fields: competitorId, url" },
        { status: 400 }
      );
    }

    // 3. Create a new session
    logger.info(routeContext, `Creating new session for URL: ${url}, competitorId: ${competitorId}`);
    const sessionId = await ScraperSessionService.createSession(userId, competitorId, url);

    // 4. Return the session ID
    logger.info(routeContext, `Created new session: ${sessionId}`);
    return NextResponse.json({ sessionId });
  } catch (error) {
    logger.error(routeContext, `Error creating session: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
