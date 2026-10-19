import { type Database, transaction } from '../../db/database.js';
import { badRequest, conflict, gone, notFound } from '../../lib/errors.js';
import { generateSlug, hashIp, newId } from '../../lib/ids.js';
import type {
  CreateLinkInput,
  Link,
  LinkList,
  LinkStats,
  ListLinksQuery,
  UpdateLinkInput,
} from './links.schemas.js';

interface LinkRow {
  id: string;
  user_id: string;
  slug: string;
  target_url: string;
  title: string | null;
  click_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClickContext {
  ip: string | undefined;
  referrer: string | undefined;
  userAgent: string | undefined;
}

export interface LinksServiceOptions {
  publicBaseUrl: string;
  /** Salt mixed into visitor IP hashes so they can't be reversed with a lookup table. */
  ipHashSalt: string;
}

const MAX_SLUG_ATTEMPTS = 5;

export class LinksService {
  private readonly ownHost: string;

  constructor(
    private readonly db: Database,
    private readonly options: LinksServiceOptions,
  ) {
    this.ownHost = new URL(options.publicBaseUrl).host;
  }

  create(userId: string, input: CreateLinkInput): Link {
    this.assertNotSelfReferential(input.url);

    if (input.slug) {
      this.assertSlugAvailable(input.slug);
      return this.toLink(this.insert(userId, input.slug, input));
    }

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const candidate = generateSlug();
      if (!this.findRowBySlug(candidate)) return this.toLink(this.insert(userId, candidate, input));
    }
    throw new Error('Could not generate a unique slug');
  }

  list(userId: string, query: ListLinksQuery): LinkList {
    const where = ['user_id = ?'];
    const params: string[] = [userId];
    if (query.q) {
      const pattern = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push(
        `(slug LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' OR target_url LIKE ? ESCAPE '\\')`,
      );
      params.push(pattern, pattern, pattern);
    }
    const clause = where.join(' AND ');

    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total FROM links WHERE ${clause}`)
      .get(...params) as { total: number };
    const rows = this.db
      .prepare(`SELECT * FROM links WHERE ${clause} ORDER BY created_at DESC, id LIMIT ? OFFSET ?`)
      .all(...params, query.limit, (query.page - 1) * query.limit) as unknown as LinkRow[];

    return {
      data: rows.map((row) => this.toLink(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  get(userId: string, id: string): Link {
    return this.toLink(this.getOwnedRow(userId, id));
  }

  update(userId: string, id: string, input: UpdateLinkInput): Link {
    const current = this.getOwnedRow(userId, id);
    if (input.url) this.assertNotSelfReferential(input.url);
    if (input.slug && input.slug !== current.slug) this.assertSlugAvailable(input.slug);

    const row = this.db
      .prepare(
        `UPDATE links
            SET slug = ?, target_url = ?, title = ?, expires_at = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
          RETURNING *`,
      )
      .get(
        input.slug ?? current.slug,
        input.url ?? current.target_url,
        input.title === undefined ? current.title : input.title,
        input.expiresAt === undefined ? current.expires_at : input.expiresAt,
        id,
      ) as unknown as LinkRow;
    return this.toLink(row);
  }

  delete(userId: string, id: string): void {
    this.getOwnedRow(userId, id);
    this.db.prepare('DELETE FROM links WHERE id = ?').run(id);
  }

  stats(userId: string, id: string, days: number): LinkStats {
    const link = this.getOwnedRow(userId, id);

    const totals = this.db
      .prepare(
        `SELECT COUNT(DISTINCT visitor_hash) AS unique_visitors, MAX(clicked_at) AS last_clicked_at
           FROM clicks WHERE link_id = ?`,
      )
      .get(id) as { unique_visitors: number; last_clicked_at: string | null };

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const daily = this.db
      .prepare(
        `SELECT substr(clicked_at, 1, 10) AS date, COUNT(*) AS clicks
           FROM clicks WHERE link_id = ? AND clicked_at >= ?
          GROUP BY date`,
      )
      .all(id, since.toISOString()) as { date: string; clicks: number }[];
    const clicksOn = new Map(daily.map((d) => [d.date, d.clicks]));

    // Emit every day in the window, including days with no clicks, so charts need no gap-filling.
    const clicksByDay = Array.from({ length: days }, (_, i) => {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      const date = day.toISOString().slice(0, 10);
      return { date, clicks: clicksOn.get(date) ?? 0 };
    });

    const topReferrers = this.db
      .prepare(
        `SELECT COALESCE(referrer, 'direct') AS referrer, COUNT(*) AS clicks
           FROM clicks WHERE link_id = ?
          GROUP BY 1 ORDER BY clicks DESC, referrer LIMIT 10`,
      )
      .all(id) as { referrer: string; clicks: number }[];

    return {
      linkId: id,
      totalClicks: link.click_count,
      uniqueVisitors: totals.unique_visitors,
      lastClickedAt: totals.last_clicked_at,
      days,
      clicksByDay,
      topReferrers,
    };
  }

  /** Looks up a slug for redirecting and records the visit. */
  resolve(slug: string, context: ClickContext): string {
    const link = this.findRowBySlug(slug);
    if (!link) throw notFound('Short link not found');
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      throw gone('This short link has expired');
    }

    transaction(this.db, () => {
      this.db
        .prepare(
          'INSERT INTO clicks (link_id, referrer, user_agent, visitor_hash) VALUES (?, ?, ?, ?)',
        )
        .run(
          link.id,
          referrerHost(context.referrer),
          context.userAgent?.slice(0, 512) ?? null,
          context.ip ? hashIp(context.ip, this.options.ipHashSalt) : null,
        );
      this.db.prepare('UPDATE links SET click_count = click_count + 1 WHERE id = ?').run(link.id);
    });

    return link.target_url;
  }

  private insert(userId: string, slug: string, input: CreateLinkInput): LinkRow {
    return this.db
      .prepare(
        `INSERT INTO links (id, user_id, slug, target_url, title, expires_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(
        newId(),
        userId,
        slug,
        input.url,
        input.title ?? null,
        input.expiresAt ?? null,
      ) as unknown as LinkRow;
  }

  private getOwnedRow(userId: string, id: string): LinkRow {
    const row = this.db.prepare('SELECT * FROM links WHERE id = ?').get(id) as LinkRow | undefined;
    // Someone else's link is reported as missing so IDs can't be probed for existence.
    if (!row || row.user_id !== userId) throw notFound('Link not found');
    return row;
  }

  private findRowBySlug(slug: string): LinkRow | undefined {
    return this.db.prepare('SELECT * FROM links WHERE slug = ?').get(slug) as LinkRow | undefined;
  }

  private assertSlugAvailable(slug: string): void {
    if (this.findRowBySlug(slug)) throw conflict(`The slug "${slug}" is already taken`);
  }

  private assertNotSelfReferential(url: string): void {
    if (new URL(url).host === this.ownHost) {
      throw badRequest('Links cannot point back to this shortener');
    }
  }

  private toLink(row: LinkRow): Link {
    return {
      id: row.id,
      slug: row.slug,
      shortUrl: `${this.options.publicBaseUrl}/${row.slug}`,
      url: row.target_url,
      title: row.title,
      clickCount: row.click_count,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function referrerHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host || null;
  } catch {
    return null;
  }
}
