import type { RequestHandler } from 'express';
import { unauthorized } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Requires a valid `Authorization: Bearer <jwt>` header and exposes the caller as `req.user`. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  const [scheme, token] = header?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw unauthorized('Missing or malformed Authorization header');
  }
  try {
    const payload = await verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  next();
};

/** Returns the authenticated user; only call inside routes guarded by `requireAuth`. */
export function currentUser(req: Express.Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
