import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, ZoomOut, ZoomIn, RotateCcw, Maximize2, X } from 'lucide-react';
import { extractExcalidrawJsonFromMarkdown, stripBom } from '../services/obsidian';

interface ExcalidrawEmbedProps {
  src: string;
  className?: string;
}

type ExcalidrawElement = {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  points?: number[][];
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  roundness?: { value?: number } | null;
  isDeleted?: boolean;
  fileId?: string;
};

type ExcalidrawBinaryFile = {
  id?: string;
  dataURL?: string;
  mimeType?: string;
};

type ExcalidrawScene = {
  elements: ExcalidrawElement[];
  files?: Record<string, ExcalidrawBinaryFile>;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const scenePromiseCache = new Map<string, Promise<ExcalidrawScene>>();
const sceneValueCache = new Map<string, ExcalidrawScene>();

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isTransparent = (value?: string): boolean => {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === 'transparent' || normalized === 'none' || normalized === '#00000000';
};

const withAlpha = (color: string | undefined, opacity: number): string => {
  if (!color) return '#0f172a';
  const alpha = clamp(opacity / 100, 0.05, 1);
  if (/^#([0-9a-f]{3}){1,2}$/i.test(color)) {
    const hex = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
    const value = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    return `${hex}${value}`;
  }
  return color;
};

const getFontFamily = (fontFamily?: number): string => {
  if (fontFamily === 1) return 'Virgil, "Comic Sans MS", cursive';
  if (fontFamily === 2) return '"Helvetica Neue", Arial, sans-serif';
  if (fontFamily === 3) return '"Cascadia Code", Consolas, Monaco, "Courier New", monospace';
  return '"Helvetica Neue", Arial, sans-serif';
};

const parseScene = (raw: unknown): ExcalidrawScene => {
  if (raw && typeof raw === 'object') {
    const direct = raw as {
      elements?: unknown;
      files?: unknown;
      scene?: { elements?: unknown; files?: unknown };
    };

    const elements = Array.isArray(direct.elements)
      ? direct.elements
      : Array.isArray(direct.scene?.elements)
        ? direct.scene.elements
        : [];

    const filesSource = direct.files && typeof direct.files === 'object'
      ? direct.files
      : direct.scene?.files && typeof direct.scene.files === 'object'
        ? direct.scene.files
        : undefined;

    return {
      elements: elements
        .filter((elem): elem is ExcalidrawElement => Boolean(elem && typeof elem === 'object'))
        .filter((elem) => !elem.isDeleted),
      files: filesSource as Record<string, ExcalidrawBinaryFile> | undefined,
    };
  }

  if (Array.isArray(raw)) {
    return {
      elements: raw
        .filter((elem): elem is ExcalidrawElement => Boolean(elem && typeof elem === 'object'))
        .filter((elem) => !elem.isDeleted),
      files: {},
    };
  }

  return { elements: [], files: {} };
};

const readScene = async (src: string): Promise<ExcalidrawScene> => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const text = stripBom(await response.text());
  let parsed: unknown = null;

  try {
    parsed = JSON.parse(text);
  } catch {
    const extracted = extractExcalidrawJsonFromMarkdown(text);
    if (!extracted) {
      throw new Error('不是有效的 Excalidraw 文件（JSON/Obsidian）');
    }
    try {
      parsed = JSON.parse(extracted);
    } catch {
      throw new Error('Excalidraw 场景解析失败');
    }
  }

  const scene = parseScene(parsed);
  if (scene.elements.length === 0) {
    throw new Error('绘图文件没有可渲染元素');
  }

  return scene;
};

const loadScene = (src: string): Promise<ExcalidrawScene> => {
  const cached = sceneValueCache.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = scenePromiseCache.get(src);
  if (pending) return pending;

  const promise = readScene(src).then((scene) => {
    sceneValueCache.set(src, scene);
    scenePromiseCache.delete(src);
    return scene;
  });

  scenePromiseCache.set(src, promise);
  return promise;
};

const getElementBounds = (element: ExcalidrawElement): Bounds => {
  const x = toFiniteNumber(element.x);
  const y = toFiniteNumber(element.y);
  const width = toFiniteNumber(element.width);
  const height = toFiniteNumber(element.height);
  const points = Array.isArray(element.points) ? element.points : [];

  if ((element.type === 'line' || element.type === 'arrow' || element.type === 'freedraw') && points.length > 0) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      const px = x + toFiniteNumber(point?.[0]);
      const py = y + toFiniteNumber(point?.[1]);
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }

    return { minX, minY, maxX, maxY };
  }

  const x2 = x + width;
  const y2 = y + height;
  return {
    minX: Math.min(x, x2),
    minY: Math.min(y, y2),
    maxX: Math.max(x, x2),
    maxY: Math.max(y, y2),
  };
};

const mergeBounds = (elements: ExcalidrawElement[]): Bounds => {
  const initial: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  const merged = elements.reduce((acc, element) => {
    const current = getElementBounds(element);
    return {
      minX: Math.min(acc.minX, current.minX),
      minY: Math.min(acc.minY, current.minY),
      maxX: Math.max(acc.maxX, current.maxX),
      maxY: Math.max(acc.maxY, current.maxY),
    };
  }, initial);

  if (!Number.isFinite(merged.minX) || !Number.isFinite(merged.maxX)) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 600 };
  }

  return merged;
};

const ExcalidrawEmbed: React.FC<ExcalidrawEmbedProps> = React.memo(({ src, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);

  const [shouldLoad, setShouldLoad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<ExcalidrawScene | null>(null);

  const [zoom, setZoom] = useState(130);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState(130);
  const [fullscreenPan, setFullscreenPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const markerId = `arrow-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    setScene(null);
    setError(null);
    setLoading(false);
    setShouldLoad(false);
    setZoom(130);
    setIsFullscreen(false);
    setFullscreenZoom(130);
    setFullscreenPan({ x: 0, y: 0 });
    setIsPanning(false);
  }, [src]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '280px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad || !src) return;

    let active = true;
    setLoading(true);
    setError(null);

    loadScene(src)
      .then((nextScene) => {
        if (!active) return;
        setScene(nextScene);
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : '绘图加载失败';
        setError(message);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [shouldLoad, src]);

  useEffect(() => {
    if (!isFullscreen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const prepared = useMemo(() => {
    if (!scene || scene.elements.length === 0) return null;

    const bounds = mergeBounds(scene.elements);
    const padding = 24;
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);

    return {
      bounds,
      viewBox: [
        bounds.minX - padding,
        bounds.minY - padding,
        contentWidth + padding * 2,
        contentHeight + padding * 2,
      ].join(' '),
    };
  }, [scene]);

  const blockClassName =
    className ||
    'my-6 rounded-2xl overflow-hidden border border-slate-200/80 bg-gradient-to-b from-slate-50 to-slate-100 shadow-lg shadow-black/20';

  const openFullscreen = () => {
    setFullscreenZoom(clamp(zoom, 80, 300));
    setFullscreenPan({ x: 0, y: 0 });
    setIsFullscreen(true);
  };

  const startPan = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isFullscreen) return;
    setIsPanning(true);
    dragOriginRef.current = {
      x: event.clientX - fullscreenPan.x,
      y: event.clientY - fullscreenPan.y,
    };
  };

  const movePan = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isFullscreen || !isPanning || !dragOriginRef.current) return;
    setFullscreenPan({
      x: event.clientX - dragOriginRef.current.x,
      y: event.clientY - dragOriginRef.current.y,
    });
  };

  const endPan = () => {
    setIsPanning(false);
    dragOriginRef.current = null;
  };

  const handleFullscreenWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!isFullscreen) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 12 : -12;
    setFullscreenZoom((prev) => clamp(prev + delta, 40, 500));
  };

  const renderedElements = useMemo(() => {
    if (!scene) return null;

    return scene.elements.map((element, idx) => {
      const type = element.type || 'rectangle';
      const x = toFiniteNumber(element.x);
      const y = toFiniteNumber(element.y);
      const width = toFiniteNumber(element.width);
      const height = toFiniteNumber(element.height);
      const strokeWidth = Math.max(1.4, toFiniteNumber(element.strokeWidth, 2));
      const opacity = clamp(toFiniteNumber(element.opacity, 100), 5, 100);
      const strokeColor = withAlpha(element.strokeColor || '#0f172a', opacity);
      const fillColor = isTransparent(element.backgroundColor)
        ? 'transparent'
        : withAlpha(element.backgroundColor || '#cbd5e1', opacity);

      const dash =
        element.strokeStyle === 'dashed'
          ? '8 6'
          : element.strokeStyle === 'dotted'
            ? '2 6'
            : undefined;

      const angle = toFiniteNumber(element.angle);
      const rotate =
        Math.abs(angle) > 0.0001
          ? `rotate(${(angle * 180) / Math.PI} ${x + width / 2} ${y + height / 2})`
          : undefined;

      const key = `${element.id || type}-${idx}`;

      if (type === 'rectangle' || type === 'frame') {
        const rx = Math.max(0, toFiniteNumber(element.roundness?.value, 6));
        return (
          <rect
            key={key}
            x={Math.min(x, x + width)}
            y={Math.min(y, y + height)}
            width={Math.abs(width)}
            height={Math.abs(height)}
            rx={rx}
            ry={rx}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            transform={rotate}
          />
        );
      }

      if (type === 'ellipse') {
        return (
          <ellipse
            key={key}
            cx={x + width / 2}
            cy={y + height / 2}
            rx={Math.abs(width / 2)}
            ry={Math.abs(height / 2)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            transform={rotate}
          />
        );
      }

      if (type === 'diamond') {
        const left = `${x},${y + height / 2}`;
        const top = `${x + width / 2},${y}`;
        const right = `${x + width},${y + height / 2}`;
        const bottom = `${x + width / 2},${y + height}`;
        return (
          <polygon
            key={key}
            points={`${top} ${right} ${bottom} ${left}`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            transform={rotate}
          />
        );
      }

      if (type === 'text') {
        const lines = String(element.text || '')
          .split('\n')
          .map((line) => line.replace(/\t/g, '    '));
        const fontSize = Math.max(12, toFiniteNumber(element.fontSize, 20));
        const lineHeight = fontSize * 1.35;
        const family = getFontFamily(element.fontFamily);

        return (
          <text
            key={key}
            x={x}
            y={y + fontSize}
            fill={strokeColor}
            fontSize={fontSize}
            fontFamily={family}
            xmlSpace="preserve"
            textRendering="optimizeLegibility"
            transform={rotate}
          >
            {lines.map((line, lineIdx) => (
              <tspan
                key={`${key}-line-${lineIdx}`}
                x={x}
                dy={lineIdx === 0 ? 0 : lineHeight}
                style={{ whiteSpace: 'pre' }}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      }

      if (type === 'image') {
        const file = element.fileId ? scene.files?.[element.fileId] : undefined;
        const imageSrc = file?.dataURL;

        if (!imageSrc) {
          return (
            <rect
              key={key}
              x={Math.min(x, x + width)}
              y={Math.min(y, y + height)}
              width={Math.max(1, Math.abs(width))}
              height={Math.max(1, Math.abs(height))}
              fill="rgba(15,23,42,0.05)"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray="6 4"
              transform={rotate}
            />
          );
        }

        return (
          <image
            key={key}
            href={imageSrc}
            x={Math.min(x, x + width)}
            y={Math.min(y, y + height)}
            width={Math.max(1, Math.abs(width))}
            height={Math.max(1, Math.abs(height))}
            preserveAspectRatio="none"
            opacity={opacity / 100}
            transform={rotate}
          />
        );
      }

      if (type === 'line' || type === 'arrow' || type === 'freedraw') {
        const points = Array.isArray(element.points) ? element.points : [];
        if (points.length === 0) return null;
        const pathPoints = points
          .map((point) => `${x + toFiniteNumber(point?.[0])},${y + toFiniteNumber(point?.[1])}`)
          .join(' ');
        return (
          <polyline
            key={key}
            points={pathPoints}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dash}
            markerEnd={type === 'arrow' ? `url(#${markerId})` : undefined}
          />
        );
      }

      return (
        <rect
          key={key}
          x={Math.min(x, x + width)}
          y={Math.min(y, y + height)}
          width={Math.max(1, Math.abs(width))}
          height={Math.max(1, Math.abs(height))}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          transform={rotate}
        />
      );
    });
  }, [scene, markerId]);

  const renderSceneSvg = (mode: 'inline' | 'fullscreen') => {
    if (!scene || !prepared) return null;

    const svgStyle =
      mode === 'inline'
        ? ({ width: `${zoom}%`, minWidth: '100%' } as React.CSSProperties)
        : ({
            width: '100%',
            height: '100%',
            transform: `translate(${fullscreenPan.x}px, ${fullscreenPan.y}px) scale(${fullscreenZoom / 100})`,
            transformOrigin: '0 0',
          } as React.CSSProperties);

    const svgClassName = mode === 'inline' ? 'h-auto min-h-[320px] max-w-none' : 'max-w-none';
    const preserve = mode === 'inline' ? 'xMinYMin meet' : 'xMidYMid meet';

    return (
      <svg
        viewBox={prepared.viewBox}
        className={svgClassName}
        style={svgStyle}
        preserveAspectRatio={preserve}
        shapeRendering="geometricPrecision"
      >
        <rect
          x={prepared.bounds.minX - 300}
          y={prepared.bounds.minY - 300}
          width={Math.max(1, prepared.bounds.maxX - prepared.bounds.minX) + 600}
          height={Math.max(1, prepared.bounds.maxY - prepared.bounds.minY) + 600}
          fill="#f8fafc"
        />
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155" />
          </marker>
        </defs>
        {renderedElements}
      </svg>
    );
  };

  if (!src) {
    return null;
  }

  return (
    <>
      <div ref={containerRef} className={blockClassName}>
        {!shouldLoad && (
          <div className="h-64 flex items-center justify-center text-xs opacity-50">绘图待加载...</div>
        )}

        {shouldLoad && loading && (
          <div className="h-64 flex items-center justify-center text-cyan-300">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            正在加载 Excalidraw...
          </div>
        )}

        {shouldLoad && !loading && error && (
          <div className="h-64 flex flex-col items-center justify-center text-red-300 gap-3 px-6 text-center">
            <AlertTriangle className="w-6 h-6" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {shouldLoad && !loading && !error && prepared && scene && (
          <div className="relative">
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-slate-300 bg-white/90 p-1 shadow">
              <button
                type="button"
                onClick={() => setZoom((prev) => clamp(prev - 15, 70, 320))}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
                title="缩小"
                aria-label="缩小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-slate-700 min-w-[44px] text-center">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((prev) => clamp(prev + 15, 70, 320))}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
                title="放大"
                aria-label="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(130)}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
                title="重置缩放"
                aria-label="重置缩放"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={openFullscreen}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
                title="全屏查看"
                aria-label="全屏查看"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(100,116,139,0.22)_1px,transparent_0)] [background-size:16px_16px]">
              {renderSceneSvg('inline')}
            </div>
            <div className="px-4 py-2 text-[11px] text-slate-600 border-t border-slate-200 bg-white/60">
              提示：右上角支持缩放和全屏查看。
            </div>
          </div>
        )}
      </div>

      {isFullscreen && prepared && scene && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-4 md:p-8">
          <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-300 bg-white shadow-2xl relative">
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-slate-300 bg-white/95 p-1 shadow">
              <button
                type="button"
                onClick={() => setFullscreenZoom((prev) => clamp(prev - 15, 40, 500))}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
                title="缩小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-slate-700 min-w-[48px] text-center">{fullscreenZoom}%</span>
              <button
                type="button"
                onClick={() => setFullscreenZoom((prev) => clamp(prev + 15, 40, 500))}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setFullscreenZoom(130);
                  setFullscreenPan({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
                title="重置视图"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
                title="关闭全屏"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`w-full h-full overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(100,116,139,0.18)_1px,transparent_0)] [background-size:18px_18px] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={startPan}
              onMouseMove={movePan}
              onMouseUp={endPan}
              onMouseLeave={endPan}
              onWheel={handleFullscreenWheel}
            >
              {renderSceneSvg('fullscreen')}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

ExcalidrawEmbed.displayName = 'ExcalidrawEmbed';

export default ExcalidrawEmbed;
