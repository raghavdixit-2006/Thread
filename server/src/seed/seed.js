// seed/seed.js - admin-only seeder: upserts the single staff account from env, nothing else.
// Products, coupons and demo users are deliberately NOT seeded here
// (`npm run seed:policies` remains for the legal policy documents). Run: npm run seed
import 'dotenv/config';
import { ensureDns } from '../core/dns.js';
import { connectDb, disconnectDb } from '../core/db.js';
import { logger } from '../core/logger.js';
import { User } from '../models/userModel.js';
import bcrypt from '@node-rs/bcrypt';
import { env } from '../core/env.js';

await ensureDns();
await connectDb();

const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, { cost: 10 });
await User.updateOne(
  { email: env.SEED_ADMIN_EMAIL },
  { $set: { name: 'Shop Admin', email: env.SEED_ADMIN_EMAIL, phone: '9700000001', passwordHash, role: 'admin', isEmailVerified: true, authProvider: 'password' } },
  { upsert: true },
);
logger.info(`admin user seeded/upserted: ${env.SEED_ADMIN_EMAIL} (role admin)`);

await disconnectDb();
process.exit(0);
