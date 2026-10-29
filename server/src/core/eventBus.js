// core/eventBus.js - in-process pub/sub with a Kafka-compatible contract.
//
// Phase 1 runs everything in-process. When Kafka is adopted later, swap
// `publish` for a producer.send and `subscribe` for a consumer-group join -
// signature stays identical so no consumer code changes:
//
//   publish(topic, payload)   -> producer.send({ topic, messages: [{ value }] })
//   subscribe(topic, handler) -> consumer.subscribe({ topic }); consumer.run()
import { EventEmitter } from 'node:events';
import { logger } from './logger.js';

export const topics = {
  PRODUCT_UPSERTED: 'product.upserted',
  PRODUCT_DELETED: 'product.deleted',
  CATALOG_REINDEX: 'catalog.reindex',
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  USER_REGISTERED: 'user.registered', // account row created - still unverified, no email
  USER_VERIFIED: 'user.verified', // email ownership proven (OTP or Google) - welcome belongs here
};

const bus = new EventEmitter();
bus.setMaxListeners(20);

const subscriptions = new Set();

export function publish(topic, payload) {
  setImmediate(() => {
    try {
      bus.emit(topic, { payload, topic, at: Date.now() });
    } catch (err) {
      logger.error({ err: err.message, topic }, 'event bus emit failed');
    }
  });
  return true;
}

export function subscribe(topic, handler) {
  if (subscriptions.has(topic)) return; // one consumer per topic (queue semantics)
  subscriptions.add(topic);
  bus.on(topic, ({ payload, topic: actualTopic }) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((err) => logger.error({ err: { message: err.message, stack: err.stack }, topic: actualTopic }, 'event consumer failed'));
  });
}

export function activeTopics() {
  return [...subscriptions];
}

export function closeBus() {
  bus.removeAllListeners();
  subscriptions.clear();
}
