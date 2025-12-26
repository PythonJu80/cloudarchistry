/**
 * Academy API Key Management Service
 * Handles encrypted storage of user's OpenAI API keys (BYOK)
 */

import prisma from "@/lib/db";
import crypto from "crypto";

// Encryption config - use NEXTAUTH_SECRET for consistency with settings route
function getEncryptionKey(): string {
  const key = process.env.NEXTAUTH_SECRET;
  if (!key || key.length < 32) {
    throw new Error("NEXTAUTH_SECRET must be set and at least 32 characters");
  }
  return key;
}
const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = "aes-256-gcm";

/**
 * Encrypt a string value
 * Returns: salt:iv:authTag:encryptedData (all hex)
 */
function encrypt(text: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a string value
 * Expects: salt:iv:authTag:encryptedData (all hex) OR legacy iv:authTag:encryptedData
 */
function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(":");
  
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

/**
 * Validate OpenAI API key format
 */
function validateOpenAIKey(key: string): { valid: boolean; error?: string } {
  // OpenAI keys start with "sk-" and are typically 51 characters
  // Newer keys may start with "sk-proj-" for project-scoped keys
  if (!key) {
    return { valid: false, error: "API key is required" };
  }
  
  if (!key.startsWith("sk-")) {
    return { valid: false, error: "Invalid key format. OpenAI keys start with 'sk-'" };
  }
  
  if (key.length < 40) {
    return { valid: false, error: "API key appears too short" };
  }
  
  return { valid: true };
}

/**
 * Get the last 4 characters for display
 */
function getLastFour(key: string): string {
  if (!key || key.length < 4) return "****";
  return key.slice(-4);
}

export interface ApiKeyInfo {
  hasKey: boolean;
  lastFour?: string;
  addedAt?: Date;
}

/**
 * Check if user has an API key configured
 */
export async function getApiKeyInfo(profileId: string): Promise<ApiKeyInfo> {
  const profile = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
    select: {
      openaiApiKey: true,
      openaiKeyLastFour: true,
      openaiKeyAddedAt: true,
    },
  });

  if (!profile || !profile.openaiApiKey) {
    return { hasKey: false };
  }

  return {
    hasKey: true,
    lastFour: profile.openaiKeyLastFour || undefined,
    addedAt: profile.openaiKeyAddedAt || undefined,
  };
}

/**
 * Set user's OpenAI API key (encrypted)
 */
export async function setApiKey(
  profileId: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  // Validate key format
  const validation = validateOpenAIKey(apiKey);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Encrypt the key
  const encryptedKey = encrypt(apiKey);
  const lastFour = getLastFour(apiKey);

  // Store in database
  await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: {
      openaiApiKey: encryptedKey,
      openaiKeyLastFour: lastFour,
      openaiKeyAddedAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Get decrypted API key for use in requests
 * Only call this when actually making API calls
 */
export async function getDecryptedApiKey(profileId: string): Promise<string | null> {
  const profile = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
    select: { openaiApiKey: true },
  });

  if (!profile?.openaiApiKey) {
    return null;
  }

  try {
    return decrypt(profile.openaiApiKey);
  } catch (error) {
    console.error("Failed to decrypt API key:", error);
    return null;
  }
}

/**
 * Remove user's API key
 */
export async function removeApiKey(profileId: string): Promise<void> {
  await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: {
      openaiApiKey: null,
      openaiKeyLastFour: null,
      openaiKeyAddedAt: null,
    },
  });
}

/**
 * Verify API key works by making a test request to OpenAI
 */
export async function verifyApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  // First validate format
  const formatCheck = validateOpenAIKey(apiKey);
  if (!formatCheck.valid) {
    return formatCheck;
  }

  try {
    // Make a minimal API call to verify the key works
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }

    if (response.status === 429) {
      // Rate limited but key is valid
      return { valid: true };
    }

    return { valid: false, error: `API returned status ${response.status}` };
  } catch (error) {
    return { valid: false, error: "Failed to verify key. Check your network connection." };
  }
}

/**
 * Get the API key to use for a request
 * Returns user's key only - no fallback to system key
 */
export async function getApiKeyForRequest(profileId: string): Promise<{
  key: string;
  source: "user";
} | null> {
  const userKey = await getDecryptedApiKey(profileId);
  if (userKey) {
    return { key: userKey, source: "user" };
  }

  return null;
}

/**
 * Get both API key and preferred model for a request
 * Returns platform .env key - no BYOK
 */
export async function getAiConfigForRequest(profileId: string): Promise<{
  key: string;
  preferredModel: string;
} | null> {
  // Return empty string - backend will use its .env OPENAI_API_KEY when it sees empty/null
  const profile = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
    select: { preferredModel: true },
  });
  
  return { 
    key: "", // Empty key - backend uses .env
    preferredModel: profile?.preferredModel || "gpt-4o" 
  };
}
