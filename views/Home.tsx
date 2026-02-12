import React from 'react';
import { DB } from '../services/db';
import { Category } from '../types';
import { Sparkles, ArrowRight, Brain, Code, Palette, Landmark, Terminal, Cpu } from 'lucide-react';

const Home: React.FC<{ onNavigate: (view: any, id?: string, cat?: Category | 'All') => void }> = ({ onNavigate }) => {
  const recentPosts = DB.getPosts().slice(0, 3);

  const CATEGORIES: { icon: any, title: Category, desc: string, color: string }[] = [
    { icon: Terminal, title: 'CS', desc: '计算机科学', color: 'text-blue-400' },
    { icon: Palette, title: 'TA', desc: '技术美术', color: 'text-indigo-400' },
    { icon: Landmark, title: '金融', desc: '量化逻辑', color: 'text-emerald-400' },
    { icon: Brain, title: '数学', desc: '逻辑建模', color: 'text-purple-400' },
    { icon: Sparkles, title: '光影艺术', desc: '视觉审美', color: 'text-pink-400' },
    { icon: Cpu, title: 'AI', desc: '人工智能', color: 'text-cyan-400' }
  ];

  return (
    <div className="space-y-32">
      {/* Hero Section */}
      <section className="relative h-[65vh] flex flex-col items-center justify-center text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-cyan-500/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
        <h1 className="font-orbitron text-7xl md:text-9xl font-bold mb-8 tracking-tighter text-glow leading-none select-none uppercase">
          VEC<span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">TR</span>
        </h1>
        <p className="text-xl md:text-2xl opacity-60 max-w-2xl font-light mb-12 leading-relaxed tracking-wide px-4">
          解构代码逻辑，重塑数字审美。一个关于 <span className="text-cyan-400">CS</span>、<span className="text-purple-400">AI</span> 与 <span className="text-indigo-400">数学</span> 的矢量灵感仓库。
        </p>
        
        <div className="flex flex-wrap justify-center gap-6">
          <button 
            onClick={() => onNavigate('blog')}
            className="group px-10 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-bold flex items-center transition-all duration-300 shadow-xl shadow-cyan-900/40 uppercase tracking-widest text-sm"
          >
            探索归档 <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button 
            onClick={() => onNavigate('friends')}
            className="px-10 py-4 glass hover:bg-white/10 rounded-2xl font-bold transition-all duration-300 uppercase tracking-widest text-sm border border-white/10"
          >
            时空友链
          </button>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {CATEGORIES.map((item, i) => (
          <div 
            key={i} 
            onClick={() => onNavigate('blog', null, item.title)}
            className="glass p-10 rounded-[32px] border border-white/5 hover:border-cyan-500/40 transition-all duration-500 group text-center cursor-pointer hover:-translate-y-2 relative overflow-hidden"
          >
            <div className={`absolute -right-2 -bottom-2 opacity-[0.05] group-hover:opacity-[0.15] transition-opacity ${item.color}`}>
               <item.icon className="w-24 h-24" />
            </div>
            <item.icon className={`w-12 h-12 mb-6 mx-auto ${item.color} group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]`} />
            <h3 className="text-base font-bold mb-3 font-orbitron tracking-widest uppercase">{item.title}</h3>
            <p className="opacity-40 text-xs uppercase tracking-tighter leading-tight">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Recent Posts */}
      <section className="space-y-12">
        <div className="flex justify-between items-end border-b border-white/5 pb-6">
          <h2 className="text-4xl font-orbitron font-bold flex items-center text-glow uppercase tracking-tighter">
            <Sparkles className="mr-4 text-cyan-400 w-8 h-8" /> 近期文章
          </h2>
          <button onClick={() => onNavigate('blog')} className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center text-sm font-bold uppercase tracking-widest">
            查看全部 <ArrowRight className="ml-1 w-4 h-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {recentPosts.map((post) => (
            <div 
              key={post.id} 
              onClick={() => onNavigate('post', post.id)}
              className="glass rounded-[32px] overflow-hidden cursor-pointer hover:translate-y-[-8px] transition-all duration-700 border border-white/5 group shadow-2xl relative"
            >
              {post.coverImage && (
                <div className="h-56 overflow-hidden relative">
                  <img src={post.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[20%] group-hover:grayscale-0" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020208] to-transparent opacity-60"></div>
                  <div className="absolute top-6 left-6 flex flex-wrap gap-2">
                    {post.category.slice(0, 2).map(cat => (
                      <span key={cat} className="bg-cyan-600/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-[0.2em] border border-cyan-400/30">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-4 group-hover:text-cyan-300 transition-colors line-clamp-2 leading-tight tracking-tight">{post.title}</h3>
                <p className="opacity-50 text-sm mb-8 line-clamp-2 leading-relaxed font-light">{post.excerpt}</p>
                <div className="flex justify-between items-center opacity-30 text-[10px] font-mono tracking-widest uppercase">
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center"><div className="w-1 h-1 bg-cyan-500 rounded-full mr-2"></div> {post.views} VIEWS</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;