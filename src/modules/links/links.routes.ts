import { Router } from 'express';
import { parse } from '../../lib/validate.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import type { RateLimiters } from '../../middleware/rate-limit.js';
import {
  createLinkSchema,
  linkIdParamsSchema,
  listLinksQuerySchema,
  statsQuerySchema,
  updateLinkSchema,
} from './links.schemas.js';
import type { LinksService } from './links.service.js';

/** Authenticated CRUD + analytics for the caller's own links, mounted at /api/v1/links. */
export function linksRouter(links: LinksService, limits: RateLimiters): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/', limits.createLink, (req, res) => {
    const link = links.create(currentUser(req).id, parse(createLinkSchema, req.body));
    res.status(201).location(`/api/v1/links/${link.id}`).json(link);
  });

  router.get('/', (req, res) => {
    res.json(links.list(currentUser(req).id, parse(listLinksQuerySchema, req.query)));
  });

  router.get('/:id', (req, res) => {
    const { id } = parse(linkIdParamsSchema, req.params);
    res.json(links.get(currentUser(req).id, id));
  });

  router.patch('/:id', (req, res) => {
    const { id } = parse(linkIdParamsSchema, req.params);
    res.json(links.update(currentUser(req).id, id, parse(updateLinkSchema, req.body)));
  });

  router.delete('/:id', (req, res) => {
    const { id } = parse(linkIdParamsSchema, req.params);
    links.delete(currentUser(req).id, id);
    res.status(204).end();
  });

  router.get('/:id/stats', (req, res) => {
    const { id } = parse(linkIdParamsSchema, req.params);
    const { days } = parse(statsQuerySchema, req.query);
    res.json(links.stats(currentUser(req).id, id, days));
  });

  return router;
}

/** Public `GET /:slug` redirect. Mounted last so it never shadows real routes. */
export function redirectRouter(links: LinksService): Router {
  const router = Router();

  router.get('/:slug', (req, res) => {
    const target = links.resolve(req.params.slug, {
      ip: req.ip,
      referrer: req.get('referer'),
      userAgent: req.get('user-agent'),
    });
    // 302 + no-store so browsers come back through us every time and each click is counted.
    res.set('Cache-Control', 'no-store').redirect(302, target);
  });

  return router;
}
