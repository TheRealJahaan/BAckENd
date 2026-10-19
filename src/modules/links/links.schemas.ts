import { z } from '../../lib/zod.js';

/** Paths the app itself serves at the root, which therefore can't be used as slugs. */
export const RESERVED_SLUGS = new Set([
  'api',
  'docs',
  'openapi.json',
  'healthz',
  'readyz',
  'favicon.ico',
  'robots.txt',
]);

const targetUrl = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .openapi({ example: 'https://github.com/TheRealJahaan' });

const slug = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, 'Slug may only contain letters, numbers, "-" and "_"')
  .refine((value) => !RESERVED_SLUGS.has(value.toLowerCase()), 'This slug is reserved')
  .openapi({ example: 'my-github' });

const futureDate = z.iso
  .datetime({ offset: true })
  .refine((value) => new Date(value).getTime() > Date.now(), 'Expiry must be in the future')
  .transform((value) => new Date(value).toISOString());

export const createLinkSchema = z
  .object({
    url: targetUrl,
    slug: slug
      .optional()
      .openapi({ description: 'Custom alias. A random one is generated if omitted.' }),
    title: z.string().trim().min(1).max(120).optional().openapi({ example: 'My GitHub profile' }),
    expiresAt: futureDate.optional().openapi({ example: '2030-01-01T00:00:00Z' }),
  })
  .openapi('CreateLinkRequest');

export const updateLinkSchema = z
  .object({
    url: targetUrl.optional(),
    slug: slug.optional(),
    title: z.string().trim().min(1).max(120).nullable().optional(),
    expiresAt: futureDate.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update')
  .openapi('UpdateLinkRequest');

export const listLinksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional().openapi({ description: 'Search slug, title or URL' }),
});

export const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const linkIdParamsSchema = z.object({ id: z.uuid() });

export const linkSchema = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    shortUrl: z.url(),
    url: z.url(),
    title: z.string().nullable(),
    clickCount: z.number().int(),
    expiresAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Link');

export const linkListSchema = z
  .object({
    data: z.array(linkSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  })
  .openapi('LinkList');

export const linkStatsSchema = z
  .object({
    linkId: z.uuid(),
    totalClicks: z.number().int(),
    uniqueVisitors: z.number().int(),
    lastClickedAt: z.iso.datetime().nullable(),
    days: z.number().int(),
    clicksByDay: z.array(z.object({ date: z.iso.date(), clicks: z.number().int() })),
    topReferrers: z.array(z.object({ referrer: z.string(), clicks: z.number().int() })),
  })
  .openapi('LinkStats');

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type ListLinksQuery = z.infer<typeof listLinksQuerySchema>;
export type Link = z.infer<typeof linkSchema>;
export type LinkList = z.infer<typeof linkListSchema>;
export type LinkStats = z.infer<typeof linkStatsSchema>;
