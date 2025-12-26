import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { z } from "zod";
import { checkRateLimit, RATE_LIMITS } from "@/lib/academy/services/rate-limit";
import { validateCsrf } from "@/lib/csrf";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  organizationName: z.string().min(2).optional().or(z.literal("")),  // Optional - for team signups, allow empty string
  userType: z.enum(["learner", "tutor"]).default("learner"),  // Beta: learner or tutor
});

export async function POST(req: NextRequest) {
  try {
    // CSRF protection - validate Origin header
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    // Rate limit by IP address
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown";
    const rateLimit = checkRateLimit(`register:${ip}`, RATE_LIMITS.REGISTRATION);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    // Security: Only log non-sensitive data
    console.log("Registration attempt for:", body.email);
    const { email, password, name, username, organizationName, userType } = registerSchema.parse(body);
    
    // Set subscription tier based on user type (beta)
    const subscriptionTier = userType === "tutor" ? "tutor" : "learner";
    
    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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

      // Create AcademyUserProfile for the user with appropriate tier and trial
      const profile = await tx.academyUserProfile.create({
        data: {
          academyUserId: user.id,
          academyTenantId: tenant.id,
          displayName: username,
          subscriptionTier, // learner or tutor based on registration choice
          trialEndsAt, // 14 days from registration
          trialUsed: false,
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
