import request from 'supertest';
import { createApp, type AppOptions } from '../src/app.js';
import { openDatabase } from '../src/db/database.js';

export function setup(options: Partial<AppOptions> = {}) {
  const db = openDatabase(':memory:');
  const app = createApp({ db, ...options });
  const api = request(app);

  let counter = 0;
  async function signUp(
    overrides: Partial<{ email: string; name: string; password: string }> = {},
  ) {
    counter += 1;
    const body = {
      email: `user${counter}@example.com`,
      name: `User ${counter}`,
      password: 'super-secret-password',
      ...overrides,
    };
    const res = await api.post('/api/v1/auth/register').send(body).expect(201);
    return { token: res.body.token as string, user: res.body.user, password: body.password };
  }

  function createLink(token: string, body: Record<string, unknown>) {
    return api.post('/api/v1/links').set('Authorization', `Bearer ${token}`).send(body);
  }

  return { app, db, api, signUp, createLink };
}
