import type { ResultSetHeader } from 'mysql2/promise';
import { getPool, parseJsonField } from './_db';
import { badMethod, config, handleOptions, json, parseJsonBody } from './_common';

type PostRow = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  cover_image: string | null;
  video_url: string | null;
  author_id: string;
  author_name: string;
  created_at: number;
  likes: string;
  views: number;
};

const transformPost = (row: PostRow) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  excerpt: row.excerpt,
  category: parseJsonField<string[]>(row.category, []),
  coverImage: row.cover_image || undefined,
  videoUrl: row.video_url || undefined,
  authorId: row.author_id,
  authorName: row.author_name,
  createdAt: Number(row.created_at) || Date.now(),
  likes: parseJsonField<string[]>(row.likes, []),
  views: Number(row.views) || 0,
});

export { config };

export default async function handler(request: Request) {
  const preflight = handleOptions(request);
  if (preflight) return preflight;

  const pool = getPool();
  const { searchParams } = new URL(request.url);

  if (request.method === 'GET') {
    const id = searchParams.get('id');

    if (id) {
      const [rows] = await pool.query<PostRow[]>(
        'SELECT * FROM posts WHERE id = ? LIMIT 1',
        [id],
      );
      if (!rows.length) return json({ data: null });
      return json({ data: transformPost(rows[0]) });
    }

    const [rows] = await pool.query<PostRow[]>('SELECT * FROM posts ORDER BY created_at DESC');
    return json({ data: rows.map(transformPost) });
  }

  if (request.method === 'POST') {
    const post = await parseJsonBody<any>(request);
    if (!post || !post.id || !post.title) {
      return json({ error: 'Invalid post payload' }, 400);
    }

    await pool.query(
      `INSERT INTO posts (
        id, title, content, excerpt, category, cover_image, video_url, author_id, author_name, created_at, likes, views
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        content = VALUES(content),
        excerpt = VALUES(excerpt),
        category = VALUES(category),
        cover_image = VALUES(cover_image),
        video_url = VALUES(video_url),
        author_id = VALUES(author_id),
        author_name = VALUES(author_name),
        created_at = VALUES(created_at),
        likes = VALUES(likes),
        views = VALUES(views)`,
      [
        String(post.id),
        String(post.title || ''),
        String(post.content || ''),
        String(post.excerpt || ''),
        JSON.stringify(Array.isArray(post.category) ? post.category : []),
        post.coverImage ? String(post.coverImage) : null,
        post.videoUrl ? String(post.videoUrl) : null,
        String(post.authorId || ''),
        String(post.authorName || ''),
        Number(post.createdAt || Date.now()),
        JSON.stringify(Array.isArray(post.likes) ? post.likes : []),
        Number(post.views || 0),
      ],
    );

    return json({ success: true });
  }

  if (request.method === 'DELETE') {
    const id = searchParams.get('id');
    if (!id) return json({ error: 'Missing id' }, 400);

    await pool.query('DELETE FROM comments WHERE post_id = ?', [id]);
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM posts WHERE id = ?', [id]);
    const affected = (result as unknown as { affectedRows?: number }).affectedRows || 0;

    if (!affected) {
      return json({ error: 'Post not found or no permission' }, 404);
    }
    return json({ success: true });
  }

  return badMethod();
}
