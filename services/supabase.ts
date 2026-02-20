import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey =
  'placeholder-anon-key';
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing, using placeholder client. If you use supabase provider, please set both env vars.',
  );
}

export const supabase = createClient(supabaseUrl || fallbackUrl, supabaseAnonKey || fallbackKey);
export const IS_SUPABASE_CONFIGURED = hasSupabaseConfig;

// 存储桶名称
export const MEDIA_BUCKET = 'media';
