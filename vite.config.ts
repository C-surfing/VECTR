import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const rawBasePath = (env.VITE_BASE_PATH || '').trim();
    const resolvedBasePath = rawBasePath
      ? `${rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`}${rawBasePath.endsWith('/') ? '' : '/'}`
      : '/';
    return {
      base: resolvedBasePath,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // 启用压缩
        minify: 'esbuild',
        // 生成 sourcemap
        sourcemap: false,
        // 分块大小警告阈值
        chunkSizeWarningLimit: 600,
        // 自动分块策略
        rollupOptions: {
          output: {
            // 资源文件命名
            chunkFileNames: 'assets/js/[name]-[hash].js',
            entryFileNames: 'assets/js/[name]-[hash].js',
            assetFileNames: (assetInfo) => {
              const info = assetInfo.name?.split('.') || [];
              const ext = info[info.length - 1];
              if (/\.(png|jpe?g|svg|webp|gif)$/i.test(assetInfo.name || '')) {
                return 'assets/images/[name]-[hash][extname]';
              }
              if (ext === 'css') {
                return 'assets/css/[name]-[hash][extname]';
              }
              return 'assets/[name]-[hash][extname]';
            }
          }
        }
      }
    };
});
