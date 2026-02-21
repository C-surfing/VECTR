import {
  decompress,
  decompressFromBase64,
  decompressFromEncodedURIComponent,
  decompressFromUTF16,
} from 'lz-string';

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|avif|heic|heif)$/i;
const SVG_EXT_RE = /\.svg$/i;
const EXCALIDRAW_EXT_RE = /\.(excalidraw|json)$/i;
const EXCALIDRAW_MD_EXT_RE = /\.excalidraw\.md$/i;
const MARKDOWN_EXT_RE = /\.md$/i;

export const stripBom = (value: string): string => value.replace(/^\uFEFF/, '');

export const normalizeObsidianPath = (value: string): string =>
  (() => {
    const raw = decodeURIComponent(String(value || '').trim())
      .replace(/^<|>$/g, '')
      .trim();
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    return raw
      .replace(/\\/g, '/')
      .replace(/^\.\/+/, '')
      .replace(/\/{2,}/g, '/')
      .split('#')[0]
      .split('?')[0]
      .trim();
  })();

const getPathForExtMatch = (value: string): string => {
  const normalized = normalizeObsidianPath(value);
  if (/^https?:\/\//i.test(normalized)) {
    return normalized.split('#')[0].split('?')[0];
  }
  return normalized;
};

export const getPathBasename = (value: string): string => {
  const normalized = normalizeObsidianPath(value);
  if (!normalized) return '';
  const parts = normalized.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : normalized;
};

export const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(String(value || '').trim());

export const isLikelyImagePath = (value: string): boolean => IMAGE_EXT_RE.test(getPathForExtMatch(value));
export const isLikelySvgPath = (value: string): boolean => SVG_EXT_RE.test(getPathForExtMatch(value));
export const isLikelyExcalidrawPath = (value: string): boolean =>
  EXCALIDRAW_EXT_RE.test(getPathForExtMatch(value));
export const isLikelyExcalidrawMarkdownPath = (value: string): boolean =>
  EXCALIDRAW_MD_EXT_RE.test(getPathForExtMatch(value));
export const isLikelyMarkdownPath = (value: string): boolean => MARKDOWN_EXT_RE.test(getPathForExtMatch(value));

export const parseWikiTarget = (raw: string): {
  target: string;
  alias: string;
  anchor: string;
  blockId: string;
  rawTarget: string;
} => {
  const [left, ...rest] = String(raw || '').split('|');
  const rawTarget = String(left || '').trim();
  const alias = String(rest.join('|') || '').trim();
  let base = rawTarget;
  let anchor = '';
  let blockId = '';

  const hashIndex = base.indexOf('#');
  if (hashIndex >= 0) {
    anchor = base.slice(hashIndex + 1);
    base = base.slice(0, hashIndex);
  }

  const caretInAnchor = anchor.indexOf('^');
  if (caretInAnchor >= 0) {
    blockId = anchor.slice(caretInAnchor + 1);
    anchor = anchor.slice(0, caretInAnchor);
  } else {
    const caretIndex = base.indexOf('^');
    if (caretIndex >= 0) {
      blockId = base.slice(caretIndex + 1);
      base = base.slice(0, caretIndex);
    }
  }

  return {
    target: normalizeObsidianPath(base || ''),
    alias,
    anchor: decodeURIComponent(anchor || '').trim(),
    blockId: decodeURIComponent(blockId || '').trim(),
    rawTarget,
  };
};

type LooseObject = Record<string, unknown>;

export type ParsedExcalidrawScene = {
  elements: LooseObject[];
  appState?: LooseObject;
  files?: Record<string, unknown>;
};

const isLooseObject = (value: unknown): value is LooseObject =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeSceneCandidate = (value: unknown): ParsedExcalidrawScene | null => {
  if (Array.isArray(value)) {
    return {
      elements: value.filter((item): item is LooseObject => isLooseObject(item)),
    };
  }

  if (!isLooseObject(value)) {
    return null;
  }

  const sceneFromSelf = value;
  const sceneFromNested = isLooseObject(value.scene) ? value.scene : null;
  const sceneFromData = isLooseObject(value.data) ? value.data : null;
  const sceneSource =
    (Array.isArray(sceneFromSelf.elements) && sceneFromSelf) ||
    (sceneFromNested && Array.isArray(sceneFromNested.elements) && sceneFromNested) ||
    (sceneFromData && Array.isArray(sceneFromData.elements) && sceneFromData);

  if (!sceneSource) {
    return null;
  }

  const elements = Array.isArray(sceneSource.elements)
    ? sceneSource.elements.filter((item): item is LooseObject => isLooseObject(item))
    : [];

  const appState =
    (isLooseObject(sceneSource.appState) && sceneSource.appState) ||
    (isLooseObject(value.appState) && value.appState) ||
    undefined;
  const filesSource =
    (isLooseObject(sceneSource.files) && sceneSource.files) ||
    (isLooseObject(value.files) && value.files) ||
    undefined;

  return {
    elements,
    appState,
    files: filesSource as Record<string, unknown> | undefined,
  };
};

const tryParseJsonScene = (raw: string): ParsedExcalidrawScene | null => {
  try {
    const parsed = JSON.parse(raw);
    return normalizeSceneCandidate(parsed);
  } catch {
    return null;
  }
};

const normalizeCompressedPayload = (raw: string): string[] => {
  const trimmed = stripBom(String(raw || '')).trim();
  if (!trimmed) return [];
  const compact = trimmed.replace(/\s+/g, '');
  return Array.from(new Set([trimmed, compact].filter(Boolean)));
};

const decodeCompressedText = (payload: string): string[] => {
  const decoded: string[] = [];
  const attempts = [decompressFromBase64, decompressFromEncodedURIComponent, decompressFromUTF16, decompress];
  for (const candidate of normalizeCompressedPayload(payload)) {
    for (const decoder of attempts) {
      try {
        const result = decoder(candidate);
        if (typeof result === 'string' && result.trim()) {
          decoded.push(result);
        }
      } catch {
        // ignore decoder errors
      }
    }
  }
  return Array.from(new Set(decoded));
};

const parseCompressedScene = (raw: string): ParsedExcalidrawScene | null => {
  const trimmed = stripBom(String(raw || '')).trim();
  if (!trimmed) return null;

  const directJson = tryParseJsonScene(trimmed);
  if (directJson) return directJson;

  const rawStringCandidates = new Set<string>(normalizeCompressedPayload(trimmed));
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string' && parsed.trim()) {
      rawStringCandidates.add(parsed.trim());
    }
  } catch {
    // ignore
  }

  for (const candidate of rawStringCandidates) {
    for (const decoded of decodeCompressedText(candidate)) {
      const scene = tryParseJsonScene(decoded);
      if (scene) {
        return scene;
      }
      try {
        const parsedDecoded = JSON.parse(decoded);
        const normalized = normalizeSceneCandidate(parsedDecoded);
        if (normalized) {
          return normalized;
        }
        if (typeof parsedDecoded === 'string') {
          const nested = tryParseJsonScene(parsedDecoded);
          if (nested) {
            return nested;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
};

const parseSceneFromFencedBlocks = (text: string): ParsedExcalidrawScene | null => {
  const fencePattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null = null;
  while ((match = fencePattern.exec(text)) !== null) {
    const language = String(match[1] || '').trim().toLowerCase();
    const body = String(match[2] || '').trim();
    if (!body) continue;

    const isCompressedBlock =
      language === 'compressed-json' ||
      language === 'compressedjson' ||
      language.includes('compressed-json');
    if (isCompressedBlock) {
      const compressedScene = parseCompressedScene(body);
      if (compressedScene) {
        return compressedScene;
      }
      continue;
    }

    const maybeJsonBlock =
      language === 'json' ||
      language === 'jsonc' ||
      language === 'excalidraw' ||
      language.includes('json') ||
      language.includes('excalidraw');
    if (maybeJsonBlock) {
      const scene = tryParseJsonScene(body);
      if (scene) {
        return scene;
      }
      const compressedFallback = parseCompressedScene(body);
      if (compressedFallback) {
        return compressedFallback;
      }
      continue;
    }

    const unlabeled = tryParseJsonScene(body);
    if (unlabeled) {
      return unlabeled;
    }
  }

  return null;
};

// Parse Excalidraw scene from raw JSON / .excalidraw / .json / .excalidraw.md.
export const parseExcalidrawScene = (raw: string): ParsedExcalidrawScene | null => {
  const text = stripBom(String(raw || ''));
  if (!text.trim()) return null;

  const direct = tryParseJsonScene(text);
  if (direct) return direct;

  const fenced = parseSceneFromFencedBlocks(text);
  if (fenced) return fenced;

  const compressed = parseCompressedScene(text);
  if (compressed) return compressed;

  return null;
};

// Kept for compatibility with existing callers.
export const extractExcalidrawJsonFromMarkdown = (markdown: string): string | null => {
  const scene = parseExcalidrawScene(markdown);
  return scene ? JSON.stringify(scene) : null;
};

export const hasExcalidrawElements = (value: unknown): boolean => {
  const scene = normalizeSceneCandidate(value);
  return Boolean(scene && Array.isArray(scene.elements));
};
