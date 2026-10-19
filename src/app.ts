import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import type { Database } from './db/database.js';
import { buildOpenApiDocument } from './docs/openapi.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createRateLimiters } from './middleware/rate-limit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { healthRouter } from './modules/health/health.routes.js';
import { linksRouter, redirectRouter } from './modules/links/links.routes.js';
import { LinksService } from './modules/links/links.service.js';
import { landingPage } from './landing.js';

export interface AppOptions {
  db: Database;
  /** Defaults to on everywhere except the test environment. */
  rateLimit?: boolean;
}

export function createApp({ db, rateLimit = env.NODE_ENV !== 'test' }: AppOptions): Express {
  const app = express();
  const limits = createRateLimiters(rateLimit);
  const auth = new AuthService(db);
  const links = new LinksService(db, {
    publicBaseUrl: env.PUBLIC_BASE_URL,
    ipHashSalt: env.JWT_SECRET,
  });
  const openApiDocument = buildOpenApiDocument(env.PUBLIC_BASE_URL);

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
      // Keep access logs compact: one line per request without the full header dump.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        // Swagger UI injects inline styles; everything else stays locked down.
        directives: { 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'data:'] },
      },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      exposedHeaders: ['X-Request-Id', 'Location', 'RateLimit', 'RateLimit-Policy'],
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  app.get('/', (_req, res) => {
    res.type('html').send(landingPage(env.PUBLIC_BASE_URL));
  });
  app.use(healthRouter(db));
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, { customSiteTitle: 'API docs' }),
  );

  app.use('/api', limits.api);
  app.use('/api/v1/auth', authRouter(auth, limits));
  app.use('/api/v1/links', linksRouter(links, limits));
  app.use('/api', notFoundHandler);

  app.use(redirectRouter(links));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
