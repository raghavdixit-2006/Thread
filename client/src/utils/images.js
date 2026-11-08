// utils/images.js - product image paths live on the API origin in dev/prod.
import { API_BASE_URL } from './constants.js';

/** '/products/tee.jpg' -> 'http://localhost:5000/products/tee.jpg' (passthrough for absolute urls) */
export function productImageUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${String(value).startsWith('/') ? '' : '/'}${value}`;
}
