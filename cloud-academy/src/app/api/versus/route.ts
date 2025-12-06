import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:6060";
const FROM_EMAIL = process.env.EMAIL_FROM || "CloudMigrate <noreply@anais.solutions>";

/**
 * GET /api/versus - Get user's active and recent matches
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get matches where user is player1 or player2
    const matches = await prisma.versusMatch.findMany({
      where: {
        OR: [
          { player1Id: academyUser.id },
          { player2Id: academyUser.id },
        ],
      },
      include: {
        player1: {
          select: { id: true, name: true, username: true },
        },
        player2: {
          select: { id: true, name: true, username: true },
        },
        challenge: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Separate active and completed
    const activeMatches = matches.filter((m: { status: string }) => ["pending", "active"].includes(m.status));
    const recentMatches = matches.filter((m: { status: string }) => m.status === "completed").slice(0, 10);

    return NextResponse.json({ activeMatches, recentMatches });
  } catch (error) {
    console.error("Error fetching versus matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}

/**
 * POST /api/versus - Create a new versus match (challenge someone)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { opponentId, challengeId, matchType = "quiz" } = body;

    if (!opponentId) {
      return NextResponse.json({ error: "Opponent is required" }, { status: 400 });
    }

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true, name: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (academyUser.id === opponentId) {
      return NextResponse.json({ error: "You can't challenge yourself" }, { status: 400 });
    }

    // Verify opponent exists and get their email
    const opponent = await prisma.academyUser.findUnique({
      where: { id: opponentId },
      select: { id: true, name: true, email: true, username: true },
    });

    if (!opponent) {
      return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
    }

    // Generate match code for joining
    const matchCode = crypto.randomBytes(8).toString("hex");

    // Create the match
    const match = await prisma.versusMatch.create({
      data: {
        matchCode,
        player1Id: academyUser.id,
        player2Id: opponentId,
        challengeId: challengeId || null,
        matchType,
        status: "pending",
      },
      include: {
        player1: {
          select: { id: true, name: true, username: true },
        },
        player2: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    // Send challenge email to opponent
    const gameUrl = `${APP_URL}/game/${matchCode}`;
    const challengerName = academyUser.name || "A teammate";
    
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: opponent.email,
        subject: `⚔️ ${challengerName} has challenged you to a battle!`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px;">
              <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(135deg, #1a0a0a 0%, #0a0a1a 100%); border-radius: 12px; padding: 40px; border: 1px solid #ef4444;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #ef4444; font-size: 28px; margin: 0;">⚔️ BATTLE CHALLENGE!</h1>
                </div>
                
                <p style="color: #ffffff; font-size: 18px; text-align: center; margin-bottom: 24px;">
                  <strong style="color: #ef4444;">${challengerName}</strong> wants to battle you!
                </p>
                
                <p style="color: #a1a1aa; line-height: 1.6; text-align: center; margin-bottom: 24px;">
                  Think you can beat them in a quiz battle? Prove it!
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${gameUrl}" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); color: #ffffff; font-weight: 700; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-size: 18px;">
                    ⚔️ ACCEPT CHALLENGE
                  </a>
                </div>
                
                <p style="color: #71717a; font-size: 12px; text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
                  Or copy this link: <a href="${gameUrl}" style="color: #ef4444;">${gameUrl}</a>
                </p>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send challenge email:", emailError);
      // Don't fail the request - match is still created
    }

    return NextResponse.json({ match });
  } catch (error) {
    console.error("Error creating versus match:", error);
    return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
  }
}
