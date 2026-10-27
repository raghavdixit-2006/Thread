// modules/auth/otp.js - 6-digit email OTP backed by Redis.
// Cap rules: 60s resend cooldown, 5 sends/hour/email, 10 sends/day/IP,
// 5 verify attempts per code. Codes are hashed (sha256 + pepper), never stored raw.
import { createHash } from 'node:crypto';
import { env } from '../../core/env.js';
import { getRedis, incrementWithTtl } from '../../core/redis.js';
import { badRequest, tooManyRequests, unauthorized } from '../../core/httpError.js';

const OTP_TTL = 10 * 60; // seconds
const CODE_PEPPER = createHash('sha256').update(`${env.JWT_ACCESS_SECRET}:thread-otp`).digest('hex').slice(0, 32);

const key = (purpose, email) => `otp:${purpose}:${email.toLowerCase()}`;
const cooldownKey = (purpose, email) => `otp:cd:${purpose}:${email.toLowerCase()}`;
const hourKey = (purpose, email) => `otp:hour:${purpose}:${email.toLowerCase()}`;
const ipDayKey = (ip) => `otp:ip:${ip}:${new Date().toISOString().slice(0, 10)}`;
const hash = (code) => createHash('sha256').update(`${code}:${CODE_PEPPER}`).digest('hex');

export const OTP_PURPOSES = ['verify', 'reset'];

export function assertPurpose(purpose) {
  if (!OTP_PURPOSES.includes(purpose)) throw badRequest('Unknown OTP purpose');
}

/** Generate + persist a new code for purpose. Throws 429 when any cap trips. */
export async function createOtp(email, purpose, ip) {
  assertPurpose(purpose);
  const redis = getRedis();

  if (await redis.exists(cooldownKey(purpose, email))) {
    throw tooManyRequests('Please wait before requesting another code');
  }
  const hourCount = await incrementWithTtl(hourKey(purpose, email), 3600);
  if (hourCount > 5) throw tooManyRequests('Too many codes requested this hour');
  const ipCount = await incrementWithTtl(ipDayKey(ip), 86_400);
  if (ipCount > 10) throw tooManyRequests('Daily code limit reached for this network');

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(
    key(purpose, email),
    JSON.stringify({ codeHash: hash(code), attempts: 0, createdAt: Date.now() }),
    'EX',
    OTP_TTL,
  );
  await redis.set(cooldownKey(purpose, email), '1', 'EX', 60);
  return code;
}

/**
 * Verify a code. resolution:
 *   'valid'     - code matched (key consumed)
 *   'invalid'   - wrong code, attempts remain (error thrown with remaining)
 * Throws for expired / too many attempts.
 */
export async function verifyOtp(email, purpose, code) {
  assertPurpose(purpose);
  const redis = getRedis();
  const storedRaw = await redis.get(key(purpose, email));
  if (!storedRaw) throw unauthorized('Code expired or never sent. Request a new one.');

  const stored = JSON.parse(storedRaw);
  if (stored.attempts >= 5) {
    await redis.del(key(purpose, email));
    throw tooManyRequests('Too many attempts. Request a new code.');
  }

  if (hash(String(code)) !== stored.codeHash) {
    stored.attempts += 1;
    const ttl = await redis.ttl(key(purpose, email));
    await redis.set(key(purpose, email), JSON.stringify(stored), 'EX', ttl > 0 ? ttl : OTP_TTL);
    throw badRequest(`Incorrect code (${5 - stored.attempts} attempts left)`);
  }

  await redis.del(key(purpose, email));
  return true;
}

export async function hasPendingOtp(email, purpose) {
  assertPurpose(purpose);
  return Boolean(await getRedis().exists(key(purpose, email)));
}

export async function cancelOtp(email, purpose) {
  getRedis().del(key(purpose, email));
}
