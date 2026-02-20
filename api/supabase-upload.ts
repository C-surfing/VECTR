import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'nodejs',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sanitizeFolder = (value: string): string => {
  const safe = (value || 'images').replace(/[^a-zA-Z0-9/_-]/g, '');
  return safe || 'images';
};

const sanitizeFilename = (value: string): string => {
  const safe = (value || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe || `upload_${Date.now()}.bin`;
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'media';

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      {
        error:
          'Supabase 配置缺失。请设置 SUPABASE_URL（或 VITE_SUPABASE_URL）和 SUPABASE_SERVICE_ROLE_KEY。',
      },
      500,
    );
  }

  try {
    const formData = await request.formData();
    const incoming = formData.get('file');
    const folderRaw = String(formData.get('folder') || 'images');

    if (!(incoming instanceof File)) {
      return json({ error: 'Missing file' }, 400);
    }

    const safeFolder = sanitizeFolder(folderRaw);
    const safeName = sanitizeFilename(incoming.name);
    const filePath = `${safeFolder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.storage.from(bucket).upload(filePath, incoming, {
      cacheControl: '3600',
      upsert: false,
      contentType: incoming.type || undefined,
    });

    if (error) {
      return json(
        {
          error: `Supabase 上传失败: ${error.message}`,
        },
        502,
      );
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const publicUrl = data?.publicUrl || '';
    if (!publicUrl) {
      return json({ error: '上传成功但未返回公共 URL，请检查 bucket 可见性' }, 500);
    }

    return json({ url: publicUrl, path: filePath, bucket });
  } catch (error) {
    console.error('[supabase-upload] error:', error);
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return json({ error: message }, 500);
  }
}

