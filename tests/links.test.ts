import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('links', () => {
  it('requires authentication', async () => {
    const { api } = setup();
    await api.get('/api/v1/links').expect(401);
    await api.post('/api/v1/links').send({ url: 'https://example.com' }).expect(401);
  });

  it('creates a link with a generated slug', async () => {
    const { signUp, createLink } = setup();
    const { token } = await signUp();
    const res = await createLink(token, { url: 'https://example.com/a/b?c=d' }).expect(201);

    expect(res.body).toMatchObject({
      url: 'https://example.com/a/b?c=d',
      clickCount: 0,
      title: null,
      expiresAt: null,
    });
    expect(res.body.slug).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(res.body.shortUrl).toBe(`http://localhost:4000/${res.body.slug}`);
    expect(res.headers.location).toBe(`/api/v1/links/${res.body.id}`);
  });

  it('creates a link with a custom slug, title and expiry', async () => {
    const { signUp, createLink } = setup();
    const { token } = await signUp();
    const res = await createLink(token, {
      url: 'https://github.com/TheRealJahaan',
      slug: 'jahaan',
      title: 'GitHub',
      expiresAt: '2099-01-01T00:00:00+05:30',
    }).expect(201);
    expect(res.body).toMatchObject({
      slug: 'jahaan',
      title: 'GitHub',
      expiresAt: '2098-12-31T18:30:00.000Z',
    });
  });

  it.each([
    [{ url: 'ftp://example.com' }, 'url'],
    [{ url: 'javascript:alert(1)' }, 'url'],
    [{ url: 'not a url' }, 'url'],
    [{ url: 'https://example.com', slug: 'a' }, 'slug'],
    [{ url: 'https://example.com', slug: 'has space' }, 'slug'],
    [{ url: 'https://example.com', slug: 'DOCS' }, 'slug'],
    [{ url: 'https://example.com', expiresAt: '2000-01-01T00:00:00Z' }, 'expiresAt'],
  ])('rejects invalid input %j', async (body, field) => {
    const { signUp, createLink } = setup();
    const { token } = await signUp();
    const res = await createLink(token, body).expect(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(field);
  });

  it('refuses links that point back at the shortener', async () => {
    const { signUp, createLink } = setup();
    const { token } = await signUp();
    const res = await createLink(token, { url: 'http://localhost:4000/abc' }).expect(400);
    expect(res.body.error.message).toMatch(/cannot point back/);
  });

  it('rejects a slug that is already taken', async () => {
    const { signUp, createLink } = setup();
    const a = await signUp();
    const b = await signUp();
    await createLink(a.token, { url: 'https://a.com', slug: 'taken' }).expect(201);
    const res = await createLink(b.token, { url: 'https://b.com', slug: 'taken' }).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('lists only the caller’s links, newest first, with pagination and search', async () => {
    const { api, signUp, createLink } = setup();
    const me = await signUp();
    const other = await signUp();
    for (const slug of ['alpha', 'bravo', 'charlie']) {
      await createLink(me.token, { url: `https://${slug}.com`, slug }).expect(201);
    }
    await createLink(other.token, { url: 'https://other.com', slug: 'other' }).expect(201);

    const page1 = await api.get('/api/v1/links?limit=2').set(auth(me.token)).expect(200);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(page1.body.data.map((l: { slug: string }) => l.slug)).toEqual(['charlie', 'bravo']);

    const page2 = await api.get('/api/v1/links?limit=2&page=2').set(auth(me.token)).expect(200);
    expect(page2.body.data.map((l: { slug: string }) => l.slug)).toEqual(['alpha']);

    const search = await api.get('/api/v1/links?q=brav').set(auth(me.token)).expect(200);
    expect(search.body.data.map((l: { slug: string }) => l.slug)).toEqual(['bravo']);

    const wildcard = await api.get('/api/v1/links?q=%25').set(auth(me.token)).expect(200);
    expect(wildcard.body.pagination.total).toBe(0);
  });

  it('validates pagination parameters', async () => {
    const { api, signUp } = setup();
    const { token } = await signUp();
    await api.get('/api/v1/links?limit=1000').set(auth(token)).expect(400);
    await api.get('/api/v1/links?page=0').set(auth(token)).expect(400);
  });

  it('gets, updates and deletes a link', async () => {
    const { api, signUp, createLink } = setup();
    const { token } = await signUp();
    const { body: link } = await createLink(token, { url: 'https://old.com', title: 'Old' });

    await api.get(`/api/v1/links/${link.id}`).set(auth(token)).expect(200, link);

    const updated = await api
      .patch(`/api/v1/links/${link.id}`)
      .set(auth(token))
      .send({ url: 'https://new.com', slug: 'renamed', title: null })
      .expect(200);
    expect(updated.body).toMatchObject({ url: 'https://new.com', slug: 'renamed', title: null });
    expect(updated.body.updatedAt >= link.updatedAt).toBe(true);

    await api.delete(`/api/v1/links/${link.id}`).set(auth(token)).expect(204);
    await api.get(`/api/v1/links/${link.id}`).set(auth(token)).expect(404);
    await api.get('/renamed').expect(404);
  });

  it('rejects an empty update', async () => {
    const { api, signUp, createLink } = setup();
    const { token } = await signUp();
    const { body: link } = await createLink(token, { url: 'https://a.com' });
    await api.patch(`/api/v1/links/${link.id}`).set(auth(token)).send({}).expect(400);
  });

  it('hides other users’ links behind a 404', async () => {
    const { api, signUp, createLink } = setup();
    const owner = await signUp();
    const intruder = await signUp();
    const { body: link } = await createLink(owner.token, { url: 'https://private.com' });

    await api.get(`/api/v1/links/${link.id}`).set(auth(intruder.token)).expect(404);
    await api
      .patch(`/api/v1/links/${link.id}`)
      .set(auth(intruder.token))
      .send({ url: 'https://evil.com' })
      .expect(404);
    await api.delete(`/api/v1/links/${link.id}`).set(auth(intruder.token)).expect(404);
    await api.get(`/api/v1/links/${link.id}/stats`).set(auth(intruder.token)).expect(404);
  });

  it('rejects malformed ids', async () => {
    const { api, signUp } = setup();
    const { token } = await signUp();
    await api.get('/api/v1/links/123').set(auth(token)).expect(400);
  });
});
