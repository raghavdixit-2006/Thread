// routes/configController.js - public storefront capabilities.
// Only booleans and public identifiers belong here: never a key secret. The client uses this
// to render honest payment choices instead of offering an option the server cannot honour.
import { ok } from '../utils/response.js';
import { env, razorpayEnabled, smtpEnabled, brevoEnabled } from '../core/env.js';

export async function storefrontConfig(_req, res) {
  return ok(res, {
    payments: {
      razorpay: razorpayEnabled,
      // sandbox keys are recognisable by prefix; useful for a staff-facing test badge
      mode: razorpayEnabled ? (env.RAZORPAY_KEY_ID.startsWith('rzp_test_') ? 'test' : 'live') : 'off',
    },
    email: {
      // 'console' means no transport is configured: OTP codes only reach the API log, so the
      // auth screen may say so. With smtp/brevo the code is in the inbox, never in the console.
      delivery: smtpEnabled ? 'smtp' : brevoEnabled ? 'brevo' : 'console',
    },
  });
}
