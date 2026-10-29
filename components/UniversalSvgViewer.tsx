import React, { useState, useMemo } from 'react';
import { Compass, ZoomIn, ZoomOut, RotateCcw, Copy, Check, Maximize2 } from 'lucide-react';

interface UniversalSvgViewerProps {
  content: string;
  title?: string;
  caption?: string;
}

/**
 * Universal SVG Vector Graphics Viewer
 * Renders any vector drawing, flowchart, layout guide, or engineering diagram directly
 * with crisp anti-aliasing, pan/zoom, and copy features.
 */
export const UniversalSvgViewer: React.FC<UniversalSvgViewerProps> = ({ content, title, caption }) => {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);

  // Extract clean SVG string
  const cleanSvg = useMemo(() => {
    if (!content) return '';
    let raw = content.trim();

    // Remove markdown code fences if present
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```[a-z0-9_-]*\n/i, '').replace(/\n```$/, '').trim();
    }

    // Find <svg ... </svg>
    const svgMatch = raw.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      raw = svgMatch[0];
    } else if (!raw.startsWith('<svg') && raw.includes('<svg')) {
      const idx = raw.indexOf('<svg');
      raw = raw.slice(idx);
    }

    // Basic sanitization: strip script tags & inline event handlers
    raw = raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/javascript:/gi, '');

    // Ensure responsive SVG attributes
    if (!raw.includes('viewBox') && raw.includes('width=') && raw.includes('height=')) {
      const wMatch = raw.match(/width=['"]([0-9\.]+)['"]/);
      const hMatch = raw.match(/height=['"]([0-9\.]+)['"]/);
      if (wMatch && hMatch) {
        raw = raw.replace('<svg', `<svg viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`);
      }
    }

    return raw;
  }, [content]);

  // Extract title/caption from content if not explicitly provided
  const parsedMeta = useMemo(() => {
    let t = title || '公文与工程图样矢量复现 (Vector Diagram)';
    let c = caption || '';

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('title:')) {
        t = trimmed.replace('title:', '').trim();
      } else if (trimmed.startsWith('caption:')) {
        c = trimmed.replace('caption:', '').trim();
      }
    }
    return { title: t, caption: c };
  }, [content, title, caption]);

  const handleCopySvg = async () => {
    try {
      await navigator.clipboard.writeText(cleanSvg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!cleanSvg) {
    return (
      <div className="my-4 p-4 border border-rose-200 bg-rose-50 text-rose-700 text-xs rounded-lg font-mono">
        未检测到有效的 SVG 矢量图形代码
      </div>
    );
  }

  return (
    <div className="my-6 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs font-sans select-none">
      {/* Blueprint Header */}
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Compass className="w-5 h-5 text-teal-400" />
          <div>
            <h4 className="text-sm font-bold tracking-wide">
              {parsedMeta.title}
            </h4>
            <div className="text-[10px] text-slate-300">
              原生矢量 SVG • 几何线条与标注 1:1 精确复现
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-slate-300">
            <button
              onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
              className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 min-w-[36px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
              className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors ml-0.5"
              title="重置"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleCopySvg}
            className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 px-2.5 py-1 rounded-lg transition-colors"
            title="复制 SVG 代码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制矢量'}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="p-6 bg-slate-50/80 overflow-x-auto flex justify-center items-center min-h-[220px]">
        <div
          className="w-full max-w-[620px] transition-transform duration-150 ease-out origin-center flex justify-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:drop-shadow-2xs"
          style={{ transform: `scale(${zoom})` }}
          dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
      </div>

      {/* Caption & Notes Footer */}
      {parsedMeta.caption && (
        <div className="p-3 bg-white border-t border-slate-200 text-center">
          <div className="text-xs font-bold text-slate-900 font-sans tracking-wide">
            {parsedMeta.caption}
          </div>
        </div>
      )}
    </div>
  );
};
