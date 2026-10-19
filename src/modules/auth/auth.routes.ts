import { Router } from 'express';
import { unauthorized } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import type { RateLimiters } from '../../middleware/rate-limit.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';

export function authRouter(auth: AuthService, limits: RateLimiters): Router {
  const router = Router();

  router.post('/register', limits.auth, async (req, res) => {
    const result = await auth.register(parse(registerSchema, req.body));
    res.status(201).json(result);
  });

  router.post('/login', limits.auth, async (req, res) => {
    res.json(await auth.login(parse(loginSchema, req.body)));
  });

  router.get('/me', requireAuth, (req, res) => {
    const user = auth.findById(currentUser(req).id);
    // The token can outlive a deleted account; treat that as an invalid session.
    if (!user) throw unauthorized('Account no longer exists');
    res.json({ user });
  });

  return router;
}
