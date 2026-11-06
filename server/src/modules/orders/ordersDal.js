// modules/orders/ordersDal.js - order persistence + cross-model stock ops (called inside transactions).
import mongoose from 'mongoose';
import { Order } from '../../models/orderModel.js';
import { User } from '../../models/userModel.js';
import { notFound } from '../../core/httpError.js';

export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Order not found');
  return (await Order.findById(id).lean()) || null;
}

export async function findByIdForUser(id, userId) {
  const order = (await Order.findOne({ _id: id, userId }).lean()) || null;
  if (!order) throw notFound('Order not found');
  return order;
}

export async function findByIdempotencyKey(userId, key) {
  return (await Order.findOne({ idempotencyKey: key, userId }).lean()) || null;
}

export async function insert(orderDoc, session) {
  const [order] = session ? await Order.create([orderDoc], { session }) : await Order.create(orderDoc);
  return order;
}

export async function listForUser(userId, { page, limit, status }) {
  const query = { userId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(query),
  ]);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listAdmin({ page, limit, status }) {
  const query = status ? { status } : {};
  const [items, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(query),
  ]);
  // customer essentials (name/email/phone) per row so the admin panel renders orders standalone
  const ownerIds = [...new Set(items.map((o) => String(o.userId)))];
  if (ownerIds.length) {
    const owners = await User.find({ _id: { $in: ownerIds } }).select('name email phone').lean();
    const byId = new Map(
      owners.map((u) => [String(u._id), { id: String(u._id), name: u.name, email: u.email, phone: u.phone || '' }]),
    );
    for (const order of items) order.customer = byId.get(String(order.userId)) || null;
  }
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function transition(id, { from, to, note, by, cancelled, delivered, refunded }, session) {
  const update = { status: to, $push: { timeline: { status: to, at: new Date(), note: note || '', by: by || 'system' } } };
  if (cancelled) {
    update.cancelledAt = new Date();
    update.cancelledReason = note || '';
  }
  if (delivered) {
    update.deliveredAt = new Date();
    update.paymentStatus = 'paid'; // COD collected at the door
  }
  if (refunded) {
    update.refundedAt = new Date();
    update.paymentStatus = 'refunded'; // money handed back - payment record must agree
  }
  const query = Order.findOneAndUpdate({ _id: id, status: from }, update, { new: true });
  if (session) query.session(session);
  const updated = await query.lean();
  if (!updated) throw notFound('Order not found (or already moved)');
  return updated;
}

export async function appendTimeline(id, entry) {
  await Order.findByIdAndUpdate(id, { $push: { timeline: { ...entry, at: new Date() } } });
}

// ------------------------------------------------------------------ payments (Razorpay) --
// All four helpers carry optimistic guards (status + paymentStatus exactly as the service just
// read them), so a cancel/verify racing these writes returns null instead of corrupting state.

export async function attachPaymentOrder(id, { expectStatus, expectPaymentStatus, razorpayOrderId, note }) {
  const updated = await Order.findOneAndUpdate(
    { _id: id, status: expectStatus, paymentStatus: expectPaymentStatus },
    {
      $set: { paymentOrderId: razorpayOrderId },
      $push: { timeline: { status: expectStatus, at: new Date(), note: note || '', by: 'system' } },
    },
    { new: true },
  ).lean();
  return updated || null;
}

export async function findForPaymentOrderId(razorpayOrderId) {
  return (await Order.findOne({ paymentOrderId: razorpayOrderId }).lean()) || null;
}

// Marks the order paid. Only ever called with verified gateway evidence (checkout HMAC or
// webhook HMAC). statusTo advances the still-unpaid 'created' order to 'confirmed' once money
// is in; null means the replay already happened and the caller should re-read and ACK.
export async function markPaymentPaid(id, { expectStatus, expectPaymentStatus, paymentId, paidAt, verifiedBy, statusTo, note }) {
  const update = {
    $set: {
      paymentStatus: 'paid',
      paymentId: paymentId || null,
      paidAt: paidAt || new Date(),
      verifiedBy,
    },
    $push: { timeline: { status: statusTo || expectStatus, at: new Date(), note: note || '', by: 'system' } },
  };
  if (statusTo && statusTo !== expectStatus) update.$set.status = statusTo;
  const updated = await Order.findOneAndUpdate(
    { _id: id, status: expectStatus, paymentStatus: expectPaymentStatus },
    update,
    { new: true },
  ).lean();
  return updated || null;
}

export async function markPaymentFailed(id, { expectStatus, expectPaymentStatus, note }) {
  const updated = await Order.findOneAndUpdate(
    { _id: id, status: expectStatus, paymentStatus: expectPaymentStatus },
    { $set: { paymentStatus: 'failed' }, $push: { timeline: { status: expectStatus, at: new Date(), note: note || '', by: 'system' } } },
    { new: true },
  ).lean();
  return updated || null;
}

// ---------------- admin aggregates (sales report) ----------------

export async function salesReport(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // four independent aggregations over the same window - run them in parallel
  const [daily, byStatus, topProducts, totals] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $nin: ['cancelled'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$amountBreakup.total' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$amountBreakup.total' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          slug: { $first: '$items.slug' },
          title: { $first: '$items.title' },
          unitsSold: { $sum: '$items.qty' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: 8 },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$amountBreakup.total' }, avgOrderValue: { $avg: '$amountBreakup.total' } } },
    ]),
  ]);

  return { daily, byStatus, topProducts, totals: totals[0] || { orders: 0, revenue: 0, avgOrderValue: 0 }, rangeDays: days };
}
