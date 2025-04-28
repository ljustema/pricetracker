import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils/uuid";
import JSZip from "jszip";

export async function POST(_request: NextRequest) {
  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const userId = ensureUUID(session.user.id);

    // Create a new zip file
    const zip = new JSZip();

    // Fetch user profile from next_auth schema
    const { data: userData, error: userError } = await supabase
      .schema("next_auth")
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Error fetching user data:", userError);
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    // Add user data to the zip file
    zip.file("user.json", JSON.stringify(userData, null, 2));

    // Fetch company data
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", userId);

    if (companyError) {
      console.error("Error fetching company data:", companyError);
      return NextResponse.json(
        { error: "Failed to fetch company data" },
        { status: 500 }
      );
    }

    // Add company data to the zip file
    zip.file("company.json", JSON.stringify(companyData, null, 2));

    // Fetch products
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId);

    if (productsError) {
      console.error("Error fetching products:", productsError);
      return NextResponse.json(
        { error: "Failed to fetch products" },
        { status: 500 }
      );
    }

    // Add products to the zip file
    zip.file("products.json", JSON.stringify(productsData, null, 2));

    // Fetch competitors
    const { data: competitorsData, error: competitorsError } = await supabase
      .from("competitors")
      .select("*")
      .eq("user_id", userId);

    if (competitorsError) {
      console.error("Error fetching competitors:", competitorsError);
      return NextResponse.json(
        { error: "Failed to fetch competitors" },
        { status: 500 }
      );
    }

    // Add competitors to the zip file
    zip.file("competitors.json", JSON.stringify(competitorsData, null, 2));

    // Fetch scrapers
    const { data: scrapersData, error: scrapersError } = await supabase
      .from("scrapers")
      .select("*")
      .eq("user_id", userId);

    if (scrapersError) {
      console.error("Error fetching scrapers:", scrapersError);
      return NextResponse.json(
        { error: "Failed to fetch scrapers" },
        { status: 500 }
      );
    }

    // Add scrapers to the zip file
    zip.file("scrapers.json", JSON.stringify(scrapersData, null, 2));

    // Fetch price changes (limit to recent ones to avoid huge files)
    const { data: priceChangesData, error: priceChangesError } = await supabase
      .from("price_changes")
      .select("*")
      .eq("user_id", userId)
      .order("changed_at", { ascending: false })
      .limit(1000);

    if (priceChangesError) {
      console.error("Error fetching price changes:", priceChangesError);
      return NextResponse.json(
        { error: "Failed to fetch price changes" },
        { status: 500 }
      );
    }

    // Add price changes to the zip file
    zip.file("price_changes.json", JSON.stringify(priceChangesData, null, 2));

    // Fetch brands
    const { data: brandsData, error: brandsError } = await supabase
      .from("brands")
      .select("*")
      .eq("user_id", userId);

    if (brandsError) {
      console.error("Error fetching brands:", brandsError);
      return NextResponse.json(
        { error: "Failed to fetch brands" },
        { status: 500 }
      );
    }

    // Add brands to the zip file
    zip.file("brands.json", JSON.stringify(brandsData, null, 2));

    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Convert the blob to an array buffer
    const arrayBuffer = await zipBlob.arrayBuffer();

    // Create a new response with the zip file
    const response = new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="pricetracker-export-${new Date().toISOString().split("T")[0]}.zip"`,
      },
    });

    return response;
  } catch (error) {
    console.error("Error in POST /api/settings/data-export:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
