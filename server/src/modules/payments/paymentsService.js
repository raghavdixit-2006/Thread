// modules/payments/paymentsService.js - Razorpay wiring without the official SDK: the two REST
// calls the flow needs plus HMAC-SHA256 signature checks through node:crypto.
//
// Money rules honoured (AGENTS.md):
//  - the server is the source of truth for money: the gateway order is created with the
//    server-computed amountBreakup.total (paise), never a client-sent figure
//  - an order becomes 'paid' ONLY on verified Razorpay evidence: the checkout HMAC (unforgeable
//    without RAZORPAY_KEY_SECRET - the browser never receives it) or the webhook HMAC; never
//    from client-reported success fields alone
//  - webhook processing is idempotent: replays ACK 200 without re-applying state
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, razorpayEnabled } from '../../core/env.js';
import { HttpError, badRequest, conflict, serviceUnavailable } from '../../core/httpError.js';
import { logger } from '../../core/logger.js';
import * as ordersDal from '../orders/ordersDal.js';

const RAZORPAY_API = 'https://api.razorpay.com/v1';
// test-mode checkout auto-captures; 'authorized' covers auth-then-capture flows with default capture
const PAID_EVIDENCE = ['captured', 'authorized'];

function assertGatewayConfigured() {
  if (!razorpayEnabled) {
    throw serviceUnavailable('Online payments are not configured on this server - use cash on delivery', [
      { field: 'payments', issue: 'missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET' },
    ]);
  }
}

const basicAuth = () => `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;

const hmacHex = (payload, secret) => createHmac('sha256', secret).update(payload).digest('hex');

// constant-time compare with a length guard (timingSafeEqual throws on unequal lengths)
function signaturesMatch(expectedHex, givenHex) {
  const expected = Buffer.from(expectedHex, 'hex');
  const given = Buffer.from(String(givenHex || ''), 'hex');
  return given.length === expected.length && timingSafeEqual(expected, given);
}

async function razorpayCall(path, { method = 'GET', payload } = {}) {
  let response;
  try {
    response = await fetch(`${RAZORPAY_API}${path}`, {
      method,
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
  } catch (err) {
    logger.error({ err: err.message }, 'razorpay api unreachable');
    throw new HttpError(502, 'PAYMENT_GATEWAY_UNAVAILABLE', 'The payment gateway is unreachable - try again shortly');
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null; // gateway error pages can be non-JSON
  } catch {
    body = null;
  }
  if (!response.ok) {
    logger.error({ status: response.status, description: body?.error?.description }, 'razorpay api rejected a call');
    throw new HttpError(502, 'PAYMENT_GATEWAY_ERROR', body?.error?.description || `Payment gateway call failed (HTTP ${response.status})`);
  }
  return body;
}

// what the checkout widget receives: the PUBLIC key id + the gateway order reference, nothing secret
function gatewayPayload(order, razorpayOrderId) {
  return {
    orderId: String(order._id),
    razorpayOrderId,
    keyId: env.RAZORPAY_KEY_ID,
    amount: order.amountBreakup.total, // paise
    currency: 'INR',
  };
}

// ---------------------------------------------------------------------------
// create the gateway order for a thread order (auth: the order owner)
// ---------------------------------------------------------------------------
export async function createPaymentOrder(userId, { orderId }) {
  assertGatewayConfigured();
  const order = await ordersDal.findByIdForUser(orderId, userId);

  if (order.paymentMethod !== 'razorpay') {
    throw badRequest('This order is cash on delivery - nothing to charge online', [{ field: 'orderId', issue: 'cod order' }]);
  }
  if (order.paymentStatus === 'paid') {
    throw conflict('This order is already paid', [{ field: 'orderId', issue: 'already paid' }]);
  }
  if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status)) {
    throw conflict(`An order that is ${order.status} can no longer be paid`, [{ field: 'status', issue: order.status }]);
  }
  if (!['initiated', 'failed'].includes(order.paymentStatus)) {
    throw conflict(`Unexpected payment state (${order.paymentStatus})`, [{ field: 'paymentStatus', issue: order.paymentStatus }]);
  }
  if (order.paymentStatus === 'initiated' && order.paymentOrderId) {
    // reuse the still-open gateway session: reloads and double clicks must not mint new ones
    return gatewayPayload(order, order.paymentOrderId);
  }

  const created = await razorpayCall('/orders', {
    method: 'POST',
    payload: {
      amount: order.amountBreakup.total, // paise - recomputed server-side at placement
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { threadOrder: order.orderNumber },
    },
  });
  const updated = await ordersDal.attachPaymentOrder(order._id, {
    expectStatus: order.status,
    expectPaymentStatus: order.paymentStatus,
    razorpayOrderId: created.id,
    note: `Razorpay session ${created.id} opened for ${order.orderNumber}`,
  });
  if (!updated) {
    throw conflict('The order changed while opening payment - refresh and retry', [{ field: 'orderId', issue: 'race' }]);
  }
  return gatewayPayload(updated, created.id);
}

// ---------------------------------------------------------------------------
// verify the checkout callback.
// signature = HMAC-SHA256(`${razorpay_order_id}|${razorpay_payment_id}`, RAZORPAY_KEY_SECRET) -
// only Razorpay can produce it (the key secret never leaves this server), so a passing HMAC is
// the gateway's own receipt. A best-effort REST cross-check of the payment (amount, linkage,
// status) runs on top of it; if the gateway is unreachable the HMAC alone still stands.
// ---------------------------------------------------------------------------
export async function verifyPayment(userId, { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  assertGatewayConfigured();
  const order = await ordersDal.findByIdForUser(orderId, userId);

  if (!order.paymentOrderId || razorpayOrderId !== order.paymentOrderId) {
    await ordersDal.appendTimeline(order._id, { status: order.status, note: 'Payment verify rejected: gateway id does not match this order', by: 'system' });
    throw badRequest('This payment does not reference the gateway session of this order', [{ field: 'razorpayOrderId', issue: 'mismatch' }]);
  }

  const expected = hmacHex(`${razorpayOrderId}|${razorpayPaymentId}`, env.RAZORPAY_KEY_SECRET);
  if (!signaturesMatch(expected, razorpaySignature)) {
    // tampered callback data - keep the attempt visible on the order record
    await ordersDal.appendTimeline(order._id, { status: order.status, note: 'Payment verify failed: checkout signature is not valid', by: 'system' });
    throw new HttpError(400, 'PAYMENT_SIGNATURE_INVALID', 'Payment signature verification failed');
  }

  // belt-and-braces cross-check at the gateway itself
  try {
    const gatewayPayment = await razorpayCall(`/payments/${encodeURIComponent(razorpayPaymentId)}`);
    if (gatewayPayment.order_id !== razorpayOrderId || Number(gatewayPayment.amount) !== order.amountBreakup.total) {
      logger.error({ orderId: String(order._id), gatewayPayment: gatewayPayment.id }, 'verify cross-check mismatch');
      await ordersDal.appendTimeline(order._id, { status: order.status, note: 'Payment cross-check mismatch against the gateway - needs investigation', by: 'system' });
      throw new HttpError(400, 'PAYMENT_MISMATCH', 'The payment does not match this order - contact support before paying again');
    }
    if (!PAID_EVIDENCE.includes(gatewayPayment.status)) {
      await ordersDal.markPaymentFailed(order._id, {
        expectStatus: order.status,
        expectPaymentStatus: order.paymentStatus,
        note: `The gateway reports payment ${gatewayPayment.id} as ${gatewayPayment.status}, not captured`,
      });
      throw badRequest(`The payment is ${gatewayPayment.status}, not captured yet`, [{ field: 'razorpayPaymentId', issue: gatewayPayment.status }]);
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    // gateway unreachable: the checkout HMAC is already unforgeable - proceed and note the skip
    logger.warn({ err: err.message }, 'verify cross-check skipped (gateway unreachable)');
  }

  const paid = await ordersDal.markPaymentPaid(order._id, {
    expectStatus: order.status,
    expectPaymentStatus: order.paymentStatus,
    paymentId: razorpayPaymentId,
    verifiedBy: 'checkout',
    statusTo: 'confirmed',
    note: `Payment received via Razorpay (checkout signature, ${razorpayPaymentId}) - order confirmed`,
  });
  if (!paid) {
    const current = await ordersDal.findById(order._id);
    if (current?.paymentStatus === 'paid') return current; // verified twice - same payment, no harm
    throw conflict('The order changed while verifying payment - refresh and check the order', [{ field: 'orderId', issue: 'race' }]);
  }
  return paid;
}

// ---------------------------------------------------------------------------
// server-to-server webhook: POST /api/payments/razorpay/webhook (raw-body mounted in app.js).
// Every signature-verified event is ACKed with 2xx - Razorpay retries non-2xx forever - and
// replays are no-ops, so the endpoint stays idempotent.
// ---------------------------------------------------------------------------
export async function handleWebhook(rawBody, signatureHeader) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw serviceUnavailable('The Razorpay webhook secret is not configured on this server', [
      { field: 'payments', issue: 'missing RAZORPAY_WEBHOOK_SECRET' },
    ]);
  }

  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  const expected = hmacHex(raw.toString('utf8'), env.RAZORPAY_WEBHOOK_SECRET);
  if (!signaturesMatch(expected, signatureHeader)) {
    logger.warn('razorpay webhook rejected: x-razorpay-signature does not verify');
    throw new HttpError(400, 'WEBHOOK_SIGNATURE_INVALID', 'Webhook signature verification failed');
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8')); // safe: this exact buffer just passed the HMAC
  } catch {
    throw badRequest('The webhook body failed to parse as JSON', [{ field: 'event', issue: 'unparsable' }]);
  }

  const eventType = event?.event || 'unknown';
  const payment = event?.payload?.payment?.entity || null;
  const gatewayOrder = event?.payload?.order?.entity || null;
  const razorpayOrderId = payment?.order_id || gatewayOrder?.id || null;
  const razorpayPaymentId = payment?.id || null;

  if (!razorpayOrderId) {
    logger.warn({ eventType }, 'razorpay webhook carried no resolvable order - acked, nothing stored');
    return { acknowledged: true, processed: false };
  }
  const order = await ordersDal.findForPaymentOrderId(razorpayOrderId);
  if (!order) {
    // replaced sessions and third-party noise: ACK anyway so Razorpay stops retrying
    logger.warn({ eventType, razorpayOrderId }, 'webhook for an unknown gateway order - acked, nothing stored');
    return { acknowledged: true, processed: false };
  }

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    if (order.paymentStatus === 'paid') return { acknowledged: true, processed: false, duplicate: true }; // idempotent replay
    const gatewayAmount = Number(payment?.amount ?? gatewayOrder?.amount_paid ?? 0);
    if (gatewayAmount !== order.amountBreakup.total) {
      // a money disagreement is never bridged automatically: keep it visible, but still ACK
      // (a retry would replay the same numbers - this needs a human in the dashboard)
      logger.error({ orderId: String(order._id), gatewayAmount, expected: order.amountBreakup.total }, 'webhook amount mismatch');
      await ordersDal.appendTimeline(order._id, {
        status: order.status,
        note: `Webhook reported ${gatewayAmount} paise vs an order total of ${order.amountBreakup.total} - resolve in the Razorpay dashboard`,
        by: 'system',
      });
      return { acknowledged: true, processed: false, mismatch: true };
    }
    const updated = await ordersDal.markPaymentPaid(order._id, {
      expectStatus: order.status,
      expectPaymentStatus: order.paymentStatus,
      paymentId: razorpayPaymentId,
      verifiedBy: 'webhook',
      statusTo: 'confirmed',
      note: `Payment confirmed by the Razorpay webhook (${eventType}${razorpayPaymentId ? `, ${razorpayPaymentId}` : ''}) - order confirmed`,
    });
    if (!updated) return { acknowledged: true, processed: false, duplicate: true };
    return { acknowledged: true, processed: true };
  }

  if (eventType === 'payment.failed') {
    if (order.paymentStatus === 'paid') return { acknowledged: true, processed: false, duplicate: true };
    const updated = await ordersDal.markPaymentFailed(order._id, {
      expectStatus: order.status,
      expectPaymentStatus: order.paymentStatus,
      note: `Payment failed at the gateway (${payment?.error_description || payment?.error_reason || 'reason not provided'}) - a retry is possible from the order page`,
    });
    return { acknowledged: true, processed: Boolean(updated), duplicate: !updated };
  }

  logger.info({ eventType }, 'razorpay webhook event left unprocessed (not in the handled set)');
  return { acknowledged: true, processed: false, ignored: eventType };
}
