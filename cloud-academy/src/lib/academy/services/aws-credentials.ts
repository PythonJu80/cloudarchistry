/**
 * Academy AWS Credentials Management Service
 * Handles encrypted storage of user's AWS credentials for diagram deployment
 * 
 * SECURITY: 
 * - Credentials are encrypted at rest using AES-256-GCM
 * - Never logged or exposed in API responses
 * - Validated before storage
 */

import prisma from "@/lib/db";
import crypto from "crypto";

// Encryption config - use NEXTAUTH_SECRET for consistency
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || "cloudacademy-secret-change-in-production";
const ALGORITHM = "aes-256-gcm";

// AWS Regions for validation
const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
  "sa-east-1", "ca-central-1", "me-south-1", "af-south-1",
];

/**
 * Encrypt a string value
 * Returns: iv:authTag:encryptedData (all hex)
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a string value
 * Expects: iv:authTag:encryptedData (all hex)
 */
function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Validate AWS Access Key ID format
 */
function validateAccessKeyId(key: string): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: "Access Key ID is required" };
  }
  
  // AWS Access Key IDs are 20 characters, start with AKIA (user) or ASIA (temporary)
  if (!/^(AKIA|ASIA)[A-Z0-9]{16}$/.test(key)) {
    return { valid: false, error: "Invalid Access Key ID format. Should be 20 characters starting with AKIA or ASIA" };
  }
  
  return { valid: true };
}

/**
 * Validate AWS Secret Access Key format
 */
function validateSecretKey(key: string): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: "Secret Access Key is required" };
  }
  
  // AWS Secret Access Keys are 40 characters, base64-like
  if (key.length !== 40) {
    return { valid: false, error: "Invalid Secret Access Key format. Should be 40 characters" };
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

export interface AwsCredentialsInfo {
  hasCredentials: boolean;
  accessKeyLastFour?: string;
  region?: string;
  addedAt?: Date;
  isValid?: boolean;
}

/**
 * Check if user has AWS credentials configured
 */
export async function getAwsCredentialsInfo(profileId: string): Promise<AwsCredentialsInfo> {
  const profile = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
    select: {
      awsAccessKeyId: true,
      awsKeyLastFour: true,
      awsRegion: true,
      awsKeyAddedAt: true,
      awsCredentialsValid: true,
    },
  });

  if (!profile || !profile.awsAccessKeyId) {
    return { hasCredentials: false };
  }

  return {
    hasCredentials: true,
    accessKeyLastFour: profile.awsKeyLastFour || undefined,
    region: profile.awsRegion || "us-east-1",
    addedAt: profile.awsKeyAddedAt || undefined,
    isValid: profile.awsCredentialsValid,
  };
}

/**
 * Set user's AWS credentials (encrypted)
 */
export async function setAwsCredentials(
  profileId: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = "us-east-1"
): Promise<{ success: boolean; error?: string }> {
  // Validate access key format
  const accessKeyValidation = validateAccessKeyId(accessKeyId);
  if (!accessKeyValidation.valid) {
    return { success: false, error: accessKeyValidation.error };
  }

  // Validate secret key format
  const secretKeyValidation = validateSecretKey(secretAccessKey);
  if (!secretKeyValidation.valid) {
    return { success: false, error: secretKeyValidation.error };
  }

  // Validate region
  if (!AWS_REGIONS.includes(region)) {
    return { success: false, error: `Invalid region. Must be one of: ${AWS_REGIONS.join(", ")}` };
  }

  // Encrypt the credentials
  const encryptedAccessKey = encrypt(accessKeyId);
  const encryptedSecretKey = encrypt(secretAccessKey);
  const lastFour = getLastFour(accessKeyId);

  // Store in database
  await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: {
      awsAccessKeyId: encryptedAccessKey,
      awsSecretAccessKey: encryptedSecretKey,
      awsRegion: region,
      awsKeyLastFour: lastFour,
      awsKeyAddedAt: new Date(),
      awsCredentialsValid: false, // Will be set to true after verification
    },
  });

  return { success: true };
}

/**
 * Get decrypted AWS credentials for use in API calls
 * Only call this when actually making AWS API calls
 */
export async function getDecryptedAwsCredentials(profileId: string): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
} | null> {
  const profile = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
    select: {
      awsAccessKeyId: true,
      awsSecretAccessKey: true,
      awsRegion: true,
    },
  });

  if (!profile?.awsAccessKeyId || !profile?.awsSecretAccessKey) {
    return null;
  }

  try {
    return {
      accessKeyId: decrypt(profile.awsAccessKeyId),
      secretAccessKey: decrypt(profile.awsSecretAccessKey),
      region: profile.awsRegion || "us-east-1",
    };
  } catch (error) {
    console.error("Failed to decrypt AWS credentials:", error);
    return null;
  }
}

/**
 * Remove user's AWS credentials
 */
export async function removeAwsCredentials(profileId: string): Promise<void> {
  await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: {
      awsAccessKeyId: null,
      awsSecretAccessKey: null,
      awsKeyLastFour: null,
      awsKeyAddedAt: null,
      awsCredentialsValid: false,
    },
  });
}

/**
 * Verify AWS credentials work by making a test API call
 * Uses STS GetCallerIdentity - minimal permissions required
 */
export async function verifyAwsCredentials(
  accessKeyId: string,
  secretAccessKey: string,
  region: string = "us-east-1"
): Promise<{ valid: boolean; error?: string; accountId?: string; arn?: string }> {
  // First validate formats
  const accessKeyCheck = validateAccessKeyId(accessKeyId);
  if (!accessKeyCheck.valid) {
    return { valid: false, error: accessKeyCheck.error };
  }

  const secretKeyCheck = validateSecretKey(secretAccessKey);
  if (!secretKeyCheck.valid) {
    return { valid: false, error: secretKeyCheck.error };
  }

  try {
    // Use AWS STS GetCallerIdentity to verify credentials
    // This is the standard way to verify AWS credentials
    const endpoint = `https://sts.${region}.amazonaws.com/`;
    const service = "sts";
    const host = `sts.${region}.amazonaws.com`;
    const method = "POST";
    const body = "Action=GetCallerIdentity&Version=2011-06-15";
    
    // Create AWS Signature Version 4
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    
    const canonicalUri = "/";
    const canonicalQuerystring = "";
    const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-date";
    
    const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;
    
    // Calculate signature
    const getSignatureKey = (key: string, dateStamp: string, regionName: string, serviceName: string) => {
      const kDate = crypto.createHmac("sha256", `AWS4${key}`).update(dateStamp).digest();
      const kRegion = crypto.createHmac("sha256", kDate).update(regionName).digest();
      const kService = crypto.createHmac("sha256", kRegion).update(serviceName).digest();
      const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
      return kSigning;
    };
    
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    
    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Host": host,
        "X-Amz-Date": amzDate,
        "Authorization": authorizationHeader,
      },
      body,
    });

    const responseText = await response.text();

    if (response.ok) {
      // Parse the XML response to get account info
      const accountIdMatch = responseText.match(/<Account>(\d+)<\/Account>/);
      const arnMatch = responseText.match(/<Arn>([^<]+)<\/Arn>/);
      
      return {
        valid: true,
        accountId: accountIdMatch?.[1],
        arn: arnMatch?.[1],
      };
    }

    // Parse error from XML
    const errorMatch = responseText.match(/<Message>([^<]+)<\/Message>/);
    return {
      valid: false,
      error: errorMatch?.[1] || `AWS returned status ${response.status}`,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Failed to verify credentials",
    };
  }
}

/**
 * Verify and update credentials validity in database
 */
export async function verifyAndUpdateCredentials(profileId: string): Promise<{
  valid: boolean;
  error?: string;
  accountId?: string;
}> {
  const credentials = await getDecryptedAwsCredentials(profileId);
  
  if (!credentials) {
    return { valid: false, error: "No AWS credentials configured" };
  }

  const result = await verifyAwsCredentials(
    credentials.accessKeyId,
    credentials.secretAccessKey,
    credentials.region
  );

  // Update validity in database
  await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: { awsCredentialsValid: result.valid },
  });

  return result;
}

/**
 * Get AWS regions list
 */
export function getAwsRegions(): string[] {
  return AWS_REGIONS;
}
