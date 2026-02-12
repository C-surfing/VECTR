
import React from 'react';
import MathRenderer from './MathRenderer';

interface MarkdownContentProps {
  content: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  // Regex to split by math ($...$ or $$...$$), images (![alt](url)), and links ([text](url))
  // For a simple implementation, we handle math first, then others.
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);

  return (
    <div className="prose prose-invert max-w-none prose-purple leading-relaxed">
      {parts.map((part, i) => {
        // Handle Block Math
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <MathRenderer key={i} formula={part.slice(2, -2)} displayMode />;
        } 
        // Handle Inline Math
        if (part.startsWith('$') && part.endsWith('$')) {
          return <MathRenderer key={i} formula={part.slice(1, -1)} />;
        }
        // Handle Images ![alt](url)
        if (part.startsWith('![') && part.includes('](')) {
          const alt = part.match(/!\[(.*?)\]/)?.[1] || "";
          const url = part.match(/\((.*?)\)/)?.[1] || "";
          return (
            <div key={i} className="my-8 group">
              <img 
                src={url} 
                alt={alt} 
                className="rounded-2xl border border-white/10 shadow-2xl mx-auto max-h-[600px] hover:scale-[1.01] transition-transform duration-500" 
              />
              {alt && <p className="text-center text-xs opacity-40 mt-3 italic font-light">{alt}</p>}
            </div>
          );
        }
        // Handle Links [text](url)
        if (part.startsWith('[') && part.includes('](')) {
          const text = part.match(/\[(.*?)\]/)?.[1] || "";
          const url = part.match(/\((.*?)\)/)?.[1] || "";
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 decoration-cyan-500/30">
              {text}
            </a>
          );
        }
        // Normal Text
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
      })}
    </div>
  );
};

export default MarkdownContent;
