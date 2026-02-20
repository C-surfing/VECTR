import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { Post, Category } from '../types';
import { DB } from '../services/db';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: 'post', postId: string) => void;
}

const CATEGORY_OPTIONS: (Category | 'All')[] = ['All', 'CS', 'TA', '金融', '数学', '光影艺术', 'AI', '生活', '哲学'];

const highlightText = (text: string, keyword: string): React.ReactNode => {
  const q = keyword.trim();
  if (!q) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQuery, cursor);
    if (idx < 0) {
      nodes.push(<React.Fragment key={`tail-${key++}`}>{text.slice(cursor)}</React.Fragment>);
      break;
    }

    if (idx > cursor) {
      nodes.push(<React.Fragment key={`plain-${key++}`}>{text.slice(cursor, idx)}</React.Fragment>);
    }

    nodes.push(
      <mark key={`mark-${key++}`} className="bg-cyan-500/30 text-cyan-100 px-1 rounded">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    cursor = idx + q.length;
  }

  return nodes;
};

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Post[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedCategory('All');
      setActiveIndex(-1);
      rowRefs.current = [];
    }
  }, [isOpen]);

  useEffect(() => {
    const searchPosts = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const posts = await DB.searchPosts(query);
        setResults(posts.slice(0, 30));
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchPosts, 250);
    return () => clearTimeout(debounce);
  }, [query]);

  const filteredResults = useMemo(() => {
    if (selectedCategory === 'All') return results;
    return results.filter((post) => post.category.includes(selectedCategory));
  }, [results, selectedCategory]);

  useEffect(() => {
    if (filteredResults.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((prev) => {
      if (prev < 0) return 0;
      return Math.min(prev, filteredResults.length - 1);
    });
  }, [filteredResults]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const currentRow = rowRefs.current[activeIndex];
    currentRow?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleResultClick = (postId: string) => {
    onNavigate('post', postId);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredResults.length === 0) return;
      setActiveIndex((prev) => (prev < 0 ? 0 : (prev + 1) % filteredResults.length));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredResults.length === 0) return;
      setActiveIndex((prev) => {
        if (prev < 0) return filteredResults.length - 1;
        return prev === 0 ? filteredResults.length - 1 : prev - 1;
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults.length === 0) return;
      const target = filteredResults[activeIndex >= 0 ? activeIndex : 0];
      if (target) {
        handleResultClick(target.id);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl mx-4 glass rounded-2xl border border-white/10 shadow-2xl animate-fade-in overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <Search className="w-5 h-5 text-cyan-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索文章..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/40 text-lg"
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as Category | 'All')}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-cyan-500/40"
            title="分类筛选"
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat} className="bg-[#0d1020]">
                {cat}
              </option>
            ))}
          </select>

          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 opacity-60" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 opacity-60" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-white/10 bg-white/5 text-xs opacity-60">
          {query.trim().length >= 2 ? `找到 ${filteredResults.length} 条结果` : '输入至少 2 个字符开始搜索'}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {isSearching ? (
            <div className="p-8 text-center text-white/40">
              <div className="animate-pulse">搜索中...</div>
            </div>
          ) : query.length >= 2 && filteredResults.length === 0 ? (
            <div className="p-8 text-center text-white/40">
              未找到相关文章
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="py-2">
              {filteredResults.map((post, index) => (
                <button
                  key={post.id}
                  ref={(node) => {
                    rowRefs.current[index] = node;
                  }}
                  onClick={() => handleResultClick(post.id)}
                  className={`w-full flex items-start p-4 transition-colors text-left ${
                    activeIndex === index ? 'bg-cyan-500/15' : 'hover:bg-white/5'
                  }`}
                >
                  <FileText className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${activeIndex === index ? 'text-cyan-300' : 'text-cyan-400/60'}`} />
                  <div className="min-w-0">
                    <div className="text-white font-medium line-clamp-1">
                      {highlightText(post.title, query)}
                    </div>
                    {post.excerpt && (
                      <div className="text-white/40 text-sm mt-1 line-clamp-2">
                        {highlightText(post.excerpt, query)}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[10px] opacity-50 uppercase tracking-wider">
                      {post.category.slice(0, 2).map((cat) => (
                        <span key={cat} className="px-2 py-0.5 rounded bg-white/10">
                          {cat}
                        </span>
                      ))}
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.length > 0 && query.length < 2 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              请输入至少2个字符进行搜索
            </div>
          ) : (
            <div className="p-8 text-center text-white/40 text-sm">
              输入关键词搜索文章
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/10 bg-white/5">
          <div className="flex items-center justify-between text-xs text-white/30">
            <span>按 <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd> 关闭</span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑</kbd>/<kbd className="px-1.5 py-0.5 bg-white/10 rounded">↓</kbd> 选择 · <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Enter</kbd> 打开
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SearchButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="p-2 tap-target hover:bg-white/10 rounded-full transition-colors"
    title="搜索文章 (Ctrl/Cmd + K)"
    aria-label="打开文章搜索"
  >
    <Search className="w-5 h-5" />
  </button>
);
