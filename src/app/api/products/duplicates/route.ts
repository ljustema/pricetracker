import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Get potential duplicates
    const { data, error } = await supabase.rpc(
      "find_potential_duplicates",
      { p_user_id: userId }
    );

    if (error) {
      console.error("Error finding potential duplicates:", error);
      return NextResponse.json(
        {
          error: "Failed to find potential duplicates",
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Group duplicates by group_id
    const groupedDuplicates = data.reduce((acc: any, product: any) => {
      const key = product.group_id;

      if (!acc[key]) {
        acc[key] = {
          group_id: product.group_id,
          match_reason: product.match_reason,
          products: []
        };
      }
      acc[key].products.push(product);
      return acc;
    }, {});

    return NextResponse.json(Object.values(groupedDuplicates));
  } catch (error) {
    console.error("Error in duplicates API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
