import { NextRequest, NextResponse } from "next/server";

const DIAGRAM_API_URL = process.env.DIAGRAM_API_URL || "http://10.121.19.210:6097";

export async function GET(req: NextRequest) {
  try {
    const [statsResponse, categoriesResponse] = await Promise.all([
      fetch(`${DIAGRAM_API_URL}/stats`),
      fetch(`${DIAGRAM_API_URL}/categories`),
    ]);

    if (!statsResponse.ok || !categoriesResponse.ok) {
      throw new Error("Failed to fetch stats");
    }

    const stats = await statsResponse.json();
    const categories = await categoriesResponse.json();

    return NextResponse.json({
      ...stats,
      ...categories,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
