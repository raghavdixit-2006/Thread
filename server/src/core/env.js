// core/env.js - fail-fast environment validation.
// Crash at startup if anything required is missing or obviously placeholder.
import { z } from 'zod';

const DurationRange = z.object({});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Pterodactyl/Botkeep expose the allocated port as SERVER_PORT; honour it when PORT is unset.
  PORT: z.coerce.number().int().positive().default(Number(process.env.SERVER_PORT) || 5000),
  HOST_URL: z.string().url().default('http://localhost:5000'),
  // JSON array or comma-separated list; normalized (trimmed, no trailing slash).
  CORS_ORIGINS: z
    .string()
    .default('["http://localhost:5173"]')
    .transform((value) => {
      const raw = value.trim();
      const list = raw.startsWith('[')
        ? (() => {
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : raw.split(',');
      return [...new Set(list.map((origin) => String(origin).trim().replace(/\/+$/, '').toLowerCase()).filter(Boolean))];
    })
    .pipe(z.array(z.string().url().or(z.literal('*'))).min(1)),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().url(),
  ELASTIC_NODE: z.string().url(),
  // used by core/dns.js only when the OS resolver is a dead loopback address
  DNS_SERVERS: z
    .string()
    .default('1.1.1.1,8.8.8.8')
    .transform((value) => value.split(',').map((server) => server.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1)).min(1)),
  ELASTIC_INDEX: z.string().default('products'),

  JWT_ACCESS_SECRET: z.string().refine((v) => v.length >= 32 && !v.includes('replace'), {
    message: 'JWT_ACCESS_SECRET missing or placeholder (needs 32+ random chars)',
  }),
  JWT_REFRESH_SECRET: z.string().refine((v) => v.length >= 32 && !v.includes('replace'), {
    message: 'JWT_REFRESH_SECRET missing or placeholder (needs 32+ random chars)',
  }),

  // optional integrations - features degrade gracefully when unset
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().url().optional().default(''),

  // email: SMTP wins when host+user+pass are present; Brevo REST API is the fallback
  MAIL_HOST: z.string().trim().default(''),
  MAIL_PORT: z.preprocess(
    (value) => (value === '' || value == null ? undefined : value),
    z.coerce.number().int().positive().default(587),
  ),
  MAIL_USERNAME: z.string().trim().default(''),
  MAIL_PASSWORD: z.string().default(''),
  MAIL_FROM: z
    .string()
    .trim()
    .default('no-reply@thread.dev')
    .transform((value) => value || 'no-reply@thread.dev'),

  BREVO_API_KEY: z.string().optional().default(''),

  // dynamic image storage: admin-uploaded product photography goes to Cloudinary when
  // all three credentials are present. Static landing-page files stay in client/public.
  CLOUDINARY_CLOUD_NAME: z.string().trim().default(''),
  CLOUDINARY_API_KEY: z.string().trim().default(''),
  CLOUDINARY_API_SECRET: z.string().trim().default(''),
  CLOUDINARY_FOLDER: z.string().trim().default('thread/products'),

  // payments (Razorpay) - test keys from dash.razorpay.com > Settings > API Keys
  RAZORPAY_KEY_ID: z.string().trim().default(''), // rzp_test_...: only the key id is safe to reach the browser
  RAZORPAY_KEY_SECRET: z.string().trim().default(''), // server-only; opens gateway orders + signs every payment decision
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().default(''), // x-razorpay-signature HMAC for server-to-server webhooks

  // the seeder is admin-only: one upsert of the staff account, nothing else
  SEED_ADMIN_EMAIL: z.string().email().default('thread.admin@gmail.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment validation failed. Refusing to start.');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nGenerate JWT secrets with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isDev: parsed.data.NODE_ENV !== 'production',
};

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
export const smtpEnabled = Boolean(env.MAIL_HOST && env.MAIL_USERNAME && env.MAIL_PASSWORD);
export const brevoEnabled = Boolean(env.BREVO_API_KEY);
// which transport sendEmail() will use; surfaced at boot and in /api/health if needed
export const emailTransport = smtpEnabled ? 'smtp' : brevoEnabled ? 'brevo' : 'console';
// dynamic (admin-uploaded) product imagery: Cloudinary when configured, local disk otherwise
export const cloudinaryEnabled = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
export const imageStorage = cloudinaryEnabled ? 'cloudinary' : 'local';
// false keeps the shop COD-only (online checkout answers 503 until both keys are set)
export const razorpayEnabled = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
