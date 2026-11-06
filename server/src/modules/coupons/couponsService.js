// modules/coupons/couponsService.js - validation + discount math (thresholds in paise).
import { Coupon } from '../../models/couponModel.js';
import { badRequest, notFound, tooManyRequests } from '../../core/httpError.js';

export async function validate(codeRaw, subtotal) {
  const code = String(codeRaw || '')
    .toUpperCase()
    .trim();
  if (!code) throw badRequest('Coupon code is required');
  const coupon = await Coupon.findOne({ code });
  if (!coupon || !coupon.isActive) throw notFound('Unknown or inactive coupon');
  if (coupon.validTill < new Date()) throw badRequest('This coupon has expired');
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw tooManyRequests('This coupon has been fully redeemed');
  if (subtotal < coupon.minOrder)
    throw badRequest(`Minimum order value is ₹${Math.max(0, coupon.minOrder) / 100} for this coupon`);

  const discount = computeDiscount(coupon, subtotal);
  if (discount <= 0) throw badRequest('Coupon does not reduce this cart value');

  return { code: coupon.code, type: coupon.type, value: coupon.value, discount, name: `${coupon.type === 'percent' ? `${coupon.value}% off` : `₹${coupon.value / 100} off`}` };
}

export function computeDiscount(coupon, subtotal) {
  let discount = coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.type === 'percent' && coupon.maxDiscount !== null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return Math.max(0, Math.min(discount, subtotal));
}

/** guarded usage bump with usageLimit check (called inside the placement transaction) */
export async function consumeCoupon(codeRaw, session) {
  let query = Coupon.updateOne(
    {
      code: String(codeRaw).toUpperCase().trim(),
      isActive: true,
      validTill: { $gt: new Date() },
      $and: [
        {
          $or: [
            { usageLimit: null },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
          ],
        },
      ],
    },
    { $inc: { usedCount: 1 } },
  ).session(session);
  const res = await query;
  return res.matchedCount === 1;
}

export async function releaseCoupon(codeRaw, session) {
  const res = await Coupon.updateOne({ code: String(codeRaw).toUpperCase().trim() }, { $inc: { usedCount: -1 } }).session(session);
  return true;
}

export async function peekByCode(codeRaw) {
  const code = String(codeRaw || '').toUpperCase().trim();
  if (!code) return null;
  return Coupon.findOne({ code, isActive: true }).lean();
}
