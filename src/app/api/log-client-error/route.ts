import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "pricetracker", "logs");
const LOG_FILE = path.join(LOG_DIR, `pricetracker-2025-04-14.log`); // TODO: Use dynamic date if needed

export async function POST(req: NextRequest) {
  console.log("[API] /api/log-client-error called");
  try {
    const { message, context, errorDetails } = await req.json();
    console.log("[API] /api/log-client-error received:", { message, context, errorDetails });

    const logEntry = `[ClientError] ${new Date().toISOString()} | ${context || "unknown"} | ${message}` +
      (errorDetails ? ` | Details: ${JSON.stringify(errorDetails)}` : "") + "\n";

    // Ensure log directory exists
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, logEntry, "utf8");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to log client error:", err);
    return NextResponse.json({ error: "Failed to log client error" }, { status: 500 });
  }
}