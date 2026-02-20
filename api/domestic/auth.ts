import crypto from 'node:crypto';
import { getPool } from './_db';
import { badMethod, config, handleOptions, json, parseJsonBody } from './_common';

type AuthAction = 'register' | 'login';

type AuthBody = {
  action?: AuthAction;
  email?: string;
  password?: string;
  username?: string;
  avatarUrl?: string;
};

const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
};

const createId = (): string => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

export { config };

export default async function handler(request: Request) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;

  if (request.method !== 'POST') return badMethod();

  const body = await parseJsonBody<AuthBody>(request);
  const action = body.action;
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const username = String(body.username || '').trim();
  const avatarUrl = String(body.avatarUrl || '').trim();

  if (!action || !email || !password) {
    return json({ success: false, error: '参数不完整' }, 400);
  }

  const pool = getPool();

  if (action === 'register') {
    if (!username) return json({ success: false, error: '用户名不能为空' }, 400);
    const resolvedAvatar =
      avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username || email)}`;

    const [existing] = await pool.query<any[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    if (existing.length > 0) {
      return json({ success: false, error: '该邮箱已注册' }, 409);
    }

    const id = createId();
    const passwordHash = hashPassword(password);

    await pool.query(
      `INSERT INTO users (id, email, password_hash, username, avatar_url, role, created_at)
       VALUES (?, ?, ?, ?, ?, 'user', ?)`,
      [id, email, passwordHash, username, resolvedAvatar, Date.now()],
    );

    return json({
      success: true,
      user: {
        id,
        username,
        avatar: resolvedAvatar,
        role: 'user',
      },
    });
  }

  if (action === 'login') {
    const [rows] = await pool.query<any[]>(
      `SELECT id, email, password_hash, username, avatar_url, role
       FROM users WHERE email = ? LIMIT 1`,
      [email],
    );

    if (!rows.length) {
      return json({ success: false, error: '账号或密码错误' }, 401);
    }

    const row = rows[0];
    if (!verifyPassword(password, row.password_hash)) {
      return json({ success: false, error: '账号或密码错误' }, 401);
    }

    return json({
      success: true,
      user: {
        id: String(row.id),
        username: String(row.username || email.split('@')[0]),
        avatar:
          String(row.avatar_url || '') ||
          `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(email)}`,
        role: row.role === 'admin' ? 'admin' : 'user',
      },
    });
  }

  return json({ success: false, error: '不支持的操作' }, 400);
}
