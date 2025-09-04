import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Database warmup endpoint to prevent cold starts
 * This endpoint performs a simple query to keep the database connection active
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    
    // Perform a simple query to warm up the database
    const { error } = await supabase
      .from('products')
      .select('count')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error("Warmup query failed:", error);
      return NextResponse.json(
        { 
          status: "error", 
          message: "Database warmup failed",
          error: error.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      message: "Database warmed up successfully",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Warmup endpoint error:", error);
    return NextResponse.json(
      { 
        status: "error", 
        message: "Warmup failed",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
