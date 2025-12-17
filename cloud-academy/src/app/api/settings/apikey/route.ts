import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";

// Decryption helper - must match encryption in settings/route.ts
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || "cloudarchistry-secret-change-in-production";
const ALGORITHM = "aes-256-gcm";

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

// GET - return decrypted API key for use in generation
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.academyUserProfile.findFirst({
      where: { academyUserId: session.user.id },
      select: { 
        openaiApiKey: true,
        preferredModel: true,
      },
    });

    if (!profile?.openaiApiKey) {
      return NextResponse.json({ apiKey: null, preferredModel: null });
    }

    // Decrypt the API key
    const decryptedKey = decrypt(profile.openaiApiKey);

    return NextResponse.json({
      apiKey: decryptedKey,
      preferredModel: profile.preferredModel,
    });
  } catch (error) {
    console.error("API key GET error:", error);
    return NextResponse.json({ error: "Failed to fetch API key" }, { status: 500 });
  }
}
