<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1rQtOo7zNQ123WDhKQ6m9ZbnpPtjjpcsb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 部署文档

- 完整国内迁移与部署步骤：`docs/deploy-cn-guide.md`

## Supabase 上传失败时的推荐方案

如果你继续使用 Supabase 且前端直传不稳定，建议切到服务端代理上传：

1. 在部署平台配置：
   - `VITE_MEDIA_UPLOAD_PROVIDER=supabase-proxy`
   - `VITE_SUPABASE_UPLOAD_API=/api/supabase-upload`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_MEDIA_BUCKET=media`
2. 重新部署。

说明：
- 该模式由 `/api/supabase-upload` 在服务端写入 Storage，可绕开大部分 RLS/CORS/匿名权限导致的上传失败。
- 熊猫 logo/头像仍不受影响，继续使用你原先 Supabase 资源链接。

## 纯本地创作模式（不依赖云端）

如果你只想先稳定写作和发布给自己看，可直接使用本地模式：

1. 设置：
   - `VITE_DATA_PROVIDER=local`
   - `VITE_MEDIA_UPLOAD_PROVIDER=local`
2. 运行并创作：导入 Obsidian/MD、插入图片/绘图、发布后会保存在浏览器本地。

说明：
- 本地模式数据存在 `localStorage`，清浏览器缓存会丢失。
- 之后要上云时，再把 provider 切回 `supabase` 或 `supabase-proxy`。

## 国内可访问部署方案

### 第一阶段（仅迁移媒体上传）

目标：先保留 Supabase 的文章/评论数据库，只把媒体上传切到国内 COS，快速解决图片/绘图导入失败与访问慢。

1. 在腾讯云创建 COS 存储桶（建议公有读或绑定 CDN 域名）。
2. 在部署平台配置以下环境变量（参考 `.env.example`）：
   - `VITE_MEDIA_UPLOAD_PROVIDER=cos-proxy`
   - `VITE_MEDIA_UPLOAD_API=/api/media-upload`
   - `COS_SECRET_ID`
   - `COS_SECRET_KEY`
   - `COS_BUCKET`
   - `COS_REGION`
   - `COS_PUBLIC_BASE_URL`（可选，建议填 CDN/自定义域名）
3. 重新部署前端。

代码已内置：
- 客户端上传可切换 provider（`supabase` / `supabase-proxy` / `cos-proxy`）。
- 服务端 `api/media-upload.ts` 会把文件转存到腾讯云 COS 并返回公网 URL。

### 第二阶段（全量迁移到国内 API + MySQL）

目标：文章/评论/友链/搜索/访客认证都走国内 API，减少对海外链路依赖。

1. 在国内云创建 MySQL（建议腾讯云 CVM+MySQL 或 TDSQL-C）。
2. 执行 `domestic-mysql-init.sql` 初始化表结构。
3. 在部署平台配置：
   - `VITE_DATA_PROVIDER=domestic-api`
   - `VITE_DATA_API_BASE=/api/domestic`
   - `VITE_AUTH_PROVIDER=domestic-api`
   - `VITE_AUTH_API_BASE=/api/domestic`
   - `DOMESTIC_DB_HOST`
   - `DOMESTIC_DB_PORT`
   - `DOMESTIC_DB_USER`
   - `DOMESTIC_DB_PASSWORD`
   - `DOMESTIC_DB_NAME`
4. 媒体建议继续使用第一阶段的 COS 方案：
   - `VITE_MEDIA_UPLOAD_PROVIDER=cos-proxy`
   - `COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_BUCKET` / `COS_REGION`
5. 重新部署。

说明：
- 管理员登录仍使用 `VITE_ADMIN_PASSWORD` 本地校验。
- 熊猫资源（logo / About 头像 / 自我介绍界面头像）继续使用 Supabase 公网 URL，不受迁移影响。
