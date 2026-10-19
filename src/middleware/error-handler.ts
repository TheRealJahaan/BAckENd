import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, notFound } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req) => {
  throw notFound(`Route ${req.method} ${req.path} not found`);
};

/**
 * Converts every thrown error into a consistent JSON envelope:
 * `{ error: { code, message, details?, requestId } }`.
 * Unknown errors are logged and reported as a generic 500 so internals never leak.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let error: AppError;
  if (err instanceof AppError) {
    error = err;
  } else if (err?.type === 'entity.parse.failed') {
    error = new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  } else if (err?.type === 'entity.too.large') {
    error = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  } else {
    req.log.error({ err }, 'Unhandled error');
    error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
  }

  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined && { details: error.details }),
      requestId: req.id,
    },
  });
};
