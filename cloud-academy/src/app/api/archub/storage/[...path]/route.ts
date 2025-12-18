import { NextRequest, NextResponse } from "next/server";

const MINIO_INTERNAL_URL = process.env.MINIO_INTERNAL_URL || "http://minio:9000";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join("/");
    const minioUrl = `${MINIO_INTERNAL_URL}/${filePath}`;
    
    const response = await fetch(minioUrl);
    
    if (!response.ok) {
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
