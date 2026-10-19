import { describe, expect, it } from 'vitest';
import { generateSlug, hashIp } from '../src/lib/ids.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { openDatabase } from '../src/db/database.js';
import { migrations } from '../src/db/migrations.js';

describe('password hashing', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('hunter2-hunter2');
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(await verifyPassword('hunter2-hunter2', hash)).toBe(true);
    expect(await verifyPassword('hunter3-hunter3', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'md5$abc$def')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});

describe('ids', () => {
  it('generates base62 slugs of the requested length', () => {
    for (let i = 0; i < 200; i++) expect(generateSlug(9)).toMatch(/^[0-9A-Za-z]{9}$/);
  });

  it('hashes IPs deterministically per salt', () => {
    expect(hashIp('1.2.3.4', 'a')).toBe(hashIp('1.2.3.4', 'a'));
    expect(hashIp('1.2.3.4', 'a')).not.toBe(hashIp('1.2.3.4', 'b'));
  });
});

describe('migrations', () => {
  it('sets user_version to the number of migrations', () => {
    const db = openDatabase(':memory:');
    const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(row.user_version).toBe(migrations.length);
  });
});
