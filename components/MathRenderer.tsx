
import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathRendererProps {
  formula: string;
  displayMode?: boolean;
}

const MathRenderer: React.FC<MathRendererProps> = ({ formula, displayMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(formula, containerRef.current, {
          throwOnError: false,
          displayMode,
          output: 'html'
        });
      } catch (e) {
        console.error("Katex error", e);
      }
    }
  }, [formula, displayMode]);

  return <span ref={containerRef} className={displayMode ? "block my-4" : "inline-block"} />;
};

export default MathRenderer;
