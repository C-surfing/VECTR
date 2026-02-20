import React, { useState, useEffect, useRef } from 'react';
import { List, X, ChevronRight } from 'lucide-react';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentRef: React.RefObject<HTMLElement | null>;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ contentRef }) => {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // 提取标题 - 添加延迟确保内容已渲染
  useEffect(() => {
    // 延迟提取确保DOM已渲染
    const timer = setTimeout(() => {
      if (!contentRef.current) {
        return;
      }
      
      // 直接在 ref 元素内查找 h1 和 h2
      const elements = contentRef.current.querySelectorAll('h1, h2');
      
      const items: TocItem[] = [];
      elements.forEach((elem, index) => {
        // 生成唯一ID
        const id = elem.id || `heading-${index}`;
        elem.id = id;
        
        items.push({
          id,
          text: elem.textContent || '',
          level: parseInt(elem.tagName.charAt(1))
        });
      });
      
      setHeadings(items);
      if (items.length > 0) {
        setActiveId(items[0].id);
      }
      setIsReady(true);
    }, 1000); // 延迟1秒确保内容渲染完成
    
    return () => clearTimeout(timer);
  }, [contentRef]);

  // 监听滚动，高亮当前章节
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0
      }
    );

    headings.forEach((item) => {
      const elem = document.getElementById(item.id);
      if (elem) observer.observe(elem);
    });

    return () => observer.disconnect();
  }, [headings]);

  // 点击跳转
  const handleClick = (id: string) => {
    const elem = document.getElementById(id);
    if (elem) {
      const top = elem.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: 'smooth' });
      setIsOpen(false);
    }
  };

  // 只有准备好且有足够标题时才显示
  if (!isReady || headings.length === 0) return null;
  if (headings.length < 2) return null; // 只有1个标题时不显示

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed bottom-20 right-8 z-40 w-12 h-12 glass rounded-full border border-cyan-500/30 flex items-center justify-center hover:bg-cyan-500/20 transition-all shadow-lg"
        title="文章目录"
      >
        <List className="w-5 h-5 text-cyan-400" />
      </button>

      {/* Desktop Sidebar */}
      <nav className="hidden lg:block sticky top-32 self-start w-64 max-h-[calc(100vh-10rem)] overflow-y-auto">
        <div className="glass rounded-2xl border border-white/10 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4 flex items-center">
            <List className="w-4 h-4 mr-2" />
            文章目录
          </h3>
          <ul className="space-y-2">
            {headings.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleClick(item.id)}
                  className={`w-full text-left text-sm py-1.5 px-3 rounded-lg transition-all truncate block ${
                    item.level === 1 
                      ? 'font-medium' 
                      : 'pl-6 opacity-70'
                  } ${
                    activeId === item.id
                      ? 'text-cyan-400 bg-cyan-500/10 border-l-2 border-cyan-400'
                      : 'hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Mobile Modal */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-80 glass border-l border-white/10 p-4 animate-slide-in-right">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest flex items-center">
                <List className="w-4 h-4 mr-2" />
                文章目录
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-2 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {headings.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleClick(item.id)}
                    className={`w-full text-left text-sm py-2 px-3 rounded-lg transition-all flex items-center ${
                      item.level === 1 
                        ? 'font-medium' 
                        : 'pl-6 opacity-70'
                    } ${
                      activeId === item.id
                        ? 'text-cyan-400 bg-cyan-500/10'
                        : 'hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <ChevronRight className="w-3 h-3 mr-2 opacity-40" />
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
};
