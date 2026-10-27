// modules/auth/schemas.js - zero-trust input contracts (zod, strict).
import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(160);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[a-zA-Z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a digit');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(80),
    email,
    password,
    accepted: z.literal(true, { message: 'You must accept the Terms and Privacy Policy' }),
    termsVersion: z.string().trim().max(16).default('1.0.0'),
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required').max(72),
  })
  .strict();

export const otpSendSchema = z
  .object({
    email,
    purpose: z.enum(['verify', 'reset']),
  })
  .strict();

export const otpVerifySchema = z
  .object({
    email,
    purpose: z.enum(['verify', 'reset']),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  })
  .strict();

export const completeGoogleSchema = z.object({ code: z.string().trim().min(10).max(120) }).strict();

export const completeResetSchema = z
  .object({
    resetToken: z.string().min(10).max(200),
    password,
  })
  .strict();

export const googleUrlSchema = z
  .object({
    redirect: z
      .string()
      .trim()
      .max(200)
      .regex(/^\/(?!\/)/, 'redirect must be an app-relative path')
      .default('/'),
  })
  .strict();

export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, 'A 10-digit Indian mobile number is required')
      .optional(),
    currentPassword: z.string().min(1).max(72).optional(),
    newPassword: password.optional(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(data.name) || Boolean(data.phone) || (Boolean(data.currentPassword) && Boolean(data.newPassword)),
    {
      message: 'Provide a new name or phone, or current + new password together',
      path: ['name'],
    },
  );
