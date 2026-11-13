// utils/format.js - pure formatting helpers (money is stored in paise).

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** 129900 (paise) -> "1,299" with rupee styling */
export const formatINR = (paise) => inr.format((Number(paise) || 0) / 100);

/** "42% OFF" from price vs mrp (paise) */
export function discountPercent(price, mrp) {
  if (!mrp || mrp <= price) return null;
  return `${Math.round(((mrp - price) / mrp) * 100)}% off`;
}

/** UTC server timestamps rendered for a viewer in India */
export function formatDate(value, { withTime = false } = {}) {
  if (!value) return '';
  const date = new Date(value);
  const options = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' };
  if (withTime) options.hour = '2-digit', options.minute = '2-digit';
  return `${date.toLocaleString('en-IN', options)} IST`;
}

/** human label for order/variant tokens: "t-shirts" -> "T-shirts" */
export function titleize(value = '') {
  return String(value)
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function orderStatusLabel(status = '') {
  switch (status) {
    case 'created':
      return 'Order created';
    case 'confirmed':
      return 'Confirmed';
    case 'packed':
      return 'Packed';
    case 'shipped':
      return 'Shipped';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    case 'refunded':
      return 'Refunded';
    case 'not_required':
      return 'Cash on delivery';
    case 'initiated':
      return 'Payment pending';
    case 'paid':
      return 'Paid';
    case 'failed':
      return 'Payment failed';
    default:
      return titleize(status);
  }
}
