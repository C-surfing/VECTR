import React from 'react';
import { Hash } from 'lucide-react';
import { Category } from '../types';
import { useCoverAccentHue } from '../services/coverAccent';

interface PostCategoryBadgesProps {
  categories: Category[];
  coverImage?: string;
  seed: string;
  max?: number;
  className?: string;
}

const PostCategoryBadges: React.FC<PostCategoryBadgesProps> = ({
  categories,
  coverImage,
  seed,
  max,
  className,
}) => {
  const hue = useCoverAccentHue(coverImage, seed);
  const visible = typeof max === 'number' && max > 0 ? categories.slice(0, max) : categories;

  return (
    <div className={className || 'flex flex-wrap gap-2'}>
      {visible.map((cat) => (
        <span
          key={cat}
          className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-lg border"
          style={{
            backgroundColor: `hsla(${hue}, 85%, 55%, 0.13)`,
            borderColor: `hsla(${hue}, 90%, 62%, 0.42)`,
            color: `hsl(${hue}, 96%, 82%)`,
          }}
        >
          <Hash className="w-3 h-3 mr-1.5 opacity-80" />
          {cat}
        </span>
      ))}
    </div>
  );
};

export default PostCategoryBadges;

