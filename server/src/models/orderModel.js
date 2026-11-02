// models/orderModel.js - order with state machine timeline, money breakup, idempotency.
import mongoose from 'mongoose';

export const ORDER_STATUSES = ['created', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'];

// Valid transition graph (enforced in the orders service, not just middleware):
const transitions = {
  created: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const PAYMENT_METHODS = ['cod', 'razorpay']; // razorpay = UPI/cards/netbanking via the checkout widget
export const PAYMENT_STATUSES = ['not_required', 'initiated', 'paid', 'failed', 'refunded'];

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    image: { type: String, required: true },
    sku: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 }, // frozen price at confirm (paise)
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true }, // public (ORD-YYYY-XXXXXX)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },

    amountBreakup: {
      subtotal: { type: Number, required: true, min: 0 },
      discount: { type: Number, required: true, min: 0, default: 0 },
      shipping: { type: Number, required: true, min: 0, default: 0 },
      tax: { type: Number, required: true, min: 0, default: 0 },
      total: { type: Number, required: true, min: 0 },
    },

    address: { type: Object, required: true }, // snapshot of the address used
    deliveryOption: { type: String, enum: ['standard', 'express'], default: 'standard' },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true },

    couponCode: { type: String, default: null, uppercase: true, trim: true },

    status: { type: String, enum: ORDER_STATUSES, default: 'created', index: true },
    timeline: [
      {
        status: { type: String, required: true },
        at: { type: Date, required: true, default: Date.now },
        note: { type: String, default: '' },
        by: { type: String, default: 'system' }, // 'system' | 'admin' | 'user'
      },
    ],

    // Razorpay linkage: the gateway's own order/payment ids (unique so a gateway order can
    // only ever attach once), the money-in timestamp, and which verified signature earned
    // the 'paid' status - the checkout HMAC or the webhook HMAC. The fields are absent for
    // COD orders; a partial unique index below keeps them from colliding on "missing".
    paymentOrderId: { type: String }, // order_XXXX from Razorpay
    paymentId: { type: String }, // pay_XXXX of the captured payment
    paidAt: { type: Date, default: null },
    verifiedBy: { type: String, enum: ['checkout', 'webhook'], default: null },
    idempotencyKey: { type: String }, // field-level unique index (always set by the service)

    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, default: '' },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 }); // admin queue + 30-day reports without a status filter
// Partial (not sparse) unique indexes: sparse still indexes explicit nulls, so a second COD
// order would fail with "Duplicate paymentOrderId". Partial only covers real string values.
for (const field of ['paymentOrderId', 'paymentId', 'idempotencyKey']) {
  orderSchema.index({ [field]: 1 }, { unique: true, partialFilterExpression: { [field]: { $type: 'string' } } });
}

orderSchema.statics.canTransition = (from, to) => (transitions[from] || []).includes(to);
orderSchema.statics.transitionMap = transitions;

export const Order = mongoose.model('Order', orderSchema);
