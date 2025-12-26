/**
 * AWS Credentials Settings API
 * 
 * Manages user's AWS credentials for diagram deployment.
 * Credentials are encrypted at rest and never exposed in responses.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAwsCredentialsInfo,
  setAwsCredentials,
  removeAwsCredentials,
  verifyAwsCredentials,
  verifyAndUpdateCredentials,
  getAwsRegions,
} from "@/lib/academy/services/aws-credentials";

/**
 * GET /api/settings/aws
 * Get current AWS credentials info (not the actual credentials)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to view AWS settings" },
        { status: 401 }
      );
    }

    const info = await getAwsCredentialsInfo(session.user.academyProfileId);
    const regions = getAwsRegions();

    return NextResponse.json({
      ...info,
      availableRegions: regions,
    });
  } catch (error) {
    console.error("Get AWS credentials error:", error);
    return NextResponse.json(
      { error: "Failed to get AWS credentials info" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/aws
 * Set or update AWS credentials
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to configure AWS" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accessKeyId, secretAccessKey, region, verify } = body;

    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: "Access Key ID and Secret Access Key are required" },
        { status: 400 }
      );
    }

    // Optionally verify credentials before saving
    if (verify) {
      const verifyResult = await verifyAwsCredentials(
        accessKeyId,
        secretAccessKey,
        region || "us-east-1"
      );

      if (!verifyResult.valid) {
        return NextResponse.json(
          { error: verifyResult.error || "Invalid AWS credentials" },
          { status: 400 }
        );
      }
    }

    // Save credentials
    const result = await setAwsCredentials(
      session.user.academyProfileId,
      accessKeyId,
      secretAccessKey,
      region || "us-east-1"
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // If we verified, update the validity flag
    if (verify) {
      await verifyAndUpdateCredentials(session.user.academyProfileId);
    }

    // Get updated info
    const info = await getAwsCredentialsInfo(session.user.academyProfileId);

    return NextResponse.json({
      success: true,
      message: "AWS credentials saved successfully",
      ...info,
    });
  } catch (error) {
    console.error("Set AWS credentials error:", error);
    return NextResponse.json(
      { error: "Failed to save AWS credentials" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/aws
 * Remove AWS credentials
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in" },
        { status: 401 }
      );
    }

    await removeAwsCredentials(session.user.academyProfileId);

    return NextResponse.json({
      success: true,
      message: "AWS credentials removed",
    });
  } catch (error) {
    console.error("Remove AWS credentials error:", error);
    return NextResponse.json(
      { error: "Failed to remove AWS credentials" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/aws
 * Verify existing credentials
 */
export async function PATCH() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in" },
        { status: 401 }
      );
    }

    const result = await verifyAndUpdateCredentials(session.user.academyProfileId);

    if (!result.valid) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || "Credentials are invalid",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "AWS credentials verified successfully",
      accountId: result.accountId,
    });
  } catch (error) {
    console.error("Verify AWS credentials error:", error);
    return NextResponse.json(
      { error: "Failed to verify AWS credentials" },
      { status: 500 }
    );
  }
}
