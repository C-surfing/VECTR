import React, { useState, useEffect, lazy, Suspense, useRef, useCallback } from 'react';
import { User, Post, Category } from './types';
import { auth } from './services/auth';
import ParticleBackground from './components/ParticleBackground';
import { SearchModal, SearchButton } from './components/SearchModal';
import { Layout, LogOut, PlusSquare, Lock, X, Loader2, RefreshCw, Upload, Keyboard } from 'lucide-react';

// Views - 懒加载优化性能
const HomeView = lazy(() => import('./views/Home'));
const BlogListView = lazy(() => import('./views/BlogList'));
const PostDetailView = lazy(() => import('./views/PostDetail'));
const FriendsView = lazy(() => import('./views/Friends'));
const AdminEditorView = lazy(() => import('./views/AdminEditor'));
const AboutView = lazy(() => import('./views/About'));

type View = 'home' | 'blog' | 'post' | 'friends' | 'editor' | 'about';

type RouteState = {
  view: View;
  postId: string | null;
  category: Category | 'All';
  blogQuery: string;
  editId: string | null;
};

type SeoPostState = {
  id: string;
  title: string;
  excerpt: string;
  coverImage?: string;
};

const VALID_CATEGORIES: Category[] = ['CS', 'TA', '金融', '数学', '光影艺术', 'AI', '生活', '哲学'];

const normalizeBasePath = (raw: string): string => {
  const value = String(raw || '/').trim() || '/';
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
};

const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL || '/');

const stripBaseFromPath = (rawPath: string): string => {
  const withLeading = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (APP_BASE_PATH === '/') return withLeading;

  const baseNoTrailing = APP_BASE_PATH.slice(0, -1);
  if (withLeading === baseNoTrailing) return '/';
  if (!withLeading.startsWith(APP_BASE_PATH)) return withLeading;

  const sliced = withLeading.slice(APP_BASE_PATH.length - 1);
  return sliced || '/';
};

const withBasePath = (rawPath: string): string => {
  const withLeading = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (APP_BASE_PATH === '/') return withLeading;
  const baseNoTrailing = APP_BASE_PATH.slice(0, -1);
  return withLeading === '/' ? `${baseNoTrailing}/` : `${baseNoTrailing}${withLeading}`;
};

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeCategory = (value: unknown): Category | 'All' => {
  if (value === 'All') return 'All';
  const raw = String(value || '').trim();
  if (!raw) return 'All';
  return VALID_CATEGORIES.includes(raw as Category) ? (raw as Category) : 'All';
};

const slugify = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

const parseRouteFromLocation = (): RouteState => {
  if (typeof window === 'undefined') {
    return { view: 'home', postId: null, category: 'All', blogQuery: '', editId: null };
  }

  const rawPath = safeDecode(window.location.pathname || '/');
  const pathnameRaw = stripBaseFromPath(rawPath).replace(/\/+$/, '');
  const pathname = pathnameRaw || '/';
  const segments = pathname.split('/').filter(Boolean);
  const head = (segments[0] || '').toLowerCase();
  const search = new URLSearchParams(window.location.search);

  if (!segments.length || head === 'home') {
    return { view: 'home', postId: null, category: 'All', blogQuery: '', editId: null };
  }

  if (head === 'blog') {
    return {
      view: 'blog',
      postId: null,
      category: normalizeCategory(search.get('category')),
      blogQuery: safeDecode(search.get('q') || '').trim(),
      editId: null,
    };
  }

  if (head === 'post' && segments[1]) {
    return {
      view: 'post',
      postId: safeDecode(segments[1]),
      category: 'All',
      blogQuery: '',
      editId: null,
    };
  }

  if (head === 'friends') {
    return { view: 'friends', postId: null, category: 'All', blogQuery: '', editId: null };
  }

  if (head === 'editor') {
    return {
      view: 'editor',
      postId: null,
      category: 'All',
      blogQuery: '',
      editId: segments[1] ? safeDecode(segments[1]) : null,
    };
  }

  if (head === 'about') {
    return { view: 'about', postId: null, category: 'All', blogQuery: '', editId: null };
  }

  return { view: 'home', postId: null, category: 'All', blogQuery: '', editId: null };
};

const buildPathFromRoute = (route: RouteState, seoPost: SeoPostState | null): string => {
  if (route.view === 'home') return '/';
  if (route.view === 'blog') {
    const params = new URLSearchParams();
    if (route.category !== 'All') {
      params.set('category', route.category);
    }
    if (route.blogQuery.trim()) {
      params.set('q', route.blogQuery.trim());
    }
    const queryString = params.toString();
    return queryString ? `/blog?${queryString}` : '/blog';
  }
  if (route.view === 'about') return '/about';
  if (route.view === 'friends') return '/friends';
  if (route.view === 'editor') {
    return route.editId ? `/editor/${encodeURIComponent(route.editId)}` : '/editor';
  }
  if (route.view === 'post' && route.postId) {
    const withSlug = seoPost && seoPost.id === route.postId;
    const slug = withSlug ? slugify(seoPost.title) : '';
    const slugSegment = slug ? `/${encodeURIComponent(slug)}` : '';
    return slug
      ? `/post/${encodeURIComponent(route.postId)}${slugSegment}`
      : `/post/${encodeURIComponent(route.postId)}`;
  }
  return '/';
};

const upsertMeta = (
  attribute: 'name' | 'property',
  key: string,
  content: string,
): void => {
  if (typeof document === 'undefined') return;
  const selector = `meta[${attribute}="${key}"]`;
  let node = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
};

const upsertCanonical = (url: string): void => {
  if (typeof document === 'undefined') return;
  let node = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  node.setAttribute('href', url);
};

const App: React.FC = () => {
  const isGithubPages = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
  const initialRouteRef = useRef<RouteState>(parseRouteFromLocation());
  const [currentView, setCurrentView] = useState<View>(initialRouteRef.current.view);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initialRouteRef.current.postId);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>(initialRouteRef.current.category);
  const [blogQuery, setBlogQuery] = useState(initialRouteRef.current.blogQuery);
  const [user, setUser] = useState<User | null>(auth.getCurrentUser());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [editPostId, setEditPostId] = useState<string | null>(initialRouteRef.current.editId);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [seoPost, setSeoPost] = useState<SeoPostState | null>(null);

  const applyRouteState = useCallback((route: RouteState) => {
    setCurrentView(route.view);
    setSelectedPostId(route.postId);
    setActiveCategory(route.category);
    setBlogQuery(route.blogQuery);
    setEditPostId(route.editId);
    if (route.view !== 'post') {
      setSeoPost(null);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      applyRouteState(parseRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyRouteState]);

  const navigate = useCallback((
    view: View,
    postId: string | null = null,
    category: Category | 'All' = 'All',
    editId: string | null = null,
    options?: { replace?: boolean; noScroll?: boolean; blogQuery?: string },
  ) => {
    const resolvedBlogQuery =
      view === 'blog'
        ? String(
            options?.blogQuery ??
              (currentView === 'blog' ? blogQuery : ''),
          ).trim()
        : '';
    const nextRoute: RouteState = {
      view,
      postId,
      category: normalizeCategory(category),
      blogQuery: resolvedBlogQuery,
      editId,
    };
    setCurrentView(view);
    setSelectedPostId(postId);
    setActiveCategory(nextRoute.category);
    setBlogQuery(nextRoute.blogQuery);
    setEditPostId(editId);
    if (view !== 'post') {
      setSeoPost(null);
    }

    const nextPath = buildPathFromRoute(nextRoute, seoPost);
    const nextHistoryPath = withBasePath(nextPath);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (nextHistoryPath !== currentPath) {
      if (options?.replace) {
        window.history.replaceState({}, '', nextHistoryPath);
      } else {
        window.history.pushState({}, '', nextHistoryPath);
      }
    }

    if (!options?.noScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  }, [blogQuery, currentView, seoPost]);

  const handlePostResolved = useCallback(
    (post: Post) => {
      const resolved: SeoPostState = {
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
      };
      setSeoPost(resolved);

      if (currentView === 'post' && selectedPostId === post.id) {
        const targetPath = buildPathFromRoute(
          { view: 'post', postId: post.id, category: 'All', blogQuery: '', editId: null },
          resolved,
        );
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const targetHistoryPath = withBasePath(targetPath);
        if (targetHistoryPath !== currentPath) {
          window.history.replaceState({}, '', targetHistoryPath);
        }
      }
    },
    [currentView, selectedPostId],
  );

  const handleLogin = (username: string, password: string) => {
    const loggedUser = auth.login(username, password);
    if (loggedUser) {
      setUser(loggedUser);
      setShowLoginModal(false);
      setLoginError('');
      navigate('home');
    } else {
      setLoginError('用户名或密码错误');
    }
  };

  const handleLogout = async () => {
    await auth.logout();
    setUser(null);
    navigate('home');
  };

  const handleDataChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const baseTitle = 'VECTR';
    const defaultDescription = 'VECTR 个人博客，记录技术、思考与创作。';
    const route: RouteState = {
      view: currentView,
      postId: selectedPostId,
      category: activeCategory,
      blogQuery,
      editId: editPostId,
    };

    const postMeta =
      currentView === 'post' && selectedPostId && seoPost?.id === selectedPostId
        ? seoPost
        : null;

    let title = `${baseTitle} | Digital Archive`;
    let description = defaultDescription;

    if (currentView === 'blog') {
      title =
        activeCategory === 'All'
          ? `${baseTitle} | 文章归档`
          : `${baseTitle} | ${activeCategory} 归档`;
      description =
        activeCategory === 'All'
          ? '浏览 VECTR 博客的全部文章归档。'
          : `浏览 VECTR 博客的 ${activeCategory} 分类文章。`;
    } else if (currentView === 'post' && postMeta) {
      title = `${postMeta.title} | ${baseTitle}`;
      description = postMeta.excerpt || defaultDescription;
    } else if (currentView === 'friends') {
      title = `${baseTitle} | 友链`;
      description = 'VECTR 友链页面，发现更多值得阅读的站点。';
    } else if (currentView === 'about') {
      title = `${baseTitle} | 关于`;
      description = '关于 VECTR 与博主的介绍。';
    } else if (currentView === 'editor') {
      title = `${baseTitle} | 创作中心`;
      description = 'VECTR 博客创作与发布编辑器。';
    }

    const path = buildPathFromRoute(route, postMeta);
    const fullPath = withBasePath(path);
    const absoluteUrl = `${window.location.origin}${fullPath}`;
    const imageUrl = postMeta?.coverImage
      ? new URL(postMeta.coverImage, window.location.origin).toString()
      : 'https://ocfbitiofnrjdudakqcf.supabase.co/storage/v1/object/public/media/panda.jpg';

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', postMeta ? 'article' : 'website');
    upsertMeta('property', 'og:url', absoluteUrl);
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', imageUrl);
    upsertCanonical(absoluteUrl);
  }, [activeCategory, blogQuery, currentView, editPostId, selectedPostId, seoPost]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      if (event.key === '?' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setShowShortcutHelp((prev) => !prev);
        return;
      }

      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'h') {
        navigate('home');
      } else if (key === 'b') {
        navigate('blog', null, activeCategory, null, { blogQuery, noScroll: true });
      } else if (key === 'a') {
        navigate('about');
      } else if (key === 'f') {
        navigate('friends');
      } else if (key === '/') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCategory, blogQuery, navigate]);

  const logoText = "VECTR";

  return (
    <div className="min-h-screen relative selection:bg-cyan-500/30">
      {!isGithubPages && <ParticleBackground />}
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div 
            onClick={() => navigate('home')} 
            className="flex items-center space-x-2 cursor-pointer logo-group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden">
              <img 
                src="https://ocfbitiofnrjdudakqcf.supabase.co/storage/v1/object/public/media/panda.jpg" 
                alt="Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="font-orbitron text-2xl font-bold tracking-tighter text-glow uppercase ml-2 flex">
              {logoText.split('').map((char, index) => (
                <span 
                  key={index} 
                  className="wave-char" 
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-10 font-medium">
            <button onClick={() => navigate('home')} className="hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] text-sm font-bold">首页</button>
            <button onClick={() => navigate('blog')} className="hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] text-sm font-bold">归档</button>
            <button onClick={() => navigate('about')} className="hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] text-sm font-bold">关于</button>
            <button onClick={() => navigate('friends')} className="hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] text-sm font-bold">友链</button>
            <SearchButton onClick={() => setIsSearchOpen(true)} />
            <button
              onClick={() => setShowShortcutHelp(true)}
              className="flex items-center px-3 py-2 rounded-full border border-white/10 hover:border-cyan-500/40 hover:bg-white/10 transition-colors"
              title="快捷键帮助"
            >
              <Keyboard className="w-4 h-4 mr-1.5" />
              <span className="text-xs tracking-wider">快捷键</span>
            </button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('editor')} className="flex items-center text-cyan-400 hover:text-cyan-300 uppercase tracking-[0.2em] text-sm font-bold">
                <PlusSquare className="w-5 h-5 mr-2" /> 发布
              </button>
            )}
            {user ? (
              <div className="flex items-center space-x-6 pl-6 border-l border-white/10">
                <div className="flex items-center space-x-3">
                  <img src={user.avatar} className="w-9 h-9 rounded-full border border-cyan-500/50" />
                  <span className="text-xs font-bold opacity-90 uppercase tracking-widest">{user.username}</span>
                </div>
                <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <LogOut className="w-5 h-5 text-red-400" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)} 
                className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 text-xs font-bold uppercase tracking-[0.25em]"
              >
                Login
              </button>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
             <Layout className="w-7 h-7" />
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden glass absolute top-full left-0 right-0 p-8 flex flex-col space-y-6 animate-fade-in border-t border-white/10">
             <button onClick={() => navigate('home')} className="text-lg font-bold uppercase tracking-widest">首页</button>
             <button onClick={() => navigate('blog')} className="text-lg font-bold uppercase tracking-widest">归档</button>
             <button onClick={() => navigate('about')} className="text-lg font-bold uppercase tracking-widest">关于</button>
             <button onClick={() => navigate('friends')} className="text-lg font-bold uppercase tracking-widest">友链</button>
             <button onClick={() => setShowShortcutHelp(true)} className="text-lg font-bold uppercase tracking-widest">快捷键</button>
             {user?.role === 'admin' && <button onClick={() => navigate('editor')} className="text-lg font-bold uppercase tracking-widest text-cyan-400">发布文章</button>}
             {!user && <button onClick={() => setShowLoginModal(true)} className="text-lg font-bold uppercase tracking-widest">登入</button>}
             {user && <button onClick={handleLogout} className="text-lg font-bold uppercase tracking-widest text-red-400">登出</button>}
          </div>
        )}
      </nav>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)} 
          onLogin={handleLogin}
          error={loginError}
        />
      )}

      {/* Search Modal */}
      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onNavigate={(view, postId) => navigate(view, postId)}
      />
      <ShortcutHelpModal
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />

      {/* Main Content Area */}
      <main className="pt-24 pb-20 px-4 md:px-0">
        <div className="max-w-5xl mx-auto">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>}>
            {currentView === 'home' && <HomeView onNavigate={navigate} />}
            {currentView === 'blog' && (
              <BlogListView
                key={refreshKey}
                onNavigate={navigate}
                activeCategory={activeCategory}
                setActiveCategory={(category) =>
                  navigate('blog', null, category, null, {
                    noScroll: true,
                    blogQuery,
                  })
                }
                searchTerm={blogQuery}
                setSearchTerm={(nextQuery) =>
                  navigate('blog', null, activeCategory, null, {
                    noScroll: true,
                    replace: true,
                    blogQuery: nextQuery,
                  })
                }
              />
            )}
            {currentView === 'post' && selectedPostId && <PostDetailView key={selectedPostId} postId={selectedPostId} user={user} onNavigate={navigate} onPostResolved={handlePostResolved} />}
            {currentView === 'friends' && <FriendsView user={user} onDataChange={handleDataChange} />}
            {currentView === 'editor' && user?.role === 'admin' && <AdminEditorView key={editPostId || 'new'} onNavigate={navigate} onPublish={handleDataChange} editPostId={editPostId} />}
            {currentView === 'about' && <AboutView />}
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 glass">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs opacity-30 font-bold uppercase tracking-[0.4em]">© 2026 VECTR_SPACE. SIGNAL_STABLE.</p>
        </div>
      </footer>
    </div>
  );
};

// Login Modal Component
const LoginModal: React.FC<{ 
  onClose: () => void; 
  onLogin: (username: string, password: string) => void;
  error: string;
}> = ({ onClose, onLogin, error }) => {
  const [mode, setMode] = useState<'admin' | 'guest-login' | 'guest-register'>('admin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarMode, setAvatarMode] = useState<'ai' | 'upload'>('ai');
  const [avatarSeed, setAvatarSeed] = useState(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [uploadedAvatar, setUploadedAvatar] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const getAiAvatarUrl = (seed: string) =>
    `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

  const avatarPreview =
    avatarMode === 'upload' && uploadedAvatar ? uploadedAvatar : getAiAvatarUrl(avatarSeed);

  useEffect(() => {
    setLocalError('');
    setSuccess('');
  }, [mode]);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取头像文件失败'));
      reader.readAsDataURL(file);
    });

  const optimizeAvatar = async (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('请选择图片文件');
    }

    const rawDataUrl = await fileToDataUrl(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('头像图片解码失败'));
      img.src = rawDataUrl;
    });

    const maxSide = 256;
    const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;

    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.85);
    });

    if (!blob) return rawDataUrl;
    return fileToDataUrl(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await optimizeAvatar(file);
      setUploadedAvatar(optimized);
      setAvatarMode('upload');
      setLocalError('');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '头像处理失败');
    } finally {
      e.target.value = '';
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccess('');
    setLoading(true);
    
    const result = await auth.loginGuest(email.trim(), password);
    setLoading(false);
    
    if (result.success) {
      // 刷新页面以更新状态
      window.location.reload();
    } else {
      setLocalError(result.error || '登录失败');
    }
  };

  const handleGuestRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccess('');

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername || cleanUsername.length < 2) {
      setLocalError('用户名至少 2 个字符');
      return;
    }

    if (!cleanEmail) {
      setLocalError('请输入邮箱');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('两次输入的密码不一致');
      return;
    }
    
    if (password.length < 6) {
      setLocalError('密码至少需要6个字符');
      return;
    }

    if (avatarMode === 'upload' && !uploadedAvatar) {
      setLocalError('请先上传头像，或切换到 AI 头像');
      return;
    }
    
    setLoading(true);

    const chosenAvatar =
      avatarMode === 'upload' ? uploadedAvatar : getAiAvatarUrl(avatarSeed);

    const result = await auth.registerGuest(cleanEmail, password, cleanUsername, chosenAvatar);
    setLoading(false);
    
    if (result.success) {
      if (result.requiresEmailVerification) {
        setSuccess('注册成功！请先完成邮箱验证，再回来登录。');
      } else {
        setSuccess('注册成功！正在跳转...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } else {
      setLocalError(result.error || '注册失败');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative glass p-8 rounded-3xl border border-white/10 max-w-md w-full mx-4 shadow-2xl animate-fade-in">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5 opacity-60" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold font-orbitron">
            {mode === 'admin' && '管理员登录'}
            {mode === 'guest-login' && '访客登录'}
            {mode === 'guest-register' && '访客注册'}
          </h2>
          <p className="text-sm opacity-50 mt-2">
            {mode === 'admin' && '请输入管理员凭据'}
            {mode === 'guest-login' && '登录后可以点赞、评论'}
            {mode === 'guest-register' && '注册成为访客用户'}
          </p>
        </div>

        {/* Admin Login Form */}
        {mode === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
                autoFocus
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-cyan-900/40"
            >
              登录
            </button>

            <div className="text-center pt-4 border-t border-white/10">
              <p className="text-xs opacity-50 mb-3">访客入口</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMode('guest-login')}
                  className="flex-1 py-2 glass rounded-xl border border-white/10 hover:border-cyan-500/30 text-xs transition-colors"
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => setMode('guest-register')}
                  className="flex-1 py-2 glass rounded-xl border border-white/10 hover:border-cyan-500/30 text-xs transition-colors"
                >
                  注册
                </button>
              </div>
            </div>

            <p className="text-center text-xs opacity-30 mt-4">
              管理员默认密码：vectr2026
            </p>
          </form>
        )}

        {/* Guest Login Form */}
        {mode === 'guest-login' && (
          <form onSubmit={handleGuestLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
                autoFocus
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
                required
              />
            </div>

            {(localError || error) && (
              <p className="text-red-400 text-sm text-center">{localError || error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-cyan-900/40 disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>

            <div className="text-center pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setMode('guest-register')}
                className="text-xs text-cyan-400 hover:underline"
              >
                还没有账号？点击注册
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('admin')}
                className="text-xs opacity-50 hover:opacity-100"
>
                ← 返回管理员登录
              </button>
            </div>
          </form>
        )}

        {/* Guest Register Form */}
        {mode === 'guest-register' && (
          <form onSubmit={handleGuestRegister} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
                autoFocus
                required
                minLength={2}
              />
            </div>
            <div>
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
                required
              />
            </div>

            <div className="glass rounded-2xl border border-white/10 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest opacity-70">头像选择</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAvatarMode('ai')}
                    className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all ${
                      avatarMode === 'ai'
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    AI 随机
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarMode('upload')}
                    className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all ${
                      avatarMode === 'upload'
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    本地上传
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <img
                  src={avatarPreview}
                  alt="avatar-preview"
                  className="w-16 h-16 rounded-2xl object-cover border border-cyan-500/30 bg-black/20"
                />
                <div className="flex-1 space-y-2">
                  {avatarMode === 'ai' ? (
                    <button
                      type="button"
                      onClick={() => setAvatarSeed(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)}
                      className="w-full py-2 text-xs rounded-lg border border-white/10 hover:border-cyan-500/40 glass flex items-center justify-center"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      换一个 AI 头像
                    </button>
                  ) : (
                    <>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="w-full py-2 text-xs rounded-lg border border-white/10 hover:border-cyan-500/40 glass flex items-center justify-center"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        选择本地头像
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div>
              <input
                type="password"
                placeholder="密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
                required
                minLength={6}
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="确认密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
                required
              />
            </div>

            {localError && (
              <p className="text-red-400 text-sm text-center">{localError}</p>
            )}
            
            {success && (
              <p className="text-green-400 text-sm text-center">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-cyan-900/40 disabled:opacity-50"
            >
              {loading ? '注册中...' : '注册'}
            </button>

            <div className="text-center pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setMode('guest-login')}
                className="text-xs text-cyan-400 hover:underline"
              >
                已有账号？点击登录
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('admin')}
                className="text-xs opacity-50 hover:opacity-100"
              >
                ← 返回管理员登录
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const ShortcutHelpModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    { key: 'Ctrl/Cmd + K', action: '打开全局搜索' },
    { key: '/', action: '打开全局搜索' },
    { key: '?', action: '打开/关闭快捷键面板' },
    { key: 'H', action: '回到首页' },
    { key: 'B', action: '进入归档页' },
    { key: 'A', action: '进入关于页' },
    { key: 'F', action: '进入友链页' },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/10 glass p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold flex items-center">
            <Keyboard className="w-4 h-4 mr-2 text-cyan-400" />
            键盘快捷键
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="关闭快捷键帮助"
          >
            <X className="w-4 h-4 opacity-70" />
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <span className="text-sm opacity-80">{item.action}</span>
              <kbd className="px-2.5 py-1 rounded-md bg-black/30 border border-white/10 text-xs tracking-wide">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
