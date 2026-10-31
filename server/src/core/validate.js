// core/validate.js - zero-trust zod validation at every entry boundary.
// Parses body/query/params, strips unknown keys (mass-assignment prevention),
// and returns field-specific { field, issue } errors (422).
import { unprocessable } from './httpError.js';

function zodIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.filter((p) => typeof p === 'string').join('.') || issue.path.join('.'),
    issue,
  }));
}

/** makeMiddleware(schema) -> (req,res,next) parsed onto req.data.<source> */
export function validate(schema, { source = 'body' } = {}) {
  return function validateRequest(req, _res, next) {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(unprocessable('Validation failed', zodIssues(parsed.error)));
    }
    req.data ||= { body: null, query: null, params: null };
    req.data[source] = parsed.data;
    next();
  };
}

/** Parse without middleware factory (helpers in services) */
export function parseOrThrow(schema, input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw unprocessable('Validation failed', zodIssues(parsed.error));
  }
  return parsed.data;
}

export const validateBody = (schema) => validate(schema, { source: 'body' });
export const validateQuery = (schema) => validate(schema, { source: 'query' });
export const validateParams = (schema) => validate(schema, { source: 'params' });
