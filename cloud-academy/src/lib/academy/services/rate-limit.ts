/**
 * Rate Limiting Service
 * Redis-based rate limiting for production scalability
 * Falls back to in-memory if Redis is unavailable
 */

import { Redis } from "ioredis";

// Redis client - uses REDIS_URL from environment
let redis: Redis | null = null;
try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on("error", (err) => {
      console.error("Redis rate limit error:", err);
    });
  }
} catch (err) {
  console.warn("Redis not available for rate limiting, using in-memory fallback");
}

// In-memory fallback for when Redis is unavailable
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is allowed based on rate limit (Redis-based)
 */
async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!redis) {
    return checkRateLimitMemory(key, config);
  }

  const now = Date.now();
  const windowKey = `ratelimit:${key}`;
  const windowSeconds = Math.ceil(config.windowMs / 1000);

  try {
    // Use Redis INCR with TTL for sliding window
    const count = await redis.incr(windowKey);
    
    if (count === 1) {
      // First request in window, set expiry
      await redis.expire(windowKey, windowSeconds);
    }

    const ttl = await redis.ttl(windowKey);
    const resetAt = now + (ttl > 0 ? ttl * 1000 : config.windowMs);

    if (count > config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - count,
      resetAt,
    };
  } catch (err) {
    console.error("Redis rate limit error, falling back to memory:", err);
    return checkRateLimitMemory(key, config);
  }
}

/**
 * Check if a request is allowed based on rate limit (in-memory fallback)
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or expired entry - allow and create new
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  // Entry exists and not expired
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Check if a request is allowed based on rate limit
 * Uses Redis if available, falls back to in-memory
 * @param key - Unique identifier for the rate limit (e.g., userId, IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  // For synchronous API compatibility, use memory-based check
  // For async contexts, use checkRateLimitAsync
  return checkRateLimitMemory(key, config);
}

/**
 * Async version that uses Redis when available
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimitRedis(key, config);
}

/**
 * Reset rate limit for a key
 * @param key - Unique identifier for the rate limit
 */
export async function resetRateLimit(key: string): Promise<void> {
  rateLimitStore.delete(key);
  if (redis) {
    try {
      await redis.del(`ratelimit:${key}`);
    } catch (err) {
      console.error("Redis reset error:", err);
    }
  }
}

/**
 * Predefined rate limit configs
 */
export const RATE_LIMITS = {
  // Team invites: 10 per hour per user
  TEAM_INVITE: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Team creation: 5 per hour per user
  TEAM_CREATE: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // General API: 100 per minute per user
  API_GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  // Registration: 5 per hour per IP - prevent mass account creation
  REGISTRATION: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Login attempts: 10 per 15 minutes per IP - prevent brute force
  LOGIN: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // AI generation: 30 per minute per user - prevent abuse
  AI_GENERATION: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;
