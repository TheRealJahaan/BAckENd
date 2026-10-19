import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

describe('platform', () => {
  it('serves liveness and readiness probes', async () => {
    const { api } = setup();
    const live = await api.get('/healthz').expect(200);
    expect(live.body.status).toBe('ok');
    const ready = await api.get('/readyz').expect(200);
    expect(ready.body).toEqual({ status: 'ready', checks: { database: 'ok' } });
  });

  it('reports not ready when the database is gone', async () => {
    const { api, db } = setup();
    db.close();
    const res = await api.get('/readyz').expect(503);
    expect(res.body.checks.database).toBe('error');
  });

  it('serves the landing page, OpenAPI spec and Swagger UI', async () => {
    const { api } = setup();
    await api.get('/').expect(200).expect('Content-Type', /html/);
    const spec = await api.get('/openapi.json').expect(200);
    expect(spec.body.openapi).toBe('3.1.0');
    expect(Object.keys(spec.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/register',
        '/api/v1/links',
        '/api/v1/links/{id}/stats',
      ]),
    );
    await api.get('/docs/').expect(200).expect('Content-Type', /html/);
  });

  it('sets security headers and a request id', async () => {
    const { api } = setup();
    const res = await api.get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('echoes an incoming request id', async () => {
    const { api } = setup();
    const res = await api.get('/healthz').set('X-Request-Id', 'trace-123');
    expect(res.headers['x-request-id']).toBe('trace-123');
  });

  it('returns JSON errors for unknown API routes and bad JSON', async () => {
    const { api } = setup();
    const missing = await api.get('/api/v1/nope').expect(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });

    const badJson = await api
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects oversized bodies', async () => {
    const { api } = setup();
    const res = await api
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', name: 'x'.repeat(20_000), password: 'password123' })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
