// routes/healthController.js - dependency probes for /api/health.
import { ok } from '../utils/response.js';
import mongoose from 'mongoose';
import { redisHealth } from '../core/redis.js';
import { googleEnabled, razorpayEnabled } from '../core/env.js';

export async function health(_req, res) {
  const redisOk = await redisHealth();
  return ok(res, {
    status: mongoose.connection.readyState === 1 && redisOk ? 'healthy' : 'degraded',
    mongodb: mongoose.connection.readyState === 1 ? 'up' : 'down',
    redis: redisOk ? 'up' : 'down',
    search: 'mongo', // q search + facets are served from the catalogue
    googleOauth: googleEnabled ? 'up' : 'not-configured',
    razorpay: razorpayEnabled ? 'up' : 'not-configured',
    uptimeSec: Math.round(process.uptime()),
  });
}
