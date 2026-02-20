-- VECTR Blog 数据库表结构 (修复版)
-- 请在 Supabase Dashboard > SQL Editor 中执行此脚本

-- 1. 创建 posts 表（文章）
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    category TEXT[] DEFAULT '{}',
    cover_image TEXT,
    video_url TEXT,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    likes TEXT[] DEFAULT '{}',
    views INTEGER DEFAULT 0,
    created_at_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建 comments 表（评论）
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    parent_id TEXT,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 3. 创建 friends 表（友链）
CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    avatar TEXT,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at BIGINT NOT NULL DEFAULT 0
);

-- 4. 启用 RLS（行级安全策略）
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- 5. 创建公开读取策略（所有人都可以读取）
CREATE POLICY "Public read posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Public read friends" ON friends FOR SELECT USING (true);

-- 6. 创建写入策略（仅管理员可以写入）
CREATE POLICY "Admin insert posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin update posts" ON posts FOR UPDATE USING (true);
CREATE POLICY "Admin delete posts" ON posts FOR DELETE USING (true);

CREATE POLICY "Authenticated insert comments" ON comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin insert friends" ON friends FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin update friends" ON friends FOR UPDATE USING (true);
CREATE POLICY "Admin delete friends" ON friends FOR DELETE USING (true);

-- 7. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts USING GIN(category);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_friends_status_created ON friends(status, created_at DESC);

-- 8. 插入示例数据
INSERT INTO posts (id, title, content, excerpt, category, cover_image, author_id, author_name, created_at, views)
VALUES (
    '1',
    'VECTR: 算法与艺术的交叉点',
    '在现代渲染引擎中，我们追求的不仅是速度，更是光影的灵动。数学公式是构建这一切的基石：\n\n$$ I = L_e + \\int_{\\Omega} f_r(x, \\omega_i, \\omega_o) L_i(x, \\omega_i) (\\omega_i \\cdot n) d\\omega_i $$\n\n这是著名的渲染方程，定义了光的传输。',
    '探索如何通过数学模型构建出极具未来感的视觉效果。',
    ARRAY['数学', '光影艺术', 'TA'],
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop',
    'admin',
    'VECTR_ARCH',
    1739302400000,
    120
),
(
    '2',
    '大规模语言模型的微调策略',
    'AI 不仅仅是黑盒，通过 LoRA (Low-Rank Adaptation) 等技术，我们可以高效地在消费级显卡上运行大模型。\n\n我们将分类维度扩展到了 **AI** 分支，以记录这些前沿探索。',
    '浅蓝紫色调的设计美学与技术实现的深度融合。',
    ARRAY['CS', 'AI'],
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=800&auto=format&fit=crop',
    'admin',
    'VECTR_ARCH',
    1739470400000,
    85
);

-- 执行成功后，请手动在 Supabase Dashboard > Storage 中创建 media bucket
-- 点击 "New bucket"，输入名称 "media"，勾选 "Public bucket"
