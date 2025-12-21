import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";

// Encryption helpers - use NEXTAUTH_SECRET for consistency
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || "cloudarchistry-secret-change-in-production";
const ALGORITHM = "aes-256-gcm";

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
  
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: session.user.academyProfileId },
      select: {
        id: true,
        openaiKeyLastFour: true,
        openaiKeyAddedAt: true,
        preferredModel: true,
        subscriptionTier: true,
        hasAiAccess: true,
        settings: true,
        trialEndsAt: true,
        trialUsed: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Calculate trial status
    let trialDaysRemaining = 0;
    let trialExpired = false;
    if (profile.trialEndsAt) {
      const now = new Date();
      const diffMs = profile.trialEndsAt.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      trialExpired = diffMs <= 0;
    }

    return NextResponse.json({
      hasOpenAiKey: !!profile.openaiKeyLastFour,
      openaiKeyLastFour: profile.openaiKeyLastFour,
      openaiKeyAddedAt: profile.openaiKeyAddedAt,
      preferredModel: profile.preferredModel,
      subscriptionTier: profile.subscriptionTier,
      hasAiAccess: profile.hasAiAccess,
      settings: profile.settings,
      // Trial info
      trialEndsAt: profile.trialEndsAt?.toISOString() || null,
      trialDaysRemaining,
      trialExpired,
      trialUsed: profile.trialUsed,
      subscriptionExpiresAt: profile.subscriptionExpiresAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { openaiApiKey, preferredModel, settings } = body;

    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: session.user.academyProfileId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Handle OpenAI API key
    if (openaiApiKey !== undefined) {
      if (openaiApiKey === null || openaiApiKey === "") {
        // Remove the key
        updateData.openaiApiKey = null;
        updateData.openaiKeyLastFour = null;
        updateData.openaiKeyAddedAt = null;
      } else {
        // Validate the key format
        if (!openaiApiKey.startsWith("sk-")) {
          return NextResponse.json(
            { error: "Invalid OpenAI API key format. Key should start with 'sk-'" },
            { status: 400 }
          );
        }

        // Encrypt and store
        const encryptedKey = encrypt(openaiApiKey);
        const lastFour = openaiApiKey.slice(-4);

        updateData.openaiApiKey = encryptedKey;
        updateData.openaiKeyLastFour = `sk-...${lastFour}`;
        updateData.openaiKeyAddedAt = new Date();
        updateData.hasAiAccess = true;
      }
    }

    // Handle preferred model - accept any model string since OpenAI models are dynamic
    if (preferredModel !== undefined) {
      if (typeof preferredModel !== "string" || preferredModel.length > 100) {
        return NextResponse.json(
          { error: "Invalid model selection" },
          { status: 400 }
        );
      }
      updateData.preferredModel = preferredModel;
    }

    // Handle general settings
    if (settings !== undefined) {
      updateData.settings = settings;
    }

    // Update the profile
    const updatedProfile = await prisma.academyUserProfile.update({
      where: { id: profile.id },
      data: updateData,
      select: {
        openaiKeyLastFour: true,
        openaiKeyAddedAt: true,
        preferredModel: true,
        hasAiAccess: true,
        settings: true,
      },
    });

    return NextResponse.json({
      success: true,
      hasOpenAiKey: !!updatedProfile.openaiKeyLastFour,
      openaiKeyLastFour: updatedProfile.openaiKeyLastFour,
      openaiKeyAddedAt: updatedProfile.openaiKeyAddedAt,
      preferredModel: updatedProfile.preferredModel,
      hasAiAccess: updatedProfile.hasAiAccess,
      settings: updatedProfile.settings,
    });
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: session.user.academyProfileId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Remove the OpenAI key
    await prisma.academyUserProfile.update({
      where: { id: profile.id },
      data: {
        openaiApiKey: null,
        openaiKeyLastFour: null,
        openaiKeyAddedAt: null,
        // Don't remove hasAiAccess if they have a paid subscription
        hasAiAccess: profile.subscriptionTier !== "free",
      },
    });

    return NextResponse.json({
      success: true,
      message: "OpenAI API key removed",
    });
  } catch (error) {
    console.error("Settings DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove API key" },
      { status: 500 }
    );
  }
}
