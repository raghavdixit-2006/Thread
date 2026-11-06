// models/couponModel.js
import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 }, // percent: 1-100; fixed: paise
    minOrder: { type: Number, required: true, min: 0, default: 0 }, // paise threshold
    maxDiscount: { type: Number, min: 0, default: null }, // paise cap for percent coupons
    usageLimit: { type: Number, min: 0, default: null }, // global redemptions allowed
    usedCount: { type: Number, default: 0, min: 0 },
    validTill: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

couponSchema.index({ validTill: 1 });

export const Coupon = mongoose.model('Coupon', couponSchema);
