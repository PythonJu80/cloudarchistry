import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email";

/**
 * GET /api/auth/verify-email/confirm?token=xxx
 * Verify email token and return JSON response
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 });
  }

  const result = await verifyEmailToken(token);

  if (result.success) {
    return NextResponse.json({ success: true, email: result.email });
  } else {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
}
