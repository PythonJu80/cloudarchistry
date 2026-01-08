import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const arcHubProfile = await prisma.arcHubProfile.findUnique({
      where: { profileId: session.user.academyProfileId },
      include: {
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            level: true,
            totalPoints: true,
            targetCertification: true,
            skillLevel: true,
          },
        },
      },
    });

    if (!arcHubProfile) {
      const newProfile = await prisma.arcHubProfile.create({
        data: {
          profileId: session.user.academyProfileId,
          arcHubUsername: session.user.username || session.user.email.split("@")[0],
        },
        include: {
          profile: {
            select: {
              displayName: true,
              avatarUrl: true,
              level: true,
              totalPoints: true,
              targetCertification: true,
              skillLevel: true,
            },
          },
        },
      });
      return NextResponse.json(newProfile);
    }

    return NextResponse.json(arcHubProfile);
  } catch (error) {
    console.error("Error fetching ArcHub profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { arcHubUsername, arcHubBio, arcHubAvatarUrl, githubUrl, linkedinUrl, websiteUrl, defaultVisibility, allowRemixes, allowComments } = body;

    const arcHubProfile = await prisma.arcHubProfile.upsert({
      where: { profileId: session.user.academyProfileId },
      update: {
        arcHubUsername,
        arcHubBio,
        arcHubAvatarUrl,
        githubUrl,
        linkedinUrl,
        websiteUrl,
        defaultVisibility,
        allowRemixes,
        allowComments,
      },
      create: {
        profileId: session.user.academyProfileId,
        arcHubUsername: arcHubUsername || session.user.username,
        arcHubBio,
        arcHubAvatarUrl,
        githubUrl,
        linkedinUrl,
        websiteUrl,
        defaultVisibility,
        allowRemixes,
        allowComments,
      },
    });

    return NextResponse.json(arcHubProfile);
  } catch (error) {
    console.error("Error updating ArcHub profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
