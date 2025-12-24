import { NextRequest, NextResponse } from "next/server";

const CRAWL_SERVICE_URL = process.env.CRAWL4AI_URL || "https://cloudarchistry.com";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const maxDepth = searchParams.get("max_depth") || "2";
    const maxConcurrent = searchParams.get("max_concurrent") || "5";
    const tenantId = searchParams.get("tenant_id");

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const crawlUrl = new URL(`${CRAWL_SERVICE_URL}/api/crawl/smart`);
    crawlUrl.searchParams.set("url", url);
    crawlUrl.searchParams.set("max_depth", maxDepth);
    crawlUrl.searchParams.set("max_concurrent", maxConcurrent);
    if (tenantId) {
      crawlUrl.searchParams.set("tenant_id", tenantId);
    }

    const response = await fetch(crawlUrl.toString(), {
      method: "POST",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Crawl proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to crawl service" },
      { status: 500 }
    );
  }
}
