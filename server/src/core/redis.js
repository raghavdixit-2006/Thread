// core/redis.js - single ioredis connection used for OTP, rate limits, OAuth state.
import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let client;

export function getRedis() {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        return Math.min(times * 500, 5_000);
      },
      keyPrefix: 'thread:',
      lazyConnect: false,
    });
    client.on('error', (err) => logger.warn({ err: err.message }, 'redis error'));
    client.on('connect', () => logger.info('redis connected'));
  }
  return client;
}

export async function redisHealth() {
  try {
    await getRedis().ping();
    return true;
  } catch {
    return false;
  }
}

export async function closeRedis() {
  if (client && client.status !== 'end') await client.quit();
}

/** INCR + EXPIRE counter with per-key ttl (quota checks; no MULTI - providers may reject it). */
export async function incrementWithTtl(key, ttlSeconds) {
  const redis = getRedis();
  const count = await redis.incr(key);
  const existingTtl = await redis.ttl(key);
  if (count === 1 || existingTtl < 0) await redis.expire(key, ttlSeconds);
  return count;
}
