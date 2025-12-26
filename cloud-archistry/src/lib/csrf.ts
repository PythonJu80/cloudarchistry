/**
 * CSRF Protection Utility
 * Validates Origin header for state-changing requests
 */

import { NextRequest, NextResponse } from "next/server";

// Allowed origins for CSRF validation
const ALLOWED_ORIGINS = [
  "https://cloudarchistry.com",
  "https://www.cloudarchistry.com",
  "http://localhost:6060",
  "http://localhost:3000",
];

/**
 * Validate the Origin header against allowed origins
 * Returns null if valid, or a NextResponse with 403 if invalid
 */
export function validateCsrf(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  
  // For same-origin requests, Origin might not be set
  // In that case, check Referer header
  if (!origin && !referer) {
    // Allow requests without Origin/Referer (same-origin, curl, etc.)
    // This is a trade-off between security and usability
    return null;
  }
  
  // Check Origin header first
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      return null;
    }
    console.warn(`CSRF: Blocked request from origin: ${origin}`);
    return NextResponse.json(
      { error: "Forbidden - Invalid origin" },
      { status: 403 }
    );
  }
  
  // Fall back to Referer header
  if (referer) {
    const refererOrigin = new URL(referer).origin;
    if (ALLOWED_ORIGINS.includes(refererOrigin)) {
      return null;
    }
    console.warn(`CSRF: Blocked request from referer: ${referer}`);
    return NextResponse.json(
      { error: "Forbidden - Invalid referer" },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * Higher-order function to wrap API handlers with CSRF protection
 * Use for POST, PUT, DELETE, PATCH methods
 */
export function withCsrfProtection<T>(
  handler: (req: NextRequest) => Promise<T>
): (req: NextRequest) => Promise<T | NextResponse> {
  return async (req: NextRequest) => {
    const csrfError = validateCsrf(req);
    if (csrfError) {
      return csrfError;
    }
    return handler(req);
  };
}
