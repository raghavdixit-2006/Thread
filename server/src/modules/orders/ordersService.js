// modules/orders/ordersService.js - placement (transaction-safe), cancellation, status flow.
//
// Money rules honoured:
//  - prices/totals recomputed server-side from the DB, never from the client
//  - stock decremented atomically inside a Mongo transaction (no oversell)
//  - coupon redemption guarded by usageLimit inside the same transaction
//  - Idempotency-Key replays return the original placed order
import { badRequest, conflict, notFound, unprocessable } from '../../core/httpError.js';
import { randomUUID } from 'node:crypto';
import { withTransaction } from '../../core/db.js';
import { publish, topics } from '../../core/eventBus.js';
import { logger } from '../../core/logger.js';
import { razorpayEnabled } from '../../core/env.js';
import { Order } from '../../models/orderModel.js';
import { User } from '../../models/userModel.js';
import * as ordersDal from './ordersDal.js';
import * as productsDal from '../products/productsDal.js';
import * as couponsService from '../coupons/couponsService.js';
import { computeBreakup } from './pricing.js';
import { Cart } from '../../models/cartModel.js';
import mongoose from 'mongoose';

function orderNumber() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${year}-${rand}`;
}

// ---------------------------------------------------------------------------
// place order (COD / Razorpay)
// ---------------------------------------------------------------------------

export async function place(userId, input) {
  // online payment needs the gateway keys, otherwise the checkout dead-ends right after placement
  if (input.paymentMethod === 'razorpay' && !razorpayEnabled) {
    throw serviceUnavailable('Online payments are not configured on this server - use cash on delivery', [{ field: 'paymentMethod', issue: 'gateway not configured' }]);
  }

  // idempotency: same key returns the original order (double-click, lost response, 401 replay).
  // This must run before the cart check - placement empties the cart, so a replay would
  // otherwise be rejected with "Your cart is empty" even though the order already exists.
  if (input.idempotencyKey) {
    const existing = await ordersDal.findByIdempotencyKey(userId, input.idempotencyKey);
    if (existing) {
      logger.info({ orderId: existing._id }, 'idempotent replay returned');
      return { order: existing, idempotentReplay: true };
    }
  }

  const cart = (await Cart.findOne({ userId }).lean())?.items || [];
  if (!cart.length) throw badRequest('Your cart is empty');
  // an absent client key still gets a unique value: the unique index must never see bare-null twins
  const storedIdempotencyKey = input.idempotencyKey ?? randomUUID();

  const user = await User.findById(userId).lean();
  if (!user) throw unprocessable('Account unavailable', [{ field: 'user', issue: 'not found' }]);

  // --- server-side pricing: load products, validate variants + stock ---
  const products = await productsDal.findForOrder(cart.map((i) => i.productId));
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = [];
  for (const item of cart) {
    const product = byId.get(String(item.productId));
    const variant = product?.variants?.find((v) => v.sku === item.sku);
    if (!product || !variant) {
      throw unprocessable('Some items in your cart are no longer available. Review your cart.', [{ field: 'cart', issue: item.sku }]);
    }
    if (variant.stock < item.qty) {
      throw conflict(`Only ${variant.stock} left of ${product.title} (${variant.size}). Reduce the quantity.`, {
        sku: item.sku,
        available: variant.stock,
      });
    }
    const unitPrice = variant.price ?? product.price;
    lines.push({
      productId: product._id,
      slug: product.slug,
      title: product.title,
      image:
        ((product.variantImages || []).find((entry) => entry.color === variant.color)?.images || [])[0] ||
        (product.images || [])[0] ||
        '',
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      unitPrice,
      qty: item.qty,
      lineTotal: unitPrice * item.qty,
    });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  // --- coupon (validated against computed subtotal) ---
  let coupon = null;
  let discount = 0;
  if (input.couponCode) {
    coupon = await couponsService.validate(input.couponCode, subtotal);
    discount = coupon.discount;
  }

  const amountBreakup = computeBreakup({ subtotal, discount, deliveryOption: input.deliveryOption });
  const address = { ...input.address };
  delete address.label;
  if (input.saveAddress) {
    await addAddressIfNew(user._id, { ...input.address });
  }

  // --- transaction: atomic stock decrement + order insert + coupon consume + cart clear ---
  let placed;
  try {
    placed = await withTransaction(async (session) => {
      for (const line of lines) {
        const dec = await productsDal.decrementVariantStock({ productId: line.productId, sku: line.sku, qty: line.qty }, session);
        if (!dec) {
          throw conflict(`Stock changed while placing the order (${line.title}). Review your cart.`, { sku: line.sku });
        }
      }

      if (coupon) {
        const consumed = await couponsService.consumeCoupon(coupon.code, session);
        if (!consumed) {
          throw conflict('This coupon has been fully redeemed. Remove it and retry.', { couponCode: coupon.code });
        }
      }

      const doc = {
        orderNumber: orderNumber(),
        userId,
        items: lines,
        amountBreakup,
        address,
        deliveryOption: input.deliveryOption,
        paymentMethod: input.paymentMethod,
        // COD needs no money up front; razorpay parks the order (stock already reserved inside
        // this same transaction) until a signature-verified gateway call marks it paid
        paymentStatus: input.paymentMethod === 'cod' ? 'not_required' : 'initiated',
        couponCode: coupon ? coupon.code : null,
        status: input.paymentMethod === 'cod' ? 'confirmed' : 'created',
        timeline: [
          input.paymentMethod === 'cod'
            ? { status: 'confirmed', at: new Date(), note: `Order placed (${input.paymentMethod.toUpperCase()}), awaiting fulfilment`, by: 'user' }
            : { status: 'created', at: new Date(), note: 'Order placed (RAZORPAY), payment pending - stock reserved', by: 'user' },
        ],
        idempotencyKey: storedIdempotencyKey,
      };

      const order = await ordersDal.insert(doc, session);
      await Cart.deleteOne({ userId }, { session });
      return order;
    });
  } catch (err) {
    throw err;
  }

  publish(topics.ORDER_CREATED, { ...placed, snapEmail: user.email, snapName: user.name });
  return { order: placed, idempotentReplay: false };
}

async function addAddressIfNew(userId, address) {
  const normalized = {
    label: address.label || 'Home',
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 || '',
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };
  // keep the first saved address as default; others default false
  const count = (await User.findById(userId).select('addresses').lean())?.addresses?.length || 0;
  await User.updateOne(
    { _id: userId, 'addresses.phone': { $ne: normalized.phone } },
    { $push: { addresses: { ...normalized, isDefault: count === 0 } } },
  );
}

// ---------------------------------------------------------------------------
// cancel (customer scope)
// ---------------------------------------------------------------------------

export async function cancel(userId, id, { reason }) {
  const order = await ordersDal.findByIdForUser(id, userId);
  if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status)) {
    throw unprocessable(`An order that is ${order.status} can no longer be cancelled`, [{ field: 'status', issue: order.status }]);
  }

  const updated = await withTransaction(async (session) => {
    const cancelled = await ordersDal.transition(id, { from: order.status, to: 'cancelled', note: reason, by: 'user', cancelled: true }, session);
    for (const line of cancelled.items) {
      await productsDal.restoreVariantStock({ productId: line.productId, sku: line.sku, qty: line.qty }, session);
    }
    return cancelled;
  });

  const owner = await User.findById(userId).select('name email').lean();
  publish(topics.ORDER_CANCELLED, { ...updated, snapEmail: owner?.email, snapName: owner?.name });
  return updated;
}

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------

export async function getForUser(userId, id) {
  const order = ordersDal.findByIdForUser(id, userId);
  return order;
}

export async function listMy(userId, { page = 1, limit = 10, status }) {
  return ordersDal.listForUser(userId, { page, limit, status });
}

// ---------------------------------------------------------------------------
// admin
// ---------------------------------------------------------------------------

export async function adminList(query) {
  return ordersDal.listAdmin(query);
}

export async function adminGet(id) {
  const order = await ordersDal.findById(id);
  if (!order) throw notFound('Order not found');
  const owner = await User.findById(order.userId).select('name email phone').lean();
  return { order, owner };
}

export async function adminSetStatus(id, { status, note }) {
  const current = await ordersDal.findById(id);
  if (!current) throw notFound('Order not found');
  if (!Order.canTransition(current.status, status)) {
    throw unprocessable(`Cannot move an order from ${current.status} to ${status}`, [{ field: 'status', issue: current.status }]);
  }

  let updated;
  if (status === 'cancelled' || status === 'refunded') {
    // cancellations/refunds restore stock atomically
    updated = await withTransaction(async (session) => {
      const changed = await ordersDal.transition(id, { from: current.status, to: status, note, by: 'admin', cancelled: status === 'cancelled', refunded: status === 'refunded' }, session);
      for (const line of changed.items) {
        await productsDal.restoreVariantStock({ productId: line.productId, sku: line.sku, qty: line.qty }, session);
      }
      return changed;
    });
  } else {
    // 'delivered' flips COD to paid at the door; razorpay payment state is earned by its own
    // signature-verified path (checkout/webhook), so the flag only applies to cash orders
    updated = await ordersDal.transition(id, { from: current.status, to: status, note, by: 'admin', delivered: status === 'delivered' && current.paymentMethod === 'cod' });
  }

  const owner = await User.findById(updated.userId).select('name email').lean();
  publish(topics.ORDER_STATUS_CHANGED, { ...updated, note, snapEmail: owner?.email, snapName: owner?.name });
  return updated;
}

export async function report() {
  return ordersDal.salesReport(30);
}
