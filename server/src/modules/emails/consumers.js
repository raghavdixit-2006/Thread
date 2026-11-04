// modules/emails/consumers.js - event-driven email fan-out (Kafka-swappable bus).
import { subscribe, topics } from '../../core/eventBus.js';
import { emailService, safeSend } from './emailService.js';
import { env } from '../../core/env.js';
import { formatINR } from '../../utils/datetime.js';

export function registerEmailConsumers() {
  // welcome only AFTER email ownership is proven: sending it on USER_REGISTERED told people
  // their account was verified while the OTP prompt was still open.
  subscribe(topics.USER_VERIFIED, async (payload) =>
    safeSend('welcome', () => emailService.sendWelcome({ email: payload.email, name: payload.name, shopUrl: `${env.CLIENT_URL}/shop` })),
  );

  subscribe(topics.ORDER_CREATED, async (order) =>
    safeSend('order-confirmation', () =>
      emailService.sendOrderConfirmation({
        email: order.snapEmail,
        name: order.snapName,
        orderNumber: order.orderNumber,
        totalFmt: formatINR(order.total),
        method: order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod,
        orderUrl: `${env.CLIENT_URL}/orders/${order._id}`,
      }),
    ),
  );

  subscribe(topics.ORDER_CANCELLED, async (order) =>
    safeSend('order-cancelled', () => emailService.sendOrderCancelled({ email: order.snapEmail, name: order.snapName, orderNumber: order.orderNumber })),
  );

  subscribe(topics.ORDER_STATUS_CHANGED, async (order) =>
    safeSend('order-status', () =>
      emailService.sendOrderStatus({ email: order.snapEmail, name: order.snapName, orderNumber: order.orderNumber, status: order.status, note: order.note || '' }),
    ),
  );
}
