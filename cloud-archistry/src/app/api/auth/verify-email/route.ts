import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken, resendVerificationEmail } from "@/lib/email";

/**
 * GET /api/auth/verify-email?token=xxx
 * Verify email from link click
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const result = await verifyEmailToken(token);

  if (result.success) {
    // Redirect to login with success message
    return NextResponse.redirect(new URL("/login?verified=true", request.url));
  } else {
    // Redirect with error
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(result.error || "verification_failed")}`, request.url));
  }
}

/**
 * POST /api/auth/verify-email
 * Resend verification email
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const sent = await resendVerificationEmail(email);

    if (sent) {
      return NextResponse.json({ success: true, message: "Verification email sent" });
    } else {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Failed to resend verification email" }, { status: 500 });
  }
}
