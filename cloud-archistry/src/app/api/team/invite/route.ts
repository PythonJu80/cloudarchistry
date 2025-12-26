import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { Resend } from "resend";
import { checkRateLimit, RATE_LIMITS } from "@/lib/academy/services/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXTAUTH_URL || "https://cloudarchistry.com";
const FROM_EMAIL = process.env.EMAIL_FROM || "CloudArchistry <noreply@anais.solutions>";

/**
 * POST /api/team/invite - Send team invite
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { teamId, email, role = "member" } = body;

    if (!teamId || !email) {
      return NextResponse.json({ error: "Team ID and email are required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Get user's academy user
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true, name: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limiting: 10 invites per hour per user
    const rateLimitKey = `invite:${academyUser.id}`;
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

    // Check if user is owner/admin of the team
    const membership = await prisma.academyTeamMember.findFirst({
      where: {
        teamId,
        academyUserId: academyUser.id,
        role: { in: ["owner", "admin"] },
      },
      include: {
        team: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You must be a team owner or admin to invite members" },
        { status: 403 }
      );
    }

    // Check if email is already a member
    const existingMember = await prisma.academyTeamMember.findFirst({
      where: {
        teamId,
        academyUser: { email },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: "This user is already a team member" }, { status: 400 });
    }

    // Check for existing pending invite
    const existingInvite = await prisma.academyTeamInvite.findFirst({
      where: {
        teamId,
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invite has already been sent to this email" },
        { status: 400 }
      );
    }

    // Check team member limit
    const memberCount = await prisma.academyTeamMember.count({
      where: { teamId },
    });

    if (memberCount >= membership.team.maxMembers) {
      return NextResponse.json(
        { error: `Team has reached maximum capacity (${membership.team.maxMembers} members)` },
        { status: 400 }
      );
    }

    // Generate invite code
    const code = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invite
    const invite = await prisma.academyTeamInvite.create({
      data: {
        teamId,
        email,
        code,
        role,
        expiresAt,
        createdBy: academyUser.id,
      },
    });

    // Create audit log for invite creation
    const inviterProfile = await prisma.academyUserProfile.findUnique({
      where: { academyUserId: academyUser.id },
      select: { id: true },
    });
    
    if (inviterProfile) {
      await prisma.academyActivity.create({
        data: {
          academyTenantId: membership.team.academyTenantId,
          profileId: inviterProfile.id,
          teamId,
          type: "team_invite_sent",
          data: {
            teamId,
            teamName: membership.team.name,
            inviteId: invite.id,
            inviteeEmail: email,
            role,
            expiresAt: expiresAt.toISOString(),
          },
          visibility: "team",
        },
      }).catch(err => {
        console.error("Failed to log invite creation:", err);
      });
    }

    // Send invite email
    const inviteUrl = `${APP_URL}/invite/${code}`;
    
    console.log('[INVITE] Attempting to send email to:', email, 'from:', FROM_EMAIL);
    
    try {
      const emailResult = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `You're invited to join ${membership.team.name} on CloudArchistry`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px;">
              <div style="max-width: 480px; margin: 0 auto; background-color: #141414; border-radius: 12px; padding: 40px; border: 1px solid #262626;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #4ade80; font-size: 24px; margin: 0;">☁️ CloudArchistry</h1>
                </div>
                
                <h2 style="font-size: 20px; margin-bottom: 16px;">You're Invited to Join Our Team!</h2>
                
                <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px;">
                  <strong style="color: #ffffff;">${academyUser.name || "A team member"}</strong> has invited you to join 
                  <strong style="color: #4ade80;">${membership.team.name}</strong> on CloudArchistry.
                </p>
                
                <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px;">
                  Join our community to collaborate on AWS architecture challenges, compete on leaderboards, 
                  and track your progress together.
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${inviteUrl}" style="display: inline-block; background-color: #4ade80; color: #000000; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
                    Accept Invite
                  </a>
                </div>
                
                <p style="color: #71717a; font-size: 14px; margin-top: 32px;">
                  Or copy this link:<br>
                  <a href="${inviteUrl}" style="color: #4ade80; word-break: break-all;">${inviteUrl}</a>
                </p>
                
                <p style="color: #71717a; font-size: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
                  This invite expires in 7 days. If you didn't expect this invite, you can ignore this email.
                </p>
              </div>
            </body>
          </html>
        `,
      });
      console.log('[INVITE] Email sent successfully:', emailResult);
    } catch (emailError) {
      console.error("[INVITE] Failed to send invite email:", emailError);
      // Don't fail the request, invite is still created
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        code: invite.code,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}

/**
 * DELETE /api/team/invite - Cancel/revoke an invite
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get("id");

    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID is required" }, { status: 400 });
    }

    // Get user's academy user
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the invite
    const invite = await prisma.academyTeamInvite.findUnique({
      where: { id: inviteId },
      include: { team: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Check if user is owner/admin of the team
    const membership = await prisma.academyTeamMember.findFirst({
      where: {
        teamId: invite.teamId,
        academyUserId: academyUser.id,
        role: { in: ["owner", "admin"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You must be a team owner or admin to revoke invites" },
        { status: 403 }
      );
    }

    // Delete the invite
    await prisma.academyTeamInvite.delete({
      where: { id: inviteId },
    });

    // Create audit log for invite revocation
    const revokerProfile = await prisma.academyUserProfile.findUnique({
      where: { academyUserId: academyUser.id },
      select: { id: true },
    });
    
    if (revokerProfile) {
      await prisma.academyActivity.create({
        data: {
          academyTenantId: invite.team.academyTenantId,
          profileId: revokerProfile.id,
          teamId: invite.teamId,
          type: "team_invite_revoked",
          data: {
            teamId: invite.teamId,
            teamName: invite.team.name,
            inviteId: invite.id,
            inviteeEmail: invite.email,
          },
          visibility: "team",
        },
      }).catch(err => {
        console.error("Failed to log invite revocation:", err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invite:", error);
    return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
  }
}
