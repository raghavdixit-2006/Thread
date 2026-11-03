// modules/orders/pricing.js - deterministic price breakup (money in paise, integers only).
// Rules: shipping free over ₹2,000 standard; express flat ₹149. tax = 5% GST on (subtotal - discount).
export const FREE_SHIPPING_PATTA = 200_000; // ₹2000
export const STANDARD_FEE = 9_900; // ₹99
export const EXPRESS_FEE = 14_900; // ₹149
export const TAX_PAISE = 5; // percent

export function computeBreakup({ subtotal, discount, deliveryOption }) {
  const taxable = Math.max(0, subtotal - discount);
  let shipping = deliveryOption === 'express' ? EXPRESS_FEE : subtotal >= FREE_SHIPPING_PATTA ? 0 : STANDARD_FEE;
  if (subtotal <= 0) shipping = 0;
  const tax = Math.round((taxable * TAX_PAISE) / 100);
  const total = taxable + shipping + tax;
  return { subtotal, discount, shipping, tax, total };
}

export const moneyInr = (paise) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
};
