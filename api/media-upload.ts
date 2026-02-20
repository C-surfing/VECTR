import crypto from 'node:crypto';

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

const encodeCosPath = (key: string): string =>
  `/${key
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')}`;

const sha1Hex = (input: string): string =>
  crypto.createHash('sha1').update(input).digest('hex');

const hmacSha1Hex = (key: string, input: string): string =>
  crypto.createHmac('sha1', key).update(input).digest('hex');

const buildCosAuthorization = (params: {
  secretId: string;
  secretKey: string;
  method: 'PUT';
  pathname: string;
  host: string;
  keyTime: string;
}): string => {
  const { secretId, secretKey, method, pathname, host, keyTime } = params;
  const signKey = hmacSha1Hex(secretKey, keyTime);
  const httpString = `${method.toLowerCase()}\n${pathname}\n\nhost=${host}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1Hex(httpString)}\n`;
  const signature = hmacSha1Hex(signKey, stringToSign);

  return [
    'q-sign-algorithm=sha1',
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    'q-header-list=host',
    'q-url-param-list=',
    `q-signature=${signature}`,
  ].join('&');
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const secretId = process.env.COS_SECRET_ID || '';
  const secretKey = process.env.COS_SECRET_KEY || '';
  const bucket = process.env.COS_BUCKET || '';
  const region = process.env.COS_REGION || '';
  const publicBaseUrl = (process.env.COS_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

  if (!secretId || !secretKey || !bucket || !region) {
    return json(
      {
        error:
          'COS 配置缺失。请设置 COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION 环境变量。',
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
    const objectKey = `${safeFolder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    const pathname = encodeCosPath(objectKey);
    const host = `${bucket}.cos.${region}.myqcloud.com`;
    const url = `https://${host}${pathname}`;

    const now = Math.floor(Date.now() / 1000);
    const keyTime = `${now - 60};${now + 600}`;
    const authorization = buildCosAuthorization({
      secretId,
      secretKey,
      method: 'PUT',
      pathname,
      host,
      keyTime,
    });

    const body = Buffer.from(await incoming.arrayBuffer());
    const contentType = incoming.type || 'application/octet-stream';

    const uploadResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        Host: host,
        'Content-Type': contentType,
      },
      body,
    });

    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text();
      return json(
        {
          error: `COS 上传失败 (${uploadResponse.status})`,
          detail: detail.slice(0, 400),
        },
        502,
      );
    }

    const publicUrl = publicBaseUrl ? `${publicBaseUrl}/${objectKey}` : url;
    return json({ url: publicUrl, key: objectKey });
  } catch (error) {
    console.error('[media-upload] error:', error);
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return json({ error: message }, 500);
  }
}
