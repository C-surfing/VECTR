import { getPool } from './_db';
import { badMethod, config, handleOptions, json, parseJsonBody } from './_common';

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  user_avatar: string;
  content: string;
  created_at: number;
  parent_id?: string | null;
};

const transformComment = (row: CommentRow) => ({
  id: row.id,
  postId: row.post_id,
  userId: row.user_id,
  username: row.username,
  userAvatar: row.user_avatar,
  content: row.content,
  createdAt: Number(row.created_at) || Date.now(),
  parentId: row.parent_id || null,
});

let parentIdColumnSupported: boolean | null = null;

const checkParentIdColumn = async (pool: ReturnType<typeof getPool>): Promise<boolean> => {
  if (typeof parentIdColumnSupported === 'boolean') return parentIdColumnSupported;
  try {
    const [rows] = await pool.query<any[]>("SHOW COLUMNS FROM comments LIKE 'parent_id'");
    parentIdColumnSupported = Array.isArray(rows) && rows.length > 0;
  } catch {
    parentIdColumnSupported = false;
  }
  return parentIdColumnSupported;
};

export { config };

export default async function handler(request: Request) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;

  const pool = getPool();
  const { searchParams } = new URL(request.url);

  if (request.method === 'GET') {
    const postId = searchParams.get('postId');
    if (!postId) return json({ error: 'Missing postId' }, 400);

    const [rows] = await pool.query<CommentRow[]>(
      'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC',
      [postId],
    );
    return json({ data: rows.map(transformComment) });
  }

  if (request.method === 'POST') {
    const comment = await parseJsonBody<any>(request);
    if (!comment || !comment.id || !comment.postId) {
      return json({ error: 'Invalid comment payload' }, 400);
    }

    const supportsParentId = await checkParentIdColumn(pool);
    if (supportsParentId) {
      await pool.query(
        `INSERT INTO comments (id, post_id, user_id, username, user_avatar, content, created_at, parent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(comment.id),
          String(comment.postId),
          String(comment.userId || ''),
          String(comment.username || 'user'),
          String(comment.userAvatar || ''),
          String(comment.content || ''),
          Number(comment.createdAt || Date.now()),
          comment.parentId ? String(comment.parentId) : null,
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO comments (id, post_id, user_id, username, user_avatar, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(comment.id),
          String(comment.postId),
          String(comment.userId || ''),
          String(comment.username || 'user'),
          String(comment.userAvatar || ''),
          String(comment.content || ''),
          Number(comment.createdAt || Date.now()),
        ],
      );
    }

    return json({ success: true });
  }

  return badMethod();
}
