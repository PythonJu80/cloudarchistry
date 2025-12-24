import { NextRequest, NextResponse } from "next/server";

const DIAGRAM_API_URL = process.env.DIAGRAM_API_URL || "http://diagram-api:8002";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const format = body.format || "drawio_xml";

    const response = await fetch(`${DIAGRAM_API_URL}/diagrams/${params.id}/export?format=${format}`, {
      method: "POST",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to track export" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error tracking export:", error);
    return NextResponse.json({ error: "Failed to track export" }, { status: 500 });
  }
}
