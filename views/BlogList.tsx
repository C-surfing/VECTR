import React, { useState } from 'react';
import { DB } from '../services/db';
import { Category } from '../types';
import { Search, Hash } from 'lucide-react';

interface BlogListProps {
  onNavigate: (view: any, id?: string) => void;
  activeCategory: Category | 'All';
  setActiveCategory: (cat: Category | 'All') => void;
}

const BlogList: React.FC<BlogListProps> = ({ onNavigate, activeCategory, setActiveCategory }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const posts = DB.getPosts().filter(p => {
    const matchesCat = activeCategory === 'All' || p.category.includes(activeCategory as Category);
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const categories: (Category | 'All')[] = ['All', 'CS', 'TA', '金融', '数学', '光影艺术', 'AI'];

  return (
    <div className="space-y-16">
      <header className="space-y-8">
        <div className="border-l-4 border-cyan-500 pl-6">
            <h1 className="text-5xl font-orbitron font-bold text-glow uppercase tracking-tighter">
                归档仓库 <span className="text-cyan-500">.archive</span>
            </h1>
            <p className="text-sm opacity-40 mt-2 font-mono uppercase tracking-[0.3em]">Querying history in standard space...</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 opacity-30 text-cyan-400" />
            <input 
              type="text" 
              placeholder="搜索灵感关键词 / SEARCH VECTOR..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-16 pr-6 py-5 glass rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-base font-medium transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-3 rounded-xl text-xs font-bold transition-all border uppercase tracking-[0.15em] ${
                  activeCategory === cat 
                    ? 'bg-cyan-600 border-cyan-400 shadow-lg shadow-cyan-900/40 text-white' 
                    : 'glass border-white/5 hover:border-white/20 hover:bg-white/10 opacity-70'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-8">
        {posts.length > 0 ? posts.map(post => (
          <div 
            key={post.id} 
            onClick={() => onNavigate('post', post.id)}
            className="glass p-8 rounded-[32px] flex flex-col md:flex-row gap-8 cursor-pointer hover:border-cyan-500/40 transition-all group shadow-xl hover:shadow-cyan-500/5"
          >
            {post.coverImage && (
              <div className="w-full md:w-72 h-48 rounded-2xl overflow-hidden shrink-0 relative">
                <img src={post.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[10%] group-hover:grayscale-0" />
                <div className="absolute inset-0 bg-black/20"></div>
              </div>
            )}
            <div className="flex flex-col justify-between py-2 flex-1">
              <div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.category.map(cat => (
                    <span key={cat} className="flex items-center text-xs text-cyan-400 font-bold uppercase tracking-[0.2em] px-3 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                      <Hash className="w-3 h-3 mr-1 opacity-50" /> {cat}
                    </span>
                  ))}
                </div>
                <h3 className="text-3xl font-bold mb-4 group-hover:text-cyan-300 transition-colors leading-tight tracking-tight">{post.title}</h3>
                <p className="opacity-50 text-base line-clamp-2 mb-6 leading-relaxed font-light">{post.excerpt}</p>
              </div>
              <div className="flex items-center space-x-6 opacity-30 text-[10px] font-mono tracking-widest uppercase">
                <span className="flex items-center"><div className="w-1 h-1 bg-cyan-500 rounded-full mr-2"></div> {new Date(post.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>{post.views} VIEWS</span>
                <span>•</span>
                <span className="font-bold text-cyan-400">{post.authorName}</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="py-32 text-center opacity-30 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border border-dashed border-white/20 flex items-center justify-center">
                <Search className="w-6 h-6" />
            </div>
            <p className="text-xl uppercase tracking-[0.3em] font-orbitron">Archive_Not_Found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogList;