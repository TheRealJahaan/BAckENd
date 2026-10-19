import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

const passThrough: RequestHandler = (_req, _res, next) => next();

function limiter(windowMs: number, limit: number, enabled: boolean): RequestHandler {
  if (!enabled) return passThrough;
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please slow down',
          requestId: req.id,
        },
      });
    },
  });
}

export function createRateLimiters(enabled: boolean) {
  return {
    api: limiter(15 * 60 * 1000, 300, enabled),
    auth: limiter(15 * 60 * 1000, 20, enabled),
    createLink: limiter(60 * 60 * 1000, 60, enabled),
  };
}

export type RateLimiters = ReturnType<typeof createRateLimiters>;
