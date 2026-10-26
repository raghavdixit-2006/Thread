// core/db.js - single Mongoose connection pool + graceful shutdown.
import mongoose from 'mongoose';
import { logger } from './logger.js';
import { env } from './env.js';

export async function connectDb() {
  mongoose.set('autoIndex', !env.isProd); // build indexes eagerly in dev only
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  logger.info({ mongoDb: mongoose.connection.name, state: mongoose.connection.readyState }, 'mongo connected');
  return mongoose.connection;
}

export async function disconnectDb() {
  try {
    await mongoose.connection.close();
  } catch (err) {
    logger.error({ err: err.message }, 'error closing mongo connection');
  }
}

export function createTransactionRunner() {
  return async function runTransaction(work) {
    const session = await mongoose.startSession();
    try {
        const result = await session.withTransaction(work, {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });
      return result;
    } finally {
      session.endSession();
    }
  };
}

export const withTransaction = createTransactionRunner();
export default mongoose;
