import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { DB } from '../services/db';
import { Post, Category } from '../types';
import {
  Sparkles,
  ArrowRight,
  Brain,
  Palette,
  Landmark,
  Terminal,
  Cpu,
  UserCircle,
  Loader2,
  Bot,
  BookOpen,
  Heart,
  MessageSquare,
  Clock,
  Eye,
  Star,
} from 'lucide-react';
import LazyImage from '../components/LazyImage';
import PostCategoryBadges from '../components/PostCategoryBadges';

const AIChat = lazy(() => import('../components/AIChat'));

const Home: React.FC<{ onNavigate: (view: any, id?: string, cat?: Category | 'All') => void }> = ({ onNavigate }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let isActive = true;

    const loadPosts = async () => {
      try {
        const allPosts = await DB.getPosts();
        if (!isActive) return;
        setPosts(allPosts);
        setLoading(false);

        // Load comment counts in background to keep first paint fast.
        const candidates = allPosts.slice(0, 10);
        const counts = await Promise.all(
          candidates.map(async (post) => {
            try {
              const comments = await DB.getComments(post.id);
              return [post.id, comments.length] as const;
            } catch {
              return [post.id, 0] as const;
            }
          }),
        );

        if (!isActive) return;
        setCommentCounts(Object.fromEntries(counts));
      } catch (error) {
        console.error('Error loading posts:', error);
        if (!isActive) return;
        setLoading(false);
      }
    };
    loadPosts();
    return () => {
      isActive = false;
    };
  }, []);

  const featuredPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => {
        const scoreA = a.likes.length * 3 + a.views * 0.18;
        const scoreB = b.likes.length * 3 + b.views * 0.18;
        return scoreB - scoreA || b.createdAt - a.createdAt;
      })
      .slice(0, 2);
  }, [posts]);

  const recentUpdates = useMemo(() => {
    const featuredSet = new Set(featuredPosts.map((post) => post.id));
    return posts.filter((post) => !featuredSet.has(post.id)).slice(0, 6);
  }, [featuredPosts, posts]);

  const heroLogoText = 'VECTR';

  const CATEGORIES: { icon: any; title: Category; desc: string; color: string }[] = [
    { icon: Terminal, title: 'CS', desc: '计算机科学', color: 'text-blue-400' },
    { icon: Palette, title: 'TA', desc: '技术美术', color: 'text-indigo-400' },
    { icon: Landmark, title: '金融', desc: '量化逻辑', color: 'text-emerald-400' },
    { icon: Brain, title: '数学', desc: '逻辑建模', color: 'text-purple-400' },
    { icon: Sparkles, title: '光影艺术', desc: '视觉审美', color: 'text-pink-400' },
    { icon: Cpu, title: 'AI', desc: '人工智能', color: 'text-cyan-400' },
    { icon: UserCircle, title: '生活', desc: '生活思考', color: 'text-green-400' },
    { icon: BookOpen, title: '哲学', desc: 'Philosophy', color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-24">
      <section className="relative h-[60vh] flex flex-col items-center justify-center text-center">
        <h1 className="font-orbitron text-7xl md:text-9xl font-bold tracking-tight text-glow uppercase hero-logo-group flex">
          {heroLogoText.split('').map((char, index) => (
            <span
              key={index}
              className="wave-char"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {char}
            </span>
          ))}
        </h1>
        <p className="mt-6 text-xl opacity-70 tracking-[0.15em] uppercase">C-surfing 的个人博客</p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            onClick={() => onNavigate('blog')}
            className="group px-8 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold flex items-center transition-all uppercase tracking-widest text-sm"
          >
            探索归档 <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => onNavigate('about')}
            className="px-8 py-3 glass rounded-xl border border-white/10 hover:bg-white/10 transition-all uppercase tracking-widest text-sm"
          >
            关于
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {CATEGORIES.map((item) => (
          <button
            key={item.title}
            onClick={() => onNavigate('blog', null, item.title)}
            className="glass p-6 rounded-2xl border border-white/10 hover:border-cyan-500/40 transition-all text-center"
          >
            <item.icon className={`w-8 h-8 mx-auto mb-3 ${item.color}`} />
            <div className="font-bold uppercase tracking-widest text-sm">{item.title}</div>
            <div className="text-xs opacity-50 mt-1">{item.desc}</div>
          </button>
        ))}
      </section>

      <button
        onClick={() => setIsAIChatOpen(true)}
        className="fixed bottom-8 left-8 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40 hover:scale-110 transition-transform border border-white/20"
        title="AI 助手"
      >
        <Bot className="w-6 h-6 text-white" />
      </button>
      {isAIChatOpen && (
        <Suspense fallback={null}>
          <AIChat isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
        </Suspense>
      )}

      <section className="space-y-8">
        <div className="flex justify-between items-end border-b border-white/10 pb-4">
          <h2 className="text-3xl font-orbitron font-bold flex items-center">
            <Sparkles className="mr-3 text-cyan-400" /> 内容流
          </h2>
          <button onClick={() => onNavigate('blog')} className="text-cyan-400 hover:text-cyan-300 text-sm uppercase tracking-widest">
            查看全部
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.25fr_0.95fr] gap-8">
            <section className="space-y-4">
              <div className="flex items-center text-xs uppercase tracking-[0.2em] opacity-70">
                <Star className="w-3.5 h-3.5 mr-2 text-amber-300" />
                编辑精选
              </div>
              <div className="space-y-5">
                {featuredPosts.map((post) => (
                  <article
                    key={post.id}
                    onClick={() => onNavigate('post', post.id)}
                    className="glass rounded-3xl overflow-hidden border border-white/10 cursor-pointer hover:border-cyan-500/45 transition-all group"
                  >
                    {post.coverImage && (
                      <div className="h-56 overflow-hidden">
                        <LazyImage
                          src={post.coverImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
                        />
                      </div>
                    )}
                    <div className="p-6 space-y-3">
                      <PostCategoryBadges categories={post.category} coverImage={post.coverImage} seed={post.id} max={3} />
                      <h3 className="text-2xl font-bold leading-tight line-clamp-2">{post.title}</h3>
                      <p className="text-sm opacity-70 leading-relaxed line-clamp-3">{post.excerpt}</p>
                      <div className="pt-1 flex flex-wrap items-center gap-4 text-xs opacity-70 font-mono">
                        <span className="flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Eye className="w-3.5 h-3.5 mr-1.5 text-violet-300" />
                          {post.views}
                        </span>
                        <span className="flex items-center">
                          <Heart className="w-3.5 h-3.5 mr-1.5 text-pink-400" />
                          {post.likes.length}
                        </span>
                        <span className="flex items-center">
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-cyan-300" />
                          {commentCounts[post.id] ?? 0}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center text-xs uppercase tracking-[0.2em] opacity-70">
                <Clock className="w-3.5 h-3.5 mr-2 text-cyan-300" />
                最近更新
              </div>
              <div className="space-y-3">
                {recentUpdates.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => onNavigate('post', post.id)}
                    className="w-full glass rounded-2xl border border-white/10 hover:border-cyan-500/35 transition-all text-left p-4"
                  >
                    <div className="space-y-2">
                      <PostCategoryBadges categories={post.category} coverImage={post.coverImage} seed={`${post.id}-recent`} max={2} />
                      <h3 className="font-bold line-clamp-2 leading-snug">{post.title}</h3>
                      <div className="flex items-center justify-between text-[11px] font-mono opacity-65">
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        <span>{commentCounts[post.id] ?? 0} COMMENTS</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
