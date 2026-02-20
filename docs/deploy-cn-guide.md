# VECTR 国内部署与迁移完整指南（从 0 开始）

本文档按你当前代码状态编写，目标是：

- 媒体文件（封面图/正文图片/绘图）迁移到腾讯云 COS
- 文章/评论/友链/搜索/访客认证迁移到国内 MySQL
- 保留熊猫资源不变（logo、About 头像、自我介绍界面头像仍用 Supabase URL）

---

## 1. 最终架构（对应当前代码）

- 前端：Vercel（你当前已在用）
- API：`/api/media-upload` + `/api/domestic/*`（已在仓库）
- 媒体：腾讯云 COS
- 数据库：国内 MySQL
- 熊猫资源：Supabase 固定公网链接（不会被迁移覆盖）

---

## 2. 你现在要准备的账号与资源

1. 腾讯云账号
2. 一个 COS 存储桶
3. 一个 MySQL 实例（腾讯云 MySQL / CVM 自建 MySQL 都可以）
4. Vercel 项目（已有即可）

可选但推荐：

1. 自定义域名（用于国内访问）
2. 域名备案（国内长期稳定访问建议做）

---

## 3. 第一步：创建 COS（媒体存储）

### 3.1 创建存储桶

1. 打开腾讯云 COS 控制台
2. 新建存储桶
3. 地域建议：`ap-guangzhou`（广州）或你用户主要地区
4. 访问权限建议：
- 公有读私有写（前端展示图片最省事）

### 3.2 配置 CORS（很关键）

在 COS 控制台给该桶添加 CORS 规则：

- 来源（Origin）：
  - `https://你的线上域名`
  - `http://localhost:5173`（本地调试）
- 方法（Methods）：
  - `GET`
  - `PUT`
  - `POST`
  - `HEAD`
  - `OPTIONS`
- Headers：`*`
- Expose Headers：`ETag`
- Max Age：`600`

### 3.3 获取密钥

在腾讯云访问管理（CAM）创建/获取：

- `SecretId`
- `SecretKey`

最小权限建议仅授予目标存储桶写入权限。

---

## 4. 第二步：创建 MySQL（业务数据）

### 4.1 创建数据库

1. 创建 MySQL 实例
2. 新建数据库：`vectr`
3. 字符集设置：`utf8mb4`

### 4.2 导入表结构

仓库里已有建表文件：`domestic-mysql-init.sql`

在 PowerShell 执行（示例）：

```powershell
mysql -h <DOMESTIC_DB_HOST> -P 3306 -u <DOMESTIC_DB_USER> -p <DOMESTIC_DB_NAME> < domestic-mysql-init.sql
```

如果你本机没有 `mysql` 命令，可直接在云数据库控制台 SQL 窗口粘贴执行 `domestic-mysql-init.sql` 内容。

---

## 5. 第三步（可选但强烈建议）：迁移旧数据

你如果已有 Supabase 文章数据，可用仓库脚本自动迁移：

- `scripts/migrate-supabase-to-domestic.mjs`

### 5.1 准备迁移环境变量（本机临时）

PowerShell 示例：

```powershell
$env:SUPABASE_URL="https://xxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="你的service_role_key"
$env:DOMESTIC_DB_HOST="你的mysql地址"
$env:DOMESTIC_DB_PORT="3306"
$env:DOMESTIC_DB_USER="你的mysql用户"
$env:DOMESTIC_DB_PASSWORD="你的mysql密码"
$env:DOMESTIC_DB_NAME="vectr"
```

### 5.2 运行迁移

```powershell
node scripts/migrate-supabase-to-domestic.mjs
```

迁移内容：

- `posts`
- `comments`
- `friends`

说明：

- 访客账号（Supabase Auth）不会自动迁移密码哈希，访客可重新注册。
- 管理员登录本来就是本地密码（`VITE_ADMIN_PASSWORD`），不受影响。

---

## 6. 第四步：配置 Vercel 环境变量

在 Vercel 项目 Settings -> Environment Variables 配置以下值：

### 6.1 前端业务开关

- `VITE_MEDIA_UPLOAD_PROVIDER=cos-proxy`
- `VITE_MEDIA_UPLOAD_API=/api/media-upload`
- `VITE_DATA_PROVIDER=domestic-api`
- `VITE_DATA_API_BASE=/api/domestic`
- `VITE_AUTH_PROVIDER=domestic-api`
- `VITE_AUTH_API_BASE=/api/domestic`
- `VITE_ADMIN_PASSWORD=你自己的管理员密码`

### 6.2 COS（服务端使用）

- `COS_SECRET_ID=...`
- `COS_SECRET_KEY=...`
- `COS_BUCKET=你的桶名`
- `COS_REGION=ap-guangzhou`
- `COS_PUBLIC_BASE_URL=你的COS公网域名或CDN域名`（可选但推荐）

### 6.3 MySQL（服务端使用）

- `DOMESTIC_DB_HOST=...`
- `DOMESTIC_DB_PORT=3306`
- `DOMESTIC_DB_USER=...`
- `DOMESTIC_DB_PASSWORD=...`
- `DOMESTIC_DB_NAME=vectr`

可选（AI 功能如果在用）：

- `GEMINI_API_KEY=...`

---

## 7. 第五步：部署

你之前报错 `The specified token is not valid`，按下面重新登录：

```powershell
vercel logout
vercel login
vercel link
vercel --prod
```

如果用 token：

```powershell
vercel login --token <NEW_TOKEN>
```

---

## 8. 第六步：上线后验收清单（逐条测）

1. 文章列表能正常加载
2. 文章详情能打开（无报错）
3. 删除文章成功（连带评论）
4. 封面图上传成功
5. 编辑器正文插图上传成功
6. Excalidraw / SVG 插入后可预览、可发布查看
7. 评论发布正常
8. 友链读写正常
9. 访客注册/登录正常
10. 管理员登录正常，且头像仍是熊猫图

---

## 9. 国内访问优化建议（你做完上面再做）

1. 绑定自定义域名，不用 `*.vercel.app`
2. 域名做备案（长期稳定）
3. COS 配 CDN（如果你填了 `COS_PUBLIC_BASE_URL`，媒体会走 CDN）
4. 后续如仍要进一步提速，再把 API 从 Vercel 迁到腾讯云函数/轻量应用服务器

---

## 10. 常见问题排查

### Q1：上传文件失败

检查顺序：

1. 如果你不用腾讯云，直接切 `VITE_MEDIA_UPLOAD_PROVIDER=supabase-proxy`
2. 配置 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
3. 确认 `SUPABASE_MEDIA_BUCKET` 存在且可读
4. 重新部署后再测试上传

不使用 COS 的最简配置：

- `VITE_MEDIA_UPLOAD_PROVIDER=supabase-proxy`
- `VITE_SUPABASE_UPLOAD_API=/api/supabase-upload`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_MEDIA_BUCKET=media`

### Q2：文章加载失败 / 删除失败

检查顺序：

1. `VITE_DATA_PROVIDER=domestic-api`
2. `DOMESTIC_DB_*` 是否正确
3. `domestic-mysql-init.sql` 是否已执行
4. MySQL 安全组/白名单是否允许 Vercel 出网访问

### Q3：访客登录失败

检查顺序：

1. `VITE_AUTH_PROVIDER=domestic-api`
2. `api/domestic/auth` 是否可访问
3. `users` 表是否已创建

### Q4：熊猫头像丢失

当前代码已固定熊猫 Supabase URL。若国内网络偶发拉取不到该 URL，页面会降级到默认头像。你如果要绝对稳定，可把同一张图镜像到 COS，再让我给你做双源自动回退。

---

## 11. 最小执行顺序（给你照着跑）

1. 创建 COS + 配 CORS
2. 创建 MySQL + 执行 `domestic-mysql-init.sql`
3. （可选）运行迁移脚本导入旧数据
4. 在 Vercel 配好全部环境变量
5. `vercel login` -> `vercel --prod`
6. 按验收清单逐条验证

---

## 12. Obsidian 与 Excalidraw 使用说明（已适配）

### 12.1 编辑器导入 Obsidian

创作中心点击 `导入 Obsidian/MD`，可直接选择：

- 单个 `.md/.txt` 文件
- 或一次性多选：`主 md + 附件图片 + svg + excalidraw/json/md`

系统会自动处理：

- `![[附件.png]]` -> 上传并转为标准 Markdown 图片
- `![[绘图.excalidraw]]` / `![[绘图.json]]` -> 上传并转为 `:::excalidraw` 块
- `![[绘图.svg]]` -> 上传并转为 `:::svg` 块
- `[[链接|别名]]` -> 转为可读文本/外链

并且会把长资源 URL 收敛为 `asset:a1` 这类短标记，避免编辑区出现大量长串内容影响继续写作。

### 12.2 直接导入 Obsidian Excalidraw `.md`

如果导入的是 Excalidraw 插件生成的 `.md`（含 `excalidraw-plugin` 前言）：

- 编辑器会自动提取其中 JSON 场景
- 自动上传为 `.excalidraw`
- 自动生成文章内容块：
  - `:::excalidraw`
  - `云端URL`
  - `:::`

不会再把大段 JSON 塞进文本框影响继续写作。

### 12.3 渲染支持

预览和发布页已支持：

- `:::excalidraw` 绘图块
- `:::svg` 绘图块
- `![[...]]` Obsidian 嵌入
- `[[...]]` Wiki 链接
- Obsidian Callout（`> [!note]` / `tip` / `warning` 等）
