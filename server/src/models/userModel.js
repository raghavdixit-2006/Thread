// models/userModel.js
import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 30, default: 'Home' },
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/, maxlength: 10 }, // Indian mobile
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120, default: '' },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    pincode: { type: String, required: true, trim: true, match: /^[1-9]\d{5}$/ },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
    passwordHash: { type: String, select: false }, // null for Google-only accounts
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // top-level profile mobile (distinct from each address's contact phone) - editable from the profile
    phone: { type: String, trim: true, match: /^[6-9]\d{9}$/, maxlength: 10, default: '' },

    // OAuth linkage
    authProvider: { type: String, enum: ['password', 'google'], default: 'password' },
    googleId: { type: String, index: true, sparse: true, default: null },
    avatarUrl: { type: String, default: '' },

    // OTP gating: login before verify issues a resend, not a session
    isEmailVerified: { type: Boolean, default: false },
    termsVersion: { type: String, default: null },
    termsAcceptedAt: { type: Date, default: null },

    addresses: { type: [addressSchema], default: [] },

    // rotation-aware refresh tokens (hashes only)
    refreshTokens: [
      new mongoose.Schema(
        {
          tokenHash: { type: String, required: true },
          family: { type: String, required: true },
          expiresAt: { type: Date, required: true },
          revokedAt: { type: Date, default: null },
          replacedByHash: { type: String, default: null },
        },
        { _id: false },
      ),
    ],
  },
  { timestamps: true, toJSON: { versionKey: false, transform: stripSecrets } },
);

function stripSecrets(_doc, ret) {
  delete ret.passwordHash;
  delete ret.googleId;
  ret.refreshTokens = (ret.refreshTokens || []).reduce((sum, t) => sum + (t.revokedAt ? 0 : 1), 0); // count only
  return ret;
}

userSchema.methods.primaryAddress = function () {
  return this.addresses.find((a) => a.isDefault) || this.addresses[0] || null;
};

userSchema.index({ createdAt: -1 });

export const User = mongoose.model('User', userSchema);
