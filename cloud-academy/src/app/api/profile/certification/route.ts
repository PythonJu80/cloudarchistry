import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Mapping between short codes (settings) and long codes (world map)
const CERT_CODE_MAP: Record<string, string> = {
  // Foundational
  "CLF": "cloud-practitioner",
  "AIF": "ai-practitioner",
  // Associate
  "SAA": "solutions-architect-associate",
  "DVA": "developer-associate",
  "SOA": "sysops-associate",
  "DEA": "data-engineer-associate",
  "MLA": "machine-learning-engineer-associate",
  // Professional
  "SAP": "solutions-architect-professional",
  "DOP": "devops-professional",
  // Specialty
  "ANS": "networking-specialty",
  "SCS": "security-specialty",
  "MLS": "machine-learning-specialty",
  "PAS": "sap-specialty",
};

// Reverse mapping: long code -> short code
const REVERSE_CERT_MAP: Record<string, string> = Object.entries(CERT_CODE_MAP).reduce(
  (acc, [short, long]) => ({ ...acc, [long]: short }),
  {}
);

// GET - fetch current target certification and skill level
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.academyUserProfile.findFirst({
      where: { academyUserId: session.user.id },
      select: { 
        targetCertification: true,
        skillLevel: true,
      },
    });

    const shortCode = profile?.targetCertification || "SAA";
    const longCode = CERT_CODE_MAP[shortCode] || shortCode;

    return NextResponse.json({
      targetCertification: longCode,
      shortCode: shortCode,
      skillLevel: profile?.skillLevel || "intermediate",
    });
  } catch (error) {
    console.error("Certification GET error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// PUT - update target certification and/or skill level
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { certCode, skillLevel } = await request.json();
    
    const updateData: Record<string, string> = {};
    
    if (certCode) {
      const validCerts = [
        "solutions-architect-associate", "developer-associate", "sysops-associate",
        "solutions-architect-professional", "devops-professional",
        "networking-specialty", "security-specialty", "machine-learning-specialty", "database-specialty"
      ];
      if (!validCerts.includes(certCode)) {
        return NextResponse.json({ error: "Invalid certification code" }, { status: 400 });
      }
      // Convert long code to short code for consistent storage
      const shortCode = REVERSE_CERT_MAP[certCode] || certCode;
      updateData.targetCertification = shortCode;
    }
    
    // Validate and set skill level if provided
    if (skillLevel) {
      const validSkillLevels = ["beginner", "intermediate", "advanced", "expert"];
      if (!validSkillLevels.includes(skillLevel)) {
        return NextResponse.json({ error: "Invalid skill level" }, { status: 400 });
      }
      updateData.skillLevel = skillLevel;
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid data to update" }, { status: 400 });
    }

    await prisma.academyUserProfile.updateMany({
      where: { academyUserId: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, ...updateData });
  } catch (error) {
    console.error("Certification PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
