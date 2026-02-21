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

// Extract scene JSON from Obsidian Excalidraw markdown file.
export const extractExcalidrawJsonFromMarkdown = (markdown: string): string | null => {
  const text = stripBom(String(markdown || ''));
  if (!text) return null;

  // Most common: fenced json block.
  const fencedBlocks = [
    /```json\s*([\s\S]*?)\s*```/gi,
    /```excalidraw\s*([\s\S]*?)\s*```/gi,
    /```(?:compressed-json|jsonc)\s*([\s\S]*?)\s*```/gi,
  ];

  for (const pattern of fencedBlocks) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = String(match[1] || '').trim();
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate);
        if (hasExcalidrawElements(parsed)) {
          return JSON.stringify(parsed);
        }
      } catch {
        // ignore and continue
      }
    }
  }

  // Fallback: whole document is already JSON.
  try {
    const parsed = JSON.parse(text);
    if (hasExcalidrawElements(parsed)) {
      return JSON.stringify(parsed);
    }
  } catch {
    // ignore
  }

  return null;
};

export const hasExcalidrawElements = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const scene = value as { elements?: unknown; scene?: { elements?: unknown } };
  return Array.isArray(scene.elements) || Array.isArray(scene.scene?.elements);
};
