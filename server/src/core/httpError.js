// core/httpError.js - domain error boundary.
// Every thrown operational error becomes a deterministic HTTP response.
import { logger } from './logger.js';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Bad request', details) => new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Forbidden') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message = 'Conflict', details) => new HttpError(409, 'CONFLICT', message, details);
export const unprocessable = (message = 'Validation failed', details) => new HttpError(422, 'VALIDATION_ERROR', message, details);
export const tooManyRequests = (message = 'Too many requests') => new HttpError(429, 'RATE_LIMITED', message);
export const serviceUnavailable = (message = 'Service temporarily unavailable', details) =>
  new HttpError(503, 'SERVICE_UNAVAILABLE', message, details);

// Convertmongoose / mongo driver errors into domain errors
export function mapMongoError(err) {
  if (err.name === 'CastError') return badRequest(`Invalid ${err.path}`);
  if (err.name === 'ValidationError') return unprocessable('Validation failed', err.message);
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return conflict(`Duplicate ${field}`, { field });
  }
  return null;
}

export function ensureConnected(state, label) {
  if (state !== 1) throw serviceUnavailable(`${label} is not ready`);
}

export function logInternalError(req, err) {
  logger.error({ requestId: req?.id, err: { message: err.message, stack: err.stack, code: err.code } }, 'internal error');
}
