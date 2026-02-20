-- Domestic MySQL schema for VECTR
-- charset: utf8mb4

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(64) PRIMARY KEY,
  title TEXT NOT NULL,
  content LONGTEXT NOT NULL,
  excerpt TEXT NOT NULL,
  category JSON NOT NULL,
  cover_image TEXT NULL,
  video_url TEXT NULL,
  author_id VARCHAR(64) NOT NULL,
  author_name VARCHAR(128) NOT NULL,
  created_at BIGINT NOT NULL,
  likes JSON NOT NULL,
  views INT NOT NULL DEFAULT 0,
  INDEX idx_posts_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  username VARCHAR(128) NOT NULL,
  user_avatar TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id VARCHAR(64) NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_comments_post_created (post_id, created_at DESC),
  INDEX idx_comments_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS friends (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  avatar TEXT NOT NULL,
  status ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved',
  created_at BIGINT NOT NULL DEFAULT 0,
  INDEX idx_friends_status_created (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  username VARCHAR(128) NOT NULL,
  avatar_url TEXT NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at BIGINT NOT NULL,
  INDEX idx_users_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
