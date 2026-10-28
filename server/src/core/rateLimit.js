// core/rateLimit.js - Redis-backed limiter tiers (defence-in-depth per backend skill).
// A tiny INCR/PTTL store instead of rate-limit-redis: some managed/Redis-compatible
// providers reject the SCRIPT command that library loads in its constructor, which
// used to crash boot. If the Redis upstream times out, each limiter falls back to an
// in-process window so a flaky cache can never turn every API call into a 500.
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { getRedis } from './redis.js';
import { logger } from './logger.js';

class RedisRateStore {
  constructor({ prefix, windowMs }) {
    this.prefix = prefix;
    this.windowMs = windowMs;
    this.memory = new Map();
    this.degraded = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  redisKey(key) {
    return `${this.prefix}${key}`;
  }

  async increment(key) {
    try {
      const result = await this.redisIncrement(key);
      if (this.degraded) {
        this.degraded = false;
        logger.info({ prefix: this.prefix }, 'redis limiter recovered');
      }
      return result;
    } catch (err) {
      if (!this.degraded) {
        this.degraded = true;
        logger.warn({ err: err.message, prefix: this.prefix }, 'redis limiter unavailable - in-process fallback active');
      }
      return this.memoryIncrement(key);
    }
  }

  async redisIncrement(key) {
    const redis = getRedis();
    const redisKey = this.redisKey(key);
    // plain INCR + PTTL: some managed Redis-compatible providers reject MULTI/EXEC
    const hits = await redis.incr(redisKey);
    let ttl = await redis.pttl(redisKey);
    if (typeof hits !== 'number' || typeof ttl !== 'number') {
      throw new Error('redis rate-limit increment failed');
    }
    if (ttl < 0) {
      await redis.pexpire(redisKey, this.windowMs);
      ttl = this.windowMs;
    }
    return { totalHits: hits, resetTime: new Date(Date.now() + ttl) };
  }

  memoryIncrement(key) {
    const now = Date.now();
    if (this.memory.size > 5_000) {
      for (const [k, v] of this.memory) if (v.resetTime <= now) this.memory.delete(k);
    }
    const entry = this.memory.get(key);
    if (!entry || entry.resetTime <= now) {
      const resetTime = now + this.windowMs;
      this.memory.set(key, { totalHits: 1, resetTime });
      return { totalHits: 1, resetTime: new Date(resetTime) };
    }
    entry.totalHits += 1;
    return { totalHits: entry.totalHits, resetTime: new Date(entry.resetTime) };
  }

  async decrement(key) {
    const entry = this.memory.get(key);
    if (entry) entry.totalHits = Math.max(0, entry.totalHits - 1);
    try {
      await getRedis().decr(this.redisKey(key));
    } catch {
      // memory fallback already adjusted; Redis outage must not fail the request
    }
  }

  async resetKey(key) {
    this.memory.delete(key);
    try {
      await getRedis().del(this.redisKey(key));
    } catch {
      // best-effort reset
    }
  }
}

const makeLimiter = ({ prefix, windowMs, limit, message }) => {
  const store = new RedisRateStore({ prefix: `rl:${prefix}:`, windowMs });
  return rateLimit({
    store,
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip), // IPv6-safe
    handler: (req, res, _next, options) =>
      res.status(options.statusCode).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: options.message },
      }),
  });
};

// General API budget: 300 requests / 5 minutes / IP
export const apiLimiter = makeLimiter({ prefix: 'api', windowMs: 5 * 60 * 1000, limit: 300, message: 'Too many requests, slow down' });

// Auth endpoints: 30 attempts / 10 min / IP (login, register, otp send, reset)
export const authLimiter = makeLimiter({ prefix: 'auth', windowMs: 10 * 60 * 1000, limit: 30, message: 'Too many auth attempts, try again later' });

// OTP verification: 10 tries / 10 min / IP
export const otpVerifyLimiter = makeLimiter({ prefix: 'otpverify', windowMs: 10 * 60 * 1000, limit: 10, message: 'Too many OTP verification attempts' });

// Silent session refresh: called by every SPA boot + 401 replay, so a looser budget
// than the credential-stuffing tiers; abuse is still capped per IP.
export const sessionLimiter = makeLimiter({ prefix: 'authrefresh', windowMs: 10 * 60 * 1000, limit: 60, message: 'Too many session refreshes, try again later' });

// OAuth flows: 15 / 10 min / IP
export const oauthLimiter = makeLimiter({ prefix: 'oauth', windowMs: 10 * 60 * 1000, limit: 15, message: 'Too many social login attempts' });

// Write-heavy storefront mutations: 100 / 5 min / IP (cart, orders, reviews)
export const writeLimiter = makeLimiter({ prefix: 'write', windowMs: 5 * 60 * 1000, limit: 100, message: 'Too many write requests' });

// Admin portal entry: 10 attempts / 10 min / IP - staff credentials are the highest-value
// target (privilege escalation), so the budget is the strictest of the login tiers.
export const adminLoginLimiter = makeLimiter({ prefix: 'adminlogin', windowMs: 10 * 60 * 1000, limit: 10, message: 'Too many admin sign-in attempts, try again later' });

// Image uploads: 30 files / 10 min / IP - multipart writes are comparatively expensive
export const uploadLimiter = makeLimiter({ prefix: 'upload', windowMs: 10 * 60 * 1000, limit: 30, message: 'Too many image uploads, try again later' });

// Payment endpoints (gateway order create/verify): 30 attempts / 10 min / IP - the money door.
// The webhook does NOT sit behind this tier (gateway retries must never be rate-limited away;
// its x-razorpay-signature HMAC is the real gate there).
export const paymentLimiter = makeLimiter({ prefix: 'payment', windowMs: 10 * 60 * 1000, limit: 30, message: 'Too many payment attempts, try again later' });
