import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'backend-api';

export interface TokenPayload {
  sub: string;
  email: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, algorithms: ['HS256'] });
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Malformed token payload');
  }
  return { sub: payload.sub, email: payload.email };
}
