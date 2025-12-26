import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";

// Decryption helper - must match encryption in settings/route.ts
function getEncryptionKey(): string {
  const key = process.env.NEXTAUTH_SECRET;
  if (!key || key.length < 32) {
    throw new Error("NEXTAUTH_SECRET must be set and at least 32 characters");
  }
  return key;
}
const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = "aes-256-gcm";

function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  
  // Support both new format (4 parts with salt) and legacy format (3 parts without salt)
  if (parts.length === 4) {
    const [saltHex, ivHex, authTagHex, encrypted] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } else if (parts.length === 3) {
    // Legacy format without salt
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } else {
    throw new Error("Invalid encrypted format");
  }
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
