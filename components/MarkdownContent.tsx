
import React from 'react';
import MathRenderer from './MathRenderer';

interface MarkdownContentProps {
  content: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  // Simple regex-based splitter for demonstration. 
  // Real apps would use react-markdown + remark-math.
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$.*?\$)/g);

  return (
    <div className="prose prose-invert max-w-none prose-purple leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <MathRenderer key={i} formula={part.slice(2, -2)} displayMode />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          return <MathRenderer key={i} formula={part.slice(1, -1)} />;
        }
        return <p key={i} className="whitespace-pre-wrap inline">{part}</p>;
      })}
    </div>
  );
};

export default MarkdownContent;
