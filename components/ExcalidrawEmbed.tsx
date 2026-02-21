import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  parseExcalidrawScene,
  stripBom,
  type ParsedExcalidrawScene,
} from '../services/obsidian';

interface ExcalidrawEmbedProps {
  src: string;
  className?: string;
}

const scenePromiseCache = new Map<string, Promise<ParsedExcalidrawScene>>();
const sceneValueCache = new Map<string, ParsedExcalidrawScene>();

const readScene = async (src: string): Promise<ParsedExcalidrawScene> => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const text = stripBom(await response.text());
  const scene = parseExcalidrawScene(text);
  if (!scene) {
    throw new Error('无法解析 Excalidraw 场景（支持 .excalidraw/.json/.excalidraw.md，含 compressed-json）');
  }

  return scene;
};

const loadScene = (src: string): Promise<ParsedExcalidrawScene> => {
  const cached = sceneValueCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = scenePromiseCache.get(src);
  if (pending) {
    return pending;
  }

  const promise = readScene(src)
    .then((scene) => {
      sceneValueCache.set(src, scene);
      scenePromiseCache.delete(src);
      return scene;
    })
    .catch((error) => {
      scenePromiseCache.delete(src);
      throw error;
    });

  scenePromiseCache.set(src, promise);
  return promise;
};

const ExcalidrawEmbed: React.FC<ExcalidrawEmbedProps> = React.memo(({ src, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<ParsedExcalidrawScene | null>(null);

  useEffect(() => {
    setScene(null);
    setError(null);
    setLoading(false);
    setShouldLoad(false);
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

  const initialData = useMemo(() => {
    if (!scene) return null;
    return {
      elements: scene.elements,
      appState: scene.appState || {},
      files: scene.files || {},
    };
  }, [scene]);

  const blockClassName =
    className ||
    'my-6 rounded-2xl overflow-hidden border border-slate-200/80 bg-gradient-to-b from-slate-50 to-slate-100 shadow-lg shadow-black/20';

  if (!src) {
    return null;
  }

  return (
    <div ref={containerRef} className={blockClassName}>
      {!shouldLoad && (
        <div className="h-64 flex items-center justify-center text-xs opacity-50">
          绘图待加载...
        </div>
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

      {shouldLoad && !loading && !error && initialData && (
        <div className="w-full h-[min(72vh,680px)] min-h-[420px] bg-slate-100">
          <Excalidraw
            initialData={initialData}
            viewModeEnabled
            zenModeEnabled
            gridModeEnabled={false}
            detectScroll={false}
            handleKeyboardGlobally={false}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: false,
                clearCanvas: false,
                export: false,
                loadScene: false,
                saveAsImage: false,
                saveToActiveFile: false,
                toggleTheme: false,
              },
            }}
          />
        </div>
      )}

      <div className="px-4 py-2 text-[11px] text-slate-600 border-t border-slate-200 bg-white/60">
        提示：支持滚轮缩放、拖动画布平移，展示完整 Excalidraw 场景。
      </div>
    </div>
  );
});

ExcalidrawEmbed.displayName = 'ExcalidrawEmbed';

export default ExcalidrawEmbed;
