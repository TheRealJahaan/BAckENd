import { randomBytes, randomUUID, createHash } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const newId = (): string => randomUUID();

/** Generates a URL-safe base62 slug with no modulo bias. */
export function generateSlug(length = 7): string {
  let slug = '';
  while (slug.length < length) {
    for (const byte of randomBytes(length * 2)) {
      // 248 is the largest multiple of 62 below 256; rejecting above it keeps the distribution uniform.
      if (byte < 248) slug += ALPHABET[byte % 62];
      if (slug.length === length) break;
    }
  }
  return slug;
}

/** One-way hash so visitor IPs can be counted as unique without storing them. */
export const hashIp = (ip: string, salt: string): string =>
  createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
