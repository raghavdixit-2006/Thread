// core/logger.js - structured JSON logging with PII/secret redaction.
// Dev runs through pino-pretty so request/error lines are readable directly in the terminal.
import { pino } from 'pino';
import { env } from './env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'passwordHash',
  '*.password',
  '*.passwordHash',
  'refreshToken',
  '*.refreshToken',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (env.isProd ? 'info' : 'debug'),
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: { service: 'thread-server', env: env.NODE_ENV },
  ...(env.isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname,service,env',
            singleLine: true,
          },
        },
      }
    : {}),
});
