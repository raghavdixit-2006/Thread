// routes/healthController.js - dependency probes for /api/health.
import { ok } from '../utils/response.js';
import mongoose from 'mongoose';
import { redisHealth } from '../core/redis.js';
import { elasticHealth } from '../core/elastic.js';
import { googleEnabled, razorpayEnabled } from '../core/env.js';

export async function health(_req, res) {
  const [redisOk, elasticOk] = await Promise.all([redisHealth(), elasticHealth().catch(() => false)]);
  return ok(res, {
    status: mongoose.connection.readyState === 1 && redisOk ? 'healthy' : 'degraded',
    mongodb: mongoose.connection.readyState === 1 ? 'up' : 'down',
    redis: redisOk ? 'up' : 'down',
    elasticsearch: elasticOk ? 'up' : 'down',
    search: elasticOk ? 'elasticsearch' : 'mongo-fallback', // the shop serves q search either way
    googleOauth: googleEnabled ? 'up' : 'not-configured',
    razorpay: razorpayEnabled ? 'up' : 'not-configured',
    uptimeSec: Math.round(process.uptime()),
  });
}
