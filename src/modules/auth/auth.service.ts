import type { Database } from '../../db/database.js';
import { AppError, conflict } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { signToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import type { LoginInput, RegisterInput, User } from './auth.schemas.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.created_at,
});

// A real hash of a throwaway password, so failed logins for unknown emails take as long
// as failed logins for real ones and can't be used to enumerate accounts.
const dummyHash = hashPassword('timing-attack-mitigation');

export class AuthService {
  constructor(private readonly db: Database) {}

  async register(input: RegisterInput): Promise<{ user: User; token: string }> {
    const existing = this.db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email);
    if (existing) throw conflict('An account with this email already exists');

    const row = this.db
      .prepare(
        `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)
         RETURNING id, email, name, password_hash, created_at`,
      )
      .get(
        newId(),
        input.email,
        input.name,
        await hashPassword(input.password),
      ) as unknown as UserRow;

    const user = toUser(row);
    return { user, token: await signToken({ sub: user.id, email: user.email }) };
  }

  async login(input: LoginInput): Promise<{ user: User; token: string }> {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(input.email) as
      UserRow | undefined;

    const valid = await verifyPassword(input.password, row?.password_hash ?? (await dummyHash));
    if (!row || !valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    const user = toUser(row);
    return { user, token: await signToken({ sub: user.id, email: user.email }) };
  }

  findById(id: string): User | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row && toUser(row);
  }
}
