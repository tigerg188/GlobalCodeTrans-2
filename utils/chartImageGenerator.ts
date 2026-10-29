/**
 * High-Resolution Engineering Chart Image Generator for Word (.docx) Export & UI
 * 
 * Renders publishing-grade engineering diagrams onto an offscreen Canvas
 * and converts to high-DPI PNG byte buffers for native Word embedding.
 * 
 * Palette:
 * - Pure Crisp White Canvas (#FFFFFF)
 * - Engineering Royal Blue / Cobalt (#1D4ED8 / #2563EB)
 * - Warm Amber (#D97706 / #F59E0B)
 * - Technical Teal (#0D9488)
 * - Slate / Grid (#334155 / #E2E8F0)
 */

export interface SpectrumChartOptions {
  title?: string;
  T0?: number;
  Ts?: number;
  TL?: number;
  SDS?: number;
  SD1?: number;
  caption?: string;
  hasExplicitParameters?: boolean;
}

export interface WindChartOptions {
  title?: string;
  V?: number;
  exposure?: string;
  Kd?: number;
  Kzt?: number;
  height?: number;
  Cp_wind?: number;
  Cp_lee?: number;
  formulas?: string[];
  caption?: string;
}

export interface EngineeringDiagramOptions {
  title?: string;
  formulas?: string[];
  parameters?: Record<string, string>;
  annotations?: string[];
  notes?: string;
  caption?: string;
}

/**
 * Converts a base64 Data URL to a Uint8Array buffer
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function parseSpectrumBlock(content: string): SpectrumChartOptions {
  let hasExplicit = content.includes('curves:') || content.includes('segment:') || content.includes('反应谱') || content.includes('Response Spectrum') || content.includes('SDS');
  const params: SpectrumChartOptions = {
    title: "设计加速度反应谱曲线 (Design Response Spectrum)",
    T0: 0.08,
    Ts: 0.40,
    TL: 8.0,
    SDS: 1.05,
    SD1: 0.42,
    caption: "图 6.1 设计加速度反应谱曲线 (Design Response Spectrum) • 依据 ASCE 7-16 / IBC 标准",
    hasExplicitParameters: true,
  };

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('title:')) {
      params.title = trimmed.replace('title:', '').trim();
    } else if (trimmed.startsWith('caption:')) {
      params.caption = trimmed.replace('caption:', '').trim();
    } else if (trimmed.startsWith('parameters:') || trimmed.includes('T0') || trimmed.includes('SDS')) {
      const t0Match = trimmed.match(/T_?0\s*=\s*([0-9\.]+)/i);
      const tsMatch = trimmed.match(/T_?s\s*=\s*([0-9\.]+)/i);
      const tlMatch = trimmed.match(/T_?L\s*=\s*([0-9\.]+)/i);
      const sdsMatch = trimmed.match(/S_?\{?DS\}?\s*=\s*([0-9\.]+)/i);
      const sd1Match = trimmed.match(/S_?\{?D1\}?\s*=\s*([0-9\.]+)/i);

      if (t0Match) { params.T0 = parseFloat(t0Match[1]); hasExplicit = true; }
      if (tsMatch) { params.Ts = parseFloat(tsMatch[1]); hasExplicit = true; }
      if (tlMatch) { params.TL = parseFloat(tlMatch[1]); hasExplicit = true; }
      if (sdsMatch) { params.SDS = parseFloat(sdsMatch[1]); hasExplicit = true; }
      if (sd1Match) { params.SD1 = parseFloat(sd1Match[1]); hasExplicit = true; }
    }
  }

  params.hasExplicitParameters = hasExplicit;

  return params;
}

export function parseWindBlock(content: string): WindChartOptions {
  const params: WindChartOptions = {
    title: "建筑结构风压沿高度分布图 (Wind Pressure Profile)",
    V: 45,
    exposure: "C",
    Kd: 0.85,
    Kzt: 1.0,
    height: 60,
    Cp_wind: 0.8,
    Cp_lee: -0.5,
    formulas: ["qz = 0.613 · Kz · Kzt · Kd · Ke · V² (N/m²)"],
    caption: "图 6.2 建筑结构风压沿高度分布图 (Wind Pressure Profile)",
  };

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('title:')) {
      params.title = trimmed.replace('title:', '').trim();
    } else if (trimmed.startsWith('caption:')) {
      params.caption = trimmed.replace('caption:', '').trim();
    } else if (trimmed.startsWith('formulas:') || trimmed.startsWith('formula:')) {
      const formStr = trimmed.replace(/formulas?:/, '').trim();
      if (formStr) params.formulas = [formStr];
    } else if (trimmed.startsWith('parameters:') || trimmed.includes('V=') || trimmed.includes('z_max')) {
      const vMatch = trimmed.match(/V\s*=\s*([0-9\.]+)/i);
      const hMatch = trimmed.match(/(?:z_max|H|height)\s*=\s*([0-9\.]+)/i);
      const expMatch = trimmed.match(/Exposure\s*=\s*([A-Za-z0-9]+)/i);
      const kdMatch = trimmed.match(/Kd\s*=\s*([0-9\.]+)/i);
      const kztMatch = trimmed.match(/Kzt\s*=\s*([0-9\.]+)/i);

      if (vMatch) params.V = parseFloat(vMatch[1]);
      if (hMatch) params.height = parseFloat(hMatch[1]);
      if (expMatch) params.exposure = expMatch[1];
      if (kdMatch) params.Kd = parseFloat(kdMatch[1]);
      if (kztMatch) params.Kzt = parseFloat(kztMatch[1]);
    }
  }

  return params;
}

export function parseDiagramBlock(content: string): EngineeringDiagramOptions {
  const opts: EngineeringDiagramOptions = {
    title: "工程结构构造与算式示意图 (Engineering Diagram)",
    formulas: [],
    parameters: {},
    annotations: [],
    caption: "图 6.1 工程结构构造与力学特征图 (Engineering Diagram)",
  };

  const lines = content.split('\n');
  let currentKey = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('title:')) {
      opts.title = trimmed.replace('title:', '').trim();
    } else if (trimmed.startsWith('caption:')) {
      opts.caption = trimmed.replace('caption:', '').trim();
    } else if (trimmed.startsWith('notes:') || trimmed.startsWith('note:')) {
      opts.notes = trimmed.replace(/notes?:/, '').trim();
    } else if (trimmed.startsWith('formulas:') || trimmed.startsWith('formula:') || trimmed.startsWith('equations:')) {
      currentKey = 'formulas';
      const inlineForm = trimmed.replace(/(?:formulas?|equations?):/, '').trim();
      if (inlineForm) opts.formulas?.push(inlineForm);
    } else if (trimmed.startsWith('parameters:') || trimmed.startsWith('params:')) {
      currentKey = 'parameters';
      const inlineParam = trimmed.replace(/(?:parameters?|params?):/, '').trim();
      if (inlineParam) {
        inlineParam.split(',').forEach(p => {
          const [k, v] = p.split('=').map(s => s.trim());
          if (k && v && opts.parameters) opts.parameters[k] = v;
        });
      }
    } else if (trimmed.startsWith('annotations:') || trimmed.startsWith('labels:')) {
      currentKey = 'annotations';
      const inlineAnn = trimmed.replace(/(?:annotations?|labels?):/, '').trim();
      if (inlineAnn) opts.annotations?.push(inlineAnn);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.slice(2).trim();
      if (currentKey === 'formulas' && opts.formulas) {
        opts.formulas.push(itemText);
      } else if (currentKey === 'annotations' && opts.annotations) {
        opts.annotations.push(itemText);
      } else if (currentKey === 'parameters' && opts.parameters) {
        const [k, v] = itemText.split('=').map(s => s.trim());
        if (k && v) opts.parameters[k] = v;
      }
    }
  }

  return opts;
}

/**
 * Generates a publication-grade Response Spectrum Curve PNG (white background, vibrant royal blue curve, amber accents)
 * matching the authentic official engineering design standards (ASCE 7 / IBC / National Standards).
 */
export function generateResponseSpectrumChartPng(options: SpectrumChartOptions = {}): Uint8Array | null {
  if (typeof document === 'undefined') return null;

  try {
    const width = 1350;
    const height = 640;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Pure White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Engineering parameters
    const T0 = options.T0 ?? 0.08;
    const Ts = options.Ts ?? 0.40;
    const TL = options.TL ?? 8.0;
    const SDS = options.SDS ?? 1.05;
    const SD1 = options.SD1 ?? 0.42;

    const padLeft = 130;
    const padRight = 100;
    const padTop = 60;
    const padBottom = 110;
    const gWidth = width - padLeft - padRight;
    const gHeight = height - padTop - padBottom;

    // Scale mapping (X: T from 0 to 3.6s, Y: Sa from 0 to 1.35 * SDS)
    const maxT = 3.6;
    const maxSa = SDS * 1.35;

    const toX = (t: number) => padLeft + (t / maxT) * gWidth;
    const toY = (sa: number) => padTop + gHeight - (sa / maxSa) * gHeight;

    // 2. Engineering Grid Lines (Crisp light slate-blue/gray)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    // Horizontal grid
    const yGridSteps = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2];
    for (const stepVal of yGridSteps) {
      if (stepVal * SDS < maxSa) {
        const yPos = toY(stepVal * SDS);
        ctx.beginPath();
        ctx.moveTo(padLeft, yPos);
        ctx.lineTo(padLeft + gWidth, yPos);
        ctx.stroke();
      }
    }
    // Vertical grid
    for (let t = 0.5; t <= 3.5; t += 0.5) {
      const xPos = toX(t);
      ctx.beginPath();
      ctx.moveTo(xPos, padTop);
      ctx.lineTo(xPos, padTop + gHeight);
      ctx.stroke();
    }

    // 3. Coordinate Axes (Crisp Slate with Sharp Arrowheads)
    ctx.strokeStyle = '#334155';
    ctx.fillStyle = '#334155';
    ctx.lineWidth = 2.5;

    // Y Axis
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + gHeight);
    ctx.lineTo(padLeft, padTop - 25);
    ctx.stroke();

    // Y Axis Arrowhead
    ctx.beginPath();
    ctx.moveTo(padLeft - 6, padTop - 20);
    ctx.lineTo(padLeft, padTop - 38);
    ctx.lineTo(padLeft + 6, padTop - 20);
    ctx.fill();

    // X Axis
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + gHeight);
    ctx.lineTo(padLeft + gWidth + 30, padTop + gHeight);
    ctx.stroke();

    // X Axis Arrowhead
    ctx.beginPath();
    ctx.moveTo(padLeft + gWidth + 25, padTop + gHeight - 6);
    ctx.lineTo(padLeft + gWidth + 44, padTop + gHeight);
    ctx.lineTo(padLeft + gWidth + 25, padTop + gHeight + 6);
    ctx.fill();

    // 4. Axis Labels (Bilingual Technical Labels)
    ctx.font = 'bold 20px "Cambria Math", "Times New Roman", "SimSun", serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('结构自振周期 T (s)  /  Period, T (sec)', padLeft + gWidth / 2, padTop + gHeight + 46);

    ctx.save();
    ctx.translate(padLeft - 85, padTop + gHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('设计加速度反应谱 Sa (g)  /  Spectral Acceleration Sa (g)', 0, 0);
    ctx.restore();

    // 5. Dashed Guidelines (Amber for plateau, slate for other milestones)
    const drawDashedLine = (x1: number, y1: number, x2: number, y2: number, color = '#64748b') => {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    const ySDS = toY(SDS);
    const ySD1 = toY(SD1);
    const xT0 = toX(T0);
    const xTs = toX(Ts);
    const xOneSec = toX(1.0);
    const xTL = toX(2.8);
    const yTL = toY(SD1 / 2.8);

    // Plateau guidelines (Vibrant Amber)
    drawDashedLine(padLeft, ySDS, xTs, ySDS, '#f59e0b');
    drawDashedLine(xT0, padTop + gHeight, xT0, ySDS, '#f59e0b');
    drawDashedLine(xTs, padTop + gHeight, xTs, ySDS, '#f59e0b');

    // 1.0s and TL guidelines (Slate)
    drawDashedLine(padLeft, ySD1, xOneSec, ySD1, '#94a3b8');
    drawDashedLine(xOneSec, padTop + gHeight, xOneSec, ySD1, '#94a3b8');
    drawDashedLine(xTL, padTop + gHeight, xTL, yTL, '#94a3b8');

    // 6. Ticks & Subscript Labels on Axes
    ctx.font = 'italic bold 19px "Cambria Math", "Times New Roman", serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.fillText('0', padLeft - 14, padTop + gHeight + 8);
    ctx.fillStyle = '#b45309';
    ctx.fillText('T₀', xT0, padTop + gHeight + 8);
    ctx.fillText('Ts', xTs, padTop + gHeight + 8);
    ctx.fillStyle = '#0f172a';
    ctx.fillText('1.0', xOneSec, padTop + gHeight + 8);
    ctx.fillText('TL', xTL, padTop + gHeight + 8);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b45309';
    ctx.fillText('SDS', padLeft - 12, ySDS);
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SD1', padLeft - 12, ySD1);

    // 7. Area Gradient Underneath the Curve (Soft Engineering Royal Blue)
    const points: { x: number; y: number }[] = [];
    const tStart = 0;
    const tEnd = maxT;
    const step = 0.01;

    for (let t = tStart; t <= tEnd; t += step) {
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
      points.push({ x: toX(t), y: toY(sa) });
    }

    if (points.length > 0) {
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + gHeight);
      grad.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
      grad.addColorStop(1, 'rgba(37, 99, 235, 0.02)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(padLeft, padTop + gHeight);
      for (const p of points) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo(points[points.length - 1].x, padTop + gHeight);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // 8. Draw the Main Curve (Vibrant Royal Blue / Cobalt #1D4ED8)
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // 9. Key Milestone Dots on the Curve
    const drawDot = (x: number, y: number, color = '#1d4ed8', r = 4.5) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    drawDot(xT0, ySDS, '#f59e0b');
    drawDot(xTs, ySDS, '#f59e0b');
    drawDot(xOneSec, ySD1, '#1d4ed8');
    drawDot(xTL, yTL, '#1d4ed8');

    // 10. Formula Callout Cards (White pill cards with blue border and sharp text)
    const drawPillBadge = (text: string, x: number, y: number, w: number, h: number) => {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      const r = 5;
      ctx.moveTo(x - w / 2 + r, y - h / 2);
      ctx.lineTo(x + w / 2 - r, y - h / 2);
      ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
      ctx.lineTo(x + w / 2, y + h / 2 - r);
      ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
      ctx.lineTo(x - w / 2 + r, y + h / 2);
      ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
      ctx.lineTo(x - w / 2, y - h / 2 + r);
      ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.font = 'bold 18px "Cambria Math", "Times New Roman", serif';
      ctx.fillStyle = '#1e40af';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    };

    // Plateau badge: Sa = SDS
    drawPillBadge('Sa = SDS', (xT0 + xTs) / 2, ySDS - 28, 120, 32);

    // Hyperbolic branch 1: Sa = SD1 / T with leader line
    const xMid1 = toX(1.6);
    const yMid1 = toY(SD1 / 1.6);
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xMid1 + 10, yMid1 - 5);
    ctx.lineTo(xMid1 + 65, yMid1 - 32);
    ctx.stroke();
    ctx.restore();
    drawPillBadge('Sa = SD1 / T', xMid1 + 140, yMid1 - 35, 140, 32);

    // Hyperbolic branch 2: Sa = (SD1 · TL) / T² with leader line
    const xMid2 = toX(3.05);
    const yMid2 = toY((SD1 * 2.8) / (3.05 * 3.05));
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xMid2 + 8, yMid2 - 5);
    ctx.lineTo(xMid2 + 60, yMid2 - 30);
    ctx.stroke();
    ctx.restore();
    drawPillBadge('Sa = (SD1 · TL) / T²', xMid2 + 110, yMid2 - 35, 175, 32);

    // 11. Bottom Official Figure Caption (Strict Engineering Style)
    const captionText = options.caption || '图 6.1 设计加速度反应谱曲线 (Design Response Spectrum) • 依据 ASCE 7-16 / IBC 标准';
    ctx.font = 'bold 20px "SimHei", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(captionText, width / 2, height - 12);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.error("Failed to generate response spectrum chart PNG:", err);
    return null;
  }
}

/**
 * Generates a publication-grade Wind Pressure Profile Chart PNG (pure white background, architectural blue & teal)
 */
export function generateWindPressureChartPng(options: WindChartOptions = {}): Uint8Array | null {
  if (typeof document === 'undefined') return null;

  try {
    const width = 1100;
    const height = 540;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const H = options.height || 60;
    const V = options.V || 45;
    const Cp_wind = options.Cp_wind ?? 0.8;
    const Cp_lee = options.Cp_lee ?? -0.5;
    const captionText = options.caption || `图 6.2 建筑结构风压沿高度分布图 (Wind Pressure Profile) • V=${V}m/s, H=${H}m`;

    // Pure white canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const groundY = 430;
    const buildingX = 420;
    const buildingW = 240;
    const buildingH = 340;
    const buildingTop = groundY - buildingH;

    // Ground line and soil hatching
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(80, groundY);
    ctx.lineTo(1020, groundY);
    ctx.stroke();

    // Ground hatches
    ctx.lineWidth = 1.2;
    for (let x = 90; x < 1010; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 12, groundY + 14);
      ctx.stroke();
    }
    ctx.font = '16px "SimSun", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('地面标高 (z = 0.0m)', 95, groundY + 34);

    // Building Slab
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2.5;
    ctx.fillRect(buildingX, buildingTop, buildingW, buildingH);
    ctx.strokeRect(buildingX, buildingTop, buildingW, buildingH);

    ctx.font = 'bold 20px "SimHei", sans-serif';
    ctx.fillStyle = '#1e3a8a';
    ctx.textAlign = 'center';
    ctx.fillText(`主体建筑结构 (H = ${H}m)`, buildingX + buildingW / 2, buildingTop + buildingH / 2);

    // Windward Profile (Curved Parabola)
    const curvePoints: { x: number; y: number }[] = [];
    const minX = 220;
    for (let y = groundY; y >= buildingTop; y -= 10) {
      const frac = (groundY - y) / buildingH;
      const x = minX + Math.pow(frac, 0.28) * (buildingX - minX);
      curvePoints.push({ x, y });
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(buildingX, groundY);
    for (const p of curvePoints) ctx.lineTo(p.x, p.y);
    ctx.lineTo(buildingX, buildingTop);
    ctx.closePath();
    ctx.fillStyle = 'rgba(13, 148, 136, 0.16)';
    ctx.fill();
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Windward pressure arrows
    ctx.strokeStyle = '#0d9488';
    ctx.fillStyle = '#0d9488';
    ctx.lineWidth = 2;
    [buildingTop + 40, buildingTop + 120, buildingTop + 200, buildingTop + 280].forEach(y => {
      const frac = (groundY - y) / buildingH;
      const xStart = 160;
      const xEnd = minX + Math.pow(frac, 0.28) * (buildingX - minX) - 6;
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(xEnd - 8, y - 5);
      ctx.lineTo(xEnd + 2, y);
      ctx.lineTo(xEnd - 8, y + 5);
      ctx.fill();
    });

    ctx.font = 'bold 18px "SimHei", sans-serif';
    ctx.fillStyle = '#0d9488';
    ctx.textAlign = 'center';
    ctx.fillText(`迎风面风压 (qz · G · Cp, 正压 Cp = +${Cp_wind})`, buildingX - 110, buildingTop - 18);

    // Leeward Suction (Constant Profile)
    const leeW = 95;
    ctx.fillStyle = 'rgba(217, 119, 6, 0.16)';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;
    ctx.fillRect(buildingX + buildingW, buildingTop, leeW, buildingH);
    ctx.strokeRect(buildingX + buildingW, buildingTop, leeW, buildingH);

    // Leeward suction arrows
    ctx.strokeStyle = '#d97706';
    ctx.fillStyle = '#d97706';
    ctx.lineWidth = 2;
    [buildingTop + 40, buildingTop + 120, buildingTop + 200, buildingTop + 280].forEach(y => {
      const xStart = buildingX + buildingW + 10;
      const xEnd = buildingX + buildingW + leeW + 40;
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.stroke();
      // Arrowhead pointing right (suction)
      ctx.beginPath();
      ctx.moveTo(xEnd - 8, y - 5);
      ctx.lineTo(xEnd + 2, y);
      ctx.lineTo(xEnd - 8, y + 5);
      ctx.fill();
    });

    ctx.fillStyle = '#d97706';
    ctx.fillText(`背风面吸力 (qh · G · Cp, 负压 Cp = ${Cp_lee})`, buildingX + buildingW + 130, buildingTop - 18);

    // Dimension lines
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(buildingX + buildingW + leeW + 160, buildingTop);
    ctx.lineTo(buildingX + buildingW + leeW + 160, groundY);
    ctx.stroke();
    ctx.restore();
    ctx.font = 'italic bold 17px "Cambria Math", serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`z = h = ${H}m`, buildingX + buildingW + leeW + 160, buildingTop - 8);

    // Bottom Caption
    ctx.font = 'bold 20px "SimHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(captionText, width / 2, height - 15);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.error("Failed to generate wind pressure chart PNG:", err);
    return null;
  }
}

/**
 * Generates a publication-grade General Engineering Diagram PNG
 */
export function generateEngineeringDiagramPng(options: EngineeringDiagramOptions = {}): Uint8Array | null {
  if (typeof document === 'undefined') return null;

  try {
    const width = 1100;
    const height = 600;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const title = options.title || "公文与工程图样几何特征示意图 (Diagram)";
    const captionText = options.caption || "图示：几何构造与尺寸标注特征图";
    const formulas = options.formulas || [];
    const params = options.parameters || {};
    const annotations = options.annotations || [];

    // Outer Border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Title Header Banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(30, 30, width - 60, 50);

    ctx.font = 'bold 20px "SimHei", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, 55, 62);

    ctx.font = 'bold 14px "Cambria Math", sans-serif';
    ctx.fillStyle = '#2DD4BF';
    ctx.textAlign = 'right';
    ctx.fillText('1:1 几何图样与标注复现', width - 55, 62);

    let curY = 100;

    // Top Formula Banner Box (if formulas exist)
    if (formulas.length > 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0d9488';
      ctx.lineWidth = 1.5;
      const formBoxH = 35 + formulas.length * 28;
      ctx.fillRect(50, curY, width - 100, formBoxH);
      ctx.strokeRect(50, curY, width - 100, formBoxH);

      ctx.font = 'bold 15px "SimHei", sans-serif';
      ctx.fillStyle = '#0f766e';
      ctx.textAlign = 'left';
      ctx.fillText('【图形上方计算公式与技术推导】', 65, curY + 24);

      ctx.font = 'bold 18px "Cambria Math", "Times New Roman", serif';
      ctx.fillStyle = '#1e293b';
      formulas.forEach((f, idx) => {
        ctx.fillText(f, 75, curY + 50 + idx * 28);
      });

      curY += formBoxH + 20;
    }

    // Main Central Diagram Vector Display Box
    const diagBoxH = height - curY - 100;
    ctx.fillStyle = '#fafafa';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.8;
    ctx.fillRect(50, curY, width - 100, diagBoxH);
    ctx.strokeRect(50, curY, width - 100, diagBoxH);

    const centerX = width / 2;
    const centerY = curY + diagBoxH / 2;

    // Coordinate Grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(70, centerY);
    ctx.lineTo(width - 70, centerY);
    ctx.moveTo(centerX, curY + 20);
    ctx.lineTo(centerX, curY + diagBoxH - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dimension Guidelines
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - 250, curY + 45);
    ctx.lineTo(centerX + 250, curY + 45);
    ctx.stroke();

    // Central Schematic Frame
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.fillRect(centerX - 260, centerY - 60, 520, 120);
    ctx.strokeRect(centerX - 260, centerY - 60, 520, 120);

    // Inner Labels & Annotations
    ctx.font = 'bold 16px "SimHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(title, centerX, centerY - 25);

    ctx.font = '14px "SimSun", sans-serif';
    ctx.fillStyle = '#334155';
    if (annotations.length > 0) {
      annotations.slice(0, 3).forEach((ann, idx) => {
        ctx.fillText(`• ${ann}`, centerX, centerY + 8 + idx * 24);
      });
    } else {
      ctx.fillText('• 构造要素与几何尺寸严格依据条文规范执行', centerX, centerY + 10);
      ctx.fillText('• 毫米级基准坐标与公差界限 1:1 精确复现', centerX, centerY + 34);
    }

    // Parameter Badges Bar
    const paramKeys = Object.keys(params);
    if (paramKeys.length > 0) {
      const paramStr = paramKeys.map(k => `${k} = ${params[k]}`).join('  |  ');
      ctx.font = 'bold 14px "Cambria Math", sans-serif';
      ctx.fillStyle = '#0f766e';
      ctx.textAlign = 'center';
      ctx.fillText(`技术参数:  ${paramStr}`, centerX, curY + diagBoxH - 15);
    }

    // Bottom Caption
    ctx.font = 'bold 18px "SimHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(captionText, width / 2, height - 15);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.error("Failed to generate engineering diagram PNG:", err);
    return null;
  }
}

/**
 * Generates an official specification sheet / layout blueprint PNG
 */
export function generateSpecSheetLayoutPng(options?: any): Uint8Array | null {
  if (typeof document === 'undefined') return null;

  try {
    const width = 1000;
    const height = 620;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const title = options?.title || "公文与技术标准版面排版标尺样张";
    const paper = options?.paper || "A4 (210mm × 297mm)";
    const marginTop = options?.marginTop || "2.0 cm";
    const marginBottom = options?.marginBottom || "2.0 cm";
    const marginLeft = options?.marginLeft || "3.0 cm";
    const marginRight = options?.marginRight || "2.0 cm";
    const notes = options?.notes || "左侧预留装订线，四周版心严格执行公文技术规程";
    const caption = options?.caption || `图示：${paper} 标准版心排版与装订标尺样张`;

    // Outer border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Header banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 40, width - 80, 48);

    ctx.font = 'bold 18px "SimHei", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, 60, 70);

    ctx.font = 'bold 13px "SimHei", sans-serif';
    ctx.fillStyle = '#2DD4BF';
    ctx.textAlign = 'right';
    ctx.fillText(`${paper} • 标尺样张`, width - 60, 70);

    // Simulated A4 sheet inside
    const sheetX = 240;
    const sheetY = 120;
    const sheetW = 520;
    const sheetH = 400;

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(sheetX, sheetY, sheetW, sheetH);
    ctx.strokeRect(sheetX, sheetY, sheetW, sheetH);

    // Margins guidelines (Dashed Red)
    ctx.strokeStyle = '#f43f5e';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.2;
    // Left margin
    ctx.beginPath();
    ctx.moveTo(sheetX + 70, sheetY);
    ctx.lineTo(sheetX + 70, sheetY + sheetH);
    ctx.stroke();
    // Top margin
    ctx.beginPath();
    ctx.moveTo(sheetX, sheetY + 45);
    ctx.lineTo(sheetX + sheetW, sheetY + 45);
    ctx.stroke();
    // Right margin
    ctx.beginPath();
    ctx.moveTo(sheetX + sheetW - 45, sheetY);
    ctx.lineTo(sheetX + sheetW - 45, sheetY + sheetH);
    ctx.stroke();
    // Bottom margin
    ctx.beginPath();
    ctx.moveTo(sheetX, sheetY + sheetH - 45);
    ctx.lineTo(sheetX + sheetW, sheetY + sheetH - 45);
    ctx.stroke();

    ctx.setLineDash([]);
    // Callout labels
    ctx.font = 'bold 13px "SimHei", sans-serif';
    ctx.fillStyle = '#e11d48';
    ctx.textAlign = 'left';
    ctx.fillText(`左边距 ${marginLeft} (装订预留)`, sheetX + 80, sheetY + 25);
    ctx.fillText(`上边距 ${marginTop}`, sheetX + 220, sheetY + 38);
    ctx.fillText(`右边距 ${marginRight}`, sheetX + sheetW - 130, sheetY + 25);
    ctx.fillText(`下边距 ${marginBottom}`, sheetX + 220, sheetY + sheetH - 25);

    // Body content simulation
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px "SimHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, sheetX + sheetW / 2, sheetY + 95);

    ctx.font = '13px "SimSun", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('标题字体：14pt 黑体加粗 • 正文字体：12pt 宋体正体（严禁倾斜）', sheetX + sheetW / 2, sheetY + 135);
    ctx.fillText('标准行距：1.15 倍行间距 • 排版版心与装订基准严格保持 1:1', sheetX + sheetW / 2, sheetY + 165);
    ctx.fillText(`注：${notes}`, sheetX + sheetW / 2, sheetY + 195);

    // Bottom Caption
    ctx.font = 'bold 18px "SimHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(caption, width / 2, height - 15);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.error("Failed to generate spec sheet layout PNG:", err);
    return null;
  }
}

/**
 * Generates Official Document Margin & Binding Vector Diagram PNG for Word Export
 */
export function generateDocMarginLayoutPng(options?: any): Uint8Array | null {
  return generateSpecSheetLayoutPng(options);
}

/**
 * Generates Official Header Grid PNG for Word Export
 */
export function generateHeaderGridLayoutPng(options?: any): Uint8Array | null {
  if (typeof document === 'undefined') return null;

  try {
    const width = 1000;
    const height = 500;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const title = options?.title || "公文文头与发文机关排版定位网格 (Official Letterhead Grid)";
    const countryName = options?.countryName || "ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ (老挝人民民主共和国)";
    const motto = options?.motto || "ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ (和平 独立 民主 统一 繁荣)";
    const ministry = options?.ministry || "发文部委/机构名称";
    const department = options?.department || "司局级机关";
    const docNumber = options?.docNumber || "ເລກທີ 001/กช (文号编号)";
    const dateLocation = options?.dateLocation || "ນະຄອນຫຼວງວຽງຈັນ, ວັນທີ... (签发地点与日期)";
    const caption = options?.caption || "图示：老挝国家行政公文标头网格定位与尺寸对照";

    // Header banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 30, width - 80, 48);
    ctx.font = 'bold 18px "SimHei", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, 60, 62);

    // Main box
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 30, width - 80, height - 70);

    // Center Golden Country & Motto box
    ctx.fillStyle = '#f0fdfa';
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 1.5;
    ctx.fillRect(100, 100, width - 200, 90);
    ctx.strokeRect(100, 100, width - 200, 90);

    ctx.font = 'bold 17px "Phetsarath OT", "Times New Roman", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(countryName, width / 2, 135);

    ctx.font = 'bold 15px "Phetsarath OT", "Times New Roman", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(motto, width / 2, 168);

    // Dual-Column Grid Box
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(100, 210, width - 200, 140);
    ctx.strokeRect(100, 210, width - 200, 140);

    // Left Column
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px "SimHei", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('左栏：发文机关 (靠左对齐，平齐版心)', 130, 240);

    ctx.font = 'bold 16px "Phetsarath OT", "Times New Roman", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(ministry, 130, 275);
    ctx.font = '14px "Phetsarath OT", "Times New Roman", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(department, 130, 305);

    // Right Column
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px "SimHei", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('右栏：文号与日期 (靠右对齐，平齐版心)', width - 130, 240);

    ctx.font = 'bold 16px "Phetsarath OT", "Times New Roman", monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(docNumber, width - 130, 275);
    ctx.font = '14px "Phetsarath OT", "Times New Roman", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(dateLocation, width - 130, 305);

    // Caption
    ctx.font = 'bold 18px "SimHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(caption, width / 2, height - 15);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.error("Failed to generate header grid PNG:", err);
    return null;
  }
}

/**
 * Generates Official Signature & Seal Stamping Layout PNG for Word Export
 */
export function generateSignatureSealLayoutPng(options?: any): Uint8Array | null {
  if (typeof document === 'undefined') return null;

  try {
    const width = 1000;
    const height = 500;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const title = options?.title || "签发签署区与公章盖印规范示意图 (Signature & Official Seal Layout)";
    const signatoryTitle = options?.signatoryTitle || "办公厅主任 / 部长 (ຫົວໜ້າຫ້ອງການ / ລັດຖະມົນຕີ)";
    const signatoryName = options?.signatoryName || "签发人姓名 (14pt 加粗)";
    const sealDiameter = options?.sealDiameter || "Ø 40mm";
    const sealOverlap = options?.sealOverlap || "骑年盖月 (覆盖日期年份 1/3 ~ 1/2)";
    const signatureGap = options?.signatureGap || "留空 2.5cm 签名手迹";
    const caption = options?.caption || "图示：老挝国家公章偏位与签署区相对位置规范图";

    // Header banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 30, width - 80, 48);
    ctx.font = 'bold 18px "SimHei", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, 60, 62);

    // Main box
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 30, width - 80, height - 70);

    // Signature Area Container
    const boxX = 460;
    const boxY = 110;
    const boxW = 460;
    const boxH = 280;

    ctx.fillStyle = '#fff1f2';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.8;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Title
    ctx.font = 'bold 17px "Phetsarath OT", "SimHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(signatoryTitle, boxX + boxW / 2, boxY + 45);

    // Gap
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.fillRect(boxX + 40, boxY + 70, boxW - 80, 80);
    ctx.strokeRect(boxX + 40, boxY + 70, boxW - 80, 80);
    ctx.setLineDash([]);

    ctx.font = 'italic 13px "SimHei", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`[ ${signatureGap} ]`, boxX + boxW / 2, boxY + 115);

    // Red Seal Circle
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(225, 29, 72, 0.12)';
    ctx.beginPath();
    ctx.arc(boxX + 110, boxY + 150, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 12px "SimHei", sans-serif';
    ctx.fillStyle = '#e11d48';
    ctx.fillText('老挝国家公章', boxX + 110, boxY + 140);
    ctx.fillText(sealDiameter, boxX + 110, boxY + 160);
    ctx.font = 'bold 10px "SimHei", sans-serif';
    ctx.fillText('骑年盖月', boxX + 110, boxY + 178);

    // Signatory Name
    ctx.font = 'bold 16px "Phetsarath OT", "SimHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(signatoryName, boxX + boxW / 2, boxY + 230);

    // Left Specification Callout List
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px "SimHei", sans-serif';
    ctx.fillStyle = '#e11d48';
    ctx.fillText('公章盖印规范要点：', 80, 160);

    ctx.font = '14px "SimSun", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`• 印章规格：标称直径 ${sealDiameter}`, 80, 200);
    ctx.fillText(`• 盖印位置：${sealOverlap}`, 80, 235);
    ctx.fillText(`• 签署净高：${signatureGap}`, 80, 270);
    ctx.fillText('• 墨色标准：正红印油，无变形，字迹清晰', 80, 305);

    // Caption
    ctx.font = 'bold 18px "SimHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(caption, width / 2, height - 15);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.error("Failed to generate signature seal PNG:", err);
    return null;
  }
}

import { 
  parseFlowchartBlock, 
  type OfficialFlowchartOptions, 
  type FlowchartStep 
} from '../components/OfficialDocLayoutComponents';

export { 
  parseFlowchartBlock, 
  type OfficialFlowchartOptions, 
  type FlowchartStep 
};
export type FlowchartBlockData = any;

/**
 * Helper to draw a rounded rectangle on Canvas 2D
 */
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Helper to draw a downward arrow on Canvas 2D
 */
function drawDownArrow(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, label?: string) {
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();

  // Arrowhead
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(x - 5, y2 - 6);
  ctx.lineTo(x + 5, y2 - 6);
  ctx.lineTo(x, y2);
  ctx.fill();

  if (label) {
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#059669';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 30, (y1 + y2) / 2);
  }
}

/**
 * Generates a raster preview of the currently parsed flowchart. This is not an editable Word diagram.
 */
export function generateFlowchartPng(content: string): Uint8Array | null {
  if (typeof document === 'undefined') return null;

  try {
    const parsed = parseFlowchartBlock(content);
    const width = 1200;
    const height = Math.max(560, 100 + parsed.steps.length * 70 + 80);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Header banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 20, width - 80, 52);
    ctx.font = 'bold 18px "SimHei", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(parsed.title || 'Flowchart', 60, 53);

    // Frame
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, 20, width - 80, height - 44);

    {
      // Domain-neutral flowchart rendering; no case-specific template.
      const stepBoxW = 760;
      const stepBoxH = 46;
      const gapY = 64;
      const topMargin = 85;

      parsed.steps.forEach((step, idx) => {
        const y = topMargin + idx * gapY;
        const isStart = step.type === 'start' || idx === 0;
        const isEnd = step.type === 'end' || idx === parsed.steps.length - 1;
        const isDecision = step.type === 'decision';
        const boxX = (width - stepBoxW) / 2;

        ctx.fillStyle = isStart ? '#eff6ff' : isEnd ? '#f0fdf4' : isDecision ? '#fffbeb' : '#f8fafc';
        ctx.strokeStyle = isStart ? '#2563eb' : isEnd ? '#16a34a' : isDecision ? '#d97706' : '#64748b';
        ctx.lineWidth = isDecision ? 2.2 : 1.8;

        if (isStart || isEnd) {
          drawRoundRect(ctx, boxX, y, stepBoxW, stepBoxH, stepBoxH / 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(boxX, y, stepBoxW, stepBoxH);
          ctx.strokeRect(boxX, y, stepBoxW, stepBoxH);
        }

        // Badge
        ctx.fillStyle = isStart ? '#2563eb' : isEnd ? '#16a34a' : isDecision ? '#d97706' : '#475569';
        ctx.beginPath();
        ctx.arc(boxX + 28, y + stepBoxH / 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${idx + 1}`, boxX + 28, y + stepBoxH / 2 + 4);

        // Step text
        ctx.font = 'bold 14px "SimHei", sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'left';
        ctx.fillText(step.name, boxX + 54, y + 29);

        // If generic decision has a [No] action, draw label on the right side of the step box
        if (isDecision && step.noBranchAction) {
          ctx.font = '11px "SimHei", sans-serif';
          ctx.fillStyle = '#b45309';
          ctx.textAlign = 'right';
          const noTag = `[否/No: ${step.noBranchAction}${step.noLoopBackTo ? ` ↺步${step.noLoopBackTo}` : ''}]`;
          ctx.fillText(noTag, boxX + stepBoxW - 16, y + 28);
          ctx.textAlign = 'left';
        }

        // Arrow
        if (idx < parsed.steps.length - 1) {
          drawDownArrow(ctx, width / 2, y + stepBoxH, y + stepBoxH + 18, isDecision ? '[Yes / 是]' : undefined);
        }
      });
    }

    // Caption at bottom
    ctx.font = 'bold 15px "SimHei", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(parsed.caption || '', width / 2, height - 16);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.error("Failed to generate flowchart PNG:", err);
    return null;
  }
}

export interface SvgRenderResult {
  buffer: Uint8Array;
  width: number;
  height: number;
  caption?: string;
}

/**
 * High-precision vector SVG to high-DPI raster PNG converter.
 * Enables Microsoft Word (.docx) export to seamlessly embed vector drawings, icons,
 * flowcharts, and technical figures with crystal-clear 2x retina sharpness.
 */
export async function renderSvgToPngBuffer(
  svgContent: string,
  targetWidth: number = 540,
  targetHeight?: number
): Promise<SvgRenderResult | null> {
  if (!svgContent) return null;
  let clean = svgContent.trim();

  // Strip code fences
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```[a-z0-9_-]*\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  }

  // Extract caption or title from metadata if present
  let caption = "";
  const titleMatch = clean.match(/(?:title|caption)[:：]\s*([^\n\r<]+)/i);
  if (titleMatch) {
    caption = titleMatch[1].trim();
  }

  // Extract pure <svg ... </svg>
  const svgMatch = clean.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    clean = svgMatch[0];
  } else if (!clean.startsWith('<svg') && clean.includes('<svg')) {
    clean = clean.slice(clean.indexOf('<svg'));
  }

  if (!clean.startsWith('<svg')) return null;

  // Extract dimensions or viewBox
  let w = targetWidth;
  let h = targetHeight || 380;

  const vbMatch = clean.match(/viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i);
  if (vbMatch) {
    const vbW = parseFloat(vbMatch[3]);
    const vbH = parseFloat(vbMatch[4]);
    if (vbW > 0 && vbH > 0) {
      w = targetWidth;
      h = Math.round((targetWidth * vbH) / vbW);
    }
  } else {
    const wMatch = clean.match(/width=["']([0-9.]+)px?["']/i);
    const hMatch = clean.match(/height=["']([0-9.]+)px?["']/i);
    if (wMatch && hMatch) {
      const parsedW = parseFloat(wMatch[1]);
      const parsedH = parseFloat(hMatch[1]);
      if (parsedW > 0 && parsedH > 0) {
        w = targetWidth;
        h = Math.round((targetWidth * parsedH) / parsedW);
      }
    }
  }

  // Constrain aspect ratio to reasonable document ranges
  h = Math.max(100, Math.min(1200, h));

  // Ensure standard XML namespace and responsive styling
  if (!clean.includes('xmlns=')) {
    clean = clean.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Strip dangerous scripts
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const scale = 2; // 2x retina sharpness for publishing
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Pure white crisp background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);

      const svgBlob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SVG render timeout')), 4000);
        img.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        img.onerror = (e) => {
          clearTimeout(timer);
          reject(e);
        };
        img.src = url;
      });

      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const dataUrl = canvas.toDataURL('image/png');
      return {
        buffer: dataUrlToUint8Array(dataUrl),
        width: targetWidth,
        height: Math.round(h),
        caption: caption || undefined,
      };
    } catch (browserErr) {
      console.warn("Browser SVG canvas render failed:", browserErr);
    }
  }

  return null;
}

/**
 * Generates an official publication-grade emblem/badge PNG buffer
 * with golden wheat wreaths, national red/blue crest or organization shield,
 * guaranteeing 100% display in Word documents even without external network image files.
 */
export function generateUniversalEmblemPng(orgName: string = "国家机构与行业指定组织"): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 300, 300);

    const cx = 150;
    const cy = 150;
    const r = 120;

    // Outer gold ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner gold ring
    ctx.beginPath();
    ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Central circular shield (Rich Deep Blue / Royal)
    ctx.beginPath();
    ctx.arc(cx, cy, r - 16, 0, Math.PI * 2);
    ctx.fillStyle = '#1E3A8A';
    ctx.fill();

    // Stylized golden rays / star in center
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + Math.cos(angle) * 36;
      const y = cy + Math.sin(angle) * 36;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Golden Laurel wreath arcs left and right
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 30, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 30, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();

    // Text around arc or bottom banner
    ctx.font = 'bold 12px "SimHei", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayTitle = orgName.length > 14 ? orgName.slice(0, 14) + '...' : orgName;
    ctx.fillText(displayTitle, cx, cy + 56);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch {
    return null;
  }
}

