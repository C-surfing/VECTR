import React from 'react';

const hueCache = new Map<string, number>();

const hashToHue = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const extractHueFromImage = async (src: string): Promise<number> => {
  return await new Promise<number>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let sumX = 0;
        let sumY = 0;
        let weightSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          const alpha = data[i + 3] / 255;
          if (alpha < 0.05) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const chroma = max - min;
          if (chroma < 0.06) continue;

          let hue = 0;
          if (max === r) {
            hue = ((g - b) / chroma) % 6;
          } else if (max === g) {
            hue = (b - r) / chroma + 2;
          } else {
            hue = (r - g) / chroma + 4;
          }
          hue *= 60;
          if (hue < 0) hue += 360;

          const sat = chroma / Math.max(max, 0.0001);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const weight = alpha * sat * (1 - Math.abs(lum - 0.52));
          if (weight <= 0.001) continue;

          const rad = (hue * Math.PI) / 180;
          sumX += Math.cos(rad) * weight;
          sumY += Math.sin(rad) * weight;
          weightSum += weight;
        }

        if (weightSum <= 0.01) {
          reject(new Error('no vivid pixels'));
          return;
        }

        let avg = (Math.atan2(sumY, sumX) * 180) / Math.PI;
        if (avg < 0) avg += 360;
        resolve(avg);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('extract failed'));
      }
    };

    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
};

export const useCoverAccentHue = (imageUrl: string | undefined, seed: string): number => {
  const fallbackHue = React.useMemo(() => hashToHue(seed || 'vectr'), [seed]);
  const [hue, setHue] = React.useState(fallbackHue);

  React.useEffect(() => {
    let active = true;
    const target = String(imageUrl || '').trim();
    if (!target) {
      setHue(fallbackHue);
      return () => {
        active = false;
      };
    }

    if (hueCache.has(target)) {
      setHue(hueCache.get(target) as number);
      return () => {
        active = false;
      };
    }

    extractHueFromImage(target)
      .then((nextHue) => {
        if (!active) return;
        const normalized = clamp(nextHue, 0, 360);
        hueCache.set(target, normalized);
        setHue(normalized);
      })
      .catch(() => {
        if (!active) return;
        setHue(fallbackHue);
      });

    return () => {
      active = false;
    };
  }, [fallbackHue, imageUrl]);

  return hue;
};

