import { getPool } from './_db';
import { badMethod, config, handleOptions, json, parseJsonBody } from './_common';

type FriendStatus = 'approved' | 'pending' | 'rejected';

type FriendRow = {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
  status?: string;
  created_at?: number;
};

const VALID_STATUSES: FriendStatus[] = ['approved', 'pending', 'rejected'];

const normalizeStatus = (value: unknown, fallback: FriendStatus = 'approved'): FriendStatus => {
  const candidate = String(value || '').toLowerCase() as FriendStatus;
  return VALID_STATUSES.includes(candidate) ? candidate : fallback;
};

const isMissingColumnError = (error: unknown, column: string): boolean => {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes('unknown column') && message.includes(column.toLowerCase());
};

const transformFriend = (row: FriendRow) => ({
  id: row.id,
  name: row.name,
  url: row.url,
  description: row.description,
  avatar: row.avatar,
  status: normalizeStatus(row.status, 'approved'),
  createdAt: Number(row.created_at || Date.now()),
});

export { config };

export default async function handler(request: Request) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;

  const pool = getPool();
  const { searchParams } = new URL(request.url);

  if (request.method === 'GET') {
    const status = searchParams.get('status');
    const statusFilter = status && status !== 'all' ? normalizeStatus(status, 'approved') : 'all';

    let rows: FriendRow[] = [];
    try {
      const [result] = await pool.query<FriendRow[]>('SELECT * FROM friends ORDER BY created_at DESC, name ASC');
      rows = result;
    } catch (error) {
      if (isMissingColumnError(error, 'created_at')) {
        const [legacyRows] = await pool.query<FriendRow[]>('SELECT * FROM friends ORDER BY name ASC');
        rows = legacyRows;
      } else {
        throw error;
      }
    }

    const allFriends = rows.map(transformFriend);
    const filtered =
      statusFilter === 'all'
        ? allFriends
        : allFriends.filter((friend) => friend.status === statusFilter);
    return json({ data: filtered });
  }

  if (request.method === 'POST') {
    const friend = await parseJsonBody<any>(request);
    if (!friend || !friend.id || !friend.name || !friend.url) {
      return json({ error: 'Invalid friend payload' }, 400);
    }

    const normalizedStatus = normalizeStatus(friend.status, 'pending');
    const createdAt = Number(friend.createdAt || Date.now());
    try {
      await pool.query(
        `INSERT INTO friends (id, name, url, description, avatar, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           url = VALUES(url),
           description = VALUES(description),
           avatar = VALUES(avatar),
           status = VALUES(status),
           created_at = VALUES(created_at)`,
        [
          String(friend.id),
          String(friend.name),
          String(friend.url),
          String(friend.description || ''),
          String(friend.avatar || ''),
          normalizedStatus,
          createdAt,
        ],
      );
    } catch (error) {
      if (
        isMissingColumnError(error, 'status') ||
        isMissingColumnError(error, 'created_at')
      ) {
        await pool.query(
          `INSERT INTO friends (id, name, url, description, avatar)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             url = VALUES(url),
             description = VALUES(description),
             avatar = VALUES(avatar)`,
          [
            String(friend.id),
            String(friend.name),
            String(friend.url),
            String(friend.description || ''),
            String(friend.avatar || ''),
          ],
        );
      } else {
        throw error;
      }
    }

    return json({ success: true });
  }

  if (request.method === 'PATCH') {
    const body = await parseJsonBody<any>(request);
    const id = String(body?.id || '').trim();
    const status = normalizeStatus(body?.status, 'pending');
    if (!id) return json({ error: 'Missing friend id' }, 400);

    try {
      await pool.query('UPDATE friends SET status = ? WHERE id = ?', [status, id]);
    } catch (error) {
      if (isMissingColumnError(error, 'status')) {
        return json({ error: 'friends 表缺少 status 字段，请先执行数据库迁移' }, 400);
      }
      throw error;
    }

    return json({ success: true });
  }

  return badMethod();
}
