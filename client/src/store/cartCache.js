// store/cartCache.js - signed-in cart snapshots cached in localStorage, keyed by user id.
// Owner scoping: the id comes from the JWT-verified identity (/me), so a cache line is only
// ever restored for the exact account it belongs to. The cache is display-only: the server
// cart always wins once its response lands, and the cache is wiped when the session ends.
import { CART_CACHE_PREFIX } from '../utils/constants.js';

const keyFor = (ownerId) => `${CART_CACHE_PREFIX}${String(ownerId)}`;

/** container shape check: nothing malformed leaks into the UI */
function sanitize(parsed) {
  if (!parsed || parsed.owner == null || !parsed.snapshot || typeof parsed.snapshot !== 'object') return null;
  if (!Array.isArray(parsed.snapshot.items)) return null;
  return { owner: String(parsed.owner), snapshot: parsed.snapshot };
}

export function readCartCache(ownerId) {
  if (ownerId == null) return null;
  try {
    const parsed = sanitize(JSON.parse(window.localStorage.getItem(keyFor(ownerId))));
    return parsed && parsed.owner === String(ownerId) ? parsed.snapshot : null;
  } catch {
    return null; // corrupted storage behaves like no cache
  }
}

export function writeCartCache(ownerId, snapshot) {
  if (ownerId == null || !snapshot) return;
  try {
    window.localStorage.setItem(keyFor(ownerId), JSON.stringify({ owner: String(ownerId), snapshot }));
  } catch {
    // storage full or blocked - the server cart still rules
  }
}

/** drop one owner's line, or every cached cart when the session ends entirely */
export function clearCartCache(ownerId) {
  try {
    if (ownerId != null) {
      window.localStorage.removeItem(keyFor(ownerId));
      return;
    }
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(CART_CACHE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // nothing to salvage here
  }
}
