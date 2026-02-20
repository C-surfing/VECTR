import { getPool, parseJsonField } from './_db';
import { badMethod, config, handleOptions, json } from './_common';

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

  if (request.method !== 'GET') return badMethod();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return json({ data: [] });

  const pool = getPool();
  const pattern = `%${q}%`;
  const [rows] = await pool.query<PostRow[]>(
    `SELECT * FROM posts
     WHERE title LIKE ? OR content LIKE ? OR excerpt LIKE ?
     ORDER BY created_at DESC`,
    [pattern, pattern, pattern],
  );

  return json({ data: rows.map(transformPost) });
}
