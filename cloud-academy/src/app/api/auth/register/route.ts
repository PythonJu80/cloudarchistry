import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  organizationName: z.string().min(2).optional().or(z.literal("")),  // Optional - for team signups, allow empty string
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Registration attempt with body:", JSON.stringify(body, null, 2));
    const { email, password, name, username, organizationName } = registerSchema.parse(body);

    // Check if Academy user exists (separate from main CloudMigrate users)
    const existingUser = await prisma.academyUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Check if username is taken
    const existingUsername = await prisma.academyUser.findFirst({
      where: { username },
    });
    if (existingUsername) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create Academy tenant and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create AcademyTenant (use org name if provided, otherwise use username)
      const tenantName = organizationName || `${username}'s Space`;
      const baseSlug = (organizationName || username)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const slug = `${baseSlug}-${Date.now()}`;

      const tenant = await tx.academyTenant.create({
        data: {
          name: tenantName,
          slug,
        },
      });

      // Create AcademyUser
      const user = await tx.academyUser.create({
        data: {
          email,
          username,
          name,
          passwordHash,
          role: "ADMIN",
          tenantId: tenant.id,
        },
      });

      // Create AcademyUserProfile for the user
      const profile = await tx.academyUserProfile.create({
        data: {
          academyUserId: user.id,
          academyTenantId: tenant.id,
          displayName: username,
          subscriptionTier: "free",
        },
      });

      return { tenant, user, profile };
    });

    // Send verification email (don't block on failure)
    sendVerificationEmail(email, name).catch((err) => {
      console.error("Failed to send verification email:", err);
    });

    return NextResponse.json({
      message: "User created successfully. Please check your email to verify your account.",
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Registration validation error:", error.message);
      console.error("Zod issues:", error.issues);
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
