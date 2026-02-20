import React from 'react';
import MathRenderer from './MathRenderer';
import LazyImage from './LazyImage';
import ExcalidrawEmbed from './ExcalidrawEmbed';
import {
  getPathBasename,
  isHttpUrl,
  isLikelyExcalidrawPath,
  isLikelyImagePath,
  isLikelySvgPath,
  normalizeObsidianPath,
  parseWikiTarget,
} from '../services/obsidian';

interface MarkdownContentProps {
  content: string;
}

type AssetMap = Record<string, string>;
type FootnoteMap = Record<string, string>;

const extractFootnotes = (raw: string): { body: string; footnotes: FootnoteMap } => {
  const lines = raw.split('\n');
  const footnotes: FootnoteMap = {};
  const keptLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);

    if (!match) {
      keptLines.push(line);
      i += 1;
      continue;
    }

    const id = match[1].trim();
    const chunks: string[] = [String(match[2] || '').trim()];
    i += 1;

    while (i < lines.length) {
      const continuation = lines[i];
      if (continuation.trim() === '') {
        chunks.push('');
        i += 1;
        continue;
      }

      if (/^\s{2,}\S/.test(continuation)) {
        chunks.push(continuation.trim());
        i += 1;
        continue;
      }
      break;
    }

    if (id) {
      footnotes[id] = chunks.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  return {
    body: keptLines.join('\n'),
    footnotes,
  };
};

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const LONG_CODE_THRESHOLD = 24;
const COLLAPSED_CODE_LINES = 12;
const KEY_SNIPPET_MAX_LINES = 14;
const KEY_LINE_RE =
  /(import\s|export\s|class\s|function\s|=>|if\s*\(|for\s*\(|while\s*\(|switch\s*\(|try\s*{|catch\s*\(|return\s|const\s|let\s|var\s|type\s|interface\s|todo|fixme)/i;

const buildKeyLineIndexes = (lines: string[]): number[] => {
  if (lines.length <= 2) return lines.map((_, idx) => idx);
  const picked = new Set<number>([0, lines.length - 1]);

  lines.forEach((line, idx) => {
    if (KEY_LINE_RE.test(line)) {
      picked.add(idx);
    }
  });

  const sorted = Array.from(picked).sort((a, b) => a - b);
  if (sorted.length <= KEY_SNIPPET_MAX_LINES) return sorted;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const middle = sorted.slice(1, -1);
  const take = Math.max(0, KEY_SNIPPET_MAX_LINES - 2);
  const sampled: number[] = [];
  if (take > 0 && middle.length > 0) {
    const step = middle.length / take;
    for (let i = 0; i < take; i += 1) {
      const index = Math.min(middle.length - 1, Math.floor(i * step));
      sampled.push(middle[index]);
    }
  }

  return [first, ...sampled, last].filter((value, idx, arr) => idx === 0 || value !== arr[idx - 1]);
};

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = React.useState(false);
  const [highlightedLine, setHighlightedLine] = React.useState<number | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'full' | 'key'>('full');
  const lines = React.useMemo(() => code.replace(/\n$/, '').split('\n'), [code]);
  const resolvedLines = lines.length > 0 ? lines : [''];
  const isLongCode = resolvedLines.length > LONG_CODE_THRESHOLD;
  const keyLineIndexes = React.useMemo(() => buildKeyLineIndexes(resolvedLines), [resolvedLines]);

  React.useEffect(() => {
    setCollapsed(isLongCode);
    setViewMode('full');
    setHighlightedLine(null);
  }, [code, isLongCode]);

  const displayIndexes = React.useMemo(() => {
    if (viewMode === 'key') return keyLineIndexes;
    if (!collapsed || !isLongCode) return resolvedLines.map((_, idx) => idx);
    return resolvedLines.slice(0, COLLAPSED_CODE_LINES).map((_, idx) => idx);
  }, [collapsed, isLongCode, keyLineIndexes, resolvedLines, viewMode]);

  const hiddenLineCount = Math.max(0, resolvedLines.length - displayIndexes.length);

  const renderedRows = React.useMemo(() => {
    const rows: React.ReactNode[] = [];
    let previousIndex = -1;

    displayIndexes.forEach((lineIndex) => {
      if (previousIndex >= 0 && lineIndex - previousIndex > 1) {
        rows.push(
          <div key={`gap-${lineIndex}`} className="flex min-h-[26px] bg-white/5 border-y border-white/5">
            <span className="w-12 shrink-0 text-[10px] text-right pr-2 border-r border-white/10 text-white/25 py-1">...</span>
            <span className="px-3 py-1 text-[11px] text-white/40">省略 {lineIndex - previousIndex - 1} 行</span>
          </div>,
        );
      }

      const line = resolvedLines[lineIndex] || '';
      const lineNo = lineIndex + 1;
      const active = highlightedLine === lineNo;
      rows.push(
        <div
          key={`${lineNo}-${line}`}
          className={`group flex min-h-[30px] ${active ? 'bg-cyan-500/15' : 'hover:bg-white/5'}`}
        >
          <button
            onClick={() => setHighlightedLine((prev) => (prev === lineNo ? null : lineNo))}
            className="w-12 shrink-0 text-[11px] text-right pr-2 border-r border-white/10 text-white/35 hover:text-cyan-300 transition-colors"
            title={`高亮第 ${lineNo} 行`}
          >
            {lineNo}
          </button>
          <span className="px-3 py-1.5 whitespace-pre flex-1">{line || ' '}</span>
        </div>,
      );
      previousIndex = lineIndex;
    });

    return rows;
  }, [displayIndexes, highlightedLine, resolvedLines]);

  const handleCopy = async () => {
    try {
      await copyText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-6 rounded-xl border border-white/10 overflow-hidden bg-black/40">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
        <span className="text-xs text-cyan-400 uppercase tracking-widest">
          {language || 'plain'}
        </span>
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg border border-white/15 text-xs hover:border-cyan-500/40 hover:bg-white/10 transition-colors"
          aria-label="复制代码"
        >
          {copied ? '已复制' : '复制代码'}
        </button>
      </div>
      {(isLongCode || keyLineIndexes.length >= 3) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-black/25">
          {isLongCode && (
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="px-2.5 py-1 rounded-md border border-white/15 text-[11px] uppercase tracking-wider hover:border-cyan-500/35 hover:bg-white/10 transition-colors"
            >
              {collapsed ? `展开全部 (${resolvedLines.length} 行)` : '收起长代码'}
            </button>
          )}
          {keyLineIndexes.length >= 3 && (
            <button
              onClick={() => setViewMode((prev) => (prev === 'key' ? 'full' : 'key'))}
              className="px-2.5 py-1 rounded-md border border-white/15 text-[11px] uppercase tracking-wider hover:border-cyan-500/35 hover:bg-white/10 transition-colors"
            >
              {viewMode === 'key' ? '查看全部' : '仅看关键片段'}
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <code className="block text-sm font-mono text-cyan-300">
          {renderedRows}
        </code>
      </div>
      {hiddenLineCount > 0 && viewMode === 'full' && collapsed && (
        <div className="px-4 py-2 text-[11px] opacity-55 border-t border-white/10">
          已折叠 {hiddenLineCount} 行
        </div>
      )}
    </div>
  );
};

// 列表项类型
type ListItem = {
  content: string;
  indent: number;
  type: 'ul' | 'ol' | 'task';
  checked?: boolean;
  number?: number;
};

// 检查是否是列表项
const getListInfo = (line: string): { isList: boolean; type: 'ul' | 'ol' | 'task' | null; indent: number; content: string; checked?: boolean; number?: number } => {
  const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(\[([ xX])\]\s+)?(.*)$/);
  if (!match) return { isList: false, type: null, indent: 0, content: '' };
  
  const indent = match[1].length;
  const marker = match[2];
  const taskCheck = match[4];
  const content = match[5];
  
  // 任务列表
  if (taskCheck !== undefined) {
    return { 
      isList: true, 
      type: 'task', 
      indent, 
      content, 
      checked: taskCheck.toLowerCase() === 'x' 
    };
  }
  
  // 有序列表
  if (/^\d+\./.test(marker)) {
    return { 
      isList: true, 
      type: 'ol', 
      indent, 
      content,
      number: parseInt(marker)
    };
  }
  
  // 无序列表
  return { isList: true, type: 'ul', indent, content };
};

// 渲染列表（支持嵌套）
const renderList = (
  items: ListItem[],
  startIndex: number,
  baseIndent: number,
  assetMap: AssetMap,
  footnotes: FootnoteMap,
): { element: React.ReactNode; nextIndex: number } => {
  if (startIndex >= items.length) return { element: null, nextIndex: startIndex };
  
  const firstItem = items[startIndex];
  if (firstItem.indent !== baseIndent) return { element: null, nextIndex: startIndex };
  
  const type = firstItem.type === 'ol' ? 'ol' : 'ul';
  const listItems: React.ReactNode[] = [];
  let i = startIndex;
  
  while (i < items.length && items[i].indent >= baseIndent) {
    const item = items[i];
    
    // 如果缩进更深，说明有嵌套列表
    if (item.indent > baseIndent) {
        const nested = renderList(items, i, item.indent, assetMap, footnotes);
      if (nested.element) {
        listItems.push(<div key={`nested-${i}`} className="ml-4">{nested.element}</div>);
      }
      i = nested.nextIndex;
      continue;
    }
    
    // 同级列表项
    if (item.indent === baseIndent) {
      // 检查下一个是否是嵌套
      const children: React.ReactNode[] = [];
      children.push(renderInlineMarkdown(item.content, assetMap, footnotes));
      
      i++;
      
      // 检查后续是否有嵌套列表
      if (i < items.length && items[i].indent > baseIndent) {
        const nested = renderList(items, i, items[i].indent, assetMap, footnotes);
        if (nested.element) {
          children.push(<div key={`child-${i}`} className="mt-1">{nested.element}</div>);
        }
        i = nested.nextIndex;
      }
      
      if (item.type === 'task') {
        listItems.push(
          <li key={i} className="flex items-start gap-2 py-1">
            <input 
              type="checkbox" 
              checked={item.checked} 
              readOnly 
              className="mt-1.5 w-4 h-4 accent-cyan-500 cursor-default"
            />
            <span className={item.checked ? 'line-through opacity-50' : ''}>{children}</span>
          </li>
        );
      } else {
        listItems.push(
          <li key={i} className="py-1 leading-relaxed">{children}</li>
        );
      }
    }
  }
  
  if (type === 'ol') {
    return {
      element: <ol className="my-2 ml-5 list-decimal marker:text-cyan-400 space-y-1">{listItems}</ol>,
      nextIndex: i
    };
  }
  
  return {
    element: <ul className="my-2 ml-5 list-disc marker:text-cyan-400 space-y-1">{listItems}</ul>,
    nextIndex: i
  };
};

// 解析表格
const parseTable = (
  lines: string[],
  startIndex: number,
  assetMap: AssetMap,
  footnotes: FootnoteMap,
): { element: React.ReactNode | null; nextIndex: number } => {
  const tableLines: string[] = [];
  let i = startIndex;
  
  // 收集表格行
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    tableLines.push(lines[i]);
    i++;
  }
  
  if (tableLines.length < 2) return { element: null, nextIndex: startIndex };
  
  // 解析表头
  const headerCells = tableLines[0].split('|').map(c => c.trim()).filter(c => c);
  
  // 解析对齐行
  const alignRow = tableLines[1].split('|').map(c => c.trim()).filter(c => c);
  const alignments: ('left' | 'center' | 'right')[] = alignRow.map(cell => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    return 'left';
  });
  
  // 解析数据行
  const dataRows = tableLines.slice(2).map(row => 
    row.split('|').map(c => c.trim()).filter(c => c)
  );
  
  const getAlignClass = (align: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };
  
  return {
    element: (
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse border border-white/20 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-white/10">
              {headerCells.map((cell, idx) => (
                <th 
                  key={idx} 
                  className={`px-4 py-3 border border-white/20 font-bold text-cyan-400 ${getAlignClass(alignments[idx] || 'left')}`}
                >
                  {renderInlineMarkdown(cell, assetMap, footnotes)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}>
                {row.map((cell, cellIdx) => (
                  <td 
                    key={cellIdx} 
                    className={`px-4 py-2 border border-white/10 ${getAlignClass(alignments[cellIdx] || 'left')}`}
                  >
                    {renderInlineMarkdown(cell, assetMap, footnotes)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    nextIndex: i
  };
};

const generateHeadingId = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const stripLeadingFrontmatter = (raw: string): string => {
  const lines = raw.split('\n');
  if (lines.length < 3) return raw;
  if (lines[0].trim() !== '---') return raw;

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
      const next: AssetMap = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && key.trim()) {
          next[key.trim()] = value;
        }
      }
      assets = next;
    }
  } catch {
    assets = {};
  }

  return { body, assets };
};

const resolveAssetSrc = (raw: string, assetMap: AssetMap): string => {
  const value = String(raw || '').trim();
  const match = value.match(/^asset:([a-zA-Z0-9_-]+)$/);
  if (!match) return value;
  return assetMap[match[1]] || '';
};

const renderCallout = (
  key: number,
  kind: string,
  title: string,
  quoteLines: string[],
  assetMap: AssetMap,
  footnotes: FootnoteMap,
) => {
  const type = kind.toLowerCase();
  const styleMap: Record<string, string> = {
    note: 'border-cyan-500/50 bg-cyan-500/10',
    info: 'border-blue-500/50 bg-blue-500/10',
    tip: 'border-emerald-500/50 bg-emerald-500/10',
    success: 'border-emerald-500/50 bg-emerald-500/10',
    warning: 'border-amber-500/60 bg-amber-500/10',
    danger: 'border-rose-500/60 bg-rose-500/10',
    error: 'border-rose-500/60 bg-rose-500/10',
    quote: 'border-purple-500/50 bg-purple-500/10',
  };
  const cls = styleMap[type] || 'border-cyan-500/50 bg-cyan-500/10';
  const heading = title || type.toUpperCase();

  return (
    <div key={key} className={`my-6 rounded-xl border p-4 ${cls}`}>
      <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-90">{heading}</div>
      <div className="space-y-2">
        {quoteLines.map((q, idx) => (
          <p key={idx} className="leading-relaxed">
            {renderInlineMarkdown(q, assetMap, footnotes)}
          </p>
        ))}
      </div>
    </div>
  );
};

const renderSignatureBlock = (
  key: number,
  kind: 'scribble' | 'lab' | 'postmortem',
  payload: string[],
  assetMap: AssetMap,
  footnotes: FootnoteMap,
): React.ReactNode => {
  const lines = payload
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const fallback = lines.length > 0 ? lines : ['(空白内容)'];
  const headingByKind = {
    scribble: '手写批注 · Scribble',
    lab: '实验日志 · Lab Notes',
    postmortem: '失败复盘 · Postmortem',
  } as const;

  const classByKind = {
    scribble: 'border-amber-300/45 bg-amber-100/10 text-amber-100 rotate-[-0.45deg]',
    lab: 'border-emerald-400/45 bg-emerald-500/10 text-emerald-100',
    postmortem: 'border-rose-400/45 bg-rose-500/10 text-rose-100',
  } as const;

  const lineClassByKind = {
    scribble: 'font-medium',
    lab: 'font-mono text-[13px] tracking-wide',
    postmortem: 'font-medium',
  } as const;

  return (
    <div key={key} className={`my-6 rounded-2xl border px-5 py-4 shadow-lg ${classByKind[kind]}`}>
      <div className="text-[11px] uppercase tracking-[0.28em] opacity-80 mb-3">{headingByKind[kind]}</div>
      <div className="space-y-2">
        {fallback.map((line, idx) => (
          <p
            key={`${kind}-${idx}-${line}`}
            className={`${lineClassByKind[kind]} leading-relaxed`}
            style={kind === 'scribble' ? { fontFamily: '"Comic Sans MS", "Segoe Print", cursive' } : undefined}
          >
            {renderInlineMarkdown(line, assetMap, footnotes)}
          </p>
        ))}
      </div>
    </div>
  );
};

const renderObsidianEmbed = (
  key: string,
  target: string,
  alias: string,
  assetMap: AssetMap,
): React.ReactNode | null => {
  const resolvedTarget = resolveAssetSrc(target, assetMap) || target;
  const normalized = normalizeObsidianPath(resolvedTarget);
  if (!normalized) return null;
  const label = alias || getPathBasename(normalized) || normalized;

  if (isLikelyExcalidrawPath(normalized) || /\.excalidraw\.md$/i.test(normalized)) {
    return <ExcalidrawEmbed key={key} src={normalized} />;
  }

  if (isLikelySvgPath(normalized)) {
    return (
      <div key={key} className="my-6 rounded-2xl overflow-hidden border border-white/10 bg-white/5 p-2">
        <LazyImage src={normalized} alt={label || 'svg-diagram'} className="w-full h-auto" />
      </div>
    );
  }

  if (isLikelyImagePath(normalized)) {
    return (
      <div key={key} className="my-6">
        <LazyImage src={normalized} alt={label || 'image'} className="w-full rounded-2xl border border-white/10" />
      </div>
    );
  }

  if (isHttpUrl(normalized)) {
    return (
      <p key={key} className="text-lg my-4 leading-relaxed">
        <a
          href={normalized}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 decoration-cyan-500/30"
        >
          {label}
        </a>
      </p>
    );
  }

  return (
    <p key={key} className="text-lg my-4 leading-relaxed opacity-80">
      {label}
    </p>
  );
};

// 解析Markdown内容为元素数组
const parseMarkdown = (content: string): React.ReactNode[] => {
  const elements: React.ReactNode[] = [];
  const { body, assets } = splitAssetManifest(stripLeadingFrontmatter(content));
  const extracted = extractFootnotes(body);
  const lines = extracted.body.split('\n');
  const footnotes = extracted.footnotes;
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // 空行
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-4" />);
      i++;
      continue;
    }

    // Excalidraw 绘图块
    if (/^:::excalidraw\s*$/i.test(line.trim())) {
      i++;
      const payload: string[] = [];
      while (i < lines.length && lines[i].trim() !== ':::') {
        payload.push(lines[i]);
        i++;
      }

      const src = payload.map((item) => item.trim()).find((item) => item.length > 0) || '';
      const resolvedSrc = resolveAssetSrc(src, assets);
      if (resolvedSrc) {
        elements.push(<ExcalidrawEmbed key={`excalidraw-${i}-${resolvedSrc.slice(0, 24)}`} src={resolvedSrc} />);
      }

      if (i < lines.length && lines[i].trim() === ':::') {
        i++;
      }
      continue;
    }

    // SVG 块
    if (/^:::svg\s*$/i.test(line.trim())) {
      i++;
      const payload: string[] = [];
      while (i < lines.length && lines[i].trim() !== ':::') {
        payload.push(lines[i]);
        i++;
      }

      const src = payload.map((item) => item.trim()).find((item) => item.length > 0) || '';
      const resolvedSrc = resolveAssetSrc(src, assets);
      if (resolvedSrc) {
        elements.push(
          <div key={`svg-${i}-${resolvedSrc.slice(0, 24)}`} className="my-6 rounded-2xl overflow-hidden border border-white/10 bg-white/5 p-2">
            <LazyImage src={resolvedSrc} alt="svg-diagram" className="w-full h-auto" />
          </div>,
        );
      }

      if (i < lines.length && lines[i].trim() === ':::') {
        i++;
      }
      continue;
    }

    const signatureBlockMatch = line.trim().match(/^:::(scribble|lab|postmortem)\s*$/i);
    if (signatureBlockMatch) {
      const kind = signatureBlockMatch[1].toLowerCase() as 'scribble' | 'lab' | 'postmortem';
      i += 1;
      const payload: string[] = [];
      while (i < lines.length && lines[i].trim() !== ':::') {
        payload.push(lines[i]);
        i += 1;
      }
      elements.push(renderSignatureBlock(i, kind, payload, assets, footnotes));
      if (i < lines.length && lines[i].trim() === ':::') {
        i += 1;
      }
      continue;
    }

    // Obsidian embed: ![[...]]
    const obsidianEmbedLine = line.trim().match(/^!\[\[([^\]]+)\]\]$/);
    if (obsidianEmbedLine) {
      const { target, alias } = parseWikiTarget(obsidianEmbedLine[1]);
      const node = renderObsidianEmbed(`obsidian-embed-${i}-${target}`, target, alias, assets);
      if (node) {
        elements.push(node);
      }
      i++;
      continue;
    }
    
    // 分割线 ---
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim()) || /^___+$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-6 border-white/20" />);
      i++;
      continue;
    }
    
    // 代码块 ```
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <CodeBlock key={i} language={language} code={codeLines.join('\n')} />
      );
      i++;
      continue;
    }
    
    // 一级标题 #
    if (/^#\s+/.test(line)) {
      const text = line.replace(/^#\s+/, '');
      const id = generateHeadingId(text);
      elements.push(<h1 key={i} id={id} className="text-4xl font-bold mt-8 mb-4 text-glow">{renderInlineMarkdown(text, assets, footnotes)}</h1>);
      i++;
      continue;
    }
    
    // 二级标题 ##
    if (/^##\s+/.test(line)) {
      const text = line.replace(/^##\s+/, '');
      const id = generateHeadingId(text);
      elements.push(<h2 key={i} id={id} className="text-3xl font-bold mt-8 mb-4">{renderInlineMarkdown(text, assets, footnotes)}</h2>);
      i++;
      continue;
    }
    
    // 三级标题 ###
    if (/^###\s+/.test(line)) {
      const text = line.replace(/^###\s+/, '');
      elements.push(<h3 key={i} className="text-2xl font-bold mt-6 mb-3">{renderInlineMarkdown(text, assets, footnotes)}</h3>);
      i++;
      continue;
    }

    // 四级标题 ####
    if (/^####\s+/.test(line)) {
      const text = line.replace(/^####\s+/, '');
      elements.push(<h4 key={i} className="text-xl font-bold mt-5 mb-2">{renderInlineMarkdown(text, assets, footnotes)}</h4>);
      i++;
      continue;
    }

    // 五级标题 #####
    if (/^#####\s+/.test(line)) {
      const text = line.replace(/^#####\s+/, '');
      elements.push(<h5 key={i} className="text-lg font-bold mt-4 mb-2">{renderInlineMarkdown(text, assets, footnotes)}</h5>);
      i++;
      continue;
    }

    // 六级标题 ######
    if (/^######\s+/.test(line)) {
      const text = line.replace(/^######\s+/, '');
      elements.push(<h6 key={i} className="text-base font-bold mt-4 mb-2">{renderInlineMarkdown(text, assets, footnotes)}</h6>);
      i++;
      continue;
    }
    
    // 引用 >
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s*/, ''));
        i++;
      }

      const calloutHeader = quoteLines[0]?.match(/^\[!([a-zA-Z0-9_-]+)\]\s*(.*)$/);
      if (calloutHeader) {
        const calloutType = calloutHeader[1];
        const calloutTitle = calloutHeader[2] || '';
        const calloutBody = quoteLines.slice(1);
        elements.push(renderCallout(i, calloutType, calloutTitle, calloutBody, assets, footnotes));
      } else {
        elements.push(
          <blockquote key={i} className="my-6 pl-6 border-l-4 border-cyan-500/50 italic opacity-80">
            {quoteLines.map((q, idx) => (
              <p key={idx} className="mb-2">{renderInlineMarkdown(q, assets, footnotes)}</p>
            ))}
          </blockquote>,
        );
      }
      continue;
    }

    // 表格 | col1 | col2 |
    if (line.trim().startsWith('|') && line.includes('|', line.indexOf('|') + 1)) {
      const tableResult = parseTable(lines, i, assets, footnotes);
      if (tableResult.element) {
        elements.push(<div key={i}>{tableResult.element}</div>);
        i = tableResult.nextIndex;
        continue;
      }
    }

    // 检查是否是列表的开始
    const listInfo = getListInfo(line);
    if (listInfo.isList) {
      // 收集连续的所有列表项
      const listItems: ListItem[] = [];
      
      while (i < lines.length) {
        const currentLine = lines[i];
        
        // 空行结束列表
        if (currentLine.trim() === '') {
          // 检查下一行是否还是列表
          const nextLine = lines[i + 1];
          if (nextLine && getListInfo(nextLine).isList) {
            i++; // 跳过空行继续
            continue;
          }
          break;
        }
        
        const info = getListInfo(currentLine);
        if (!info.isList) break;
        
        listItems.push({
          content: info.content,
          indent: info.indent,
          type: info.type!,
          checked: info.checked,
          number: info.number
        });
        i++;
      }
      
      // 渲染列表
      if (listItems.length > 0) {
        const result = renderList(listItems, 0, listItems[0].indent, assets, footnotes);
        if (result.element) {
          elements.push(<div key={i} className="my-4">{result.element}</div>);
        }
      }
      continue;
    }
    
    // 普通段落
    elements.push(<p key={i} className="text-lg my-4 leading-relaxed">{renderInlineMarkdown(line, assets, footnotes)}</p>);
    i++;
  }

  const footnoteEntries = Object.entries(footnotes);
  if (footnoteEntries.length > 0) {
    elements.push(
      <section key="footnotes" className="mt-12 pt-6 border-t border-white/10">
        <h4 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">脚注</h4>
        <ol className="space-y-2 ml-5 list-decimal marker:text-cyan-400">
          {footnoteEntries.map(([id, note]) => (
            <li key={id} id={`fn-${id}`} className="text-sm opacity-80 leading-relaxed">
              {renderInlineMarkdown(note, assets, footnotes, { disableFootnoteRefs: true })}
            </li>
          ))}
        </ol>
      </section>,
    );
  }
  
  return elements;
};

const normalizeInlineDelimiters = (input: string): string => {
  return input
    .replace(/＊/g, '*')
    .replace(/＿/g, '_')
    .replace(/～/g, '~')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
};

// 处理行内Markdown（粗体、斜体、链接、行内公式等）
const renderInlineMarkdown = (
  text: string,
  assetMap: AssetMap,
  footnotes: FootnoteMap = {},
  options?: { disableFootnoteRefs?: boolean },
): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let remaining = normalizeInlineDelimiters(text);
  let key = 0;
  
  // 依次处理各种行内元素
  while (remaining.length > 0) {
    // 优先匹配数学公式 $...$ 或 $$
    const mathMatch = remaining.match(/^\$\$[\s\S]+?\$\$|^\$[^\$\n]+?\$/);
    if (mathMatch) {
      const formula = mathMatch[0];
      if (formula.startsWith('$$') && formula.endsWith('$$')) {
        parts.push(<MathRenderer key={key++} formula={formula.slice(2, -2)} displayMode />);
      } else {
        parts.push(<MathRenderer key={key++} formula={formula.slice(1, -1)} />);
      }
      remaining = remaining.slice(formula.length);
      continue;
    }
    
    // 匹配图片 ![alt](url)
    const imageMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      const imageSrc = resolveAssetSrc(imageMatch[2], assetMap);
      parts.push(
        <span key={key++}>
          <LazyImage 
            src={imageSrc} 
            alt={imageMatch[1]} 
            className="inline w-32 h-32 rounded-lg mx-2 align-middle" 
          />
        </span>
      );
      remaining = remaining.slice(imageMatch[0].length);
      continue;
    }

    // 匹配 Obsidian 嵌入 ![[target|alias]]
    const obsidianEmbedMatch = remaining.match(/^!\[\[([^\]]+)\]\]/);
    if (obsidianEmbedMatch) {
      const { target, alias } = parseWikiTarget(obsidianEmbedMatch[1]);
      const normalized = normalizeObsidianPath(resolveAssetSrc(target, assetMap) || target);
      const alt = alias || getPathBasename(normalized) || 'embed';

      if (normalized && (isLikelyImagePath(normalized) || isLikelySvgPath(normalized) || isHttpUrl(normalized))) {
        parts.push(
          <span key={key++}>
            <LazyImage src={normalized} alt={alt} className="inline w-32 h-32 rounded-lg mx-2 align-middle" />
          </span>,
        );
      } else {
        parts.push(<span key={key++} className="opacity-80">{alt}</span>);
      }

      remaining = remaining.slice(obsidianEmbedMatch[0].length);
      continue;
    }
    
    // 匹配链接 [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 decoration-cyan-500/30">
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 匹配 Obsidian Wiki 链接 [[target|alias]]
    const wikiLinkMatch = remaining.match(/^\[\[([^\]]+)\]\]/);
    if (wikiLinkMatch) {
      const { target, alias } = parseWikiTarget(wikiLinkMatch[1]);
      const normalized = normalizeObsidianPath(resolveAssetSrc(target, assetMap) || target);
      const label = alias || getPathBasename(normalized) || normalized;

      if (normalized && isHttpUrl(normalized)) {
        parts.push(
          <a
            key={key++}
            href={normalized}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 decoration-cyan-500/30"
          >
            {label}
          </a>,
        );
      } else {
        parts.push(
          <span key={key++} className="text-cyan-300/90 underline underline-offset-4 decoration-cyan-500/30">
            {label}
          </span>,
        );
      }

      remaining = remaining.slice(wikiLinkMatch[0].length);
      continue;
    }

    // 匹配脚注引用 [^id]，支持悬浮预览
    const footnoteMatch = remaining.match(/^\[\^([^\]]+)\]/);
    if (footnoteMatch && !options?.disableFootnoteRefs) {
      const footnoteId = footnoteMatch[1].trim();
      const note = footnotes[footnoteId] || '';

      parts.push(
        <sup key={key++} className="mx-0.5 align-super text-[11px]">
          <span className="relative inline-flex items-center group">
            <a
              href={`#fn-${footnoteId}`}
              className="px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 hover:bg-cyan-500/25"
            >
              {footnoteId}
            </a>
            {note && (
              <span className="pointer-events-none absolute left-1/2 top-[-10px] z-20 hidden w-72 -translate-x-1/2 -translate-y-full rounded-xl border border-white/15 bg-[#070b1b] px-3 py-2 text-xs text-white/85 shadow-2xl group-hover:block group-focus-within:block">
                {renderInlineMarkdown(note, assetMap, footnotes, { disableFootnoteRefs: true })}
              </span>
            )}
          </span>
        </sup>,
      );

      remaining = remaining.slice(footnoteMatch[0].length);
      continue;
    }

    // 匹配高亮 ==text==
    const highlightMatch = remaining.match(/^==([^=]+)==/);
    if (highlightMatch) {
      parts.push(<mark key={key++} className="bg-yellow-500/30 text-yellow-200 px-1 rounded">{highlightMatch[1]}</mark>);
      remaining = remaining.slice(highlightMatch[0].length);
      continue;
    }
    
    // 匹配粗体 **text** 或 __text__
    const boldMatch = remaining.match(/^(\*\*|__)\s*([^\n]*?\S[^\n]*?)\s*\1/);
    if (boldMatch) {
      parts.push(
        <strong
          key={key++}
          className="text-cyan-100"
          style={{ fontWeight: 800, letterSpacing: '0.01em' }}
        >
          {boldMatch[2]}
        </strong>,
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 匹配删除线 ~~text~~
    const strikethroughMatch = remaining.match(/^~~([^~]+)~~/);
    if (strikethroughMatch) {
      parts.push(<del key={key++} className="line-through opacity-50">{strikethroughMatch[1]}</del>);
      remaining = remaining.slice(strikethroughMatch[0].length);
      continue;
    }
    
    // 匹配斜体 *text* 或 _text_
    const italicMatch = remaining.match(/^(\*|_)\s*([^\n]*?\S[^\n]*?)\s*\1/);
    if (italicMatch) {
      parts.push(
        <em
          key={key++}
          className="text-cyan-200"
          style={{ fontStyle: 'italic', display: 'inline-block', transform: 'skewX(-8deg)' }}
        >
          {italicMatch[2]}
        </em>,
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    
    // 匹配行内代码 `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      const codeContent = codeMatch[1];
      // 在代码内容中支持粗体、斜体等 Markdown 格式
      const parsedCodeContent = parseInlineCodeContent(codeContent);
      parts.push(<code key={key++} className="px-2 py-1 bg-white/10 rounded text-cyan-300 font-mono text-sm">{parsedCodeContent}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    
    // 普通文本 - 取第一个字符
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }
  
  return parts;
};

// 解析行内代码中的 Markdown 内容（支持粗体、斜体等）
const parseInlineCodeContent = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let remaining = normalizeInlineDelimiters(text);
  let key = 0;
  
  while (remaining.length > 0) {
    // 在行内代码中匹配粗体 **text**
    const boldMatch = remaining.match(/^(\*\*|__)\s*([^\n]*?\S[^\n]*?)\s*\1/);
    if (boldMatch) {
      parts.push(
        <strong
          key={key++}
          className="text-cyan-100"
          style={{ fontWeight: 800, letterSpacing: '0.01em' }}
        >
          {boldMatch[2]}
        </strong>,
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    
    // 在行内代码中匹配斜体 *text*
    const italicMatch = remaining.match(/^(\*|_)\s*([^\n]*?\S[^\n]*?)\s*\1/);
    if (italicMatch) {
      parts.push(
        <em
          key={key++}
          className="text-cyan-200"
          style={{ fontStyle: 'italic', display: 'inline-block', transform: 'skewX(-8deg)' }}
        >
          {italicMatch[2]}
        </em>,
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    
    // 在行内代码中匹配删除线 ~~text~~
    const strikethroughMatch = remaining.match(/^~~([^~]+)~~/);
    if (strikethroughMatch) {
      parts.push(<del key={key++} className="line-through opacity-50">{strikethroughMatch[1]}</del>);
      remaining = remaining.slice(strikethroughMatch[0].length);
      continue;
    }
    
    // 普通文本 - 取第一个字符
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }
  
  return parts;
};

const MarkdownContent: React.FC<MarkdownContentProps> = React.memo(({ content }) => {
  const [lightboxImage, setLightboxImage] = React.useState<{ src: string; alt: string } | null>(null);
  const parsed = React.useMemo(() => parseMarkdown(content || ''), [content]);
  const handleArticleClickCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    const src = target.currentSrc || target.src;
    if (!src) return;
    setLightboxImage({
      src,
      alt: target.alt || 'image',
    });
  }, []);

  React.useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxImage]);

  return (
    <>
      <div
        className="article-content prose prose-invert max-w-none prose-purple leading-relaxed"
        onClickCapture={handleArticleClickCapture}
      >
        {content ? parsed : <div className="prose prose-invert max-w-none">等待内容...</div>}
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-5 right-5 px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 text-sm"
            onClick={() => setLightboxImage(null)}
          >
            关闭
          </button>
          <div className="max-w-6xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl border border-white/15 shadow-2xl"
            />
            {lightboxImage.alt && (
              <p className="mt-3 text-xs opacity-70">{lightboxImage.alt}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

export default MarkdownContent;
