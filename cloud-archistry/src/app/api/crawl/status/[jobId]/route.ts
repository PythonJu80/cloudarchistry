import { NextRequest, NextResponse } from "next/server";

const CRAWL_SERVICE_URL = process.env.CRAWL4AI_URL || "https://cloudarchistry.com";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    const response = await fetch(`${CRAWL_SERVICE_URL}/api/crawl/status/${jobId}`);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Crawl status proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch crawl status" },
      { status: 500 }
    );
  }
}
