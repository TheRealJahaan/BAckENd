import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

describe('redirects and analytics', () => {
  it('redirects to the target and counts the click', async () => {
    const { api, signUp, createLink } = setup();
    const { token } = await signUp();
    const { body: link } = await createLink(token, { url: 'https://example.com', slug: 'gogo' });

    const res = await api.get('/gogo').expect(302);
    expect(res.headers.location).toBe('https://example.com');
    expect(res.headers['cache-control']).toBe('no-store');

    const after = await api.get(`/api/v1/links/${link.id}`).set('Authorization', `Bearer ${token}`);
    expect(after.body.clickCount).toBe(1);
  });

  it('returns 404 for unknown slugs and 410 for expired links', async () => {
    const { api, db, signUp, createLink } = setup();
    const { token } = await signUp();
    const { body: link } = await createLink(token, { url: 'https://example.com', slug: 'old' });
    db.prepare('UPDATE links SET expires_at = ? WHERE id = ?').run(
      '2000-01-01T00:00:00.000Z',
      link.id,
    );

    const missing = await api.get('/nothing-here').expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    const expired = await api.get('/old').expect(410);
    expect(expired.body.error.code).toBe('GONE');
  });

  it('aggregates clicks by day, unique visitors and referrers', async () => {
    const { api, signUp, createLink } = setup({});
    const { token } = await signUp();
    const { body: link } = await createLink(token, { url: 'https://example.com', slug: 'track' });

    await api
      .get('/track')
      .set('Referer', 'https://twitter.com/some/post')
      .set('X-Forwarded-For', '1.1.1.1');
    await api
      .get('/track')
      .set('Referer', 'https://twitter.com/other')
      .set('X-Forwarded-For', '1.1.1.1');
    await api.get('/track').set('Referer', 'https://news.ycombinator.com/');
    await api.get('/track');

    const res = await api
      .get(`/api/v1/links/${link.id}/stats?days=7`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.totalClicks).toBe(4);
    expect(res.body.uniqueVisitors).toBeGreaterThanOrEqual(1);
    expect(res.body.lastClickedAt).toEqual(expect.any(String));
    expect(res.body.clicksByDay).toHaveLength(7);
    expect(res.body.clicksByDay.at(-1)).toEqual({
      date: new Date().toISOString().slice(0, 10),
      clicks: 4,
    });
    expect(res.body.topReferrers).toEqual([
      { referrer: 'twitter.com', clicks: 2 },
      { referrer: 'direct', clicks: 1 },
      { referrer: 'news.ycombinator.com', clicks: 1 },
    ]);
  });

  it('never stores raw visitor IPs', async () => {
    const { api, db, signUp, createLink } = setup();
    const { token } = await signUp();
    await createLink(token, { url: 'https://example.com', slug: 'priv' });
    await api.get('/priv');

    const row = db.prepare('SELECT visitor_hash FROM clicks').get() as { visitor_hash: string };
    expect(row.visitor_hash).toMatch(/^[0-9a-f]{32}$/);
  });
});
