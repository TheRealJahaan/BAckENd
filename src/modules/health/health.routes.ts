import { Router } from 'express';
import type { Database } from '../../db/database.js';

const startedAt = Date.now();

export function healthRouter(db: Database): Router {
  const router = Router();

  // Liveness: the process is up and serving requests.
  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
  });

  // Readiness: dependencies (the database) are reachable.
  router.get('/readyz', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ready', checks: { database: 'ok' } });
    } catch (err) {
      req.log.error({ err }, 'Readiness check failed');
      res.status(503).json({ status: 'unavailable', checks: { database: 'error' } });
    }
  });

  return router;
}
