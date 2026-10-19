import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from '../lib/zod.js';
import {
  authResponseSchema,
  loginSchema,
  registerSchema,
  userSchema,
} from '../modules/auth/auth.schemas.js';
import {
  createLinkSchema,
  linkIdParamsSchema,
  linkListSchema,
  linkSchema,
  linkStatsSchema,
  listLinksQuerySchema,
  statsQuerySchema,
  updateLinkSchema,
} from '../modules/links/links.schemas.js';

const errorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'BAD_REQUEST' }),
      message: z.string(),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
      requestId: z.string(),
    }),
  })
  .openapi('Error');

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const err = (description: string) => json(errorSchema, description);
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { 'application/json': { schema } } },
});

export function buildOpenApiDocument(serverUrl: string) {
  const registry = new OpenAPIRegistry();
  const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  const secured = [{ [bearerAuth.name]: [] }];

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/register',
    tags: ['Auth'],
    summary: 'Create an account',
    request: body(registerSchema),
    responses: {
      201: json(authResponseSchema, 'Account created'),
      400: err('Validation failed'),
      409: err('Email already registered'),
      429: err('Rate limited'),
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    tags: ['Auth'],
    summary: 'Log in and receive a JWT',
    request: body(loginSchema),
    responses: {
      200: json(authResponseSchema, 'Logged in'),
      401: err('Invalid credentials'),
      429: err('Rate limited'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    tags: ['Auth'],
    summary: 'Get the current user',
    security: secured,
    responses: {
      200: json(z.object({ user: userSchema }), 'Current user'),
      401: err('Not authenticated'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/links',
    tags: ['Links'],
    summary: 'Shorten a URL',
    security: secured,
    request: body(createLinkSchema),
    responses: {
      201: json(linkSchema, 'Link created'),
      400: err('Validation failed'),
      401: err('Not authenticated'),
      409: err('Slug already taken'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/links',
    tags: ['Links'],
    summary: 'List your links (paginated, searchable)',
    security: secured,
    request: { query: listLinksQuerySchema },
    responses: { 200: json(linkListSchema, 'A page of links'), 401: err('Not authenticated') },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/links/{id}',
    tags: ['Links'],
    summary: 'Get a link',
    security: secured,
    request: { params: linkIdParamsSchema },
    responses: { 200: json(linkSchema, 'The link'), 404: err('Not found') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/links/{id}',
    tags: ['Links'],
    summary: 'Update a link',
    security: secured,
    request: { params: linkIdParamsSchema, ...body(updateLinkSchema) },
    responses: {
      200: json(linkSchema, 'Updated link'),
      400: err('Validation failed'),
      404: err('Not found'),
      409: err('Slug already taken'),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/links/{id}',
    tags: ['Links'],
    summary: 'Delete a link and its analytics',
    security: secured,
    request: { params: linkIdParamsSchema },
    responses: { 204: { description: 'Deleted' }, 404: err('Not found') },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/links/{id}/stats',
    tags: ['Links'],
    summary: 'Click analytics for a link',
    security: secured,
    request: { params: linkIdParamsSchema, query: statsQuerySchema },
    responses: { 200: json(linkStatsSchema, 'Analytics'), 404: err('Not found') },
  });

  registry.registerPath({
    method: 'get',
    path: '/{slug}',
    tags: ['Redirect'],
    summary: 'Follow a short link',
    request: { params: z.object({ slug: z.string().openapi({ example: 'my-github' }) }) },
    responses: {
      302: { description: 'Redirect to the target URL' },
      404: err('Unknown slug'),
      410: err('Link expired'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/healthz',
    tags: ['Health'],
    summary: 'Liveness probe',
    responses: { 200: { description: 'Process is up' } },
  });
  registry.registerPath({
    method: 'get',
    path: '/readyz',
    tags: ['Health'],
    summary: 'Readiness probe (checks the database)',
    responses: { 200: { description: 'Ready' }, 503: { description: 'Database unavailable' } },
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'BAckENd — URL Shortener API',
      version: '2.0.0',
      description:
        'Shorten URLs, manage them with JWT-authenticated CRUD, and track click analytics.',
    },
    servers: [{ url: serverUrl }],
  });
}
