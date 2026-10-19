import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

describe('auth', () => {
  it('registers a user and returns a token', async () => {
    const { api } = setup();
    const res = await api
      .post('/api/v1/auth/register')
      .send({ email: '  Jahaan@Example.com ', name: 'Jahaan', password: 'password123' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email: 'jahaan@example.com', name: 'Jahaan' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('rejects duplicate emails case-insensitively', async () => {
    const { api, signUp } = setup();
    await signUp({ email: 'dup@example.com' });
    const res = await api
      .post('/api/v1/auth/register')
      .send({ email: 'DUP@example.com', name: 'Again', password: 'password123' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates the request body with field-level details', async () => {
    const { api } = setup();
    const res = await api
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', name: '', password: 'short' })
      .expect(400);

    expect(res.body.error.code).toBe('BAD_REQUEST');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'name', 'password']));
  });

  it('logs in with correct credentials', async () => {
    const { api, signUp } = setup();
    const { user, password } = await signUp();
    const res = await api
      .post('/api/v1/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const { api, signUp } = setup();
    const { user } = await signUp();

    const wrongPassword = await api
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'wrong-password' })
      .expect(401);
    const unknownEmail = await api
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever123' })
      .expect(401);

    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmail.body.error).toMatchObject({
      code: wrongPassword.body.error.code,
      message: wrongPassword.body.error.message,
    });
  });

  it('returns the current user for a valid token', async () => {
    const { api, signUp } = setup();
    const { token, user } = await signUp();
    const res = await api
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.user).toEqual(user);
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['garbage token', 'Bearer not.a.jwt'],
  ])('rejects /me with %s', async (_label, header) => {
    const { api } = setup();
    const req = api.get('/api/v1/auth/me');
    if (header) req.set('Authorization', header);
    const res = await req.expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token whose account was deleted', async () => {
    const { api, db, signUp } = setup();
    const { token, user } = await signUp();
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('rate limits repeated login attempts when enabled', async () => {
    const { api } = setup({ rateLimit: true });
    const attempt = () =>
      api.post('/api/v1/auth/login').send({ email: 'x@example.com', password: 'nope-nope' });

    for (let i = 0; i < 20; i++) await attempt().expect(401);
    const res = await attempt().expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
