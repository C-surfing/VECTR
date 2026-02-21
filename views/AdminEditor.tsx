import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { DB } from '../services/db';
import { auth } from '../services/auth';
import { Category, Post } from '../types';
import { GoogleGenAI } from '@google/genai';
import MarkdownContent from '../components/MarkdownContent';
import {
  getPathBasename,
  isHttpUrl,
  isLikelyExcalidrawPath,
  isLikelyExcalidrawMarkdownPath,
  isLikelyImagePath,
  isLikelyMarkdownPath,
  isLikelySvgPath,
  normalizeObsidianPath,
  parseExcalidrawScene,
  parseWikiTarget,
  stripBom,
} from '../services/obsidian';
import {
  Send,
  Eye,
  PenTool,
  Image as ImageIcon,
  Video,
  Sparkles,
  Check,
  FileUp,
  X,
  Loader2,
  Cloud,
} from 'lucide-react';

const CATEGORY_OPTIONS: { name: Category; desc: string }[] = [
  { name: 'CS', desc: '计算机科学与工程' },
  { name: 'TA', desc: '技术美术与视觉工程' },
  { name: '金融', desc: '金融量化与市场逻辑' },
  { name: '数学', desc: '纯粹数学与逻辑建模' },
  { name: '光影艺术', desc: '数字审美与光影交互' },
  { name: 'AI', desc: '人工智能与深度学习' },
  { name: '生活', desc: '生活思考与记录' },
  { name: '哲学', desc: 'Philosophy and critical thinking' },
];

interface AdminEditorProps {
  onNavigate: (view: any) => void;
  onPublish?: () => void;
  editPostId?: string | null;
}

type AssetMap = Record<string, string>;

const AdminEditor: React.FC<AdminEditorProps> = ({ onNavigate, onPublish, editPostId = null }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(['CS']);
  const [coverImage, setCoverImage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDrawing, setUploadingDrawing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isLoadingEditPost, setIsLoadingEditPost] = useState(false);
  const [editingSourcePost, setEditingSourcePost] = useState<Post | null>(null);
  const deferredContent = useDeferredValue(content);
  const isEditing = Boolean(editPostId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excalidrawFileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const contentImageInputRef = useRef<HTMLInputElement>(null);
  const contentExcalidrawInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let isActive = true;

    if (!editPostId) {
      setEditingSourcePost(null);
      return () => {
        isActive = false;
      };
    }

    setIsLoadingEditPost(true);
    DB.getPostById(editPostId, true)
      .then((post) => {
        if (!isActive) return;
        if (!post) {
          alert('未找到要修改的文章，可能已被删除。');
          onNavigate('blog');
          return;
        }

        setEditingSourcePost(post);
        setTitle(post.title || '');
        setContent(post.content || '');
        setSelectedCategories(Array.isArray(post.category) && post.category.length > 0 ? post.category : ['CS']);
        setCoverImage(post.coverImage || '');
        setVideoUrl(post.videoUrl || '');
        setIsPreview(false);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error('Failed to load editing post:', error);
        const message = error instanceof Error ? error.message : '未知错误';
        alert(`加载待编辑文章失败：${message}`);
        onNavigate('blog');
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingEditPost(false);
      });

    return () => {
      isActive = false;
    };
  }, [editPostId]);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取本地文件失败'));
      reader.readAsDataURL(file);
    });

  const parseExcalidrawSceneJsonFromFile = async (file: File): Promise<string> => {
    const rawText = stripBom(String(await file.text()));
    const scene = parseExcalidrawScene(rawText);
    if (!scene) {
      throw new Error('无法解析 Excalidraw 场景（支持 .excalidraw/.json/.excalidraw.md，含 compressed-json）');
    }
    return JSON.stringify(scene);
  };

  const buildExcalidrawBlock = (src: string) => `\n:::excalidraw\n${src}\n:::\n`;
  const buildSvgBlock = (src: string) => `\n:::svg\n${src}\n:::\n`;

  const isSvgFile = (file: File): boolean =>
    file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);

  const uploadDrawingToCloud = async (file: File): Promise<string> => {
    try {
      const folder = isSvgFile(file) ? 'svgs' : 'drawings';
      return await DB.uploadMedia(file, folder);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : '云端上传失败';
      throw new Error(`绘图上传失败：${message}`);
    }
  };

  const optimizeImageForUpload = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif') return file;

    const shouldProcess = file.size > 400 * 1024;
    if (!shouldProcess) return file;

    const dataUrl = await fileToDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片解码失败'));
      image.src = dataUrl;
    });

    const maxSide = 1920;
    const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
    const targetWidth = Math.max(1, Math.round(img.width * ratio));
    const targetHeight = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = outputType === 'image/jpeg' ? 0.82 : undefined;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), outputType, quality);
    });

    if (!blob) return file;
    if (blob.size >= file.size * 0.95) return file;

    const nextName = file.name.replace(/\.[^.]+$/, outputType === 'image/png' ? '.png' : '.jpg');
    return new File([blob], nextName, { type: outputType, lastModified: Date.now() });
  };

  const splitAssetManifest = (raw: string): { body: string; assets: AssetMap } => {
    const match = raw.match(/\n?:::assets\s*\n([\s\S]*?)\n:::\s*$/);
    if (!match) {
      return { body: raw, assets: {} };
    }

    const body = raw.slice(0, match.index ?? raw.length).replace(/\s+$/, '');
    let assets: AssetMap = {};

    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string' && key.trim()) {
            assets[key.trim()] = value;
          }
        }
      }
    } catch {
      assets = {};
    }

    return { body, assets };
  };

  const buildWithAssetManifest = (body: string, assets: AssetMap): string => {
    const cleanBody = body.replace(/\s+$/, '');
    const entries = Object.entries(assets).filter((item) => item[0] && item[1]);
    if (entries.length === 0) {
      return cleanBody;
    }

    const orderedAssets = Object.fromEntries(
      entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })),
    );

    return `${cleanBody}\n\n:::assets\n${JSON.stringify(orderedAssets)}\n:::\n`;
  };

  const upsertAssetToken = (assets: AssetMap, url: string): string => {
    for (const [key, value] of Object.entries(assets)) {
      if (value === url) {
        return `asset:${key}`;
      }
    }

    const next = Object.keys(assets).reduce((max, key) => {
      const match = key.match(/^a(\d+)$/i);
      const current = match ? Number(match[1]) : 0;
      return Math.max(max, Number.isFinite(current) ? current : 0);
    }, 0) + 1;

    const id = `a${next}`;
    assets[id] = url;
    return `asset:${id}`;
  };

  const insertBlockWithAsset = (url: string, builder: (token: string) => string): void => {
    const textarea = contentTextareaRef.current;
    const pageScrollY = window.scrollY;
    const textareaScrollTop = textarea?.scrollTop ?? 0;
    const { body, assets } = splitAssetManifest(content);
    const token = upsertAssetToken(assets, url);
    const block = builder(token);

    const start = textarea ? Math.min(textarea.selectionStart, body.length) : body.length;
    const nextBody = body.slice(0, start) + block + body.slice(start);
    const nextContent = buildWithAssetManifest(nextBody, assets);
    setContent(nextContent);

    requestAnimationFrame(() => {
      if (!textarea) return;
      const cursor = start + block.length;
      restoreEditorViewport(textarea, cursor, cursor, textareaScrollTop, pageScrollY);
    });
  };

  const restoreEditorViewport = (
    textarea: HTMLTextAreaElement,
    selectionStart: number,
    selectionEnd: number,
    textareaScrollTop: number,
    pageScrollY: number,
  ): void => {
    try {
      textarea.focus({ preventScroll: true });
    } catch {
      textarea.focus();
    }

    textarea.setSelectionRange(selectionStart, selectionEnd);
    textarea.scrollTop = textareaScrollTop;

    if (Math.abs(window.scrollY - pageScrollY) > 1) {
      window.scrollTo(0, pageScrollY);
    }
  };

  const replaceAsync = async (
    input: string,
    pattern: RegExp,
    replacer: (match: RegExpExecArray) => Promise<string>,
  ): Promise<string> => {
    const matches = Array.from(input.matchAll(pattern));
    if (matches.length === 0) return input;

    let cursor = 0;
    let output = '';
    for (const match of matches) {
      const index = match.index ?? 0;
      output += input.slice(cursor, index);
      output += await replacer(match);
      cursor = index + match[0].length;
    }
    output += input.slice(cursor);
    return output;
  };

  const buildImportFileMap = (files: File[]): Map<string, File> => {
    const map = new Map<string, File>();
    for (const file of files) {
      const byName = normalizeObsidianPath(file.name).toLowerCase();
      if (byName) map.set(byName, file);

      const rel = normalizeObsidianPath((file as File & { webkitRelativePath?: string }).webkitRelativePath || '').toLowerCase();
      if (rel) map.set(rel, file);
    }
    return map;
  };

  const resolveReferencedLocalFile = (
    rawRef: string,
    filesMap: Map<string, File>,
  ): File | null => {
    const normalized = normalizeObsidianPath(rawRef).toLowerCase();
    if (!normalized) return null;

    if (filesMap.has(normalized)) {
      return filesMap.get(normalized) || null;
    }

    const base = getPathBasename(normalized).toLowerCase();
    if (base && filesMap.has(base)) {
      return filesMap.get(base) || null;
    }

    for (const [key, file] of filesMap) {
      if (key.endsWith(`/${normalized}`) || key.endsWith(`/${base}`)) {
        return file;
      }
    }

    return null;
  };

  const uploadReferencedAsset = async (
    rawRef: string,
    filesMap: Map<string, File>,
    cache: Map<string, string>,
    progressRef: { current: number },
  ): Promise<{ kind: 'image' | 'svg' | 'excalidraw' | 'url'; url: string } | null> => {
    const normalized = normalizeObsidianPath(rawRef);
    if (!normalized) return null;

    if (isHttpUrl(normalized)) {
      if (isLikelyExcalidrawPath(normalized) || isLikelyExcalidrawMarkdownPath(normalized)) {
        return { kind: 'excalidraw', url: normalized };
      }
      if (isLikelySvgPath(normalized)) return { kind: 'svg', url: normalized };
      if (isLikelyImagePath(normalized)) return { kind: 'image', url: normalized };
      return { kind: 'url', url: normalized };
    }

    const file = resolveReferencedLocalFile(normalized, filesMap);
    if (!file) return null;

    const cacheKey = `${file.name}|${file.size}|${file.lastModified}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      if (isSvgFile(file)) return { kind: 'svg', url: cached };
      if (isLikelyExcalidrawPath(file.name) || isLikelyExcalidrawMarkdownPath(file.name)) {
        return { kind: 'excalidraw', url: cached };
      }
      return { kind: 'image', url: cached };
    }

    progressRef.current += 1;
    setUploadProgress(`正在上传 Obsidian 资源 (${progressRef.current})...`);

    if (isSvgFile(file)) {
      const url = await uploadDrawingToCloud(file);
      cache.set(cacheKey, url);
      return { kind: 'svg', url };
    }

    if (isLikelyExcalidrawPath(file.name) || isLikelyExcalidrawMarkdownPath(file.name)) {
      const sceneJson = await parseExcalidrawSceneJsonFromFile(file);
      const jsonFile = new File(
        [sceneJson],
        `${file.name.replace(/\.[^.]+$/, '')}.excalidraw`,
        { type: 'application/json', lastModified: Date.now() },
      );
      const url = await uploadDrawingToCloud(jsonFile);
      cache.set(cacheKey, url);
      return { kind: 'excalidraw', url };
    }

    if (file.type.startsWith('image/') || isLikelyImagePath(file.name)) {
      const optimized = await optimizeImageForUpload(file);
      const url = await DB.uploadMedia(optimized, 'images');
      cache.set(cacheKey, url);
      return { kind: 'image', url };
    }

    return null;
  };

  const stripFrontmatter = (raw: string): string => {
    const lines = raw.split('\n');
    if (lines.length < 3 || lines[0].trim() !== '---') return raw;
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        end = i;
        break;
      }
    }
    if (end < 0) return raw;
    return lines.slice(end + 1).join('\n');
  };

  const transformObsidianMarkdown = async (raw: string, files: File[]): Promise<string> => {
    const filesMap = buildImportFileMap(files);
    const uploadCache = new Map<string, string>();
    const progressRef = { current: 0 };
    const assets: AssetMap = {};

    let output = stripFrontmatter(raw).replace(/\r\n/g, '\n');

    // Obsidian embeds: ![[target|alias]]
    output = await replaceAsync(output, /!\[\[([^\]]+)\]\]/g, async (match) => {
      const { target, alias } = parseWikiTarget(match[1]);
      const resolved = await uploadReferencedAsset(target, filesMap, uploadCache, progressRef);
      if (!resolved) return match[0];
      if (resolved.kind === 'excalidraw') {
        const token = upsertAssetToken(assets, resolved.url);
        return `\n:::excalidraw\n${token}\n:::\n`;
      }
      if (resolved.kind === 'svg') {
        const token = upsertAssetToken(assets, resolved.url);
        return `\n:::svg\n${token}\n:::\n`;
      }
      if (resolved.kind === 'image') {
        const token = upsertAssetToken(assets, resolved.url);
        return `![${alias || getPathBasename(target) || 'image'}](${token})`;
      }
      return `[${alias || target}](${resolved.url})`;
    });

    // Markdown image local path: ![alt](./xx.png)
    output = await replaceAsync(output, /!\[([^\]]*)\]\(([^)]+)\)/g, async (match) => {
      const alt = String(match[1] || '');
      const ref = String(match[2] || '').trim();
      const resolved = await uploadReferencedAsset(ref, filesMap, uploadCache, progressRef);
      if (!resolved) return match[0];
      if (resolved.kind === 'svg') {
        const token = upsertAssetToken(assets, resolved.url);
        return `\n:::svg\n${token}\n:::\n`;
      }
      if (resolved.kind === 'excalidraw') {
        const token = upsertAssetToken(assets, resolved.url);
        return `\n:::excalidraw\n${token}\n:::\n`;
      }
      if (resolved.kind === 'image') {
        const token = upsertAssetToken(assets, resolved.url);
        return `![${alt || getPathBasename(ref) || 'image'}](${token})`;
      }
      return `![${alt}](${resolved.url})`;
    });

    // Wiki links: [[path|label]] -> label / http link
    output = output.replace(/\[\[([^\]]+)\]\]/g, (whole: string, inner: string, offset: number, full: string) => {
      const prevChar = offset > 0 ? full[offset - 1] : '';
      if (prevChar === '!') return whole;
      const { target, alias, anchor, blockId } = parseWikiTarget(inner);
      const label = alias || anchor || blockId || getPathBasename(target) || target;
      if (isHttpUrl(target)) {
        return `[${label}](${target})`;
      }
      if (anchor || blockId) {
        return `[[${inner}]]`;
      }
      return label;
    });

    return buildWithAssetManifest(output, assets);
  };

  const insertMarkdown = (before: string, after = '', placeholder = '文本') => {
    const textarea = contentTextareaRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}${before}${placeholder}${after}`);
      return;
    }

    const pageScrollY = window.scrollY;
    const textareaScrollTop = textarea.scrollTop;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selected = content.slice(selectionStart, selectionEnd) || placeholder;

    const nextContent =
      content.slice(0, selectionStart) +
      before +
      selected +
      after +
      content.slice(selectionEnd);

    setContent(nextContent);

    requestAnimationFrame(() => {
      const start = selectionStart + before.length;
      restoreEditorViewport(textarea, start, start + selected.length, textareaScrollTop, pageScrollY);
    });
  };

  const insertBlock = (block: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}\n${block}\n`);
      return;
    }

    const pageScrollY = window.scrollY;
    const textareaScrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const nextContent = content.slice(0, start) + block + content.slice(start);
    setContent(nextContent);

    requestAnimationFrame(() => {
      const cursor = start + block.length;
      restoreEditorViewport(textarea, cursor, cursor, textareaScrollTop, pageScrollY);
    });
  };

  const insertLink = () => {
    const textarea = contentTextareaRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}[链接文本](https://)`);
      return;
    }

    const pageScrollY = window.scrollY;
    const textareaScrollTop = textarea.scrollTop;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selected = content.slice(selectionStart, selectionEnd) || '链接文本';
    const linkText = `[${selected}](https://)`;
    const nextContent = content.slice(0, selectionStart) + linkText + content.slice(selectionEnd);
    setContent(nextContent);

    requestAnimationFrame(() => {
      const urlStart = selectionStart + selected.length + 3;
      const urlEnd = urlStart + 'https://'.length;
      restoreEditorViewport(textarea, urlStart, urlEnd, textareaScrollTop, pageScrollY);
    });
  };

  const handlePublish = async () => {
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();
    if (!normalizedTitle || !normalizedContent || selectedCategories.length === 0) return;

    const user = auth.getCurrentUser();
    if (!user) return;

    const fallbackCover = `https://picsum.photos/seed/${normalizedTitle}/800/400`;

    const newPost: Post = {
      id: editingSourcePost?.id || Math.random().toString(36).substr(2, 9),
      title: normalizedTitle,
      content: normalizedContent,
      excerpt: normalizedContent.substring(0, 100).replace(/[#*`]/g, '') + '...',
      category: selectedCategories,
      coverImage: coverImage || (editingSourcePost ? undefined : fallbackCover),
      videoUrl: videoUrl || undefined,
      authorId: editingSourcePost?.authorId || user.id,
      authorName: editingSourcePost?.authorName || user.username,
      createdAt: editingSourcePost?.createdAt || Date.now(),
      likes: editingSourcePost?.likes || [],
      views: editingSourcePost?.views || 0,
    };

    try {
      const savedMode = await DB.savePost(newPost, { requireRemote: true });
      setEditingSourcePost(newPost);
      if (savedMode === 'local') {
        alert('当前是本地数据模式，保存仅在当前浏览器生效；部署升级或更换域名后不会保留。');
      }
      if (onPublish) onPublish();
      onNavigate('blog');
    } catch (e) {
      alert('发布失败：' + (e as Error).message);
    }
  };

  const toggleCategory = (cat: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const articleFile =
      files.find((file) => /\.(md|markdown|txt)$/i.test(file.name)) ||
      files[0];
    if (!articleFile) return;

    setUploadingImage(true);
    setUploadProgress('正在导入 Obsidian/Markdown 文档...');

    try {
      const raw = await articleFile.text();
      const lowerName = articleFile.name.toLowerCase();
      const isExplicitExcalidraw =
        /\.excalidraw$/i.test(lowerName) ||
        isLikelyExcalidrawMarkdownPath(lowerName) ||
        (/\.json$/i.test(lowerName) && /"elements"\s*:/.test(raw));
      const isObsidianExcalidraw = /excalidraw-plugin\s*:/i.test(raw) && isLikelyMarkdownPath(lowerName);

      if (isExplicitExcalidraw || isObsidianExcalidraw) {
        try {
          setUploadProgress('检测到 Excalidraw，正在转换...');
          const sceneJson = await parseExcalidrawSceneJsonFromFile(articleFile);
          const normalizedScene = new File(
            [sceneJson],
            `${articleFile.name.replace(/\.[^.]+$/, '')}.excalidraw`,
            { type: 'application/json', lastModified: Date.now() },
          );
          const sceneUrl = await uploadDrawingToCloud(normalizedScene);
          const assets: AssetMap = {};
          const token = upsertAssetToken(assets, sceneUrl);
          setContent(buildWithAssetManifest(buildExcalidrawBlock(token), assets));
          if (!title) {
            setTitle(articleFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
          }
          return;
        } catch (error) {
          if (isExplicitExcalidraw) {
            throw error;
          }
        }
      }

      const normalized = await transformObsidianMarkdown(raw, files);
      setContent(normalized);
      if (!title) {
        setTitle(articleFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      alert(`文档导入失败：${message}`);
    } finally {
      setUploadingImage(false);
      setUploadProgress('');
      event.target.value = '';
    }
  };

  const handleExcalidrawImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDrawing(true);
    setUploadProgress('正在导入绘图...');

    try {
      if (isSvgFile(file)) {
        const src = await uploadDrawingToCloud(file);
        const assets: AssetMap = {};
        const token = upsertAssetToken(assets, src);
        setContent(buildWithAssetManifest(buildSvgBlock(token), assets));
      } else {
        const sceneJson = await parseExcalidrawSceneJsonFromFile(file);
        const normalized = new File(
          [sceneJson],
          `${file.name.replace(/\.[^.]+$/, '')}.excalidraw`,
          { type: 'application/json', lastModified: Date.now() },
        );
        const src = await uploadDrawingToCloud(normalized);
        const assets: AssetMap = {};
        const token = upsertAssetToken(assets, src);
        setContent(buildWithAssetManifest(buildExcalidrawBlock(token), assets));
      }

      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      alert(`绘图导入失败：${message}`);
    } finally {
      setUploadingDrawing(false);
      setUploadProgress('');
      event.target.value = '';
    }
  };

  const handleContentExcalidrawInsert = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDrawing(true);
    setUploadProgress('正在插入绘图...');

    try {
      if (isSvgFile(file)) {
        const src = await uploadDrawingToCloud(file);
        insertBlockWithAsset(src, (token) => buildSvgBlock(token));
      } else {
        const sceneJson = await parseExcalidrawSceneJsonFromFile(file);
        const normalized = new File(
          [sceneJson],
          `${file.name.replace(/\.[^.]+$/, '')}.excalidraw`,
          { type: 'application/json', lastModified: Date.now() },
        );
        const src = await uploadDrawingToCloud(normalized);
        insertBlockWithAsset(src, (token) => buildExcalidrawBlock(token));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '插入失败';
      alert(`绘图插入失败：${message}`);
    } finally {
      setUploadingDrawing(false);
      setUploadProgress('');
      event.target.value = '';
    }
  };

  const handleContentImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadProgress('正在上传图片...');

    try {
      const optimized = await optimizeImageForUpload(file);
      const url = await DB.uploadMedia(optimized, 'images');
      insertBlockWithAsset(url, (token) => `\n![图片描述](${token})\n`);
    } catch (error) {
      console.error('Upload failed:', error);
      const message = error instanceof Error ? error.message : '图片上传失败';
      alert(`图片插入失败：${message}`);
    } finally {
      setUploadingImage(false);
      setUploadProgress('');
      event.target.value = '';
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadProgress('正在上传封面...');

    try {
      const optimized = await optimizeImageForUpload(file);
      const url = await DB.uploadMedia(optimized, 'covers');
      setCoverImage(url);
    } catch (error) {
      console.error('Upload failed:', error);
      try {
        const dataUrl = await fileToDataUrl(file);
        setCoverImage(dataUrl);
        const message = error instanceof Error ? error.message : '云端上传失败';
        alert(`封面云端上传失败，已改为本地封面：${message}`);
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : error instanceof Error
              ? error.message
              : '封面上传失败，请重试或使用外部链接';
        alert(`封面上传失败：${message}`);
      }
    } finally {
      setUploadingImage(false);
      setUploadProgress('');
      event.target.value = '';
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert('视频文件超过 50MB，建议使用外部嵌入链接。');
    }

    setUploadingVideo(true);
    setUploadProgress('正在上传视频...');

    try {
      const url = await DB.uploadMedia(file, 'videos');
      setVideoUrl(url);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('视频上传失败，请重试或使用外部嵌入链接');
    } finally {
      setUploadingVideo(false);
      setUploadProgress('');
    }
  };

  const handleAiImprove = async () => {
    if (!content) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'demo-key' });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents:
          `你是一位极具未来主义风格的博主，擅长将文字处理得优雅且富有科技感。` +
          `请优化以下段落，保持其含义不变但增加文学性，并确保数学公式（如果有）` +
          `使用 LaTeX 格式包裹：\n\n${content}`,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });
      if (response.text) {
        setContent(response.text.trim());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {isLoadingEditPost && (
        <div className="fixed top-24 right-8 z-50 glass px-6 py-4 rounded-xl border border-cyan-500/50 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span className="text-sm font-bold">正在加载待修改文章...</span>
        </div>
      )}
      {uploadProgress && (
        <div className="fixed top-24 right-8 z-50 glass px-6 py-4 rounded-xl border border-cyan-500/50 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span className="text-sm font-bold">{uploadProgress}</span>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl font-orbitron font-bold text-glow">
            创作中心 <span className="text-cyan-400">.editor</span>
          </h1>
          <p className="text-xs opacity-40 mt-2 font-mono uppercase tracking-widest">
            <Cloud className="w-3 h-3 inline mr-1" />
            {isEditing ? '编辑模式 • 自动加载原文' : '云端同步模式 • 支持 Obsidian/Excalidraw'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".md,.txt,.markdown,image/*,.svg,.excalidraw,.json,application/json,text/json,image/svg+xml"
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={excalidrawFileInputRef}
            onChange={handleExcalidrawImport}
            accept=".excalidraw,.json,.md,.svg,application/json,text/json,text/markdown,image/svg+xml"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 glass rounded-xl hover:bg-white/10 transition-all flex items-center text-xs font-bold border-cyan-500/20"
          >
            <FileUp className="w-4 h-4 mr-2 text-cyan-400" />
            导入 Obsidian/MD
          </button>
          <button
            onClick={() => excalidrawFileInputRef.current?.click()}
            disabled={uploadingDrawing}
            className="px-4 py-2.5 glass rounded-xl hover:bg-white/10 transition-all flex items-center text-xs font-bold border-cyan-500/20 disabled:opacity-40"
          >
            {uploadingDrawing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-cyan-400" />
            ) : (
              <PenTool className="w-4 h-4 mr-2 text-cyan-400" />
            )}
            导入绘图
          </button>

          <div className="w-px h-6 bg-white/10 hidden md:block mx-2" />

          <button
            onClick={() => setIsPreview(!isPreview)}
            className={`px-5 py-2.5 rounded-xl transition-all flex items-center text-sm font-bold border ${
              isPreview ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'glass hover:bg-white/10'
            }`}
          >
            {isPreview ? (
              <>
                <PenTool className="w-4 h-4 mr-2" />
                返回编辑
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                预览全篇
              </>
            )}
          </button>

          <button
            onClick={handlePublish}
            disabled={isLoadingEditPost || selectedCategories.length === 0 || !title.trim()}
            className="px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-cyan-900/40 flex items-center disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 mr-2" />
            {isEditing ? '保存修改' : '发布'}
          </button>
        </div>
      </header>

      {isPreview ? (
        <div className="glass p-8 md:p-16 rounded-[40px] min-h-[60vh] animate-fade-in border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] -z-10" />
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedCategories.map((cat) => (
              <span
                key={cat}
                className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
          <h1 className="text-5xl font-bold mb-10 leading-tight">{title || '未命名档案'}</h1>
          <div className="prose-xl">
            <MarkdownContent content={deferredContent || '等待注入灵感...'} />
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-6">
            <input
              type="text"
              placeholder="档案标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoadingEditPost}
              className="w-full text-4xl md:text-5xl font-bold bg-transparent border-none focus:outline-none placeholder:opacity-20 transition-all text-glow"
            />

            <div className="glass border border-white/10 rounded-2xl p-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => insertMarkdown('# ', '', '一级标题')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="一级标题"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('## ', '', '二级标题')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="二级标题"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('### ', '', '三级标题')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="三级标题"
              >
                H3
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('**', '**', '加粗文本')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="加粗"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('*', '*', '斜体文本')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="斜体"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('`', '`', '代码')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="行内代码"
              >
                Code
              </button>
              <button
                type="button"
                onClick={() => insertBlock('\n```ts\n// code\n```\n')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="代码块"
              >
                ``` ```
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('- ', '', '列表项')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="无序列表"
              >
                UL
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('1. ', '', '列表项')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="有序列表"
              >
                OL
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('> ', '', '引用')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="引用"
              >
                Quote
              </button>
              <button
                type="button"
                onClick={insertLink}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="链接"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => insertBlock('\n---\n')}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                title="分隔线"
              >
                HR
              </button>
            </div>

            <div className="relative group">
              <textarea
                ref={contentTextareaRef}
                placeholder="在此处倾泻你的灵感（支持 Markdown 与 LaTeX $...$ / $$...$$）"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isLoadingEditPost}
                className="w-full h-[65vh] bg-white/5 border border-white/10 rounded-[32px] p-8 md:p-10 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 resize-none font-mono text-base leading-relaxed transition-all glass hover:bg-white/[0.07]"
              />
              <div className="absolute bottom-8 right-8 flex gap-3">
                <input
                  type="file"
                  ref={contentImageInputRef}
                  onChange={handleContentImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={contentExcalidrawInputRef}
                  onChange={handleContentExcalidrawInsert}
                  accept=".excalidraw,.json,.md,.svg,application/json,text/json,text/markdown,image/svg+xml"
                  className="hidden"
                />
                <button
                  onClick={() => contentImageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="px-5 py-3 glass hover:bg-white/20 border border-white/10 rounded-2xl backdrop-blur-xl transition-all flex items-center text-sm font-bold disabled:opacity-30 group"
                  title="插入图片到正文"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      插入图片
                    </>
                  )}
                </button>
                <button
                  onClick={() => contentExcalidrawInputRef.current?.click()}
                  disabled={uploadingDrawing}
                  className="px-5 py-3 glass hover:bg-white/20 border border-white/10 rounded-2xl backdrop-blur-xl transition-all flex items-center text-sm font-bold disabled:opacity-30 group"
                  title="插入 Excalidraw/SVG 绘图"
                >
                  {uploadingDrawing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <PenTool className="w-4 h-4 mr-2" />
                      插入绘图
                    </>
                  )}
                </button>

                <button
                  onClick={handleAiImprove}
                  disabled={isAiLoading || !content}
                  className="px-6 py-3 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-2xl backdrop-blur-xl transition-all flex items-center text-sm font-bold disabled:opacity-30 group"
                >
                  {isAiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      优化中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                      AI 语义重构
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="glass p-8 rounded-[32px] space-y-8 border border-white/10 shadow-xl">
              <h3 className="font-orbitron font-bold border-b border-white/5 pb-4 flex items-center text-sm tracking-widest text-cyan-400">
                CONFIG <span className="ml-auto opacity-20 text-[10px]">VER_3.0.0</span>
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] opacity-40 block mb-4 font-bold uppercase tracking-[0.2em]">
                    维度分类 / Categories
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <div
                        key={opt.name}
                        onClick={() => toggleCategory(opt.name)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1 group ${
                          selectedCategories.includes(opt.name)
                            ? 'bg-cyan-500/20 border-cyan-500/50'
                            : 'bg-white/5 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          {opt.name}
                          {selectedCategories.includes(opt.name) && (
                            <Check className="w-3 h-3 text-cyan-400" />
                          )}
                        </div>
                        <div className="text-[9px] opacity-30 group-hover:opacity-60 transition-opacity">
                          {opt.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] opacity-40 block font-bold uppercase tracking-[0.2em]">
                    封面资源 / Cover
                  </label>

                  <div className="space-y-3">
                    <div className="relative group">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-focus-within:text-cyan-400 transition-colors" />
                      <input
                        type="text"
                        placeholder="封面图 URL..."
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 pl-12 focus:outline-none focus:bg-white/[0.15] text-xs transition-all"
                      />
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={coverImageInputRef}
                        onChange={handleCoverUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={() => coverImageInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flex-1 py-3 glass hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-bold flex items-center justify-center disabled:opacity-50"
                      >
                        <Cloud className="w-3 h-3 mr-2" />
                        上传至云端
                      </button>
                      {coverImage && (
                        <button
                          onClick={() => setCoverImage('')}
                          className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="p-5 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Video className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold">视频模块</span>
                        <span className="text-[10px] opacity-30 ml-auto">云端存储</span>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="嵌入代码或链接..."
                          value={videoUrl.startsWith('https://') ? videoUrl : ''}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          className="w-full bg-black/30 border border-white/5 rounded-xl p-3 text-[11px] focus:outline-none focus:border-cyan-500/30 transition-all"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={videoInputRef}
                          onChange={handleVideoUpload}
                          accept="video/*"
                          className="hidden"
                        />
                        <button
                          onClick={() => videoInputRef.current?.click()}
                          disabled={uploadingVideo}
                          className={`flex-1 flex items-center justify-center p-3 rounded-xl border text-[11px] font-bold transition-all ${
                            videoUrl.startsWith('https://')
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {uploadingVideo ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                              上传中
                            </>
                          ) : videoUrl.startsWith('https://') ? (
                            <>
                              <Check className="w-3 h-3 mr-2" />
                              云端已存储
                            </>
                          ) : (
                            <>
                              <Cloud className="w-3 h-3 mr-2" />
                              上传本地视频
                            </>
                          )}
                        </button>

                        {videoUrl && (
                          <button
                            onClick={() => setVideoUrl('')}
                            className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
                            title="清除媒体"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex items-center justify-between opacity-30 text-[9px] font-mono">
                <span>CLOUD_SYNC_MODE</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEditor;
