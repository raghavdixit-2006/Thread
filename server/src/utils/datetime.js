// utils/datetime.js - UTC-first timestamp helpers (database skill: timestamps in UTC/ISO).
export const readableDate = () => new Date().toISOString();

export function formatINR(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
}

// Money is stored as integers (paise) per database skill - never floats.
export const rupeesToPaise = (rupees) => Math.round(rupees * 100);
