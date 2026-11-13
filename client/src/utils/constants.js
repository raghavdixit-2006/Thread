// utils/constants.js - app-wide literals (naming per frontend SKILL.md).

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const CLIENT_URL = import.meta.env.VITE_CLIENT_URL || 'http://localhost:5173';

export const PRODUCT_CATEGORIES = ['jackets', 'dresses', 'shirts', 't-shirts', 'jeans', 'sweaters'];
export const PRODUCT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const PRODUCT_SORTS = [
  ['featured', 'Featured'],
  ['newest', 'Newest first'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Best rated'],
  ['name', 'Name (A-Z)'],
];

export const DELIVERY_OPTIONS = [
  ['standard', 'Standard delivery'],
  ['express', 'Express delivery'],
];

// Estimate-only mirror of server pricing rules; the order document is the
// source of truth for all final amounts.
export const FREE_SHIPPING_THRESHOLD_PAISE = 200_000; // 2000 INR
export const STANDARD_FEE_PAISE = 9_900; // 99 INR
export const EXPRESS_FEE_PAISE = 14_900; // 149 INR
export const GST_PERCENT = 5;

export const ORDER_STATUSES = ['created', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'];
export const CANCELLABLE_STATUSES = ['created', 'confirmed', 'packed'];

/**
 * Admin actions per current order status (mirrors server orderModel transitionMap, restricted to
 * what PATCH /api/admin/orders/:id/status accepts). Never shows an action the server would reject.
 */
export const ADMIN_NEXT_STATUSES = {
  created: ['cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const GUEST_CART_STORAGE_KEY = 'thread.guestCart.v1';
/** per-user cart snapshots in localStorage: `${PREFIX}${userId}` */
export const CART_CACHE_PREFIX = 'thread.cartCache.v1.';
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const TERMS_VERSION = '1.0.0';
