import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { compare } from "bcryptjs";
import { prisma } from "./db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      username: string;
      role: string;
      isSuperuser: boolean;
      tenantId: string;
      tenantName: string;
      tenantSlug: string;
      // Academy-specific
      academyProfileId?: string;
      subscriptionTier?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    username: string;
    role: string;
    isSuperuser: boolean;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    academyProfileId?: string;
    subscriptionTier?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    username: string;
    role: string;
    isSuperuser: boolean;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    academyProfileId?: string;
    subscriptionTier?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Email/Password
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // Use AcademyUser for Cloud Academy authentication
        const user = await prisma.academyUser.findUnique({
          where: { email: credentials.email },
          include: { tenant: true },
        });

        if (!user) {
          throw new Error("User not found");
        }

        const isValid = await compare(credentials.password, user.passwordHash);

        if (!isValid) {
          throw new Error("Invalid password");
        }

        // Note: Email verification is optional for Academy users
        // if (!user.emailVerified) {
        //   throw new Error("Please verify your email before signing in");
        // }

        return {
          id: user.id,
          email: user.email,
          name: user.name || "",
          username: user.username,
          role: user.role,
          isSuperuser: false, // Academy users don't have superuser flag
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          tenantSlug: user.tenant.slug,
        };
      },
    }),
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "select_account",
              },
            },
          }),
        ]
      : []),
    // Microsoft OAuth (Azure AD)
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? [
          AzureADProvider({
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            tenantId: process.env.MICROSOFT_TENANT_ID || "common",
            authorization: {
              params: {
                prompt: "select_account",
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers, create AcademyUser, AcademyTenant, and AcademyUserProfile if they don't exist
      if (account?.provider === "google" || account?.provider === "azure-ad") {
        const email = user.email;
        if (!email) return false;

        let existingUser = await prisma.academyUser.findUnique({
          where: { email },
          include: { tenant: true },
        });

        // Create user if doesn't exist
        if (!existingUser) {
          const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
          const tenant = await prisma.academyTenant.create({
            data: {
              name: user.name || email.split("@")[0],
              slug: `${slug}-${Date.now()}`,
            },
          });

          existingUser = await prisma.academyUser.create({
            data: {
              email,
              name: user.name || "",
              passwordHash: "", // No password for OAuth users
              role: "ADMIN",
              tenantId: tenant.id,
            },
            include: { tenant: true },
          });
        }

        // Always check if profile exists, create if missing
        const existingProfile = await prisma.academyUserProfile.findFirst({
          where: { academyUserId: existingUser.id },
        });

        if (!existingProfile) {
          // Calculate trial end date (14 days from now)
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);
          
          // Create AcademyUserProfile with Google metadata
          // Default to learner tier with 14-day trial for OAuth signups
          await prisma.academyUserProfile.create({
            data: {
              academyUserId: existingUser.id,
              academyTenantId: existingUser.tenantId,
              displayName: user.name || email.split("@")[0],
              avatarUrl: user.image || null, // Google profile picture
              skillLevel: "beginner",
              subscriptionTier: "learner", // Default to learner for beta
              trialEndsAt, // 14 days from registration
              trialUsed: false,
            },
          });
        }
      }
      
      return true;
    },
    async jwt({ token, user, account }) {
      // For OAuth sign-in, fetch AcademyUser data from DB
      if (account?.provider === "google" || account?.provider === "azure-ad") {
        const dbUser = await prisma.academyUser.findUnique({
          where: { email: token.email! },
          include: { tenant: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.email = dbUser.email;
          token.name = dbUser.name || "";
          token.username = dbUser.username;
          token.role = dbUser.role;
          token.isSuperuser = false;
          token.tenantId = dbUser.tenantId;
          token.tenantName = dbUser.tenant.name;
          token.tenantSlug = dbUser.tenant.slug;
          
          // Get academy profile
          const profile = await prisma.academyUserProfile.findFirst({
            where: { academyUserId: dbUser.id },
          });
          if (profile) {
            token.academyProfileId = profile.id;
            token.subscriptionTier = profile.subscriptionTier;
          }
        }
      } else if (user) {
        // For credentials provider
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.username = user.username;
        token.role = user.role;
        token.isSuperuser = user.isSuperuser;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.tenantSlug = user.tenantSlug;
        
        // Get academy profile for credentials login too
        const profile = await prisma.academyUserProfile.findFirst({
          where: { academyUserId: user.id },
        });
        if (profile) {
          token.academyProfileId = profile.id;
          token.subscriptionTier = profile.subscriptionTier;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Always fetch fresh subscription tier from DB (it can change without re-login)
      let freshSubscriptionTier = token.subscriptionTier;
      if (token.academyProfileId) {
        const profile = await prisma.academyUserProfile.findUnique({
          where: { id: token.academyProfileId },
          select: { subscriptionTier: true },
        });
        if (profile) {
          freshSubscriptionTier = profile.subscriptionTier;
        }
      }
      
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        username: token.username,
        role: token.role,
        isSuperuser: token.isSuperuser,
        tenantId: token.tenantId,
        tenantName: token.tenantName,
        tenantSlug: token.tenantSlug,
        academyProfileId: token.academyProfileId,
        subscriptionTier: freshSubscriptionTier,
      };
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
