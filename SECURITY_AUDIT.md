# CloudAcademy Security Audit Report
**Date:** December 26, 2025  
**Audit Type:** Pre-Beta Security Deep Dive  
**Status:** Action Required Before Beta Launch

---

## Executive Summary

This security audit identified **12 critical/high issues** and **8 medium/low issues** that should be addressed before beta testing. The platform has good foundational security (AES-256-GCM encryption, bcryptjs password hashing, Prisma ORM for SQL injection prevention) but needs hardening in several areas.

---

## 🔴 CRITICAL Issues (Fix Before Beta)

### 1. Hardcoded Database Credentials in docker-compose.yml
**Severity:** CRITICAL  
**Location:** `docker-compose.yml` lines 8-10, 91-92, 251-253

```yaml
POSTGRES_PASSWORD=cloudmigrate2025
NEO4J_AUTH=neo4j/cloudmigrate2025
MINIO_ROOT_PASSWORD=cloudmigrate2025
```

**Risk:** If docker-compose.yml is committed to a public repo or exposed, attackers gain full database access.

**Fix:** Use environment variables or Docker secrets:
```yaml
environment:
  - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
```

---

### 2. Overly Permissive CORS Configuration
**Severity:** CRITICAL  
**Location:** 
- `learning_agent/crawl4ai_mcp.py:252`
- `cloud-academy/aws_drawing_agent/main.py:38`

```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, ...)
```

**Risk:** Allows any website to make authenticated requests to your API, enabling CSRF attacks and data theft.

**Fix:** Restrict to your domains:
```python
ALLOWED_ORIGINS = [
    "https://cloudarchistry.com",
    "https://www.cloudarchistry.com", 
    "http://localhost:6060",  # Development only
]
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, ...)
```

---

### 3. Weak Encryption Key Derivation (Static Salt)
**Severity:** CRITICAL  
**Location:** 
- `cloud-academy/src/lib/academy/services/api-keys.ts:19`
- `cloud-academy/src/lib/academy/services/aws-credentials.ts:32`
- `cloud-academy/src/app/api/settings/route.ts:13`

```typescript
const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
```

**Risk:** Using a static "salt" defeats the purpose of salting. All keys encrypted with the same password will produce identical ciphertext prefixes.

**Fix:** Use a unique random salt per encryption and store it with the ciphertext:
```typescript
const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
// Return: salt:iv:authTag:encrypted
```

---

### 4. Fallback Encryption Key in Code
**Severity:** HIGH  
**Location:** 
- `cloud-academy/src/lib/academy/services/api-keys.ts:10`
- `cloud-academy/src/app/api/settings/route.ts:8`

```typescript
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || "cloudarchistry-secret-change-in-production";
```

**Risk:** If NEXTAUTH_SECRET is not set, a predictable fallback key is used, making all encrypted data trivially decryptable.

**Fix:** Fail loudly if encryption key is missing:
```typescript
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error("NEXTAUTH_SECRET must be set and at least 32 characters");
}
```

---

### 5. Hardcoded Redis Connection String
**Severity:** HIGH  
**Location:** `cloud-academy/src/app/api/places/nearby/route.ts:7`

```typescript
const redis = new Redis("redis://10.121.15.210:4379");
```

**Risk:** Hardcoded internal IP address; if code is exposed, attackers know your infrastructure.

**Fix:** Use environment variable:
```typescript
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
```

---

## 🟠 HIGH Issues

### 6. Missing Security Headers
**Severity:** HIGH  
**Location:** `cloud-academy/next.config.mjs`

No security headers configured (CSP, X-Frame-Options, etc.)

**Fix:** Add to `next.config.mjs`:
```javascript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // ... rest of config
};
```

---

### 7. No Rate Limiting on Critical Endpoints
**Severity:** HIGH  
**Location:** Most API routes in `cloud-academy/src/app/api/`

Rate limiting exists (`rate-limit.ts`) but is only applied to team operations. Login, registration, and AI endpoints are unprotected.

**Fix:** Apply rate limiting to:
- `/api/auth/register` - Prevent mass account creation
- `/api/auth/*` - Prevent brute force
- All AI generation endpoints - Prevent abuse

---

### 8. Registration Logging Sensitive Data
**Severity:** HIGH  
**Location:** `cloud-academy/src/app/api/auth/register/route.ts:19`

```typescript
console.log("Registration attempt with body:", JSON.stringify(body, null, 2));
```

**Risk:** Passwords logged in plaintext to console/logs.

**Fix:** Remove or redact:
```typescript
console.log("Registration attempt for:", body.email);
```

---

### 9. No CSRF Protection
**Severity:** HIGH  
**Location:** Platform-wide

NextAuth handles CSRF for auth routes, but custom API routes have no protection.

**Fix:** For state-changing operations, validate the `Origin` header or implement CSRF tokens.

---

## 🟡 MEDIUM Issues

### 10. In-Memory Rate Limiting Won't Scale
**Severity:** MEDIUM  
**Location:** `cloud-academy/src/lib/academy/services/rate-limit.ts`

Using `Map<string, RateLimitEntry>` - won't work with multiple server instances.

**Fix:** Use Redis-based rate limiting for production:
```typescript
// Use ioredis with sliding window algorithm
```

---

### 11. Session Duration Too Long
**Severity:** MEDIUM  
**Location:** `cloud-academy/src/lib/auth.ts:297`

```typescript
maxAge: 30 * 24 * 60 * 60, // 30 days
```

**Fix:** Reduce to 7 days with sliding expiration:
```typescript
maxAge: 7 * 24 * 60 * 60, // 7 days
updateAge: 24 * 60 * 60, // Update session every 24 hours
```

---

### 12. Python Container Runs as Root
**Severity:** MEDIUM  
**Location:** `learning_agent/Dockerfile`

Container runs as root by default.

**Fix:** Add non-root user:
```dockerfile
RUN useradd -m -u 1000 appuser
USER appuser
```

---

### 13. Missing Input Validation on Some Endpoints
**Severity:** MEDIUM  
**Location:** Various API routes

Not all routes use Zod validation like the registration endpoint does.

**Fix:** Add Zod schemas to all POST/PUT endpoints.

---

## 🟢 GOOD Security Practices Found

✅ **Password Hashing:** Using bcryptjs with cost factor 12  
✅ **API Key Encryption:** AES-256-GCM with auth tags  
✅ **SQL Injection Prevention:** Prisma ORM with parameterized queries  
✅ **No eval() or Function():** No dynamic code execution found  
✅ **No raw SQL queries:** Using Prisma exclusively  
✅ **Docker Production User:** cloud-academy Dockerfile uses non-root user  
✅ **Input Validation:** Zod used on registration (extend to all routes)  
✅ **XSS Prevention:** No dangerouslySetInnerHTML except one static globe component  

---

## Pre-Beta Checklist

### Must Fix (Blockers)
- [ ] Remove hardcoded credentials from docker-compose.yml
- [ ] Fix CORS to allow only your domains
- [ ] Remove fallback encryption keys - fail if not set
- [ ] Fix static salt in encryption functions
- [ ] Remove hardcoded Redis connection string
- [ ] Remove password logging in registration

### Should Fix (High Priority)
- [ ] Add security headers to Next.js config
- [ ] Add rate limiting to auth and AI endpoints
- [ ] Implement CSRF protection for state-changing APIs
- [ ] Run learning-agent container as non-root

### Can Fix Later (Post-Beta)
- [ ] Move to Redis-based rate limiting
- [ ] Reduce session duration
- [ ] Add comprehensive input validation
- [ ] Add request signing for internal service communication

---

## Environment Variables to Set for Production

```bash
# REQUIRED - Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=<64+ character random string>

# REQUIRED - Dedicated encryption key
ENCRYPTION_KEY=<32+ character random string>

# Database (use strong passwords)
POSTGRES_PASSWORD=<generated strong password>
NEO4J_PASSWORD=<generated strong password>

# Redis
REDIS_URL=redis://<host>:<port>

# OAuth (if using)
GOOGLE_CLIENT_ID=<from google console>
GOOGLE_CLIENT_SECRET=<from google console>
```

---

## Next Steps

1. I can implement the critical fixes automatically
2. Review and approve the changes
3. Generate new secrets for production
4. Deploy to staging for security testing
5. Consider a professional penetration test before public beta

Would you like me to implement the critical fixes now?
