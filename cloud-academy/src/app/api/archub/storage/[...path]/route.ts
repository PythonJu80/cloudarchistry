import { NextRequest, NextResponse } from "next/server";

const DIAGRAM_API_URL = process.env.DIAGRAM_API_URL || "http://diagram-api:8002";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join("/");
    
    // Use the diagram API's storage endpoint which has proper MinIO auth
    const apiUrl = `${DIAGRAM_API_URL}/storage/${filePath}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch from diagram API: ${response.status} ${response.statusText}`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const data = await response.arrayBuffer();
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Error proxying storage file:", error);
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
