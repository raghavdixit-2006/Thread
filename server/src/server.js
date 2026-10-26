// server.js - application entrypoint (fail-fast config, twin data layers, graceful shutdown).
import 'dotenv/config';

import { env, emailTransport, imageStorage } from './core/env.js';
import { logger } from './core/logger.js';
import { ensureDns } from './core/dns.js';
import { connectDb, disconnectDb } from './core/db.js';
import { Product } from './models/productModel.js';
import { Order } from './models/orderModel.js';
import { ensureIndex } from './core/elastic.js';
import { closeRedis } from './core/redis.js';
import { closeBus } from './core/eventBus.js';
import { createApp } from './core/app.js';
import { registerSearchConsumers } from './modules/search/searchConsumers.js';
import { registerEmailConsumers } from './modules/emails/consumers.js';

const boot = async () => {
  await ensureDns();
  await connectDb();
  // catalogue + order indexes (prod keeps mongoose autoIndex off - cloud Mongo included,
  // so this is the one guaranteed build, idempotent)
  try {
    await Promise.all([Product.createIndexes(), Order.createIndexes()]);
  } catch (err) {
    logger.warn({ err: err.message }, 'index build failed - Mongo list/search fallback degraded');
  }
  registerSearchConsumers();
  registerEmailConsumers();

  try {
    await ensureIndex();
  } catch (err) {
    logger.warn({ err: err.message }, 'Elasticsearch index not available now - q search will serve from the Mongo fallback');
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`THREAD API listening on http://localhost:${env.PORT}`);
    logger.info(`CORS origins: ${JSON.stringify(env.CORS_ORIGINS)}`);
    logger.info({ emailTransport }, 'email transport');
    logger.info({ imageStorage }, 'image storage');
    if (!env.isProd && imageStorage === 'local') logger.info('dev mode: admin uploads stay in server/uploads (set CLOUDINARY_* to store them in the cloud)');
    if (!env.isProd && emailTransport === 'console') logger.info('dev mode: emails print to console (set MAIL_* SMTP or BREVO_API_KEY to send)');
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received - shutting down gracefully`);
    server.close(async () => {
      closeBus();
      await disconnectDb();
      await closeRedis();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason?.message || reason }, 'unhandled rejection');
  });
};

boot().catch((err) => {
  logger.error({ err: { message: err.message, stack: err.stack } }, 'fatal boot failure');
  process.exit(1);
});


