import React, { useState, useEffect } from 'react';

export const ReadingProgress: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      
      if (scrollHeight <= 0) {
        setProgress(0);
        return;
      }
      
      const scrollPercent = (scrollTop / scrollHeight) * 100;
      setProgress(Math.min(100, Math.max(0, scrollPercent)));
    };

    // 使用requestAnimationFrame优化性能
    let ticking = false;
    
    const optimizedScrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', optimizedScrollHandler, { passive: true });
    handleScroll(); // 初始化

    return () => {
      window.removeEventListener('scroll', optimizedScrollHandler);
    };
  }, []);

  // 始终渲染进度条
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent pointer-events-none">
      <div 
        className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-lg shadow-cyan-500/50 transition-all duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
