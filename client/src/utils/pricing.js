// utils/pricing.js - client-side ESTIMATE mirror of server pricing rules.
// The order document placed by the server is the only source of truth for
// final amounts; this exists purely for on-screen previews.
import { FREE_SHIPPING_THRESHOLD_PAISE, STANDARD_FEE_PAISE, EXPRESS_FEE_PAISE, GST_PERCENT } from './constants.js';

export function estimateBreakup({ subtotal, discount = 0, deliveryOption = 'standard' }) {
  const taxable = Math.max(0, (subtotal || 0) - (discount || 0));
  let shipping = deliveryOption === 'express' ? EXPRESS_FEE_PAISE : (subtotal || 0) >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : STANDARD_FEE_PAISE;
  if (!subtotal) shipping = 0;
  const tax = Math.round((taxable * GST_PERCENT) / 100);
  const total = taxable + shipping + tax;
  return { subtotal: subtotal || 0, discount: discount || 0, shipping, tax, total };
}

export function estimateSavings(price = null, mrp = null, discount = 0) {
  const catalogSaving = price != null && mrp != null && mrp > price ? mrp - price : 0;
  return catalogSaving + (discount || 0);
}
