import { Post, Comment, Friend, Category, FriendStatus } from '../types';
import { supabase, MEDIA_BUCKET } from './supabase';

const MEDIA_UPLOAD_PROVIDER = (import.meta.env.VITE_MEDIA_UPLOAD_PROVIDER || 'supabase').toLowerCase();
const MEDIA_UPLOAD_API = import.meta.env.VITE_MEDIA_UPLOAD_API || '/api/media-upload';
const SUPABASE_UPLOAD_API = import.meta.env.VITE_SUPABASE_UPLOAD_API || '/api/supabase-upload';
const MEDIA_LOCAL_FALLBACK = String(import.meta.env.VITE_MEDIA_LOCAL_FALLBACK || 'true').toLowerCase() !== 'false';
const DATA_PROVIDER = (import.meta.env.VITE_DATA_PROVIDER || 'supabase').toLowerCase();
const DATA_API_BASE = (import.meta.env.VITE_DATA_API_BASE || '/api/domestic').replace(/\/+$/, '');
const IS_DOMESTIC_DATA_PROVIDER = DATA_PROVIDER === 'domestic-api' || DATA_PROVIDER === 'mysql-api';
const IS_LOCAL_DATA_PROVIDER = DATA_PROVIDER === 'local' || DATA_PROVIDER === 'browser-local';

const LOCAL_KEYS = {
  POSTS: 'vectr_local_posts',
  POSTS_REMOTE_SNAPSHOT: 'vectr_remote_posts_snapshot',
  COMMENTS: 'vectr_local_comments',
  FRIENDS: 'vectr_local_friends',
};

const VALID_FRIEND_STATUSES: FriendStatus[] = ['approved', 'pending', 'rejected'];

const normalizeFriendStatus = (value: unknown, fallback: FriendStatus = 'approved'): FriendStatus => {
  const status = String(value || '').toLowerCase() as FriendStatus;
  return VALID_FRIEND_STATUSES.includes(status) ? status : fallback;
};

const normalizeFriend = (friend: Friend): Friend => ({
  ...friend,
  status: normalizeFriendStatus(friend.status, 'approved'),
  createdAt: Number(friend.createdAt || Date.now()),
});

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
};

const writeJson = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[local] write failed: ${key}`, error);
  }
};

const readLocalPosts = (): Post[] => {
  const posts = readJson<Post[]>(LOCAL_KEYS.POSTS, []);
  return Array.isArray(posts) ? posts : [];
};

const writeLocalPosts = (posts: Post[]): void => {
  const normalized = [...posts].sort((a, b) => b.createdAt - a.createdAt);
  writeJson(LOCAL_KEYS.POSTS, normalized);
};

const readRemotePostsSnapshot = (): Post[] => {
  const posts = readJson<Post[]>(LOCAL_KEYS.POSTS_REMOTE_SNAPSHOT, []);
  return Array.isArray(posts) ? posts : [];
};

const writeRemotePostsSnapshot = (posts: Post[]): void => {
  const normalized = [...posts].sort((a, b) => b.createdAt - a.createdAt);
  writeJson(LOCAL_KEYS.POSTS_REMOTE_SNAPSHOT, normalized);
};

const mergePostsById = (left: Post[], right: Post[]): Post[] => {
  const merged = new Map<string, Post>();
  for (const post of [...left, ...right]) {
    merged.set(post.id, post);
  }
  return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
};

const readLocalComments = (): Comment[] => {
  const comments = readJson<Comment[]>(LOCAL_KEYS.COMMENTS, []);
  return Array.isArray(comments) ? comments : [];
};

const writeLocalComments = (comments: Comment[]): void => {
  const normalized = [...comments].sort((a, b) => b.createdAt - a.createdAt);
  writeJson(LOCAL_KEYS.COMMENTS, normalized);
};

const readLocalFriends = (): Friend[] => {
  const friends = readJson<Friend[]>(LOCAL_KEYS.FRIENDS, []);
  if (!Array.isArray(friends)) return [];
  return friends.map((friend) => normalizeFriend(friend));
};

const writeLocalFriends = (friends: Friend[]): void => {
  writeJson(
    LOCAL_KEYS.FRIENDS,
    friends.map((friend) => normalizeFriend(friend)),
  );
};

const fileToDataUrl = async (file: File): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取本地文件失败'));
    reader.readAsDataURL(file);
  });
};

const uploadViaApi = async (file: File, folder: string, endpoint: string): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error || '上传失败')
        : `上传失败 (${response.status})`;
    throw new Error(message);
  }

  const url = payload && typeof payload === 'object' ? payload.url : null;
  if (!url || typeof url !== 'string') {
    throw new Error('上传接口返回无效 URL');
  }

  return url;
};

const fetchDomesticJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${DATA_API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error || '请求失败')
        : `请求失败 (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
};

// 鍐呭瓨缂撳瓨
let postsCache: { data: Post[]; timestamp: number } | null = null;
let friendsCache: { data: Friend[]; timestamp: number } | null = null;
let commentsCache: Record<string, { data: Comment[]; timestamp: number }> = {};
const CACHE_DURATION = 60000; // 缂撳瓨1鍒嗛挓
const COMMENTS_CACHE_DURATION = 20000;
const POSTS_REMOTE_QUERY_TIMEOUT_MS = 1800;

let postsRefreshPromise: Promise<Post[]> | null = null;

// 杈呭姪鍑芥暟锛氬皢鏁版嵁搴撹褰曡浆鎹负 Post 绫诲瀷
const transformPost = (row: any): Post => ({
  id: row.id,
  title: row.title,
  content: row.content,
  excerpt: row.excerpt,
  category: row.category as Category[],
  coverImage: row.cover_image,
  videoUrl: row.video_url,
  authorId: row.author_id,
  authorName: row.author_name,
  createdAt: row.created_at,
  likes: row.likes || [],
  views: row.views || 0
});

// 杈呭姪鍑芥暟锛氬皢 Post 杞崲涓烘暟鎹簱鏍煎紡
const toDbPost = (post: Post): any => ({
  id: post.id,
  title: post.title,
  content: post.content,
  excerpt: post.excerpt,
  category: post.category,
  cover_image: post.coverImage,
  video_url: post.videoUrl,
  author_id: post.authorId,
  author_name: post.authorName,
  created_at: post.createdAt,
  likes: post.likes,
  views: post.views
});

// 璇勮杞崲
const transformComment = (row: any): Comment => ({
  id: row.id,
  postId: row.post_id,
  userId: row.user_id,
  username: row.username,
  userAvatar: row.user_avatar,
  content: row.content,
  createdAt: row.created_at,
  parentId: row.parent_id || null,
});

// 鍙嬮摼杞崲
const transformFriend = (row: any): Friend => ({
  id: row.id,
  name: row.name,
  url: row.url,
  description: row.description,
  avatar: row.avatar,
  status: normalizeFriendStatus(row.status, 'approved'),
  createdAt: Number(row.created_at || row.createdAt || Date.now()),
});

const mergePostIntoCache = (post: Post): void => {
  const current = postsCache?.data || [];
  const idx = current.findIndex((p) => p.id === post.id);
  let next: Post[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = post;
  } else {
    next = [...current, post];
  }

  next.sort((a, b) => b.createdAt - a.createdAt);
  postsCache = {
    data: next,
    timestamp: Date.now(),
  };
};

// 甯﹂噸璇曠殑鏌ヨ鍑芥暟
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await promise;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const queryWithRetry = async <T>(
  queryFn: () => Promise<{ data: T[] | null; error: any }>,
  options?: {
    maxRetries?: number;
    timeoutMs?: number;
    retryBaseDelayMs?: number;
    label?: string;
  },
): Promise<T[]> => {
  const maxRetries = options?.maxRetries ?? 3;
  const timeoutMs = options?.timeoutMs ?? 0;
  const retryBaseDelayMs = options?.retryBaseDelayMs ?? 1000;
  const label = options?.label || 'query';
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const { data, error } = await withTimeout(queryFn(), timeoutMs, label);
      if (error) {
        lastError = error;
        console.warn(`Query failed (attempt ${i + 1}/${maxRetries}):`, error.message);
        await sleep(retryBaseDelayMs * (i + 1));
        continue;
      }
      return data || [];
    } catch (err) {
      lastError = err;
      console.warn(`Query error (attempt ${i + 1}/${maxRetries}):`, err);
      await sleep(retryBaseDelayMs * (i + 1));
    }
  }

  console.error('Query failed after all retries:', lastError);
  throw (lastError instanceof Error ? lastError : new Error('Remote query failed'));
};

export const DB = {
  syncPosts: async (): Promise<Post[]> => {
    if (postsRefreshPromise) {
      return await postsRefreshPromise;
    }

    postsRefreshPromise = (async () => {
      let posts: Post[] = [];
      const remoteSnapshot = readRemotePostsSnapshot();
      const localPosts = readLocalPosts();
      const hasWarmFallback = remoteSnapshot.length > 0 || localPosts.length > 0;

      if (IS_LOCAL_DATA_PROVIDER) {
        posts = localPosts;
      } else if (IS_DOMESTIC_DATA_PROVIDER) {
        try {
          const payload = await fetchDomesticJson<{ data: Post[] }>('/posts');
          posts = Array.isArray(payload.data) ? payload.data : [];
        } catch (error) {
          console.warn('[posts] domestic read failed, fallback to snapshot/local', error);
          posts = remoteSnapshot;
        }
      } else {
        try {
          const data = await queryWithRetry(
            async () => {
              return await supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });
            },
            {
              maxRetries: hasWarmFallback ? 1 : 2,
              retryBaseDelayMs: hasWarmFallback ? 150 : 300,
              timeoutMs: hasWarmFallback ? POSTS_REMOTE_QUERY_TIMEOUT_MS : POSTS_REMOTE_QUERY_TIMEOUT_MS + 1200,
              label: 'posts',
            },
          );
          posts = data.map(transformPost);
        } catch (error) {
          console.warn('[posts] remote read failed, fallback to snapshot/local', error);
          posts = remoteSnapshot;
        }
      }

      if (!IS_LOCAL_DATA_PROVIDER) {
        if (posts.length === 0 && remoteSnapshot.length > 0) {
          console.warn('[posts] remote returned empty, using last snapshot');
          posts = remoteSnapshot;
        }

        if (localPosts.length > 0) {
          posts = mergePostsById(posts, localPosts);
        }

        if (posts.length > 0) {
          writeRemotePostsSnapshot(posts);
        }
      }

      postsCache = {
        data: posts,
        timestamp: Date.now(),
      };

      return posts;
    })();

    try {
      return await postsRefreshPromise;
    } finally {
      postsRefreshPromise = null;
    }
  },

  // 获取所有文章（缓存优先 + 快速回退）
  getPosts: async (options?: { preferFast?: boolean }): Promise<Post[]> => {
    const preferFast = options?.preferFast !== false;

    if (postsCache && Date.now() - postsCache.timestamp < CACHE_DURATION) {
      return postsCache.data;
    }

    if (preferFast && postsCache && postsCache.data.length > 0) {
      if (!postsRefreshPromise) {
        void DB.syncPosts().catch((error) => {
          console.warn('[posts] background sync failed:', error);
        });
      }
      return postsCache.data;
    }

    if (!IS_LOCAL_DATA_PROVIDER && preferFast) {
      const fallbackPosts = mergePostsById(readRemotePostsSnapshot(), readLocalPosts());
      if (fallbackPosts.length > 0) {
        postsCache = {
          data: fallbackPosts,
          timestamp: Date.now(),
        };

        if (!postsRefreshPromise) {
          void DB.syncPosts().catch((error) => {
            console.warn('[posts] background sync failed:', error);
          });
        }
        return fallbackPosts;
      }
    }

    return await DB.syncPosts();
  },

  // 强制刷新文章缓存
  refreshPosts: async (): Promise<Post[]> => {
    postsCache = null;
    return await DB.syncPosts();
  },

  getPostById: async (id: string, forceRefresh: boolean = false): Promise<Post | null> => {
    if (!forceRefresh && postsCache && Date.now() - postsCache.timestamp < CACHE_DURATION) {
      const cached = postsCache.data.find((post) => post.id === id);
      if (cached) return cached;
    }

    if (!forceRefresh) {
      if (postsCache) {
        const staleCached = postsCache.data.find((post) => post.id === id);
        if (staleCached) {
          if (!postsRefreshPromise) {
            void DB.syncPosts().catch((error) => {
              console.warn('[post] background sync failed:', error);
            });
          }
          return staleCached;
        }
      }

      const fallbackPost = mergePostsById(readRemotePostsSnapshot(), readLocalPosts()).find(
        (post) => post.id === id,
      );
      if (fallbackPost) {
        mergePostIntoCache(fallbackPost);
        if (!postsRefreshPromise) {
          void DB.syncPosts().catch((error) => {
            console.warn('[post] background sync failed:', error);
          });
        }
        return fallbackPost;
      }
    }

    if (IS_DOMESTIC_DATA_PROVIDER) {
      const payload = await fetchDomesticJson<{ data: Post | null }>(`/posts?id=${encodeURIComponent(id)}`);
      const post = payload.data || null;
      if (post) {
        mergePostIntoCache(post);
        return post;
      }

      return null;
    }

    try {
      const data = await queryWithRetry(async () => {
        return await supabase
          .from('posts')
          .select('*')
          .eq('id', id)
          .limit(1);
      });

      if (data.length > 0) {
        const post = transformPost(data[0]);
        mergePostIntoCache(post);
        return post;
      }
    } catch (error) {
      console.warn('[post] remote read failed, fallback to snapshot/local', error);
    }

    const snapshotPost = readRemotePostsSnapshot().find((post) => post.id === id);
    if (snapshotPost) {
      mergePostIntoCache(snapshotPost);
      return snapshotPost;
    }

    const localPost = readLocalPosts().find((post) => post.id === id);
    if (localPost) {
      mergePostIntoCache(localPost);
      return localPost;
    }

    return null;
  },

  // Save post (create or update)
  // requireRemote=true: remote failure should throw (no silent "saved locally" success)
  savePost: async (
    post: Post,
    options?: { requireRemote?: boolean },
  ): Promise<'remote' | 'local'> => {
    const requireRemote = Boolean(options?.requireRemote);

    if (IS_LOCAL_DATA_PROVIDER) {
      const localPosts = readLocalPosts();
      const idx = localPosts.findIndex((item) => item.id === post.id);
      if (idx >= 0) {
        localPosts[idx] = post;
      } else {
        localPosts.push(post);
      }
      writeLocalPosts(localPosts);
      mergePostIntoCache(post);
      return 'local';
    }

    if (IS_DOMESTIC_DATA_PROVIDER) {
      try {
        await fetchDomesticJson<{ success: boolean }>('/posts', {
          method: 'POST',
          body: JSON.stringify(post),
        });
        mergePostIntoCache(post);
        writeRemotePostsSnapshot(mergePostsById(readRemotePostsSnapshot(), [post]));
        return 'remote';
      } catch (error) {
        if (requireRemote) {
          throw error;
        }

        console.warn('[posts] domestic write failed, fallback to local', error);
        const localPosts = readLocalPosts();
        const idx = localPosts.findIndex((item) => item.id === post.id);
        if (idx >= 0) {
          localPosts[idx] = post;
        } else {
          localPosts.push(post);
        }
        writeLocalPosts(localPosts);
        mergePostIntoCache(post);
        return 'local';
      }
    }

    const { error } = await supabase
      .from('posts')
      .upsert(toDbPost(post), { onConflict: 'id' });
    
    if (error) {
      if (requireRemote) {
        throw new Error(error.message || '远端保存失败');
      }
      console.error('Error saving post, fallback to local:', error);
      const localPosts = readLocalPosts();
      const idx = localPosts.findIndex((item) => item.id === post.id);
      if (idx >= 0) {
        localPosts[idx] = post;
      } else {
        localPosts.push(post);
      }
      writeLocalPosts(localPosts);
      mergePostIntoCache(post);
      return 'local';
    }

    // Remote success: clear same-id local fallback copy to avoid future stale override.
    const localPosts = readLocalPosts();
    const nextLocalPosts = localPosts.filter((item) => item.id !== post.id);
    if (nextLocalPosts.length !== localPosts.length) {
      writeLocalPosts(nextLocalPosts);
    }
    
    mergePostIntoCache(post);
    writeRemotePostsSnapshot(mergePostsById(readRemotePostsSnapshot(), [post]));
    return 'remote';
  },

  // 鍒犻櫎鏂囩珷
  deletePost: async (id: string): Promise<void> => {
    if (IS_LOCAL_DATA_PROVIDER) {
      const localPosts = readLocalPosts().filter((post) => post.id !== id);
      writeLocalPosts(localPosts);
      writeRemotePostsSnapshot(readRemotePostsSnapshot().filter((post) => post.id !== id));
      const localComments = readLocalComments().filter((comment) => comment.postId !== id);
      writeLocalComments(localComments);
      if (postsCache) {
        postsCache = {
          data: postsCache.data.filter((post) => post.id !== id),
          timestamp: Date.now(),
        };
      }
      delete commentsCache[id];
      return;
    }

    if (IS_DOMESTIC_DATA_PROVIDER) {
      await fetchDomesticJson<{ success: boolean }>(`/posts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      writeRemotePostsSnapshot(readRemotePostsSnapshot().filter((post) => post.id !== id));

      if (postsCache) {
        postsCache = {
          data: postsCache.data.filter((post) => post.id !== id),
          timestamp: Date.now(),
        };
      }
      delete commentsCache[id];
      return;
    }

    // Best-effort comment cleanup in case cascade/constraints differ across environments.
    const { error: commentsDeleteError } = await supabase
      .from('comments')
      .delete()
      .eq('post_id', id);

    if (commentsDeleteError) {
      console.warn('Failed to delete related comments (continuing with post delete):', commentsDeleteError);
    }

    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('Error deleting post, fallback local cleanup only:', error);
    }

    if (!data || data.length === 0) {
      console.warn('Remote delete had no effect, continuing local cleanup.');
    }

    const localPosts = readLocalPosts().filter((post) => post.id !== id);
    writeLocalPosts(localPosts);
    writeRemotePostsSnapshot(readRemotePostsSnapshot().filter((post) => post.id !== id));
    const localComments = readLocalComments().filter((comment) => comment.postId !== id);
    writeLocalComments(localComments);

    if (postsCache) {
      postsCache = {
        data: postsCache.data.filter((post) => post.id !== id),
        timestamp: Date.now(),
      };
    }
    delete commentsCache[id];
  },

  // 鑾峰彇鏂囩珷璇勮
  getComments: async (postId: string): Promise<Comment[]> => {
    const cached = commentsCache[postId];
    if (cached && Date.now() - cached.timestamp < COMMENTS_CACHE_DURATION) {
      return cached.data;
    }

    if (IS_LOCAL_DATA_PROVIDER) {
      const comments = readLocalComments().filter((comment) => comment.postId === postId);
      commentsCache[postId] = {
        data: comments,
        timestamp: Date.now(),
      };
      return comments;
    }

    if (IS_DOMESTIC_DATA_PROVIDER) {
      const payload = await fetchDomesticJson<{ data: Comment[] }>(
        `/comments?postId=${encodeURIComponent(postId)}`,
      );
      const comments = Array.isArray(payload.data) ? payload.data : [];
      commentsCache[postId] = {
        data: comments,
        timestamp: Date.now(),
      };
      return comments;
    }

    let comments: Comment[] = [];
    try {
      const data = await queryWithRetry(async () => {
        return await supabase
          .from('comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: false });
      });
      comments = data.map(transformComment);
    } catch (error) {
      console.warn('[comments] remote read failed, fallback to local', error);
      comments = [];
    }

    const localComments = readLocalComments().filter((comment) => comment.postId === postId);
    if (localComments.length > 0) {
      const merged = new Map<string, Comment>();
      for (const comment of [...comments, ...localComments]) {
        merged.set(comment.id, comment);
      }
      comments = Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
    }

    commentsCache[postId] = {
      data: comments,
      timestamp: Date.now(),
    };
    return comments;
  },

  // 娣诲姞璇勮
  addComment: async (comment: Comment): Promise<void> => {
    if (IS_LOCAL_DATA_PROVIDER) {
      const localComments = readLocalComments();
      const idx = localComments.findIndex((item) => item.id === comment.id);
      if (idx >= 0) {
        localComments[idx] = comment;
      } else {
        localComments.push(comment);
      }
      writeLocalComments(localComments);
      const cached = commentsCache[comment.postId];
      commentsCache[comment.postId] = {
        data: cached ? [comment, ...cached.data.filter((c) => c.id !== comment.id)] : [comment],
        timestamp: Date.now(),
      };
      return;
    }

    if (IS_DOMESTIC_DATA_PROVIDER) {
      await fetchDomesticJson<{ success: boolean }>('/comments', {
        method: 'POST',
        body: JSON.stringify(comment),
      });

      const cached = commentsCache[comment.postId];
      commentsCache[comment.postId] = {
        data: cached ? [comment, ...cached.data.filter((c) => c.id !== comment.id)] : [comment],
        timestamp: Date.now(),
      };
      return;
    }

    const commentPayloadWithParent = {
      id: comment.id,
      post_id: comment.postId,
      user_id: comment.userId,
      username: comment.username,
      user_avatar: comment.userAvatar,
      content: comment.content,
      created_at: comment.createdAt,
      parent_id: comment.parentId || null,
    };

    const commentPayloadLegacy = {
      id: comment.id,
      post_id: comment.postId,
      user_id: comment.userId,
      username: comment.username,
      user_avatar: comment.userAvatar,
      content: comment.content,
      created_at: comment.createdAt,
    };

    let savedWithoutParentColumn = false;
    let { error } = await supabase
      .from('comments')
      .insert(commentPayloadWithParent);

    if (
      error &&
      /parent_id|column|schema cache/i.test(String((error as { message?: string }).message || ''))
    ) {
      const retry = await supabase.from('comments').insert(commentPayloadLegacy);
      error = retry.error;
      savedWithoutParentColumn = !retry.error;
    }
    
    if (error) {
      console.error('Error adding comment, fallback to local:', error);
      const localComments = readLocalComments();
      const idx = localComments.findIndex((item) => item.id === comment.id);
      if (idx >= 0) {
        localComments[idx] = comment;
      } else {
        localComments.push(comment);
      }
      writeLocalComments(localComments);
    } else if (savedWithoutParentColumn && comment.parentId) {
      const localComments = readLocalComments();
      const idx = localComments.findIndex((item) => item.id === comment.id);
      if (idx >= 0) {
        localComments[idx] = comment;
      } else {
        localComments.push(comment);
      }
      writeLocalComments(localComments);
    }

    const cached = commentsCache[comment.postId];
    commentsCache[comment.postId] = {
      data: cached ? [comment, ...cached.data.filter((c) => c.id !== comment.id)] : [comment],
      timestamp: Date.now(),
    };
  },

  // 预取相邻文章和封面图，提升详情页切换速度
  prefetchAdjacentPosts: async (id: string): Promise<void> => {
    try {
      const posts = await DB.getPosts();
      const index = posts.findIndex((post) => post.id === id);
      if (index < 0) return;

      const candidates = [posts[index - 1], posts[index + 1]].filter(Boolean) as Post[];

      for (const candidate of candidates) {
        await DB.getPostById(candidate.id);
        if (candidate.coverImage && typeof Image !== 'undefined') {
          const img = new Image();
          img.decoding = 'async';
          img.src = candidate.coverImage;
        }
      }
    } catch (error) {
      console.warn('Prefetch adjacent posts failed:', error);
    }
  },

  // Get friends (with cache)
  getFriends: async (options?: { status?: FriendStatus | 'all' }): Promise<Friend[]> => {
    const statusFilter = options?.status || 'approved';
    const applyFilter = (list: Friend[]): Friend[] =>
      statusFilter === 'all'
        ? list
        : list.filter((friend) => normalizeFriendStatus(friend.status, 'approved') === statusFilter);

    if (friendsCache && Date.now() - friendsCache.timestamp < CACHE_DURATION) {
      return applyFilter(friendsCache.data);
    }

    let friends: Friend[] = [];

    if (IS_LOCAL_DATA_PROVIDER) {
      friends = readLocalFriends();
    } else if (IS_DOMESTIC_DATA_PROVIDER) {
      const payload = await fetchDomesticJson<{ data: Friend[] }>('/friends');
      friends = Array.isArray(payload.data) ? payload.data.map((friend) => normalizeFriend(friend)) : [];
    } else {
      try {
        const data = await queryWithRetry(async () => {
          return await supabase
            .from('friends')
            .select('*');
        });
        friends = data.map(transformFriend).map((friend) => normalizeFriend(friend));
      } catch (error) {
        console.warn('[friends] remote read failed, fallback to local', error);
        friends = [];
      }
    }

    const localFriends = readLocalFriends();
    if (localFriends.length > 0) {
      const merged = new Map<string, Friend>();
      for (const friend of [...friends, ...localFriends]) {
        merged.set(friend.id, normalizeFriend(friend));
      }
      friends = Array.from(merged.values());
    }

    friendsCache = {
      data: friends,
      timestamp: Date.now()
    };

    return applyFilter(friends);
  },

  getFriendApplications: async (): Promise<Friend[]> => {
    return await DB.getFriends({ status: 'pending' });
  },

  // 娣诲姞鍙嬮摼
  addFriend: async (friend: Friend): Promise<void> => {
    const normalizedFriend = normalizeFriend({
      ...friend,
      status: normalizeFriendStatus(friend.status, 'pending'),
      createdAt: Number(friend.createdAt || Date.now()),
    });

    if (IS_LOCAL_DATA_PROVIDER) {
      const localFriends = readLocalFriends();
      const idx = localFriends.findIndex((item) => item.id === normalizedFriend.id);
      if (idx >= 0) {
        localFriends[idx] = normalizedFriend;
      } else {
        localFriends.push(normalizedFriend);
      }
      writeLocalFriends(localFriends);
      friendsCache = null;
      return;
    }

    if (IS_DOMESTIC_DATA_PROVIDER) {
      await fetchDomesticJson<{ success: boolean }>('/friends', {
        method: 'POST',
        body: JSON.stringify(normalizedFriend),
      });
      if (normalizedFriend.status && normalizedFriend.status !== 'approved') {
        const localFriends = readLocalFriends();
        const idx = localFriends.findIndex((item) => item.id === normalizedFriend.id);
        if (idx >= 0) {
          localFriends[idx] = normalizedFriend;
        } else {
          localFriends.push(normalizedFriend);
        }
        writeLocalFriends(localFriends);
      }
      friendsCache = null;
      return;
    }

    const payloadWithStatus = {
      id: normalizedFriend.id,
      name: normalizedFriend.name,
      url: normalizedFriend.url,
      description: normalizedFriend.description,
      avatar: normalizedFriend.avatar,
      status: normalizedFriend.status,
      created_at: normalizedFriend.createdAt,
    };

    const payloadLegacy = {
      id: normalizedFriend.id,
      name: normalizedFriend.name,
      url: normalizedFriend.url,
      description: normalizedFriend.description,
      avatar: normalizedFriend.avatar,
    };

    let { error } = await supabase
      .from('friends')
      .insert(payloadWithStatus);

    if (
      error &&
      /status|created_at|column|schema cache/i.test(String((error as { message?: string }).message || ''))
    ) {
      const retry = await supabase.from('friends').insert(payloadLegacy);
      error = retry.error;
    }

    if (error) {
      console.error('Error adding friend, fallback to local:', error);
      const localFriends = readLocalFriends();
      const idx = localFriends.findIndex((item) => item.id === normalizedFriend.id);
      if (idx >= 0) {
        localFriends[idx] = normalizedFriend;
      } else {
        localFriends.push(normalizedFriend);
      }
      writeLocalFriends(localFriends);
    } else if (normalizedFriend.status && normalizedFriend.status !== 'approved') {
      const localFriends = readLocalFriends();
      const idx = localFriends.findIndex((item) => item.id === normalizedFriend.id);
      if (idx >= 0) {
        localFriends[idx] = normalizedFriend;
      } else {
        localFriends.push(normalizedFriend);
      }
      writeLocalFriends(localFriends);
    }

    friendsCache = null;
  },

  updateFriendStatus: async (friendId: string, status: FriendStatus): Promise<void> => {
    const nextStatus = normalizeFriendStatus(status, 'pending');

    if (IS_LOCAL_DATA_PROVIDER) {
      const localFriends = readLocalFriends();
      const idx = localFriends.findIndex((friend) => friend.id === friendId);
      if (idx < 0) throw new Error('友链申请不存在');
      localFriends[idx] = normalizeFriend({ ...localFriends[idx], status: nextStatus });
      writeLocalFriends(localFriends);
      friendsCache = null;
      return;
    }

    if (IS_DOMESTIC_DATA_PROVIDER) {
      try {
        await fetchDomesticJson<{ success: boolean }>('/friends', {
          method: 'PATCH',
          body: JSON.stringify({ id: friendId, status: nextStatus }),
        });
      } catch (error) {
        const message = String((error as { message?: string })?.message || '');
        if (/status/i.test(message)) {
          const localFriends = readLocalFriends();
          const idx = localFriends.findIndex((friend) => friend.id === friendId);
          if (idx >= 0) {
            localFriends[idx] = normalizeFriend({ ...localFriends[idx], status: nextStatus });
            writeLocalFriends(localFriends);
          }
        } else {
          throw error;
        }
      }
      friendsCache = null;
      return;
    }

    const { error } = await supabase
      .from('friends')
      .update({ status: nextStatus })
      .eq('id', friendId);

    if (error) {
      if (/status|column|schema cache/i.test(String((error as { message?: string }).message || ''))) {
        const localFriends = readLocalFriends();
        const idx = localFriends.findIndex((friend) => friend.id === friendId);
        if (idx >= 0) {
          localFriends[idx] = normalizeFriend({ ...localFriends[idx], status: nextStatus });
          writeLocalFriends(localFriends);
          friendsCache = null;
          return;
        }
        throw new Error('当前 friends 表缺少 status 列，请先迁移数据库结构后再审核友链');
      }
      throw new Error(error.message || '更新友链状态失败');
    }

    friendsCache = null;
  },

  // 鎼滅储鏂囩珷
  searchPosts: async (query: string): Promise<Post[]> => {
    if (!query.trim()) {
      return [];
    }

    if (IS_LOCAL_DATA_PROVIDER) {
      const posts = await DB.getPosts();
      const q = query.toLowerCase();
      return posts.filter((post) =>
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q),
      );
    }

    if (IS_DOMESTIC_DATA_PROVIDER) {
      const payload = await fetchDomesticJson<{ data: Post[] }>(
        `/search?q=${encodeURIComponent(query)}`,
      );
      return Array.isArray(payload.data) ? payload.data : [];
    }
    
    // 浣跨敤ilike杩涜妯＄硦鎼滅储
    try {
      const data = await queryWithRetry(async () => {
        return await supabase
          .from('posts')
          .select('*')
          .or(`title.ilike.%${query}%,content.ilike.%${query}%,excerpt.ilike.%${query}%`)
          .order('created_at', { ascending: false });
      });
      return data.map(transformPost);
    } catch (error) {
      console.warn('[search] remote failed, fallback to local', error);
      const posts = await DB.getPosts();
      const q = query.toLowerCase();
      return posts.filter((post) =>
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q),
      );
    }
  },

  // ========== 濯掍綋鏂囦欢涓婁紶 ==========

  // 涓婁紶鍥剧墖/瑙嗛鍒?Storage
  uploadMedia: async (file: File, folder: string = 'images'): Promise<string> => {
    const safeFolder = (folder || 'images').replace(/[^a-zA-Z0-9/_-]/g, '') || 'images';

    if (MEDIA_UPLOAD_PROVIDER === 'local' || MEDIA_UPLOAD_PROVIDER === 'browser-local') {
      return fileToDataUrl(file);
    }

    if (MEDIA_UPLOAD_PROVIDER === 'supabase-proxy') {
      try {
        return await uploadViaApi(file, safeFolder, SUPABASE_UPLOAD_API);
      } catch (error) {
        if (MEDIA_LOCAL_FALLBACK) {
          console.warn('[upload] supabase-proxy failed, fallback to data URL', error);
          return fileToDataUrl(file);
        }
        throw error;
      }
    }

    if (MEDIA_UPLOAD_PROVIDER === 'cos-proxy' || MEDIA_UPLOAD_PROVIDER === 'domestic-api') {
      try {
        return await uploadViaApi(file, safeFolder, MEDIA_UPLOAD_API);
      } catch (error) {
        if (MEDIA_LOCAL_FALLBACK) {
          console.warn('[upload] proxy failed, fallback to data URL', error);
          return fileToDataUrl(file);
        }
        throw error;
      }
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const shouldFallbackToImages =
      safeFolder === 'covers' || safeFolder === 'drawings' || safeFolder === 'svgs';
    const candidateFolders = Array.from(
      new Set([safeFolder, ...(shouldFallbackToImages ? ['images'] : [])]),
    );

    let lastError: any = null;

    for (const candidate of candidateFolders) {
      const filePath = `${candidate}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeFileName}`;
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (!error) {
        const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
        return urlData.publicUrl;
      }

      lastError = error;
      console.warn(`Upload failed in folder "${candidate}", trying fallback if available:`, error);
    }

    if (MEDIA_LOCAL_FALLBACK) {
      console.warn('[upload] supabase direct failed, fallback to data URL', lastError);
      return fileToDataUrl(file);
    }

    const message =
      lastError && typeof lastError === 'object' && 'message' in lastError
        ? String((lastError as { message?: string }).message || '上传失败')
        : '上传失败';
    throw new Error(message);
  },

  // 鍒犻櫎濯掍綋鏂囦欢
  deleteMedia: async (fileUrl: string): Promise<void> => {
    if (
      MEDIA_UPLOAD_PROVIDER === 'local' ||
      MEDIA_UPLOAD_PROVIDER === 'browser-local' ||
      MEDIA_UPLOAD_PROVIDER === 'supabase-proxy' ||
      MEDIA_UPLOAD_PROVIDER === 'cos-proxy' ||
      MEDIA_UPLOAD_PROVIDER === 'domestic-api'
    ) {
      // Proxy upload modes keep delete optional for now.
      return;
    }

    // Extract file path from public URL
    const urlParts = fileUrl.split('/');
    const fileName = urlParts.slice(-2).join('/'); // 鑾峰彇 bucket 涔嬪悗鐨勮矾寰?    
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([fileName]);
    
    if (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
};
