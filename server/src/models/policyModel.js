// models/policyModel.js - legal content served by the backend (docs skill §9).
import mongoose from 'mongoose';

const policySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 60 }, // privacy-policy | refund-policy | ...
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: ['legal', 'shipping', 'terms', 'privacy', 'cookie', 'contact'], default: 'legal' },
    bodyMarkdown: { type: String, required: true, maxlength: 200_000 },
    version: { type: String, required: true, default: '1.0.0' }, // semver; register flow records this
    effectiveDate: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true },
    updatedAtBy: { type: String, default: 'system' },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

policySchema.index({ slug: 1 }, { unique: true });
policySchema.index({ isActive: 1 });

export const Policy = mongoose.model('Policy', policySchema);
