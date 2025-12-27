import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { checkRateLimit, RATE_LIMITS } from "@/lib/academy/services/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXTAUTH_URL || "https://cloudarchistry.com";
const FROM_EMAIL = process.env.EMAIL_FROM || "CloudArchistry <noreply@anais.solutions>";

/**
 * POST /api/invite - Send platform invite (takes user to pricing page)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Get user's academy user for rate limiting and name
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true, name: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limiting: 10 invites per hour per user
    const rateLimitKey = `platform-invite:${academyUser.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.TEAM_INVITE);
    
    if (!rateLimit.allowed) {
      const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      return NextResponse.json(
        { 
          error: `Rate limit exceeded. You can send more invites in ${resetInMinutes} minute${resetInMinutes !== 1 ? 's' : ''}.`,
          resetAt: rateLimit.resetAt,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.TEAM_INVITE.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }

    // Send invite email - direct link to pricing page
    const inviteUrl = `${APP_URL}/pricing`;
    const inviterName = academyUser.name || session.user.email;
    
    console.log('[PLATFORM INVITE] Attempting to send email to:', email, 'from:', FROM_EMAIL);
    
    try {
      const emailResult = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `${inviterName} invited you to join CloudArchistry`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px;">
              <div style="max-width: 520px; margin: 0 auto; background-color: #141414; border-radius: 12px; padding: 40px; border: 1px solid #262626;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #4ade80; font-size: 28px; margin: 0;">☁️ CloudArchistry</h1>
                  <p style="color: #71717a; font-size: 14px; margin-top: 8px;">Master AWS Architecture Through Play</p>
                </div>
                
                <h2 style="font-size: 22px; margin-bottom: 16px; text-align: center;">You've Been Invited! 🎉</h2>
                
                <p style="color: #a1a1aa; line-height: 1.7; margin-bottom: 24px; text-align: center;">
                  <strong style="color: #ffffff;">${inviterName}</strong> wants you to join them on CloudArchistry — 
                  where cloud architects level up their AWS skills through hands-on challenges, competitive gameplay, and collaborative learning.
                </p>

                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 10px; padding: 24px; margin-bottom: 24px; border: 1px solid #262626;">
                  <p style="color: #ffffff; font-weight: 600; margin: 0 0 16px 0; font-size: 15px;">What awaits you:</p>
                  
                  <div style="margin-bottom: 14px;">
                    <span style="color: #ef4444; font-weight: 600;">🎮 Game Zone</span>
                    <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 14px;">Battle head-to-head in real-time architecture challenges. Design solutions under pressure, earn XP, and climb the leaderboards.</p>
                  </div>
                  
                  <div style="margin-bottom: 14px;">
                    <span style="color: #f59e0b; font-weight: 600;">📚 Learning Centre</span>
                    <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 14px;">Structured learning paths for every AWS certification. Interactive scenarios, not just theory — build real architectures as you learn.</p>
                  </div>
                  
                  <div style="margin-bottom: 14px;">
                    <span style="color: #06b6d4; font-weight: 600;">🌍 World Map</span>
                    <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 14px;">Explore 200+ AWS services visually. Understand how they connect and when to use each one.</p>
                  </div>
                  
                  <div>
                    <span style="color: #8b5cf6; font-weight: 600;">👥 Cohorts</span>
                    <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 14px;">Join or create a team. Track progress together, compete on team leaderboards, and hold each other accountable.</p>
                  </div>
                </div>

                <div style="background-color: #1c1c1c; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 3px solid #4ade80;">
                  <p style="color: #a1a1aa; margin: 0; font-size: 14px; line-height: 1.6;">
                    <strong style="color: #ffffff;">Why architects love it:</strong> Stop passively watching tutorials. CloudArchistry makes you <em>do</em> — design, debug, and defend your architecture decisions in real scenarios.
                  </p>
                </div>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: #000000; font-weight: 700; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-size: 16px;">
                    Join ${inviterName.split(' ')[0]} on CloudArchistry →
                  </a>
                </div>
                
                <p style="color: #71717a; font-size: 13px; margin-top: 32px; text-align: center;">
                  Or copy this link:<br>
                  <a href="${inviteUrl}" style="color: #4ade80; word-break: break-all;">${inviteUrl}</a>
                </p>
                
                <p style="color: #52525b; font-size: 11px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626; text-align: center;">
                  If you didn't expect this invite, you can safely ignore this email.
                </p>
              </div>
            </body>
          </html>
        `,
      });
      console.log('[PLATFORM INVITE] Email sent successfully:', emailResult);
    } catch (emailError) {
      console.error("[PLATFORM INVITE] Failed to send invite email:", emailError);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Invite sent to ${email}`,
    });
  } catch (error) {
    console.error("Error sending platform invite:", error);
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 });
  }
}
