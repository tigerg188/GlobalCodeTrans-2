import React from 'react';
import { Activity, Wind, FileText, Compass } from 'lucide-react';
import { UniversalSvgViewer } from './UniversalSvgViewer';
import { 
  OfficialDocMarginViewer, 
  OfficialHeaderGridViewer, 
  OfficialSignatureSealViewer, 
  OfficialFlowchartViewer 
} from './OfficialDocLayoutComponents';

export interface ResponseSpectrumParams {
  title?: string;
  T0?: number;
  Ts?: number;
  TL?: number;
  SDS?: number;
  SD1?: number;
  notes?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  caption?: string;
}

export function parseSpectrumBlock(content: string): ResponseSpectrumParams {
  const params: ResponseSpectrumParams = {
    title: "设计加速度反应谱曲线 (Design Response Spectrum)",
    T0: 0.08,
    Ts: 0.40,
    TL: 8.0,
    SDS: 1.05,
    SD1: 0.42,
    notes: "依据 ASCE 7-16 第 11.4.6 节 / IBC 2006 规定计算复现",
    xAxisLabel: "结构自振周期 T (s)",
    yAxisLabel: "设计加速度反应谱 Sa (g)",
    caption: "图 6.1 设计加速度反应谱曲线 (Design Response Spectrum) • 依据 ASCE 7-16 / IBC 标准",
  };

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('title:')) {
      params.title = trimmed.replace('title:', '').trim();
    } else if (trimmed.startsWith('notes:') || trimmed.startsWith('note:')) {
      params.notes = trimmed.replace(/notes?:/, '').trim();
    } else if (trimmed.startsWith('xAxis:')) {
      params.xAxisLabel = trimmed.replace('xAxis:', '').trim();
    } else if (trimmed.startsWith('yAxis:')) {
      params.yAxisLabel = trimmed.replace('yAxis:', '').trim();
    } else if (trimmed.startsWith('caption:')) {
      params.caption = trimmed.replace('caption:', '').trim();
    } else if (trimmed.startsWith('parameters:') || trimmed.includes('T0') || trimmed.includes('SDS')) {
      const t0Match = trimmed.match(/T_?0\s*=\s*([0-9\.]+)/i);
      const tsMatch = trimmed.match(/T_?s\s*=\s*([0-9\.]+)/i);
      const tlMatch = trimmed.match(/T_?L\s*=\s*([0-9\.]+)/i);
      const sdsMatch = trimmed.match(/S_?\{?DS\}?\s*=\s*([0-9\.]+)/i);
      const sd1Match = trimmed.match(/S_?\{?D1\}?\s*=\s*([0-9\.]+)/i);

      if (t0Match) params.T0 = parseFloat(t0Match[1]);
      if (tsMatch) params.Ts = parseFloat(tsMatch[1]);
      if (tlMatch) params.TL = parseFloat(tlMatch[1]);
      if (sdsMatch) params.SDS = parseFloat(sdsMatch[1]);
      if (sd1Match) params.SD1 = parseFloat(sd1Match[1]);
    }
  }

  return params;
}

export const ResponseSpectrumChart: React.FC<{ content: string }> = ({ content }) => {
  const params = parseSpectrumBlock(content);

  const T0 = params.T0 || 0.08;
  const Ts = params.Ts || 0.40;
  const SDS = params.SDS || 1.05;
  const SD1 = params.SD1 || 0.42;
  const TL = params.TL || 8.0;

  // Chart dimensions in SVG coordinates
  const svgWidth = 620;
  const svgHeight = 330;
  const padding = { top: 40, right: 35, bottom: 65, left: 75 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Scale mapping (X: T from 0 to 3.6s, Y: Sa from 0 to 1.35 * SDS)
  const maxT = 3.6;
  const maxSa = SDS * 1.35;

  const toSvgX = (t: number) => padding.left + (t / maxT) * graphWidth;
  const toSvgY = (sa: number) => padding.top + graphHeight - (sa / maxSa) * graphHeight;

  // Generate curve path points
  const points: { x: number; y: number }[] = [];
  const step = 0.02;
  for (let t = 0; t <= maxT; t += step) {
    let sa = 0;
    if (t < T0) {
      sa = SDS * (0.4 + 0.6 * (t / T0));
    } else if (t <= Ts) {
      sa = SDS;
    } else if (t <= 2.8) {
      sa = SD1 / t;
    } else {
      sa = (SD1 * 2.8) / (t * t);
    }
    points.push({ x: toSvgX(t), y: toSvgY(sa) });
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`;

  const ySDS = toSvgY(SDS);
  const ySD1 = toSvgY(SD1);
  const xT0 = toSvgX(T0);
  const xTs = toSvgX(Ts);
  const xOneSec = toSvgX(1.0);
  const xTL = toSvgX(2.8);

  return (
    <div className="my-6 border border-slate-300 rounded-xl bg-white p-5 shadow-xs font-serif text-slate-900 select-none">
      {/* Top Banner: Publication Grade Indicator */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-bold text-slate-800 font-sans tracking-tight">
            {params.title}
          </h4>
        </div>
        <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono font-medium">
          ASCE 7-16 / IBC 2006
        </span>
      </div>

      {/* SVG Canvas - Pure White Publication Grade */}
      <div className="flex justify-center bg-white py-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-[580px] h-auto"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Soft Royal Blue Area Fill Gradient */}
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
            {/* Subtle Filter for Callout Badges */}
            <filter id="badgeShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Background Grid Lines (Engineering Millimeter Paper Simulation) */}
          {[0.2, 0.4, 0.6, 0.8, 1.0, 1.2].map((frac) => {
            const val = frac * SDS;
            if (val > maxSa) return null;
            const y = toSvgY(val);
            return (
              <line
                key={`grid-y-${frac}`}
                x1={padding.left}
                y1={y}
                x2={padding.left + graphWidth}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            );
          })}
          {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((t) => {
            const x = toSvgX(t);
            return (
              <line
                key={`grid-x-${t}`}
                x1={x}
                y1={padding.top}
                x2={x}
                y2={padding.top + graphHeight}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            );
          })}

          {/* Coordinate Axes with Crisp Arrowheads */}
          {/* Y Axis */}
          <line
            x1={padding.left}
            y1={padding.top + graphHeight}
            x2={padding.left}
            y2={padding.top - 15}
            stroke="#334155"
            strokeWidth="1.8"
          />
          <polygon
            points={`${padding.left - 4},${padding.top - 12} ${padding.left},${padding.top - 24} ${padding.left + 4},${padding.top - 12}`}
            fill="#334155"
          />

          {/* X Axis */}
          <line
            x1={padding.left}
            y1={padding.top + graphHeight}
            x2={padding.left + graphWidth + 20}
            y2={padding.top + graphHeight}
            stroke="#334155"
            strokeWidth="1.8"
          />
          <polygon
            points={`${padding.left + graphWidth + 17},${padding.top + graphHeight - 4} ${padding.left + graphWidth + 28},${padding.top + graphHeight} ${padding.left + graphWidth + 17},${padding.top + graphHeight + 4}`}
            fill="#334155"
          />

          {/* Axis Labels */}
          <text
            x={padding.left + graphWidth / 2}
            y={padding.top + graphHeight + 36}
            textAnchor="middle"
            fill="#1e293b"
            fontSize="12"
            fontWeight="bold"
            fontFamily="'Cambria Math', 'Times New Roman', 'SimSun', serif"
          >
            结构自振周期 T (s)  /  Period, T (sec)
          </text>
          <text
            transform={`rotate(-90) translate(-${padding.top + graphHeight / 2}, 22)`}
            textAnchor="middle"
            fill="#1e293b"
            fontSize="12"
            fontWeight="bold"
            fontFamily="'Cambria Math', 'Times New Roman', 'SimSun', serif"
          >
            设计加速度反应谱 Sa (g)  /  Spectral Acceleration Sa (g)
          </text>

          {/* Dashed Coordinate Guidelines */}
          {/* Plateau Horizontal guideline for SDS (Vibrant Amber) */}
          <line
            x1={padding.left}
            y1={ySDS}
            x2={xTs}
            y2={ySDS}
            stroke="#f59e0b"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          {/* Horizontal guideline for SD1 (at 1.0s) */}
          <line
            x1={padding.left}
            y1={ySD1}
            x2={xOneSec}
            y2={ySD1}
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />

          {/* Vertical guidelines */}
          <line
            x1={xT0}
            y1={padding.top + graphHeight}
            x2={xT0}
            y2={ySDS}
            stroke="#f59e0b"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          <line
            x1={xTs}
            y1={padding.top + graphHeight}
            x2={xTs}
            y2={ySDS}
            stroke="#f59e0b"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          <line
            x1={xOneSec}
            y1={padding.top + graphHeight}
            x2={xOneSec}
            y2={ySD1}
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          <line
            x1={xTL}
            y1={padding.top + graphHeight}
            x2={xTL}
            y2={toSvgY(SD1 / 2.8)}
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />

          {/* Ticks and Subscript Marks on Axes */}
          <text x={padding.left - 6} y={padding.top + graphHeight + 14} textAnchor="end" fill="#334155" fontSize="11" fontFamily="'Cambria Math', serif">0</text>
          <text x={xT0} y={padding.top + graphHeight + 14} textAnchor="middle" fill="#b45309" fontSize="11" fontStyle="italic" fontWeight="bold" fontFamily="'Cambria Math', serif">T₀</text>
          <text x={xTs} y={padding.top + graphHeight + 14} textAnchor="middle" fill="#b45309" fontSize="11" fontStyle="italic" fontWeight="bold" fontFamily="'Cambria Math', serif">Ts</text>
          <text x={xOneSec} y={padding.top + graphHeight + 14} textAnchor="middle" fill="#334155" fontSize="11" fontFamily="'Cambria Math', serif">1.0</text>
          <text x={xTL} y={padding.top + graphHeight + 14} textAnchor="middle" fill="#334155" fontSize="11" fontStyle="italic" fontFamily="'Cambria Math', serif">TL</text>

          <text x={padding.left - 8} y={ySDS + 4} textAnchor="end" fill="#b45309" fontSize="11" fontStyle="italic" fontWeight="bold" fontFamily="'Cambria Math', serif">SDS</text>
          <text x={padding.left - 8} y={ySD1 + 4} textAnchor="end" fill="#334155" fontSize="11" fontStyle="italic" fontFamily="'Cambria Math', serif">SD1</text>

          {/* Area Fill Gradient under Curve */}
          <path d={areaD} fill="url(#curveGradient)" />

          {/* Vivid Royal Blue Response Spectrum Curve */}
          <path
            d={pathD}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Key Milestone Dots on the Curve */}
          <circle cx={xT0} cy={ySDS} r="3.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
          <circle cx={xTs} cy={ySDS} r="3.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
          <circle cx={xOneSec} cy={ySD1} r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.8" />
          <circle cx={xTL} cy={toSvgY(SD1 / 2.8)} r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.8" />

          {/* Formula Annotations on Branches with White Pill Badges */}
          {/* Plateau Badge: Sa = SDS */}
          <g transform={`translate(${(xT0 + xTs) / 2}, ${ySDS - 18})`}>
            <rect x="-42" y="-12" width="84" height="22" rx="4" fill="#ffffff" stroke="#93c5fd" strokeWidth="1" filter="url(#badgeShadow)" />
            <text x="0" y="3" textAnchor="middle" fill="#1e40af" fontSize="11" fontStyle="italic" fontWeight="bold" fontFamily="'Cambria Math', serif">
              Sa = SDS
            </text>
          </g>

          {/* Branch 3: Sa = SD1 / T with leader line */}
          <line
            x1={toSvgX(1.7) + 8}
            y1={toSvgY(SD1 / 1.7) - 3}
            x2={toSvgX(1.7) + 40}
            y2={toSvgY(SD1 / 1.7) - 22}
            stroke="#3b82f6"
            strokeWidth="1.2"
          />
          <g transform={`translate(${toSvgX(1.7) + 85}, ${toSvgY(SD1 / 1.7) - 25})`}>
            <rect x="-48" y="-12" width="96" height="22" rx="4" fill="#ffffff" stroke="#93c5fd" strokeWidth="1" filter="url(#badgeShadow)" />
            <text x="0" y="3" textAnchor="middle" fill="#1e40af" fontSize="11" fontStyle="italic" fontWeight="bold" fontFamily="'Cambria Math', serif">
              Sa = SD1 / T
            </text>
          </g>

          {/* Branch 4: Sa = (SD1 · TL) / T² with leader line */}
          <line
            x1={toSvgX(3.1) + 6}
            y1={toSvgY((SD1 * 2.8) / (3.1 * 3.1)) - 3}
            x2={toSvgX(3.1) + 38}
            y2={toSvgY((SD1 * 2.8) / (3.1 * 3.1)) - 22}
            stroke="#3b82f6"
            strokeWidth="1.2"
          />
          <g transform={`translate(${toSvgX(3.1) + 88}, ${toSvgY((SD1 * 2.8) / (3.1 * 3.1)) - 25})`}>
            <rect x="-60" y="-12" width="120" height="22" rx="4" fill="#ffffff" stroke="#93c5fd" strokeWidth="1" filter="url(#badgeShadow)" />
            <text x="0" y="3" textAnchor="middle" fill="#1e40af" fontSize="11" fontStyle="italic" fontWeight="bold" fontFamily="'Cambria Math', serif">
              Sa = (SD1 · TL) / T²
            </text>
          </g>
        </svg>
      </div>

      {/* Numerical Parameters Badge Bar */}
      <div className="mt-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono text-slate-700">
        <div>拐点参数: <span className="text-amber-700 font-bold">T₀ = {T0} s</span>, <span className="text-amber-700 font-bold">Ts = {Ts} s</span>, <span className="text-slate-800">TL = {TL} s</span></div>
        <div>谱加速度: <span className="text-blue-700 font-bold">SDS = {SDS} g</span>, <span className="text-blue-700 font-bold">SD1 = {SD1} g</span></div>
      </div>

      {/* Official Centered Document Caption */}
      <div className="text-center mt-3 pt-2 border-t border-slate-200">
        <div className="text-xs font-bold text-slate-900 font-sans tracking-wide">
          {params.caption || '图 6.1 设计加速度反应谱曲线 (Design Response Spectrum) • 依据 ASCE 7-16 / IBC 标准'}
        </div>
      </div>
    </div>
  );
};

import { parseWindBlock, parseDiagramBlock } from '../utils/chartImageGenerator';
import katex from 'katex';

export const WindPressureChart: React.FC<{ content: string }> = ({ content }) => {
  const params = parseWindBlock(content);
  const H = params.height || 60;
  const V = params.V || 45;
  const Cp_wind = params.Cp_wind ?? 0.8;
  const Cp_lee = params.Cp_lee ?? -0.5;

  return (
    <div className="my-5 border border-slate-300 rounded-xl overflow-hidden bg-white text-slate-900 shadow-xs font-sans select-none">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-teal-600" />
          <h4 className="text-sm font-bold text-slate-800 tracking-tight">
            {params.title}
          </h4>
          <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded font-mono font-medium">
            ASCE 7-16 / MWFRS
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-600">
          风速 V = <span className="font-bold text-teal-700">{V} m/s</span>
        </div>
      </div>

      {/* Pure White Background SVG */}
      <div className="p-4 bg-white flex justify-center">
        <svg viewBox="0 0 560 260" className="w-full max-w-[540px] h-auto select-none">
          {/* Ground Line */}
          <line x1="40" y1="210" x2="520" y2="210" stroke="#64748b" strokeWidth="2" />
          <text x="50" y="226" fill="#64748b" fontSize="10">地面标高 (z = 0m)</text>

          {/* Building Slab Outline (Light slate with blue border) */}
          <rect x="220" y="40" width="120" height="170" fill="#f8fafc" stroke="#1e40af" strokeWidth="2" />
          <text x="280" y="130" textAnchor="middle" fill="#1e3a8a" fontSize="11" fontWeight="bold">
            主体建筑结构 (H = {H}m)
          </text>

          {/* Windward Pressure Profile (Curved Parabola) */}
          <path
            d="M 120 210 Q 150 120 180 40 L 220 40 L 220 210 Z"
            fill="rgba(13, 148, 136, 0.16)"
            stroke="#0d9488"
            strokeWidth="2.2"
          />
          {/* Pressure arrows */}
          {[60, 100, 140, 180].map((y) => (
            <g key={`arrow-${y}`}>
              <line x1="80" y1={y} x2={y > 100 ? "170" : "195"} y2={y} stroke="#0d9488" strokeWidth="1.6" />
              <polygon
                points={`${y > 100 ? 170 : 195},${y} ${y > 100 ? 164 : 189},${y - 3} ${y > 100 ? 164 : 189},${y + 3}`}
                fill="#0d9488"
              />
            </g>
          ))}
          <text x="140" y="28" textAnchor="middle" fill="#0d9488" fontSize="11" fontWeight="bold">
            迎风面风压 (qz · G · Cp, 正压 Cp = +{Cp_wind})
          </text>

          {/* Leeward Suction Profile (Constant) */}
          <rect x="340" y="40" width="55" height="170" fill="rgba(217, 119, 6, 0.16)" stroke="#d97706" strokeWidth="2" />
          {[60, 100, 140, 180].map((y) => (
            <g key={`lee-arrow-${y}`}>
              <line x1="340" y1={y} x2="415" y2={y} stroke="#d97706" strokeWidth="1.6" />
              <polygon
                points={`415,${y} 409,${y - 3} 409,${y + 3}`}
                fill="#d97706"
              />
            </g>
          ))}
          <text x="368" y="28" textAnchor="middle" fill="#d97706" fontSize="11" fontWeight="bold">
            背风面吸力 (qh · G · Cp, 负压 Cp = {Cp_lee})
          </text>

          {/* Dimension arrows on left */}
          <line x1="210" y1="40" x2="210" y2="210" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
          <text x="205" y="45" textAnchor="end" fill="#64748b" fontSize="10" fontStyle="italic">z = h = {H}m</text>
        </svg>
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between flex-wrap gap-2 font-mono">
        <div>计算式: <span className="text-teal-700 font-bold">{params.formulas?.[0] || 'qz = 0.613 · Kz · Kzt · Kd · Ke · V² (N/m²)'}</span></div>
        <div>迎风面: <span className="text-teal-700 font-bold">Cp = +{Cp_wind}</span>，背风面: <span className="text-amber-700 font-bold">Cp = {Cp_lee}</span></div>
      </div>

      <div className="text-center py-2 border-t border-slate-100 text-xs font-bold text-slate-800">
        {params.caption}
      </div>
    </div>
  );
};

export const EngineeringDiagramViewer: React.FC<{ content: string }> = ({ content }) => {
  // 1. If content contains raw SVG, delegate to UniversalSvgViewer
  if (content && (content.includes('<svg') || content.trim().startsWith('<?xml'))) {
    return <UniversalSvgViewer content={content} />;
  }

  // 2. If content describes official margin/spec-sheet, delegate to OfficialDocMarginViewer
  if (content && (content.includes('marginLeft') || content.includes('margins:') || content.includes('装订') || content.includes('bindingWidth'))) {
    return <OfficialDocMarginViewer content={content} />;
  }

  // 3. If content describes official letterhead/grid, delegate to OfficialHeaderGridViewer
  if (content && (content.includes('countryName') || content.includes('ministry') || content.includes('motto:'))) {
    return <OfficialHeaderGridViewer content={content} />;
  }

  // 4. If content describes official seal/signature, delegate to OfficialSignatureSealViewer
  if (content && (content.includes('sealDiameter') || content.includes('signatory') || content.includes('骑年盖月'))) {
    return <OfficialSignatureSealViewer content={content} />;
  }

  // 5. If content describes flowcharts or workflow steps, delegate to OfficialFlowchartViewer
  if (content && (content.includes('steps:') || content.includes('flow:') || content.includes('->') || content.includes('→'))) {
    return <OfficialFlowchartViewer content={content} />;
  }

  const opts = parseDiagramBlock(content);

  return (
    <div className="my-6 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs font-serif text-slate-900 select-none">
      {/* Top Banner */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2 font-sans">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-teal-400" />
          <h4 className="text-sm font-bold tracking-tight">
            {opts.title}
          </h4>
        </div>
        <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded font-mono font-medium">
          1:1 几何图样与标注复现
        </span>
      </div>

      {/* Top Formulas Callout Banner (Above Diagram) */}
      {opts.formulas && opts.formulas.length > 0 && (
        <div className="px-5 py-3 bg-teal-50/60 border-b border-teal-200/80 font-sans">
          <div className="text-[11px] font-bold text-teal-900 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <span>【图形上方计算公式与技术推导】</span>
          </div>
          <div className="space-y-1.5">
            {opts.formulas.map((formStr, i) => {
              try {
                const latex = formStr.replace(/\$\$/g, '').trim();
                const rendered = katex.renderToString(latex, { displayMode: true, throwOnError: false });
                return (
                  <div
                    key={`form-${i}`}
                    className="py-1 px-3 bg-white rounded border border-teal-200/60 text-slate-900 text-center shadow-2xs overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: rendered }}
                  />
                );
              } catch {
                return (
                  <div key={`form-${i}`} className="py-1 px-3 bg-white rounded border border-teal-200/60 text-slate-800 text-center font-mono text-xs">
                    $${formStr}$$
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* Adaptive Vector Schematic Drawing Canvas */}
      <div className="p-6 bg-slate-50/60 flex justify-center">
        <div className="w-full max-w-[560px] bg-white border border-slate-300 rounded p-4 shadow-sm">
          <svg viewBox="0 0 540 240" className="w-full h-auto select-none">
            <defs>
              <marker id="dim-arrow-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 10 1 L 0 5 L 10 9 z" fill="#0d9488" />
              </marker>
              <marker id="dim-arrow-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#0d9488" />
              </marker>
              <pattern id="diag-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Grid Background */}
            <rect x="20" y="20" width="500" height="200" fill="url(#diag-grid)" stroke="#cbd5e1" strokeWidth="1.5" rx="3" />

            {/* Coordinate / Center Reference Guidelines */}
            <line x1="20" y1="120" x2="520" y2="120" stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="4 4" />
            <line x1="270" y1="20" x2="270" y2="220" stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="4 4" />

            {/* Dimension Lines (Top & Left) */}
            <line x1="70" y1="45" x2="470" y2="45" stroke="#0d9488" strokeWidth="1.4" markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
            <rect x="235" y="36" width="70" height="16" fill="#ffffff" stroke="#99f6e4" rx="2" />
            <text x="270" y="48" textAnchor="middle" fill="#0f766e" fontSize="9" fontWeight="bold" fontFamily="monospace">基准跨度 L</text>

            {/* Central Schematic Framing Box */}
            <rect x="70" y="65" width="400" height="110" fill="#f8fafc" stroke="#334155" strokeWidth="1.8" rx="2" />
            
            {/* Inner Details / Annotations */}
            <g transform="translate(90, 85)">
              <text x="0" y="15" fill="#0f172a" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                {opts.title}
              </text>
              <line x1="0" y1="25" x2="360" y2="25" stroke="#cbd5e1" strokeWidth="1" />

              {/* Dynamic Annotation Callout Bullets */}
              {opts.annotations && opts.annotations.length > 0 ? (
                opts.annotations.slice(0, 4).map((ann, idx) => (
                  <g key={`callout-${idx}`} transform={`translate(0, ${42 + idx * 18})`}>
                    <circle cx="4" cy="-4" r="3" fill="#0d9488" />
                    <text x="14" y="0" fill="#334155" fontSize="10" fontFamily="sans-serif">
                      {ann}
                    </text>
                  </g>
                ))
              ) : (
                <g transform="translate(0, 42)">
                  <text x="0" y="0" fill="#64748b" fontSize="10" fontFamily="sans-serif">
                    • 构造节点特征与参数指标依条文规定核准
                  </text>
                  <text x="0" y="20" fill="#64748b" fontSize="10" fontFamily="sans-serif">
                    • 几何尺寸、公差配合与装配基准符合国家标准
                  </text>
                </g>
              )}
            </g>

            {/* Bottom Scale Label */}
            <text x="510" y="212" textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="monospace">
              SCALE: 1:1 矢量坐标系
            </text>
          </svg>
        </div>
      </div>

      {/* Technical Parameter Badge Bar */}
      {opts.parameters && Object.keys(opts.parameters).length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] font-mono text-slate-700 flex flex-wrap gap-2.5 items-center justify-center">
          {Object.entries(opts.parameters).map(([k, v]) => (
            <div key={k} className="bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              <span className="text-slate-500">{k}:</span> <span className="font-bold text-teal-700">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Official Caption */}
      <div className="text-center py-2.5 border-t border-slate-200 bg-white font-sans text-xs font-bold text-slate-900">
        {opts.caption}
      </div>
    </div>
  );
};

export interface SpecSheetOptions {
  title?: string;
  subtitle?: string;
  paper?: string;
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
  titleFont?: string;
  bodyFont?: string;
  lineHeight?: string;
  notes?: string;
  seal?: string;
  bodyTitle?: string;
  caption?: string;
}

export function parseSpecSheetBlock(content: string): SpecSheetOptions {
  const opts: SpecSheetOptions = {
    title: "公文与技术标准版面排版标尺样张",
    subtitle: "",
    paper: "A4 (210mm × 297mm)",
    marginTop: "2.0 cm",
    marginBottom: "2.0 cm",
    marginLeft: "3.0 cm",
    marginRight: "2.0 cm",
    titleFont: "14pt 加粗黑体",
    bodyFont: "12pt 正体宋体",
    lineHeight: "1.15",
    notes: "严格执行标准版心要求，左侧预留装订线",
    seal: "公文印章位 (Ø 40mm)",
    bodyTitle: "条款标题与正文编号（14pt 加粗黑体）",
    caption: "图示：A4 标准版面与装订标尺样张"
  };

  const lines = (content || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('title:')) {
      opts.title = trimmed.replace('title:', '').trim();
    } else if (trimmed.startsWith('caption:')) {
      opts.caption = trimmed.replace('caption:', '').trim();
    } else if (trimmed.startsWith('subtitle:')) {
      opts.subtitle = trimmed.replace('subtitle:', '').trim();
    } else if (trimmed.startsWith('paper:')) {
      opts.paper = trimmed.replace('paper:', '').trim();
    } else if (trimmed.startsWith('lineHeight:')) {
      opts.lineHeight = trimmed.replace('lineHeight:', '').trim();
    } else if (trimmed.startsWith('notes:') || trimmed.startsWith('note:')) {
      opts.notes = trimmed.replace(/notes?:/, '').trim();
    } else if (trimmed.startsWith('seal:')) {
      opts.seal = trimmed.replace('seal:', '').trim();
    } else if (trimmed.startsWith('bodyTitle:')) {
      opts.bodyTitle = trimmed.replace('bodyTitle:', '').trim();
    } else if (trimmed.startsWith('margins:')) {
      const marginStr = trimmed.replace('margins:', '').trim();
      const topMatch = marginStr.match(/top=([0-9\.]+\s*(?:cm|mm)?)/i);
      const bottomMatch = marginStr.match(/bottom=([0-9\.]+\s*(?:cm|mm)?)/i);
      const leftMatch = marginStr.match(/left=([0-9\.]+\s*(?:cm|mm)?)/i);
      const rightMatch = marginStr.match(/right=([0-9\.]+\s*(?:cm|mm)?)/i);
      if (topMatch) opts.marginTop = topMatch[1];
      if (bottomMatch) opts.marginBottom = bottomMatch[1];
      if (leftMatch) opts.marginLeft = leftMatch[1];
      if (rightMatch) opts.marginRight = rightMatch[1];
    }
  }

  return opts;
}

export const SpecSheetLayoutViewer: React.FC<{ content: string }> = ({ content }) => {
  const opts = parseSpecSheetBlock(content || '');

  return (
    <div className="my-6 border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs font-sans">
      {/* Blueprint Header */}
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-teal-400" />
          <div>
            <h4 className="text-sm font-bold tracking-wide">
              {opts.title}
            </h4>
            <div className="text-[10px] text-slate-300">
              {opts.paper} 标准版心与标尺装订复现
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-full font-bold">
            1:1 标尺样张
          </span>
        </div>
      </div>

      {/* Blueprint Content Area */}
      <div className="p-6 bg-slate-100/80 flex flex-col items-center">
        {/* Simulated A4 Page with Calibrated Engineering Rulers */}
        <div className="relative w-full max-w-[520px] bg-white border-2 border-slate-300 shadow-sm rounded-sm p-6 text-slate-800 text-xs">
          
          {/* Top Ruler Bar */}
          <div className="absolute -top-6 left-0 right-0 h-5 bg-slate-200 border-b border-slate-300 flex justify-between px-6 text-[9px] font-mono text-slate-600 select-none">
            <span>0cm</span>
            <span>3cm (装订)</span>
            <span>6cm</span>
            <span>10cm</span>
            <span>15cm</span>
            <span>19cm (切边)</span>
            <span>21cm</span>
          </div>

          {/* Left Ruler Bar */}
          <div className="absolute top-0 -left-6 bottom-0 w-5 bg-slate-200 border-r border-slate-300 flex flex-col justify-between py-6 text-[9px] font-mono text-slate-600 select-none items-center">
            <span>0</span>
            <span>2cm</span>
            <span>5cm</span>
            <span>10cm</span>
            <span>15cm</span>
            <span>20cm</span>
            <span>25cm</span>
            <span>29.7</span>
          </div>

          {/* Red Dimension Guidelines (Boundaries) */}
          {/* Top Margin */}
          <div className="relative border-b-2 border-dashed border-rose-400 pb-2 mb-3">
            <div className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
              上边距: {opts.marginTop}
            </div>
            {/* Header Content */}
            <div className="text-center space-y-1">
              <div className="font-extrabold text-sm text-slate-900 tracking-tight">
                {opts.title}
              </div>
              {opts.subtitle && (
                <div className="text-[11px] font-bold text-slate-800 tracking-wider">
                  {opts.subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Left Margin Callout (3.0 cm Binding Line) */}
          <div className="relative pl-6 my-4 border-l-2 border-dashed border-rose-400">
            <div className="absolute top-1/2 -left-2 -translate-y-1/2 -rotate-90 bg-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap">
              左边距: {opts.marginLeft} (预留装订线)
            </div>

            {/* Document Body Simulation */}
            <div className="space-y-3 text-justify">
              <div className="text-center font-bold text-[13px] text-slate-900 py-1 bg-slate-50 rounded">
                {opts.bodyTitle}
              </div>

              <p className="text-[11px] leading-[1.15] text-slate-700">
                正文内容严格采用 12pt 正体排版，行间距统一设定为 <span className="font-bold text-teal-700">{opts.lineHeight} 倍标准行距</span>。所有条文细则、专有名词、参数指标及编号逐项排列，忠实原文，严禁使用倾斜字体。
              </p>

              {opts.notes && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[10.5px] text-slate-600">
                  <span className="font-bold text-slate-800">版面规范要点：</span>{opts.notes}
                </div>
              )}
            </div>

            {/* Right Margin Callout */}
            <div className="absolute top-1/3 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
              右边距: {opts.marginRight}
            </div>
          </div>

          {/* Bottom Margin */}
          <div className="relative pt-3 mt-4 border-t-2 border-dashed border-rose-400 flex justify-between items-end">
            <div className="absolute -bottom-1 right-0 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
              下边距: {opts.marginBottom}
            </div>

            <div className="text-[9px] text-slate-500 space-y-0.5">
              <div className="font-bold text-slate-700">审核状态: 规范排版已核验</div>
              <div>符合 {opts.paper} 标准版面规范</div>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-dashed border-rose-500 text-rose-600 font-bold text-[9px] bg-rose-50/60 shadow-inner px-1 text-center">
                {opts.seal || '规范核验章'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Summary Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-teal-600" />
          <span>版面原则：{opts.paper} 标准版心 + 正文字体 + {opts.lineHeight}倍行距 + 左边距预留装订</span>
        </div>
        <div className="text-teal-700 font-semibold">
          忠实原文版面排版
        </div>
      </div>
    </div>
  );
};
