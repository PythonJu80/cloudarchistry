import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const DIAGRAM_API_URL = process.env.DIAGRAM_API_URL || "http://diagram-api:8002";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const userId = body.user_id || session.user.id;

    const response = await fetch(`${DIAGRAM_API_URL}/diagrams/${params.id}/remix?user_id=${userId}`, {
      method: "POST",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to remix diagram" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error remixing diagram:", error);
    return NextResponse.json({ error: "Failed to remix diagram" }, { status: 500 });
  }
}
