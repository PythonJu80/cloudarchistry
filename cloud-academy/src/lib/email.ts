import { Resend } from "resend";
import { prisma } from "./db";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXTAUTH_URL || "https://cloudarchistry.com";
const FROM_EMAIL = process.env.EMAIL_FROM || "CloudArchistry <noreply@cloudarchistry.com>";

/**
 * Generate a verification token and store it
 */
export async function createVerificationToken(email: string): Promise<string> {
  // Delete any existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { email },
  });

  // Create new token (valid for 24 hours)
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      token,
      email,
      expires,
    },
  });

  return token;
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(email: string, name?: string): Promise<boolean> {
  try {
    const token = await createVerificationToken(email);
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Verify your email - CloudArchistry",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px;">
            <div style="max-width: 480px; margin: 0 auto; background-color: #141414; border-radius: 12px; padding: 40px; border: 1px solid #262626;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #4ade80; font-size: 24px; margin: 0;">☁️ CloudArchistry</h1>
              </div>
              
              <h2 style="font-size: 20px; margin-bottom: 16px;">Verify your email</h2>
              
              <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px;">
                Hi${name ? ` ${name}` : ""},<br><br>
                Thanks for signing up! Please verify your email address by clicking the button below.
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verifyUrl}" style="display: inline-block; background-color: #4ade80; color: #000000; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
                  Verify Email
                </a>
              </div>
              
              <p style="color: #71717a; font-size: 14px; margin-top: 32px;">
                Or copy this link:<br>
                <a href="${verifyUrl}" style="color: #4ade80; word-break: break-all;">${verifyUrl}</a>
              </p>
              
              <p style="color: #71717a; font-size: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
                This link expires in 24 hours. If you didn't create an account, you can ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send verification email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}

/**
 * Verify email token and mark user as verified
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return { success: false, error: "Invalid or expired token" };
    }

    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.verificationToken.delete({ where: { token } });
      return { success: false, error: "Token has expired" };
    }

    // Mark AcademyUser as verified
    await prisma.academyUser.update({
      where: { email: verificationToken.email },
      data: { emailVerified: new Date() },
    });

    // Delete used token
    await prisma.verificationToken.delete({ where: { token } });

    return { success: true, email: verificationToken.email };
  } catch (error) {
    console.error("Error verifying email token:", error);
    return { success: false, error: "Verification failed" };
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<boolean> {
  const user = await prisma.academyUser.findUnique({
    where: { email },
    select: { name: true, emailVerified: true },
  });

  if (!user) {
    return false;
  }

  if (user.emailVerified) {
    return true; // Already verified
  }

  return sendVerificationEmail(email, user.name || undefined);
}
