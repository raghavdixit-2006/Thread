// modules/auth/routes.js - auth endpoints with tiered rate limits.
import { Router } from 'express';
import { authLimiter, otpVerifyLimiter, oauthLimiter, sessionLimiter, writeLimiter } from '../../core/rateLimit.js';
import { validateBody, validateQuery } from '../../core/validate.js';
import { authRequired } from '../../core/middleware/auth.js';
import { registerSchema, loginSchema, otpSendSchema, otpVerifySchema, completeResetSchema, googleUrlSchema, completeGoogleSchema, profileSchema } from './schemas.js';
import * as controller from './authController.js';

export function authRoutes() {
  const router = Router();

  // account entry (victim of credential stuffing - strictest budget)
  router.post('/register', authLimiter, validateBody(registerSchema), controller.register);
  router.post('/login', authLimiter, validateBody(loginSchema), controller.login);
  router.post('/otp/send', authLimiter, validateBody(otpSendSchema), controller.resendOtp);
  router.post('/otp/verify', otpVerifyLimiter, validateBody(otpVerifySchema), controller.verifyOtp);
  router.post('/reset/complete', authLimiter, validateBody(completeResetSchema), controller.completeReset);

  // google oauth
  router.get('/google/url', oauthLimiter, validateQuery(googleUrlSchema), controller.googleUrl);
  router.get('/google/callback', oauthLimiter, controller.googleCallback);
  router.post('/google/complete', oauthLimiter, validateBody(completeGoogleSchema), controller.googleComplete);

  // silent refresh + session-scoped
  router.post('/refresh', sessionLimiter, controller.refresh);
  router.get('/me', authRequired, controller.me);
  router.patch('/me', authRequired, writeLimiter, validateBody(profileSchema), controller.updateProfile);
  router.get('/sessions', authRequired, controller.sessions);
  router.post('/logout', authRequired, controller.logout);

  return router;
}
