import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
};

const parseEpoch = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string') {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) return Math.floor(asNum);
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) return asDate;
  }
  if (value instanceof Date) return value.getTime();
  return Date.now();
};

const asJsonString = (value, fallback) => {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(fallback);
    }
  }
  return JSON.stringify(fallback);
};

const fetchAllRows = async (supabase, table, columns = '*') => {
  const pageSize = 500;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`[supabase:${table}] ${error.message}`);
    }

    if (!data || data.length === 0) break;
    rows.push(...data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
};

const main = async () => {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const dbHost = requireEnv('DOMESTIC_DB_HOST');
  const dbPort = Number(process.env.DOMESTIC_DB_PORT || '3306');
  const dbUser = requireEnv('DOMESTIC_DB_USER');
  const dbPassword = requireEnv('DOMESTIC_DB_PASSWORD');
  const dbName = requireEnv('DOMESTIC_DB_NAME');

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    charset: 'utf8mb4',
  });

  try {
    console.log('Fetching rows from Supabase...');
    const [posts, comments, friends] = await Promise.all([
      fetchAllRows(supabase, 'posts'),
      fetchAllRows(supabase, 'comments'),
      fetchAllRows(supabase, 'friends'),
    ]);

    console.log(`posts: ${posts.length}, comments: ${comments.length}, friends: ${friends.length}`);

    await connection.beginTransaction();

    for (const row of posts) {
      await connection.execute(
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
          String(row.id),
          String(row.title || ''),
          String(row.content || ''),
          String(row.excerpt || ''),
          asJsonString(row.category, []),
          row.cover_image ? String(row.cover_image) : null,
          row.video_url ? String(row.video_url) : null,
          String(row.author_id || ''),
          String(row.author_name || ''),
          parseEpoch(row.created_at),
          asJsonString(row.likes, []),
          Number(row.views || 0),
        ],
      );
    }

    for (const row of comments) {
      await connection.execute(
        `INSERT INTO comments (id, post_id, user_id, username, user_avatar, content, created_at, parent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           post_id = VALUES(post_id),
           user_id = VALUES(user_id),
           username = VALUES(username),
           user_avatar = VALUES(user_avatar),
            content = VALUES(content),
            created_at = VALUES(created_at),
            parent_id = VALUES(parent_id)`,
        [
          String(row.id),
          String(row.post_id || ''),
          String(row.user_id || ''),
          String(row.username || ''),
          String(row.user_avatar || ''),
          String(row.content || ''),
          parseEpoch(row.created_at),
          row.parent_id ? String(row.parent_id) : null,
        ],
      );
    }

    for (const row of friends) {
      await connection.execute(
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
          String(row.id),
          String(row.name || ''),
          String(row.url || ''),
          String(row.description || ''),
          String(row.avatar || ''),
          ['approved', 'pending', 'rejected'].includes(String(row.status || '').toLowerCase())
            ? String(row.status).toLowerCase()
            : 'approved',
          parseEpoch(row.created_at),
        ],
      );
    }

    await connection.commit();
    console.log('Migration finished successfully.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
