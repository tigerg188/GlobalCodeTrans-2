import React from 'react';
import { 
  FileText, 
  CheckCircle2, 
  Compass, 
  Award, 
  Layers, 
  Info,
  Maximize2,
  GitBranch,
  ArrowRight,
  Workflow
} from 'lucide-react';

/**
 * Universal Parser for Official Document Layout blocks
 */
export interface OfficialDocMarginOptions {
  title?: string;
  paper?: string;
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
  bindingWidth?: string;
  headerHeight?: string;
  footerHeight?: string;
  notes?: string;
  caption?: string;
}

export function parseDocMarginBlock(content: string): OfficialDocMarginOptions {
  const opts: OfficialDocMarginOptions = {
    title: "公文版面边距与装订标尺规范 (Margin & Binding Specification)",
    paper: "A4 (210mm × 297mm)",
    marginTop: "2.5 cm",
    marginBottom: "2.0 cm",
    marginLeft: "3.0 cm",
    marginRight: "2.0 cm",
    bindingWidth: "3.0 cm",
    headerHeight: "1.5 cm",
    footerHeight: "1.5 cm",
    notes: "左侧3.0cm预留装订线，四周版心严格执行公文技术规程",
    caption: "图示：A4 国家行政公文版心尺寸与装订边距界线图"
  };

  const lines = (content || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('title:')) {
      opts.title = trimmed.replace('title:', '').trim();
    } else if (trimmed.startsWith('caption:')) {
      opts.caption = trimmed.replace('caption:', '').trim();
    } else if (trimmed.startsWith('paper:')) {
      opts.paper = trimmed.replace('paper:', '').trim();
    } else if (trimmed.startsWith('notes:') || trimmed.startsWith('note:')) {
      opts.notes = trimmed.replace(/notes?:/, '').trim();
    } else if (trimmed.startsWith('margins:') || trimmed.startsWith('parameters:')) {
      const marginStr = trimmed.replace(/(?:margins|parameters):/, '').trim();
      const topMatch = marginStr.match(/top=([0-9\.]+\s*(?:cm|mm)?)/i);
      const bottomMatch = marginStr.match(/bottom=([0-9\.]+\s*(?:cm|mm)?)/i);
      const leftMatch = marginStr.match(/left=([0-9\.]+\s*(?:cm|mm)?)/i);
      const rightMatch = marginStr.match(/right=([0-9\.]+\s*(?:cm|mm)?)/i);
      const bindingMatch = marginStr.match(/binding=([0-9\.]+\s*(?:cm|mm)?)/i);

      if (topMatch) opts.marginTop = topMatch[1];
      if (bottomMatch) opts.marginBottom = bottomMatch[1];
      if (leftMatch) opts.marginLeft = leftMatch[1];
      if (rightMatch) opts.marginRight = rightMatch[1];
      if (bindingMatch) opts.bindingWidth = bindingMatch[1];
    } else {
      const topMatch = trimmed.match(/(?:上边距|marginTop|top)\s*[:=]\s*([0-9\.]+\s*(?:cm|mm)?)/i);
      const botMatch = trimmed.match(/(?:下边距|marginBottom|bottom)\s*[:=]\s*([0-9\.]+\s*(?:cm|mm)?)/i);
      const leftMatch = trimmed.match(/(?:左边距|marginLeft|left)\s*[:=]\s*([0-9\.]+\s*(?:cm|mm)?)/i);
      const rightMatch = trimmed.match(/(?:右边距|marginRight|right)\s*[:=]\s*([0-9\.]+\s*(?:cm|mm)?)/i);
      if (topMatch) opts.marginTop = topMatch[1];
      if (botMatch) opts.marginBottom = botMatch[1];
      if (leftMatch) opts.marginLeft = leftMatch[1];
      if (rightMatch) opts.marginRight = rightMatch[1];
    }
  }

  return opts;
}

/**
 * 1. Official Document Margin & Binding Vector Viewer
 * Precise SVG visualization with calibrated rulers, dual-ended dimension arrows, and binding line
 */
export const OfficialDocMarginViewer: React.FC<{ content: string }> = ({ content }) => {
  const opts = parseDocMarginBlock(content);

  return (
    <div className="my-6 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs font-sans select-none">
      {/* Blueprint Header */}
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-teal-400" />
          <div>
            <h4 className="text-sm font-bold tracking-wide">
              {opts.title}
            </h4>
            <div className="text-[10px] text-slate-300">
              {opts.paper} • 毫米级几何定位与装订预留矢量图
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
            官方标准尺寸复现
          </span>
        </div>
      </div>

      {/* SVG Dimension Drawing Canvas */}
      <div className="p-6 bg-slate-100 flex flex-col items-center">
        <div className="relative w-full max-w-[560px] bg-white border border-slate-300 shadow-sm rounded-sm p-4">
          <svg viewBox="0 0 540 380" className="w-full h-auto">
            <defs>
              <marker id="dim-arrow-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 10 1 L 0 5 L 10 9 z" fill="#e11d48" />
              </marker>
              <marker id="dim-arrow-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#e11d48" />
              </marker>
              <pattern id="binding-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" strokeWidth="1.5" />
              </pattern>
            </defs>

            {/* A4 Sheet Outline (210 x 297 ratio) */}
            <rect x="70" y="30" width="400" height="320" fill="#ffffff" stroke="#1e293b" strokeWidth="2" rx="1" />
            <text x="475" y="44" fill="#64748b" fontSize="9" fontFamily="sans-serif">A4 (210×297mm)</text>

            {/* Top Outer Calibrated Metric Ruler */}
            <line x1="70" y1="20" x2="470" y2="20" stroke="#94a3b8" strokeWidth="1.2" />
            {[0, 3, 6, 10, 15, 18, 21].map((cm) => {
              const x = 70 + (cm / 21) * 400;
              return (
                <g key={`top-ruler-${cm}`}>
                  <line x1={x} y1="16" x2={x} y2="20" stroke="#64748b" strokeWidth="1.2" />
                  <text x={x} y="13" textAnchor="middle" fill="#475569" fontSize="8" fontFamily="monospace">{cm}cm</text>
                </g>
              );
            })}

            {/* Left Outer Calibrated Metric Ruler */}
            <line x1="60" y1="30" x2="60" y2="350" stroke="#94a3b8" strokeWidth="1.2" />
            {[0, 2.5, 5, 10, 15, 20, 25, 29.7].map((cm) => {
              const y = 30 + (cm / 29.7) * 320;
              return (
                <g key={`left-ruler-${cm}`}>
                  <line x1="56" y1={y} x2="60" y2={y} stroke="#64748b" strokeWidth="1.2" />
                  <text x="52" y={y + 3} textAnchor="end" fill="#475569" fontSize="8" fontFamily="monospace">{cm}</text>
                </g>
              );
            })}

            {/* Left Binding Margin Zone (3.0 cm, ~57px on SVG) */}
            <rect x="70" y="30" width="57" height="320" fill="url(#binding-hatch)" opacity="0.8" />
            <line x1="127" y1="30" x2="127" y2="350" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="4 3" />
            
            {/* Punch hole indicators */}
            <circle cx="98" cy="110" r="3.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
            <circle cx="98" cy="270" r="3.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />

            {/* Top Margin Boundary Line (2.5 cm, ~27px on SVG) */}
            <line x1="70" y1="57" x2="470" y2="57" stroke="#e11d48" strokeWidth="1.2" strokeDasharray="3 3" />

            {/* Right Margin Boundary Line (2.0 cm, ~38px from right = x:432) */}
            <line x1="432" y1="30" x2="432" y2="350" stroke="#e11d48" strokeWidth="1.2" strokeDasharray="3 3" />

            {/* Bottom Margin Boundary Line (2.0 cm, ~22px from bottom = y:328) */}
            <line x1="70" y1="328" x2="470" y2="328" stroke="#e11d48" strokeWidth="1.2" strokeDasharray="3 3" />

            {/* Effective Text Body Area (Print Zone) */}
            <rect x="127" y="57" width="305" height="271" fill="#f0fdfa" fillOpacity="0.45" stroke="#0d9488" strokeWidth="1.5" strokeDasharray="5 4" />
            
            {/* Dimension Arrows */}
            {/* 1. Left Binding Dimension Arrow */}
            <line x1="70" y1="190" x2="127" y2="190" stroke="#e11d48" strokeWidth="1.5" markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
            <rect x="74" y="174" width="50" height="15" rx="3" fill="#ffffff" stroke="#fecdd3" strokeWidth="1" />
            <text x="99" y="185" textAnchor="middle" fill="#be123c" fontSize="9" fontWeight="bold" fontFamily="monospace">{opts.marginLeft}</text>
            <text x="99" y="208" textAnchor="middle" fill="#be123c" fontSize="8" fontWeight="bold">装订线</text>

            {/* 2. Top Margin Dimension Arrow */}
            <line x1="280" y1="30" x2="280" y2="57" stroke="#e11d48" strokeWidth="1.5" markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
            <rect x="290" y="36" width="68" height="15" rx="3" fill="#ffffff" stroke="#fecdd3" strokeWidth="1" />
            <text x="324" y="47" textAnchor="middle" fill="#be123c" fontSize="9" fontWeight="bold" fontFamily="monospace">上边距 {opts.marginTop}</text>

            {/* 3. Right Margin Dimension Arrow */}
            <line x1="432" y1="190" x2="470" y2="190" stroke="#e11d48" strokeWidth="1.5" markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
            <rect x="424" y="174" width="52" height="15" rx="3" fill="#ffffff" stroke="#fecdd3" strokeWidth="1" />
            <text x="450" y="185" textAnchor="middle" fill="#be123c" fontSize="9" fontWeight="bold" fontFamily="monospace">{opts.marginRight}</text>

            {/* 4. Bottom Margin Dimension Arrow */}
            <line x1="280" y1="328" x2="280" y2="350" stroke="#e11d48" strokeWidth="1.5" markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
            <rect x="290" y="331" width="68" height="15" rx="3" fill="#ffffff" stroke="#fecdd3" strokeWidth="1" />
            <text x="324" y="342" textAnchor="middle" fill="#be123c" fontSize="9" fontWeight="bold" fontFamily="monospace">下边距 {opts.marginBottom}</text>

            {/* Inside Content Mock Lines */}
            <g transform="translate(140, 75)" opacity="0.75">
              <text x="135" y="0" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">公文版心正文区 (Print Area)</text>
              <line x1="20" y1="20" x2="250" y2="20" stroke="#0d9488" strokeWidth="1.8" />
              <line x1="40" y1="36" x2="250" y2="36" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="10" y1="52" x2="250" y2="52" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="10" y1="68" x2="200" y2="68" stroke="#94a3b8" strokeWidth="1.5" />
              
              <rect x="15" y="90" width="225" height="40" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
              <line x1="15" y1="104" x2="240" y2="104" stroke="#cbd5e1" strokeWidth="1" />
              <text x="127" y="115" textAnchor="middle" fill="#64748b" fontSize="8">数据表格与条款细则排列示范</text>

              {/* Seal Location Guide */}
              <circle cx="200" cy="180" r="22" fill="#fff1f2" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3 2" />
              <text x="200" y="183" textAnchor="middle" fill="#be123c" fontSize="7" fontWeight="bold">印章位置</text>
            </g>
          </svg>
        </div>
      </div>

      {/* Numerical Parameters Badge Bar */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-2.5 items-center justify-between text-xs font-mono text-slate-700">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
            左装订: <strong className="text-rose-700">{opts.marginLeft}</strong>
          </span>
          <span className="bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
            上边距: <strong className="text-rose-700">{opts.marginTop}</strong>
          </span>
          <span className="bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
            右裁切: <strong className="text-rose-700">{opts.marginRight}</strong>
          </span>
          <span className="bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
            下边距: <strong className="text-rose-700">{opts.marginBottom}</strong>
          </span>
        </div>
        <div className="text-[11px] text-teal-700 font-sans font-semibold">
          标准版心比例 100% 保持
        </div>
      </div>

      {/* Caption & Notes */}
      <div className="p-3 bg-white border-t border-slate-200 text-center space-y-1">
        <div className="text-xs font-bold text-slate-900 font-sans tracking-wide">
          {opts.caption}
        </div>
        {opts.notes && (
          <div className="text-[11px] text-slate-500 font-sans">
            注：{opts.notes}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 2. Official Document Header & Typography Grid Viewer
 * Visualizes Lao State Letterhead Grid: Country Name, Motto, Ministry, Number & Date alignment
 */
export interface OfficialHeaderGridOptions {
  title?: string;
  countryName?: string;
  motto?: string;
  ministry?: string;
  department?: string;
  docNumber?: string;
  dateLocation?: string;
  titleFont?: string;
  mottoFont?: string;
  spacing?: string;
  caption?: string;
  notes?: string;
}

export function parseHeaderGridBlock(content: string): OfficialHeaderGridOptions {
  const opts: OfficialHeaderGridOptions = {
    title: "公文文头与发文机关排版定位网格 (Official Letterhead Grid)",
    countryName: "ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ (老挝人民民主共和国)",
    motto: "ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ (和平 独立 民主 统一 繁荣)",
    ministry: "ກະຊວງ... (发文部委/机构名称)",
    department: "ຫ້ອງການ / ກົມ... (司局级机关)",
    docNumber: "ເລກທີ 001/ກຊ (文号编号)",
    dateLocation: "ນະຄອນຫຼວງວຽງຈັນ, ວັນທີ... (签发地点与日期)",
    titleFont: "14pt 加粗居中",
    mottoFont: "12pt 正体加粗单行距",
    spacing: "文头与正文间距 1.5 行距",
    caption: "图示：老挝国家行政公文标头网格定位与尺寸对照",
    notes: "国名固定居中14pt加粗，国家格言12pt加粗，发文机关靠左对齐，文号与日期居右对齐"
  };

  const lines = (content || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('title:')) opts.title = trimmed.replace('title:', '').trim();
    else if (trimmed.startsWith('countryName:')) opts.countryName = trimmed.replace('countryName:', '').trim();
    else if (trimmed.startsWith('motto:')) opts.motto = trimmed.replace('motto:', '').trim();
    else if (trimmed.startsWith('ministry:')) opts.ministry = trimmed.replace('ministry:', '').trim();
    else if (trimmed.startsWith('department:')) opts.department = trimmed.replace('department:', '').trim();
    else if (trimmed.startsWith('docNumber:')) opts.docNumber = trimmed.replace('docNumber:', '').trim();
    else if (trimmed.startsWith('dateLocation:')) opts.dateLocation = trimmed.replace('dateLocation:', '').trim();
    else if (trimmed.startsWith('caption:')) opts.caption = trimmed.replace('caption:', '').trim();
    else if (trimmed.startsWith('notes:')) opts.notes = trimmed.replace('notes:', '').trim();
  }

  return opts;
}

export const OfficialHeaderGridViewer: React.FC<{ content: string }> = ({ content }) => {
  const opts = parseHeaderGridBlock(content);

  return (
    <div className="my-6 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs font-sans select-none">
      {/* Blueprint Header */}
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Award className="w-5 h-5 text-teal-400" />
          <div>
            <h4 className="text-sm font-bold tracking-wide">
              {opts.title}
            </h4>
            <div className="text-[10px] text-slate-300">
              老挝公文法定标头布局 • 左右网格对齐规范
            </div>
          </div>
        </div>
        <span className="text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-0.5 rounded-full font-bold">
          标头网格图示
        </span>
      </div>

      {/* Letterhead Visual Grid Area */}
      <div className="p-6 bg-slate-100 flex flex-col items-center">
        <div className="relative w-full max-w-[560px] bg-white border border-slate-300 shadow-sm rounded-sm p-6 text-slate-900">
          
          {/* Top Center: Country & Motto in Golden/Red Highlight Box */}
          <div className="relative border border-dashed border-teal-500/60 bg-teal-50/30 rounded p-3 text-center mb-4">
            <span className="absolute -top-2.5 left-4 bg-teal-700 text-white text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
              居中对齐区 (14pt 加粗)
            </span>
            <div className="text-sm font-black text-slate-900 tracking-tight leading-snug">
              {opts.countryName}
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">
              {opts.motto}
            </div>
            <div className="text-[10px] text-teal-800 font-mono mt-1">
              [基准参考线：距顶部 2.5cm • 居中单倍行距]
            </div>
          </div>

          {/* Left / Right Dual-Column Grid */}
          <div className="grid grid-cols-2 gap-4 border border-dashed border-indigo-400/60 bg-indigo-50/20 rounded p-3 relative">
            <span className="absolute -top-2.5 left-4 bg-indigo-700 text-white text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
              发文机关与文号网格
            </span>

            {/* Left Column: Issuing Agency */}
            <div className="border-r border-slate-200 pr-3 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">左栏：发文机关 (靠左对齐)</div>
              <div className="text-xs font-bold text-slate-800">{opts.ministry}</div>
              <div className="text-[11px] text-slate-700">{opts.department}</div>
              <div className="text-[9px] font-mono text-indigo-700 pt-1 border-t border-slate-100">
                ← 距装订线 0cm (平齐版心)
              </div>
            </div>

            {/* Right Column: Doc Number & Date */}
            <div className="pl-1 text-right space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">右栏：文号与日期 (靠右对齐)</div>
              <div className="text-xs font-bold text-slate-800 font-mono">{opts.docNumber}</div>
              <div className="text-[11px] text-slate-700">{opts.dateLocation}</div>
              <div className="text-[9px] font-mono text-indigo-700 pt-1 border-t border-slate-100">
                距右边距 0cm (平齐版心) →
              </div>
            </div>
          </div>

          {/* Separation Leader Line Arrow to Body */}
          <div className="mt-4 pt-2 border-t-2 border-dashed border-rose-400 flex items-center justify-between text-xs text-rose-700 font-mono">
            <span>↓ 标头与正文分割间隙: 1.5 行距 (约 1.0cm)</span>
            <span className="font-bold">正文由此向下起始排版</span>
          </div>
        </div>
      </div>

      {/* Caption & Notes */}
      <div className="p-3 bg-white border-t border-slate-200 text-center space-y-1">
        <div className="text-xs font-bold text-slate-900 font-sans tracking-wide">
          {opts.caption}
        </div>
        {opts.notes && (
          <div className="text-[11px] text-slate-500 font-sans">
            注：{opts.notes}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 3. Official Signature & Seal Stamping Specification Viewer
 * Visualizes official stamp placement (Ø 40mm/45mm), "骑年盖月" overlap rules, and signature blank box
 */
export interface OfficialSignatureSealOptions {
  title?: string;
  signatoryTitle?: string;
  signatoryName?: string;
  sealDiameter?: string;
  sealOverlap?: string;
  signatureGap?: string;
  caption?: string;
  notes?: string;
}

export function parseSignatureSealBlock(content: string): OfficialSignatureSealOptions {
  const opts: OfficialSignatureSealOptions = {
    title: "签发签署区与公章盖印规范示意图 (Signature & Official Seal Layout)",
    signatoryTitle: "ຫົວໜ້າຫ້ອງການ / ລັດຖະມົນຕີ (办公厅主任 / 部长)",
    signatoryName: "(手写签名留白位 • 签发人姓名 14pt 加粗)",
    sealDiameter: "Ø 40mm (部委公章标称直径)",
    sealOverlap: "骑年盖月 (覆盖签发日期大写年份前 1/3 ~ 1/2)",
    signatureGap: "留空 2.5cm (签名手迹预留净高)",
    caption: "图示：老挝国家公章偏位与签署区相对位置规范图",
    notes: "印章必须使用正红色油墨，正圆无变形，盖在职务名称右下方并压盖日期，绝不允许完全遮盖姓名"
  };

  const lines = (content || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('title:')) opts.title = trimmed.replace('title:', '').trim();
    else if (trimmed.startsWith('signatoryTitle:')) opts.signatoryTitle = trimmed.replace('signatoryTitle:', '').trim();
    else if (trimmed.startsWith('signatoryName:')) opts.signatoryName = trimmed.replace('signatoryName:', '').trim();
    else if (trimmed.startsWith('sealDiameter:')) opts.sealDiameter = trimmed.replace('sealDiameter:', '').trim();
    else if (trimmed.startsWith('sealOverlap:')) opts.sealOverlap = trimmed.replace('sealOverlap:', '').trim();
    else if (trimmed.startsWith('signatureGap:')) opts.signatureGap = trimmed.replace('signatureGap:', '').trim();
    else if (trimmed.startsWith('caption:')) opts.caption = trimmed.replace('caption:', '').trim();
    else if (trimmed.startsWith('notes:')) opts.notes = trimmed.replace('notes:', '').trim();
  }

  return opts;
}

export const OfficialSignatureSealViewer: React.FC<{ content: string }> = ({ content }) => {
  const opts = parseSignatureSealBlock(content);

  return (
    <div className="my-6 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs font-sans select-none">
      {/* Blueprint Header */}
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Award className="w-5 h-5 text-rose-400" />
          <div>
            <h4 className="text-sm font-bold tracking-wide">
              {opts.title}
            </h4>
            <div className="text-[10px] text-slate-300">
              老挝公文印章盖印标准 • 骑年盖月比例矢量示意
            </div>
          </div>
        </div>
        <span className="text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">
          印章规范图示
        </span>
      </div>

      {/* Seal Drawing Area */}
      <div className="p-6 bg-slate-100 flex flex-col items-center">
        <div className="relative w-full max-w-[560px] bg-white border border-slate-300 shadow-sm rounded-sm p-6 text-slate-900">
          <div className="flex justify-end">
            <div className="w-72 relative border-2 border-dashed border-rose-300 bg-rose-50/20 rounded p-4 text-center">
              
              {/* Signatory Title */}
              <div className="text-xs font-extrabold text-slate-900 mb-2">
                {opts.signatoryTitle}
              </div>

              {/* Signature Gap Box */}
              <div className="my-4 h-16 border border-dashed border-slate-300 rounded bg-white/70 flex items-center justify-center relative">
                <span className="text-[10px] text-slate-400 font-mono italic">
                  [ {opts.signatureGap} 签名留白 ]
                </span>
                
                {/* Simulated Official Red Seal (Overlapping date & signature area) */}
                <div 
                  className="absolute -left-6 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-dashed border-rose-600 bg-rose-500/15 flex flex-col items-center justify-center text-rose-600 shadow-inner select-none pointer-events-none"
                  style={{ backdropFilter: 'blur(0.5px)' }}
                >
                  <div className="text-[8px] font-black uppercase tracking-widest text-center px-1">
                    ກາປະທັບທາງລັດຖະການ
                  </div>
                  <div className="text-[10px] font-extrabold my-0.5">★ 国徽/徽标 ★</div>
                  <div className="text-[8px] font-bold font-mono">{opts.sealDiameter}</div>
                  <div className="text-[7px] text-rose-700 bg-white/80 px-1 rounded mt-0.5 font-bold">
                    骑年盖月
                  </div>
                </div>
              </div>

              {/* Date & Name Line */}
              <div className="text-right text-[11px] font-mono text-slate-600 pr-2">
                ນະຄອນຫຼວງວຽງຈັນ, ວັນທີ 12/05/2026
              </div>

              <div className="text-xs font-bold text-slate-900 mt-2">
                {opts.signatoryName}
              </div>

              {/* Dimension callouts */}
              <div className="absolute -left-36 top-1/2 -translate-y-1/2 text-left text-[10px] text-rose-700 space-y-1 border-l-2 border-rose-500 pl-2">
                <div className="font-bold">公章规范指标：</div>
                <div>• 直径：{opts.sealDiameter}</div>
                <div>• 覆盖：{opts.sealOverlap}</div>
                <div>• 墨色：正红印油，字迹清晰</div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 4. Official Document Workflow & Flowchart Viewer
 * 100% faithful reproduction of official designation procedure and technical workflows
 * Supports: Rounded start/end pills, process rectangles, true decision diamonds,
 * dual-branch conditional routing ([Yes] / [No]), corrective loopback boxes, and footnotes.
 */
export interface FlowchartStep {
  id: string;
  stepNumber?: number;
  name: string;
  desc?: string;
  role?: string;
  condition?: string;
  type?: 'start' | 'process' | 'decision' | 'end';
  noBranchAction?: string;
  noLoopBackTo?: number | string;
  yesBranchAction?: string;
  yesNextStep?: number | string;
}

export interface OfficialFlowchartOptions {
  title?: string;
  caption?: string;
  notes?: string;
  isDesignationProcedure?: boolean;
  steps: FlowchartStep[];
}

/**
 * Strictly identifies whether a flowchart block is the ASEAN EE MRA designation procedure.
 * Avoids false triggers from isolated technical keywords (e.g. CAB, DB, COD, 合格评定, Designation).
 */
export function isAseanDesignationProcedure(_content: string): boolean {
  // Kept for API compatibility. No content is routed to a domain-specific template.
  return false;
}

export function parseFlowchartBlock(content: string): OfficialFlowchartOptions {
  const opts: OfficialFlowchartOptions = {
    title: 'Flowchart', caption: '', notes: '', isDesignationProcedure: false, steps: []
  };
  const lines = (content || '').split(/\r?\n/);
  let inSteps = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const title = line.match(/^title\s*:\s*(.*)$/i);
    const caption = line.match(/^caption\s*:\s*(.*)$/i);
    const notes = line.match(/^notes?\s*:\s*(.*)$/i);
    if (title) { opts.title = title[1].trim(); continue; }
    if (caption) { opts.caption = caption[1].trim(); continue; }
    if (notes) { opts.notes = notes[1].trim(); continue; }
    if (/^(steps|flow|nodes)\s*:/i.test(line)) { inSteps = true; continue; }
    if (!inSteps && !/^[-*]\s+/.test(line) && !/^\d+[.、)]\s*/.test(line)) continue;
    const clean = line.replace(/^[-*]\s*/, '').trim();
    const numbered = clean.match(/^(\d+)[.、)]\s*(.*)$/);
    const stepNumber = numbered ? Number(numbered[1]) : opts.steps.length + 1;
    let text = (numbered ? numbered[2] : clean).trim();
    const branchParts = text.split(/\s*\|\s*(?=\[(?:yes|no|是|否)\])/i);
    const branchData: Record<string, string> = {};
    for (const part of branchParts) {
      const m = part.match(/^\[(yes|no|是|否)[^\]]*\]\s*(?:->|→)?\s*(.*)$/i);
      if (m) branchData[/^(yes|是)$/i.test(m[1]) ? 'yes' : 'no'] = m[2].trim();
    }
    text = text.replace(/\s*\[(?:yes|no|是|否)[^\]]*\]\s*(?:->|→)?\s*[^|]*/ig, '').trim();
    const loopTarget = (value: string | undefined) => {
      if (!value) return undefined;
      const m = value.match(/(?:->|→|返回|回至|回到)\s*(?:步骤|step)?\s*(\d+|[A-Za-z][\w-]*)/i);
      return m ? (/^\d+$/.test(m[1]) ? Number(m[1]) : m[1]) : undefined;
    };
    const actionWithoutLoop = (value: string | undefined) => value
      ? value.replace(/\s*(?:->|→|返回|回至|回到)\s*(?:步骤|step)?\s*(?:\d+|[A-Za-z][\w-]*)/i, '').trim()
      : '';
    const isDecision = /[?？]|\b(?:decision|yes\/no|true\/false)\b|是否|是否满足|是否通过|是否符合/i.test(text);
    const isStart = /^(start|begin|开始|起点)\b/i.test(text);
    const isEnd = /^(end|finish|stop|结束|终点)\b/i.test(text);
    opts.steps.push({
      id: `node-${stepNumber}-${opts.steps.length}`, stepNumber,
      name: text, type: isStart ? 'start' : isEnd ? 'end' : isDecision ? 'decision' : 'process',
      noBranchAction: actionWithoutLoop(branchData.no), noLoopBackTo: loopTarget(branchData.no),
      yesBranchAction: actionWithoutLoop(branchData.yes), yesNextStep: loopTarget(branchData.yes)
    });
  }
  return opts;
}

export const OfficialFlowchartViewer: React.FC<{ content: string }> = ({ content }) => {
  const opts = parseFlowchartBlock(content);
  const isDesignation = Boolean(opts.isDesignationProcedure);

  return (
    <div className="my-8 border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-md font-sans select-none">
      {/* Header Banner */}
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg border border-teal-500/30">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold tracking-wide text-white">
              {opts.title}
            </h4>
            <div className="text-xs text-slate-300">
              程序与业务流转 • 判定菱形与分支回路 100% 高保真复现
            </div>
          </div>
        </div>
        <span className="text-xs bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1 rounded-full font-bold">
          100% 结构保真流程图
        </span>
      </div>

      {/* Main Flowchart Canvas */}
      <div className="p-6 sm:p-8 bg-slate-50/60 overflow-x-auto flex justify-center">
        {isDesignation ? (
          /* Faithful Two-Column / Branched Diagram Reproduction */
          <div className="w-full max-w-[780px] bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs relative">
            <div className="flex flex-col items-center">
              {opts.steps.map((step, idx) => {
                const stepNum = step.stepNumber || (idx + 1);
                const isStart = step.type === 'start' || idx === 0;
                const isEnd = step.type === 'end' || idx === opts.steps.length - 1;
                const isDecision = step.type === 'decision';

                return (
                  <React.Fragment key={step.id || idx}>
                    {/* Step Row */}
                    <div className="w-full relative flex items-center justify-center my-1.5">
                      {/* Left: Optional Step 6 Loopback indicator */}
                      {stepNum === 6 && (
                        <div className="absolute left-2 sm:left-6 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-md shadow-2xs">
                          <span className="font-bold">[No / 否]</span>
                          <span>↺ 返回步骤5</span>
                        </div>
                      )}

                      {/* Center Node */}
                      {isStart || isEnd ? (
                        /* Stadium / Pill Shape */
                        <div className={`px-8 py-2.5 rounded-full border-2 font-bold text-sm shadow-xs flex items-center gap-2 ${
                          isStart 
                            ? 'bg-blue-600 text-white border-blue-700' 
                            : 'bg-emerald-600 text-white border-emerald-700'
                        }`}>
                          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-mono">
                            {isStart ? 'S' : 'E'}
                          </span>
                          <span>{step.name}</span>
                        </div>
                      ) : isDecision ? (
                        /* True Rhombus / Decision Diamond */
                        <div className="relative flex items-center justify-center my-2">
                          {/* Rotated Diamond */}
                          <div className="w-48 h-24 sm:w-56 sm:h-28 bg-amber-50 border-2 border-amber-500 rounded-xl shadow-xs transform rotate-45 flex items-center justify-center transition-transform hover:scale-105" />
                          
                          {/* Inner Content (Counter-rotated upright text) */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
                            <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold font-mono shadow-xs mb-0.5">
                              {stepNum}
                            </span>
                            <div className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug whitespace-pre-line">
                              {step.name}
                            </div>
                          </div>

                          {/* Right Branch for Decision (e.g. Step 3 & Step 4) */}
                          {step.noBranchAction && (
                            <div className="absolute left-[calc(50%+6.5rem)] sm:left-[calc(50%+7.5rem)] flex items-center">
                              {/* Horizontal connector line with [No] label */}
                              <div className="flex items-center">
                                <div className="h-0.5 w-6 sm:w-10 bg-amber-500 relative">
                                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded whitespace-nowrap">
                                    [No / 否]
                                  </div>
                                </div>
                                <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-amber-600" />
                              </div>

                              {/* Right Corrective Action Box */}
                              <div className="relative ml-1 w-44 sm:w-52 p-2.5 bg-rose-50 border-2 border-rose-400 rounded-lg shadow-xs text-left">
                                <div className="text-xs font-bold text-slate-900 leading-tight">
                                  {step.noBranchAction}
                                </div>
                                
                                {/* Upward Loopback Indicator */}
                                <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-700 font-bold">
                                  <span>↺ 纠正后返回步骤{step.noLoopBackTo || stepNum}</span>
                                </div>

                                {/* Decorative Curved Arrow Path back to top of diamond */}
                                <div className="hidden sm:block absolute -top-5 right-1/2 w-28 h-6 border-t-2 border-l-2 border-rose-400 rounded-tl-lg pointer-events-none" />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Standard Process Rectangle */
                        <div className="w-full max-w-[420px] p-3 sm:p-3.5 bg-slate-50 border-2 border-slate-300 rounded-lg shadow-xs flex items-center gap-3 transition-shadow hover:shadow-sm">
                          <span className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-xs">
                            {stepNum}
                          </span>
                          <div className="text-xs sm:text-sm font-bold text-slate-800 whitespace-pre-line leading-relaxed text-left flex-1">
                            {step.name}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Downward Connector Arrow */}
                    {idx < opts.steps.length - 1 && (
                      <div className="flex flex-col items-center my-0.5 relative">
                        {isDecision && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded mb-0.5 shadow-2xs">
                            [Yes / 是]
                          </span>
                        )}
                        <div className="w-0.5 h-4 bg-slate-400" />
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-600" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          /* Generic Linear Flowchart */
          <div className="w-full max-w-[620px] bg-white border border-slate-300 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col gap-3">
              {opts.steps.map((step, idx) => {
                const isStart = step.type === 'start' || idx === 0;
                const isEnd = step.type === 'end' || idx === opts.steps.length - 1;
                const isDecision = step.type === 'decision';

                return (
                  <React.Fragment key={step.id || idx}>
                    <div className={`p-3.5 rounded-lg border-2 flex items-center justify-between gap-3 shadow-2xs ${
                      isStart 
                        ? 'border-blue-400 bg-blue-50/50' 
                        : isEnd 
                        ? 'border-teal-400 bg-teal-50/50' 
                        : isDecision 
                        ? 'border-amber-400 bg-amber-50/50' 
                        : 'border-slate-300 bg-slate-50/70'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0 shadow-xs text-white ${
                          isStart ? 'bg-blue-600' : isEnd ? 'bg-teal-600' : isDecision ? 'bg-amber-600' : 'bg-slate-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {step.name}
                          </div>
                          {step.desc && (
                            <div className="text-xs text-slate-600 mt-0.5">
                              {step.desc}
                            </div>
                          )}
                          {step.noBranchAction && (
                            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mt-1 inline-flex items-center gap-1.5 font-medium">
                              <span className="font-bold text-amber-900">[否 / No]:</span>
                              <span>{step.noBranchAction}</span>
                              {step.noLoopBackTo && (
                                <span className="text-amber-700 font-mono text-[11px]">↺ 返回步骤{step.noLoopBackTo}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 uppercase shrink-0">
                        {isStart ? '起始节点' : isEnd ? '结束' : isDecision ? '审查判定' : '流转步骤'}
                      </span>
                    </div>

                    {idx < opts.steps.length - 1 && (
                      <div className="flex flex-col items-center my-0.5">
                        <div className="w-0.5 h-3 bg-slate-400" />
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-500" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Caption & Footnotes */}
      <div className="p-4 bg-white border-t border-slate-200 text-center space-y-1.5">
        <div className="text-xs font-bold text-slate-900 tracking-wide">
          {opts.caption}
        </div>
        {opts.notes && (
          <div className="text-[11px] text-slate-600 font-sans bg-slate-50 py-1 px-3 rounded-md border border-slate-200 inline-block">
            {opts.notes}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 5. Official Dimension & Marking Lines Viewer
 * Renders technical dimension callouts, leader lines, and measurement indicators
 */
export interface DimensionItem {
  label: string;
  value: string;
  notes?: string;
}

export interface OfficialDimensionOptions {
  title?: string;
  caption?: string;
  notes?: string;
  dimensions: DimensionItem[];
}

export function parseDimensionBlock(content: string): OfficialDimensionOptions {
  const opts: OfficialDimensionOptions = {
    title: "公文各要素排版尺寸界线与标注标尺图 (Dimension & Margin Guide)",
    caption: "图示：老挝国家公文尺寸界线、行距与字符留白相对位置标注",
    notes: "所有尺寸标记均依据国家标准，毫米级基准执行",
    dimensions: []
  };

  const lines = (content || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('title:')) opts.title = trimmed.replace('title:', '').trim();
    else if (trimmed.startsWith('caption:')) opts.caption = trimmed.replace('caption:', '').trim();
    else if (trimmed.startsWith('notes:') || trimmed.startsWith('note:')) opts.notes = trimmed.replace(/notes?:/, '').trim();
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const clean = trimmed.replace(/^[-*]\s*/, '').trim();
      const [lbl, val, ...rest] = clean.split(/[:=：]/);
      if (lbl && val) {
        opts.dimensions.push({
          label: lbl.trim(),
          value: val.trim(),
          notes: rest.join(':').trim()
        });
      }
    }
  }

  if (opts.dimensions.length === 0) {
    opts.dimensions = [
      { label: "纸张标准规格", value: "210 mm × 297 mm", notes: "国际标准 A4 规格" },
      { label: "左侧装订线边距", value: "30 mm (3.0 cm)", notes: "预留装订打孔" },
      { label: "顶部页边距", value: "25 mm (2.5 cm)", notes: "上裁切安全距离" },
      { label: "右侧页边距", value: "20 mm (2.0 cm)", notes: "右裁切安全距离" },
      { label: "底部页边距", value: "20 mm (2.0 cm)", notes: "下裁切与页码区" },
      { label: "正文标准行间距", value: "1.15 倍行距", notes: "单行单列排版" },
      { label: "印章标称直径", value: "Ø 40 mm", notes: "红色正圆印油" }
    ];
  }

  return opts;
}

export const OfficialDimensionViewer: React.FC<{ content: string }> = ({ content }) => {
  const opts = parseDimensionBlock(content);

  return (
    <div className="my-6 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs font-sans select-none">
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Compass className="w-5 h-5 text-teal-400" />
          <div>
            <h4 className="text-sm font-bold tracking-wide">{opts.title}</h4>
            <div className="text-[10px] text-slate-300">尺寸指标复查 • 标尺与公差界线对照</div>
          </div>
        </div>
        <span className="text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-0.5 rounded-full font-bold">
          尺寸标注图
        </span>
      </div>

      <div className="p-6 bg-slate-100 flex flex-col items-center">
        <div className="w-full max-w-[580px] bg-white border border-slate-300 rounded-lg p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {opts.dimensions.map((dim, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded flex flex-col justify-between hover:border-teal-400 transition-colors">
                <div className="text-xs text-slate-500 font-medium">{dim.label}</div>
                <div className="text-base font-extrabold text-teal-700 font-mono my-1">
                  {dim.value}
                </div>
                {dim.notes && (
                  <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1 mt-1">
                    {dim.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 bg-white border-t border-slate-200 text-center space-y-1">
        <div className="text-xs font-bold text-slate-900 font-sans tracking-wide">
          {opts.caption}
        </div>
        {opts.notes && (
          <div className="text-[11px] text-slate-500 font-sans">
            注：{opts.notes}
          </div>
        )}
      </div>
    </div>
  );
};

