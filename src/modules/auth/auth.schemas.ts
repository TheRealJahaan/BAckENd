import { z } from '../../lib/zod.js';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254))
  .openapi({ example: 'jahaan@example.com' });

export const registerSchema = z
  .object({
    email,
    name: z.string().trim().min(1).max(80).openapi({ example: 'Jahaan Suthar' }),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .openapi({ example: 'correct-horse-battery' }),
  })
  .openapi('RegisterRequest');

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).max(128).openapi({ example: 'correct-horse-battery' }),
  })
  .openapi('LoginRequest');

export const userSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
    createdAt: z.iso.datetime(),
  })
  .openapi('User');

export const authResponseSchema = z
  .object({
    user: userSchema,
    token: z.string().openapi({ description: 'JWT to send as `Authorization: Bearer <token>`' }),
  })
  .openapi('AuthResponse');

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type User = z.infer<typeof userSchema>;
