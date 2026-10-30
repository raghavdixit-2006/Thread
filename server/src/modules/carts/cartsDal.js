// modules/carts/cartsDal.js - cart persistence (one row per user).
import { Cart } from '../../models/cartModel.js';

const MAX_QTY_PER_LINE = 10;

export async function getRaw(userId) {
  return (await Cart.findOne({ userId }).lean()) || { userId, items: [] };
}

export async function upsertItems(userId, items) {
  return Cart.findOneAndUpdate({ userId }, { items }, { upsert: true, new: true }).lean();
}

export async function countTotalQty(userId) {
  const cart = await Cart.findOne({ userId }).select('items').lean();
  return (cart?.items || []).reduce((sum, i) => sum + i.qty, 0);
}

export const MAX_LINE_QTY = MAX_QTY_PER_LINE;
