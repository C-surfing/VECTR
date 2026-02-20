export const config = {
  runtime: 'nodejs',
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export const handleOptions = (request: Request): Response | null => {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const json = (data: Record<string, unknown> | unknown[], status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const badMethod = (): Response => json({ error: 'Method Not Allowed' }, 405);

export const parseJsonBody = async <T>(request: Request): Promise<T> => {
  return (await request.json()) as T;
};
