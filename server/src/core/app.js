// core/app.js - express application factory (helmet, cors whitelist, parsers,
// request logging, rate limits, error boundary). Routes are mounted separately.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';
import { env } from './env.js';
import { HttpError, mapMongoError, logInternalError } from './httpError.js';
import { apiLimiter } from './rateLimit.js';
import { apiRoutes } from '../routes/index.js';
import { rawPaymentRoutes } from '../modules/payments/paymentsModule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // behind nginx/Render/Vercel proxies in prod
  app.set('etag', false); // no conditional 304s: ETag validation gives axios error-shaped results on revalidation

  // security headers; disable CSP for the API (client is a separate SPA origin)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow client to load /products images
    }),
  );

  app.use(cors({ origin: (origin, cb) => (!origin || env.CORS_ORIGINS.includes(origin) ? cb(null, true) : cb(new Error('CORS_REJECTED'))), credentials: true }));

  // Razorpay webhook verifies an HMAC over the EXACT bytes the gateway signed, so this mount
  // buffers them raw - placed before express.json (which re-parses/re-serializes JSON).
  // Only POST /webhook is captured here; the authed payment endpoints fall through to the
  // normal parser pipeline and live on /api/payments via routes/index.js.
  app.use('/api/payments/razorpay', rawPaymentRoutes());

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      quietReqLogger: true,
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'silent'),
      customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
      customErrorMessage: (req, res, err) => `${req.method} ${req.url} -> ${err?.message || res.statusCode}`,
    }),
  );

  // product photography is served directly by the API (keyed, immutable).
  // __dirname = server/src/core -> up two levels is the server root.
  app.use('/products', express.static(path.join(__dirname, '..', '..', 'public', 'products'), { maxAge: '1h' }));

  // legacy/fallback admin uploads live in server/uploads with random monotonic names;
  // new uploads go to Cloudinary when CLOUDINARY_* is configured. The filename is only
  // issued AFTER the magic-byte content check, so /uploads holds no junk.
  app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads'), { maxAge: '7d' }));

  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.use('/api', apiLimiter, apiRoutes());

  // 404 keep at the end
  app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` } }));

  // central error boundary - mapped domain errors -> status; unknown -> 500 (no stack leak)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (String(err?.message) === 'CORS_REJECTED') {
      return res.status(403).json({ success: false, error: { code: 'CORS_REJECTED', message: 'Origin not allowed' } });
    }
    // domain errors thrown through the pipeline -> accurate status + code envelope
    if (err instanceof HttpError) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
    }
    // body-parser parse failures (malformed JSON) are client errors, not 500s
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON' } });
    }
    const mapped = mapMongoError(err);
    if (mapped) {
      return res.status(mapped.status).json({
        success: false,
        error: { code: mapped.code, message: mapped.message, ...(mapped.details ? { details: mapped.details } : {}) },
      });
    }
    logInternalError(req, err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  });

  return app;
}
