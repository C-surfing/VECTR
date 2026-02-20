import { User } from '../types';
import { supabase, IS_SUPABASE_CONFIGURED } from './supabase';

const ADMIN_USERNAME = 'admin';
const PANDA_SUPABASE_URL =
  'https://ocfbitiofnrjdudakqcf.supabase.co/storage/v1/object/public/media/panda.jpg';
const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER || 'supabase').toLowerCase();
const AUTH_API_BASE = (import.meta.env.VITE_AUTH_API_BASE || '/api/domestic').replace(/\/+$/, '');
const IS_DOMESTIC_AUTH_PROVIDER =
  AUTH_PROVIDER === 'domestic-api' || AUTH_PROVIDER === 'mysql-api';
const STORAGE_KEYS = {
  CURRENT_USER: 'blog_current_user'
};

// 获取管理员密码（从环境变量）
const getAdminPassword = (): string => {
  return import.meta.env.VITE_ADMIN_PASSWORD || 'vectr2026';
};

// 获取管理员头像（从 Supabase Storage）
const getAdminAvatar = (): string => {
  return PANDA_SUPABASE_URL;
};

const getGuestAvatar = (seed: string): string => {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;
};

type GuestAuthResult = {
  success: boolean;
  error?: string;
  requiresEmailVerification?: boolean;
};

type DomesticGuestAuthResponse = GuestAuthResult & {
  user?: User;
};

const callDomesticGuestAuth = async (
  action: 'register' | 'login',
  payload: {
    email: string;
    password: string;
    username?: string;
    avatarUrl?: string;
  },
): Promise<DomesticGuestAuthResponse> => {
  const response = await fetch(`${AUTH_API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String(body.error || '请求失败')
        : `请求失败 (${response.status})`;
    return { success: false, error: message };
  }

  if (!body || typeof body !== 'object') {
    return { success: false, error: '认证服务返回异常' };
  }

  const payloadUser = (body as { user?: User }).user;
  return {
    success: Boolean((body as { success?: boolean }).success),
    error: typeof (body as { error?: string }).error === 'string' ? (body as { error: string }).error : undefined,
    user: payloadUser,
  };
};

// 验证管理员登录
export const auth = {
  // 管理员登录验证
  login: (username: string, password: string): User | null => {
    const storedPassword = getAdminPassword();
    
    // 验证用户名和密码
    if (username.toLowerCase() === ADMIN_USERNAME && password === storedPassword) {
      const user: User = {
        id: 'admin',
        username: ADMIN_USERNAME,
        avatar: getAdminAvatar(),
        role: 'admin'
      };
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      return user;
    }
    
    return null;
  },

  // 访客注册
  registerGuest: async (
    email: string,
    password: string,
    username: string,
    avatarUrl?: string,
  ): Promise<GuestAuthResult> => {
    try {
      const cleanEmail = email.trim();
      const cleanUsername = username.trim();
      const avatar = avatarUrl?.trim() || getGuestAvatar(`${cleanUsername || cleanEmail}-${Date.now()}`);

      if (IS_DOMESTIC_AUTH_PROVIDER) {
        const result = await callDomesticGuestAuth('register', {
          email: cleanEmail,
          password,
          username: cleanUsername,
          avatarUrl: avatar,
        });

        if (!result.success) {
          return { success: false, error: result.error || '注册失败' };
        }

        if (result.user) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(result.user));
        }

        return { success: true };
      }

      if (!IS_SUPABASE_CONFIGURED) {
        return { success: false, error: 'Supabase 配置缺失，请切换 VITE_AUTH_PROVIDER=domestic-api 或补齐 Supabase 环境变量' };
      }

      // 使用 Supabase 进行注册
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            avatar_url: avatar,
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // 创建用户 profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: cleanUsername,
            avatar_url: avatar,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        // 若未返回 session，通常是开启了邮箱验证：此时不应本地伪登录。
        if (!data.session) {
          return { success: true, requiresEmailVerification: true };
        }

        const metadata = data.user.user_metadata || {};
        const user: User = {
          id: data.user.id,
          username: metadata.username || cleanUsername || cleanEmail.split('@')[0],
          avatar: metadata.avatar_url || avatar,
          role: 'user'
        };
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        
        return { success: true };
      }

      return { success: false, error: '注册失败' };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: '注册失败，请稍后重试' };
    }
  },

  // 访客登录
  loginGuest: async (email: string, password: string): Promise<GuestAuthResult> => {
    try {
      const cleanEmail = email.trim();

      if (IS_DOMESTIC_AUTH_PROVIDER) {
        const result = await callDomesticGuestAuth('login', {
          email: cleanEmail,
          password,
        });

        if (!result.success) {
          return { success: false, error: result.error || '登录失败' };
        }

        if (result.user) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(result.user));
        }

        return { success: true };
      }

      if (!IS_SUPABASE_CONFIGURED) {
        return { success: false, error: 'Supabase 配置缺失，请切换 VITE_AUTH_PROVIDER=domestic-api 或补齐 Supabase 环境变量' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const metadata = data.user.user_metadata || {};
        const fallbackName = cleanEmail.split('@')[0];
        const fallbackAvatar = getGuestAvatar(cleanEmail);

        // 获取用户 profile（若表不存在或无记录，降级使用 metadata）
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        const user: User = {
          id: data.user.id,
          username: profile?.username || metadata.username || fallbackName,
          avatar: profile?.avatar_url || metadata.avatar_url || fallbackAvatar,
          role: 'user'
        };
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        
        return { success: true };
      }

      return { success: false, error: '登录失败' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '登录失败，请稍后重试' };
    }
  },

  // 获取当前用户
  getCurrentUser: (): User | null => {
    const user = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return user ? JSON.parse(user) : null;
  },

  // 登出
  logout: async (): Promise<void> => {
    if (!IS_DOMESTIC_AUTH_PROVIDER && IS_SUPABASE_CONFIGURED) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  // 检查是否已登录
  isLoggedIn: (): boolean => {
    const user = auth.getCurrentUser();
    return user?.role === 'admin' || user?.role === 'user';
  },

  // 修改密码（需要在已登录状态）
  changePassword: (oldPassword: string, newPassword: string): boolean => {
    const storedPassword = getAdminPassword();
    
    if (oldPassword !== storedPassword) {
      return false;
    }
    
    console.warn('Password change requires updating VITE_ADMIN_PASSWORD in .env.local');
    return true;
  }
};
