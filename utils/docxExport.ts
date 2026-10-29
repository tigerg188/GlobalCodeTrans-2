import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  LineRuleType,
  convertMillimetersToTwip,
  Math as DMath,
  MathRun,
  MathFraction,
  MathSubScript,
  MathSuperScript,
  MathSubSuperScript,
  MathRadical,
  MathRoundBrackets,
  MathSquareBrackets,
} from 'docx';
import { normalizeMarkdown } from './markdownSanitizer';
import {
  generateResponseSpectrumChartPng,
  generateWindPressureChartPng,
  generateSpecSheetLayoutPng,
  generateEngineeringDiagramPng,
  generateDocMarginLayoutPng,
  generateHeaderGridLayoutPng,
  generateSignatureSealLayoutPng,
  generateFlowchartPng,
  parseFlowchartBlock,
  parseSpectrumBlock,
  parseWindBlock,
  parseDiagramBlock,
  renderSvgToPngBuffer,
  generateUniversalEmblemPng,
  SvgRenderResult,
  dataUrlToUint8Array,
} from './chartImageGenerator';
import {
  parseDocMarginBlock,
  parseHeaderGridBlock,
  parseSignatureSealBlock,
} from '../components/OfficialDocLayoutComponents';
import { parseSpecSheetBlock } from '../components/EngineeringCharts';

// Official Engineering Technical Standards & Government Document Layout Replication:
// Paper: A4 (210 x 297 mm)
// Margins: Top 20mm, Bottom 20mm, Left 30mm, Right 20mm
// Line Spacing: 1.15 (line: 276, lineRule: auto)
// Lao font: Phetsarath OT
// English & Numerals: Times New Roman
// Chinese Body: SimSun (宋体) 12pt (24 half-pts), regular, upright (所有文字正体，不得倾斜)
// Text Headings: SimHei (黑体) / Bold, fixed at 14pt (28 half-pts), upright
// Math Formulas: Office Math (OMML) & Cambria Math

const FONT_LAO = "Phetsarath OT";
const FONT_ENGLISH = "Times New Roman";
const FONT_CHINESE_BODY = "SimSun";
const FONT_CHINESE_HEADING = "SimHei";

// In Word/OpenXML, 240 is 1.0 line spacing; 1.15 multiple = 240 * 1.15 = 276 twips
const LINE_SPACING_1_15 = 276;

const LAO_EMBLEM_URLS = [
  '/lao_emblem.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Emblem_of_Laos_%281991-2025%29.svg/960px-Emblem_of_Laos_%281991-2025%29.svg.png'
];

let cachedEmblemBuffer: Uint8Array | null = null;

async function getLaoEmblemBuffer(): Promise<Uint8Array | null> {
  if (cachedEmblemBuffer) return cachedEmblemBuffer;
  for (const url of LAO_EMBLEM_URLS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        cachedEmblemBuffer = new Uint8Array(ab);
        return cachedEmblemBuffer;
      }
    } catch {
      // Continue to next URL or skip safely
    }
  }
  return null;
}

interface RunOptions {
  bold?: boolean;
  underline?: boolean;
  size?: number; // half-points: 12pt = 24, 14pt = 28
  color?: string;
  isHeading?: boolean;
}

/**
 * Splits plain text into language segments (Lao, English/digits, Chinese/other)
 * and creates appropriately styled TextRuns:
 * - Lao: Phetsarath OT
 * - English & Numerals: Times New Roman
 * - Chinese: SimSun (Body) / SimHei (Heading)
 */
function sanitizeChunkText(rawText: string): string {
  if (!rawText) return "";
  let s = rawText;
  s = s.replace(/p;&nbsp;/gi, ' ');
  s = s.replace(/&nbsp;/gi, '\u00A0');
  s = s.replace(/&amp;/gi, '&');
  s = s.replace(/&lt;/gi, '<');
  s = s.replace(/&gt;/gi, '>');
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/&#39;|&apos;/gi, "'");
  s = s.replace(/\u00A0{6,}/g, ' ________ ');
  return s;
}

function createTextRunsForChunk(text: string, defaultOptions: RunOptions = {}): TextRun[] {
  const cleanInput = sanitizeChunkText(text);
  const defaultSize = defaultOptions.size ?? 24; // 12pt standard
  const defaultColor = defaultOptions.color ?? "1E293B";
  const defaultFont = defaultOptions.isHeading ? FONT_CHINESE_HEADING : FONT_CHINESE_BODY;

  if (!cleanInput) {
    return [
      new TextRun({
        text: "",
        font: {
          ascii: FONT_ENGLISH,
          hAnsi: FONT_ENGLISH,
          eastAsia: defaultFont,
          cs: FONT_LAO,
        },
        size: defaultSize,
        color: defaultColor,
        bold: defaultOptions.bold,
        underline: defaultOptions.underline ? {} : undefined,
        italics: false,
      })
    ];
  }

  const chunks: { text: string; script: 'lao' | 'en' | 'cn' | 'other' }[] = [];
  let currentScript: 'lao' | 'en' | 'cn' | 'other' | '' = '';
  let currentStr = '';

  for (const char of cleanInput) {
    let script: 'lao' | 'en' | 'cn' | 'other' = 'other';
    if (/[\u0E80-\u0EFF]/.test(char)) {
      script = 'lao';
    } else if (/[A-Za-z0-9]/.test(char)) {
      script = 'en';
    } else if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(char)) {
      script = 'cn';
    }

    if (script === 'other' && currentScript) {
      currentStr += char;
    } else if (script === currentScript || !currentScript) {
      currentScript = script || 'other';
      currentStr += char;
    } else {
      chunks.push({ text: currentStr, script: currentScript });
      currentScript = script;
      currentStr = char;
    }
  }
  if (currentStr) {
    chunks.push({ text: currentStr, script: currentScript || 'other' });
  }

  return chunks.map(chunk => {
    const isLao = chunk.script === 'lao';
    const isEnglish = chunk.script === 'en';

    return new TextRun({
      text: chunk.text,
      font: {
        ascii: isEnglish ? FONT_ENGLISH : (isLao ? FONT_LAO : defaultFont),
        hAnsi: isEnglish ? FONT_ENGLISH : (isLao ? FONT_LAO : defaultFont),
        eastAsia: defaultFont,
        cs: FONT_LAO,
      },
      size: defaultSize,
      color: defaultColor,
      bold: defaultOptions.bold,
      underline: defaultOptions.underline ? {} : undefined,
      italics: false, // 严格正体，不得倾斜
    });
  });
}

/**
 * Cleans LaTeX escape sequences into clear standard mathematical unicode representation
 */
function cleanLaTeXSymbols(str: string): string {
  if (!str) return '';
  return str
    .replace(/SDSSDS/g, 'S_{DS}')
    .replace(/SD1SD1/g, 'S_{D1}')
    .replace(/\bTT\b/g, 'T')
    .replace(/\\frac\s*\\frac/g, '\\frac')
    .replace(/TS\s*=\s*TS\s*=/g, 'T_s =')
    .replace(/\\\{S_?\{?DS\}?\\\}/g, 'S_{DS}')
    .replace(/\\\{S_?\{?D1\}?\\\}/g, 'S_{D1}')
    .replace(/(\{S_?\{?D1\}?\})\s*(\{S_?\{?DS\}?\})/g, '\\frac{S_{D1}}{S_{DS}}')
    .replace(/S_?\{?D1\}?\s*\/\s*S_?\{?DS\}/g, '\\frac{S_{D1}}{S_{DS}}')
    .replace(/0\.2\s*\(\s*\\frac\{S_{D1}\}\{S_{DS}\}\s*\)/g, '0.2 \\frac{S_{D1}}{S_{DS}}')
    .replace(/ൌ/g, '=')
    .replace(/൅/g, '+')
    .replace(/ൈ/g, '×')
    .replace(/ሺ/g, '(')
    .replace(/ࣰ/g, ')')
    .replace(/\\cdot(?![a-zA-Z])/g, ' · ')
    .replace(/\\times(?![a-zA-Z])/g, ' × ')
    .replace(/\\pm(?![a-zA-Z])/g, ' ± ')
    .replace(/\\le(q)?(?![a-zA-Z])/g, ' ≤ ')
    .replace(/\\ge(q)?(?![a-zA-Z])/g, ' ≥ ')
    .replace(/\\neq(?![a-zA-Z])/g, ' ≠ ')
    .replace(/\\approx(?![a-zA-Z])/g, ' ≈ ')
    .replace(/\\quad(?![a-zA-Z])/g, '    ')
    .replace(/\\qquad(?![a-zA-Z])/g, '        ')
    .replace(/\\sum(?![a-zA-Z])/g, '∑')
    .replace(/\\prod(?![a-zA-Z])/g, '∏')
    .replace(/\\int(?![a-zA-Z])/g, '∫')
    .replace(/\\infty(?![a-zA-Z])/g, '∞')
    .replace(/\\pi(?![a-zA-Z])/g, 'π')
    .replace(/\\alpha(?![a-zA-Z])/g, 'α')
    .replace(/\\beta(?![a-zA-Z])/g, 'β')
    .replace(/\\gamma(?![a-zA-Z])/g, 'γ')
    .replace(/\\theta(?![a-zA-Z])/g, 'θ')
    .replace(/\\lambda(?![a-zA-Z])/g, 'λ')
    .replace(/\\mu(?![a-zA-Z])/g, 'μ')
    .replace(/\\sigma(?![a-zA-Z])/g, 'σ')
    .replace(/\\omega(?![a-zA-Z])/g, 'ω')
    .replace(/\\Delta(?![a-zA-Z])/g, 'Δ')
    .replace(/\\Sigma(?![a-zA-Z])/g, 'Σ')
    .replace(/\\left\s*([(\[{])/g, '$1')
    .replace(/\\right\s*([)\]}])/g, '$1')
    .replace(/\\left\./g, '')
    .replace(/\\right\./g, '')
    .replace(/\\displaystyle/g, '')
    .replace(/\\limits/g, '')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\boldsymbol\{([^}]*)\}/g, '$1');
}

/**
 * Converts a LaTeX formula string into native Word Office Math (OMML) components
 */
export function parseLatexToDocxMathChildren(rawLatex: string): any[] {
  if (!rawLatex) return [new MathRun('')];

  let latex = rawLatex.trim();
  if (latex.startsWith('$$') && latex.endsWith('$$')) {
    latex = latex.slice(2, -2).trim();
  } else if (latex.startsWith('$') && latex.endsWith('$')) {
    latex = latex.slice(1, -1).trim();
  }

  latex = cleanLaTeXSymbols(latex);

  try {
    const elements: any[] = [];
    let i = 0;

    function findClosingBrace(str: string, startIdx: number): number {
      let depth = 1;
      for (let j = startIdx; j < str.length; j++) {
        if (str[j] === '{') depth++;
        else if (str[j] === '}') {
          depth--;
          if (depth === 0) return j;
        }
      }
      return -1;
    }

    function findClosingBracket(str: string, startIdx: number, openChar: string, closeChar: string): number {
      let depth = 1;
      for (let j = startIdx; j < str.length; j++) {
        if (str[j] === openChar) depth++;
        else if (str[j] === closeChar) {
          depth--;
          if (depth === 0) return j;
        }
      }
      return -1;
    }

    while (i < latex.length) {
      const startI = i;

      // 1. Fractions: \frac{num}{den}
      const fracMatch = latex.substring(i).match(/^\\+frac\b/);
      if (fracMatch) {
        i += fracMatch[0].length;
        while (i < latex.length && /\s/.test(latex[i])) i++;
        if (latex[i] === '{') {
          const endNum = findClosingBrace(latex, i + 1);
          if (endNum !== -1) {
            const numStr = latex.substring(i + 1, endNum);
            i = endNum + 1;
            while (i < latex.length && /\s/.test(latex[i])) i++;
            if (latex[i] === '{') {
              const endDen = findClosingBrace(latex, i + 1);
              if (endDen !== -1) {
                const denStr = latex.substring(i + 1, endDen);
                i = endDen + 1;
                elements.push(
                  new MathFraction({
                    numerator: parseLatexToDocxMathChildren(numStr),
                    denominator: parseLatexToDocxMathChildren(denStr)
                  })
                );
                continue;
              }
            }
          }
        }
      }

      // 2. Square roots & Radicals: \sqrt{...} or \sqrt[n]{...}
      const sqrtMatch = latex.substring(i).match(/^\\+sqrt\b/);
      if (sqrtMatch) {
        i += sqrtMatch[0].length;
        while (i < latex.length && /\s/.test(latex[i])) i++;
        let degreeChildren: any[] | undefined = undefined;
        if (latex[i] === '[') {
          const endDeg = findClosingBracket(latex, i + 1, '[', ']');
          if (endDeg !== -1) {
            const degStr = latex.substring(i + 1, endDeg);
            degreeChildren = parseLatexToDocxMathChildren(degStr);
            i = endDeg + 1;
            while (i < latex.length && /\s/.test(latex[i])) i++;
          }
        }
        if (latex[i] === '{') {
          const endRad = findClosingBrace(latex, i + 1);
          if (endRad !== -1) {
            const radStr = latex.substring(i + 1, endRad);
            i = endRad + 1;
            elements.push(
              new MathRadical({
                children: parseLatexToDocxMathChildren(radStr),
                degree: degreeChildren
              })
            );
            continue;
          }
        }
      }

      // 3. Round brackets: ( ... )
      if (latex[i] === '(') {
        const endParen = findClosingBracket(latex, i + 1, '(', ')');
        if (endParen !== -1) {
          const inside = latex.substring(i + 1, endParen);
          i = endParen + 1;
          const roundBracket = new MathRoundBrackets({
            children: parseLatexToDocxMathChildren(inside)
          });
          let subStr: string | null = null;
          let supStr: string | null = null;
          while (i < latex.length && (latex[i] === '_' || latex[i] === '^')) {
            if (latex[i] === '_') {
              i++;
              if (latex[i] === '{') {
                const endS = findClosingBrace(latex, i + 1);
                subStr = latex.substring(i + 1, endS !== -1 ? endS : undefined);
                i = endS !== -1 ? endS + 1 : latex.length;
              } else {
                subStr = latex[i] || '';
                i++;
              }
            } else if (latex[i] === '^') {
              i++;
              if (latex[i] === '{') {
                const endS = findClosingBrace(latex, i + 1);
                supStr = latex.substring(i + 1, endS !== -1 ? endS : undefined);
                i = endS !== -1 ? endS + 1 : latex.length;
              } else {
                supStr = latex[i] || '';
                i++;
              }
            }
          }
          if (subStr && supStr) {
            elements.push(new MathSubSuperScript({
              children: [roundBracket],
              subScript: parseLatexToDocxMathChildren(subStr),
              superScript: parseLatexToDocxMathChildren(supStr)
            }));
          } else if (subStr) {
            elements.push(new MathSubScript({
              children: [roundBracket],
              subScript: parseLatexToDocxMathChildren(subStr)
            }));
          } else if (supStr) {
            elements.push(new MathSuperScript({
              children: [roundBracket],
              superScript: parseLatexToDocxMathChildren(supStr)
            }));
          } else {
            elements.push(roundBracket);
          }
          continue;
        }
      }

      // 4. Square brackets: [ ... ]
      if (latex[i] === '[') {
        const endBracket = findClosingBracket(latex, i + 1, '[', ']');
        if (endBracket !== -1) {
          const inside = latex.substring(i + 1, endBracket);
          i = endBracket + 1;
          const squareBracket = new MathSquareBrackets({
            children: parseLatexToDocxMathChildren(inside)
          });
          let subStr: string | null = null;
          let supStr: string | null = null;
          while (i < latex.length && (latex[i] === '_' || latex[i] === '^')) {
            if (latex[i] === '_') {
              i++;
              if (latex[i] === '{') {
                const endS = findClosingBrace(latex, i + 1);
                subStr = latex.substring(i + 1, endS !== -1 ? endS : undefined);
                i = endS !== -1 ? endS + 1 : latex.length;
              } else {
                subStr = latex[i] || '';
                i++;
              }
            } else if (latex[i] === '^') {
              i++;
              if (latex[i] === '{') {
                const endS = findClosingBrace(latex, i + 1);
                supStr = latex.substring(i + 1, endS !== -1 ? endS : undefined);
                i = endS !== -1 ? endS + 1 : latex.length;
              } else {
                supStr = latex[i] || '';
                i++;
              }
            }
          }
          if (subStr && supStr) {
            elements.push(new MathSubSuperScript({
              children: [squareBracket],
              subScript: parseLatexToDocxMathChildren(subStr),
              superScript: parseLatexToDocxMathChildren(supStr)
            }));
          } else if (subStr) {
            elements.push(new MathSubScript({
              children: [squareBracket],
              subScript: parseLatexToDocxMathChildren(subStr)
            }));
          } else if (supStr) {
            elements.push(new MathSuperScript({
              children: [squareBracket],
              superScript: parseLatexToDocxMathChildren(supStr)
            }));
          } else {
            elements.push(squareBracket);
          }
          continue;
        }
      }

      // 5. Curly braces: { ... }
      if (latex[i] === '{') {
        const endBrace = findClosingBrace(latex, i + 1);
        if (endBrace !== -1) {
          const inside = latex.substring(i + 1, endBrace);
          i = endBrace + 1;
          elements.push(...parseLatexToDocxMathChildren(inside));
          continue;
        }
      }

      // 6. Variable with Subscript / Superscript: e.g. C_{vx}, w_x h_x^k, ∑_{i=1}^n, ∫_{0}^{T}
      const baseMatch = latex.substring(i).match(/^([A-Za-z0-9πναβγθλμσωΔΣ∫∑∏\u2200-\u22FF\u0370-\u03FF\u2100-\u214F]+)/);
      if (baseMatch) {
        const baseText = baseMatch[1];
        const nextChar = latex[i + baseText.length];
        if (nextChar === '_' || nextChar === '^') {
          i += baseText.length;
          let subStr: string | null = null;
          let supStr: string | null = null;
          while (i < latex.length && (latex[i] === '_' || latex[i] === '^')) {
            if (latex[i] === '_') {
              i++;
              if (latex[i] === '{') {
                const endS = findClosingBrace(latex, i + 1);
                subStr = latex.substring(i + 1, endS !== -1 ? endS : undefined);
                i = endS !== -1 ? endS + 1 : latex.length;
              } else {
                subStr = latex[i] || '';
                i++;
              }
            } else if (latex[i] === '^') {
              i++;
              if (latex[i] === '{') {
                const endS = findClosingBrace(latex, i + 1);
                supStr = latex.substring(i + 1, endS !== -1 ? endS : undefined);
                i = endS !== -1 ? endS + 1 : latex.length;
              } else {
                supStr = latex[i] || '';
                i++;
              }
            }
          }
          if (subStr && supStr) {
            elements.push(
              new MathSubSuperScript({
                children: [new MathRun(baseText)],
                subScript: parseLatexToDocxMathChildren(subStr),
                superScript: parseLatexToDocxMathChildren(supStr)
              })
            );
          } else if (subStr) {
            elements.push(
              new MathSubScript({
                children: [new MathRun(baseText)],
                subScript: parseLatexToDocxMathChildren(subStr)
              })
            );
          } else if (supStr) {
            elements.push(
              new MathSuperScript({
                children: [new MathRun(baseText)],
                superScript: parseLatexToDocxMathChildren(supStr)
              })
            );
          }
          continue;
        }
      }

      // 7. Plain text / Operators / Non-scripted tokens
      let plainChunk = '';
      while (i < latex.length) {
        if (
          latex.substring(i).match(/^\\+frac\b/) ||
          latex.substring(i).match(/^\\+sqrt\b/) ||
          latex[i] === '(' ||
          latex[i] === '[' ||
          latex[i] === '{'
        ) {
          break;
        }
        const peekSubSup = latex.substring(i).match(/^([A-Za-z0-9πναβγθλμσωΔΣ\u2200-\u22FF\u0370-\u03FF\u2100-\u214F]+)(_|\^)/);
        if (peekSubSup) {
          break;
        }
        plainChunk += latex[i];
        i++;
      }

      if (plainChunk) {
        elements.push(new MathRun(plainChunk));
      }

      // Guaranteed progress safety guard on any unhandled/malformed character
      if (i === startI) {
        elements.push(new MathRun(latex[i]));
        i++;
      }
    }

    return elements.length > 0 ? elements : [new MathRun(latex)];
  } catch (err) {
    console.warn("Math formula parsing fallback:", err);
    return [new MathRun(latex)];
  }
}

/**
 * Parses markdown inline text (*bold*, `code`, math $...$, plain).
 * Enforces strictly upright text (italics: false) across all elements.
 * Correctly assigns Phetsarath OT to Lao, Times New Roman to English, SimSun/SimHei to Chinese,
 * and converts mathematical expressions ($...$) to native Office Math.
 */
function parseInlineRuns(text: string, defaultOptions: RunOptions = {}): any[] {
  if (!text) {
    return createTextRunsForChunk('', defaultOptions);
  }

  const runs: any[] = [];
  // Tokenize markdown bold (**), underline (<u>, <ins>), tags (<b>, <strong>), inline math ($...$), code (`...`), plain text
  const regex = /(<u>\*\*[\s\S]*?\*\*<\/u>|\*\*<u>[\s\S]*?<\/u>\*\*|<u>[\s\S]*?<\/u>|<ins>[\s\S]*?<\/ins>|\*\*[\s\S]*?\*\*|<b>[\s\S]*?<\/b>|<strong>[\s\S]*?<\/strong>|\$[^\$\n]+?\$|`[^`\n]+?`|\*[^\*\n]+?\*|(?:(?!<u>|<ins>|\*\*|<b>|<strong>|\$|`|\*)[\s\S])+)/gi;
  const matches = text.match(regex);

  if (!matches) {
    return createTextRunsForChunk(text, defaultOptions);
  }

  for (const part of matches) {
    // Both bold and underline: <u>**...**</u> or **<u>...</u>**
    if (/^<u>\*\*([\s\S]*?)\*\*<\/u>$/i.test(part) || /^\*\*<u>([\s\S]*?)<\/u>\*\*$/i.test(part)) {
      const inner = part
        .replace(/^<u>\*\*/i, '')
        .replace(/\*\*<\/u>$/i, '')
        .replace(/^\*\*<u>/i, '')
        .replace(/<\/u>\*\*$/i, '');
      runs.push(
        ...createTextRunsForChunk(inner, {
          ...defaultOptions,
          bold: true,
          underline: true,
          color: defaultOptions.color ?? "0F172A",
        })
      );
    } else if (/^<(?:u|ins)>([\s\S]*?)<\/(?:u|ins)>$/i.test(part)) {
      const inner = part.replace(/^<(?:u|ins)>/i, '').replace(/<\/(?:u|ins)>$/i, '');
      const hasBold = /^\*\*([\s\S]*?)\*\*$/.test(inner) || /^<b>([\s\S]*?)<\/b>$/i.test(inner) || /^<strong>([\s\S]*?)<\/strong>$/i.test(inner);
      const cleanInner = inner.replace(/^\*\*|^<b>|^<strong>/i, '').replace(/\*\*$|<\/b>$|<\/strong>$/i, '');
      runs.push(
        ...createTextRunsForChunk(cleanInner, {
          ...defaultOptions,
          bold: defaultOptions.bold || hasBold,
          underline: true,
          color: defaultOptions.color ?? (hasBold ? "0F172A" : "1E293B"),
        })
      );
    } else if (/^(?:\*\*([\s\S]*?)\*\*|<b>([\s\S]*?)<\/b>|<strong>([\s\S]*?)<\/strong>)$/i.test(part)) {
      const inner = part.replace(/^\*\*|^<b>|^<strong>/i, '').replace(/\*\*$|<\/b>$|<\/strong>$/i, '');
      const hasUnderline = /^<u>([\s\S]*?)<\/u>$/i.test(inner) || /^<ins>([\s\S]*?)<\/ins>$/i.test(inner);
      const cleanInner = inner.replace(/^<u>|^<ins>/i, '').replace(/<\/u>$|<\/ins>$/i, '');
      runs.push(
        ...createTextRunsForChunk(cleanInner, {
          ...defaultOptions,
          bold: true,
          underline: defaultOptions.underline || hasUnderline,
          color: defaultOptions.color ?? "0F172A",
        })
      );
    } else if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      // Inline math formula -> native Office Math
      const mathFormula = part.slice(1, -1).trim();
      const mathChildren = parseLatexToDocxMathChildren(mathFormula);
      runs.push(
        new DMath({
          children: mathChildren
        })
      );
    } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      // All text must remain upright
      runs.push(
        ...createTextRunsForChunk(part.slice(1, -1), {
          ...defaultOptions,
          color: defaultOptions.color ?? "1E293B",
        })
      );
    } else if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      runs.push(
        ...createTextRunsForChunk(part.slice(1, -1), {
          ...defaultOptions,
          color: "0F766E",
        })
      );
    } else {
      runs.push(
        ...createTextRunsForChunk(part, defaultOptions)
      );
    }
  }

  return runs;
}

export async function exportMarkdownToDocx(markdown: string, documentTitle: string = "翻译公文"): Promise<Blob> {
  const cleanMarkdown = normalizeMarkdown(markdown);
  const lines = cleanMarkdown.split(/\r?\n/);
  const docElements: (Paragraph | Table)[] = [];

  // Preload high-definition Lao national emblem
  const emblemBuffer = await getLaoEmblemBuffer();

  let i = 0;
  while (i < lines.length) {
    const loopStartIndex = i;
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    if (line.includes('【工程技术参数') || line.includes('【数据块') || line.includes('【工程技术参数 / 数据块')) {
      i++;
      continue;
    }

    // 0.00 Embedded Image Markdown: ![caption](data:image/... or url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const altText = imgMatch[1].trim();
      const imgSrc = imgMatch[2].trim();
      let imgBuffer: Uint8Array | null = null;
      if (imgSrc.startsWith('data:image/')) {
        imgBuffer = dataUrlToUint8Array(imgSrc);
      }

      if (imgBuffer) {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: 'png',
                data: imgBuffer,
                transformation: {
                  width: 520,
                  height: 360,
                },
              }),
            ],
            spacing: { before: 120, after: 60 },
          })
        );
        if (altText) {
          docElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: altText,
                  bold: true,
                  size: 20,
                  color: "0F172A",
                  font: {
                    ascii: FONT_ENGLISH,
                    eastAsia: FONT_CHINESE_HEADING,
                    cs: FONT_LAO,
                  },
                }),
              ],
              spacing: { before: 40, after: 120, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
            })
          );
        }
        i++;
        continue;
      }
    }

    // 0.0 Raw embedded <svg>...</svg> Vector Drawing / Icon / Diagram
    if (line.startsWith('<svg') || (line.includes('<svg') && !line.startsWith('|'))) {
      const svgLines: string[] = [line];
      if (!line.includes('</svg>')) {
        i++;
        while (i < lines.length && !lines[i].includes('</svg>')) {
          svgLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          svgLines.push(lines[i]);
          i++;
        }
      } else {
        i++;
      }
      const rawSvgBlock = svgLines.join('\n');
      const rendered = await renderSvgToPngBuffer(rawSvgBlock, 540);
      if (rendered) {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: 'png',
                data: rendered.buffer,
                transformation: {
                  width: 540,
                  height: Math.min(rendered.height, 500),
                },
              }),
            ],
            spacing: { before: 100, after: 60 },
          })
        );
        if (rendered.caption) {
          docElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: rendered.caption,
                  bold: true,
                  size: 21,
                  color: "0F172A",
                  font: {
                    ascii: FONT_ENGLISH,
                    eastAsia: FONT_CHINESE_HEADING,
                    cs: FONT_LAO,
                  },
                }),
              ],
              spacing: { before: 40, after: 120, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
            })
          );
        }
        continue;
      }
    }

    // 0. Standalone / Multiline LaTeX block formula ($$...$$)
    if (line.startsWith('$$')) {
      let formulaText = '';
      if (line.endsWith('$$') && line.length >= 4) {
        formulaText = line.slice(2, -2).trim();
        i++;
      } else {
        const formulaLines: string[] = [line.slice(2)];
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          formulaLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const lastLine = lines[i].trim();
          formulaLines.push(lastLine.slice(0, -2));
          i++;
        }
        formulaText = formulaLines.join(' ').trim();
      }

      const mathChildren = parseLatexToDocxMathChildren(formulaText);
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new DMath({
              children: mathChildren
            })
          ],
          spacing: { before: 140, after: 140, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
        })
      );
      continue;
    }

    // 0.5 Code blocks / Engineering Diagram Blocks -> High-DPI Image Embedding
    if (line.startsWith('```')) {
      const codeType = line.slice(3).trim().toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      const blockContent = codeLines.join('\n');

      const isSvg = codeType.includes('svg') || blockContent.includes('<svg') || (codeType === 'xml' && blockContent.includes('<svg'));
      const isDocMargin = codeType.includes('margin') || (codeType.includes('layout') && (blockContent.includes('marginLeft') || blockContent.includes('margins:') || blockContent.includes('装订') || blockContent.includes('binding')));
      const isHeaderGrid = codeType.includes('header') || codeType.includes('letterhead') || (codeType.includes('layout') && (blockContent.includes('countryName') || blockContent.includes('ministry') || blockContent.includes('motto')));
      const isSignatureSeal = codeType.includes('seal') || codeType.includes('signature') || blockContent.includes('sealDiameter') || blockContent.includes('signatory') || blockContent.includes('骑年盖月');
      const isFlowchart = codeType.includes('flowchart') || codeType.includes('process') || (blockContent.includes('steps:') && (blockContent.includes('->') || blockContent.includes('→') || blockContent.includes('- ')));
      const isSpectrum = codeType.includes('spectrum') || codeType.includes('response') || codeType.includes('engineering-diagram') || codeType.includes('diagram') || blockContent.includes('SDS') || blockContent.includes('curves:') || blockContent.includes('segment:');
      const isWind = codeType.includes('wind') || codeType.includes('pressure');
      const isLayout = codeType.includes('layout') || codeType.includes('spec-sheet') || codeType.includes('blueprint');
      const isDiagram = codeType.includes('diagram') || codeType.includes('chart') || codeType.includes('figure') || codeType.includes('drawing') || codeType.includes('detail') || blockContent.includes('caption:');

      let chartImageBuffer: Uint8Array | null = null;
      let figureCaption = "";
      let topFormulas: string[] = [];
      let customHeight: number | null = null;

      if (isSvg) {
        const svgRes = await renderSvgToPngBuffer(blockContent, 540);
        if (svgRes) {
          chartImageBuffer = svgRes.buffer;
          figureCaption = svgRes.caption || "图示：矢量工程图样与构造示意图";
          customHeight = Math.min(svgRes.height, 500);
        }
      } else if (isDocMargin) {
        const opts = parseDocMarginBlock(blockContent);
        chartImageBuffer = generateDocMarginLayoutPng(opts);
        figureCaption = opts.caption || "图示：A4 国家行政公文版心尺寸与装订边距界线图";
      } else if (isHeaderGrid) {
        const opts = parseHeaderGridBlock(blockContent);
        chartImageBuffer = generateHeaderGridLayoutPng(opts);
        figureCaption = opts.caption || "图示：老挝国家行政公文标头网格定位与尺寸对照";
      } else if (isSignatureSeal) {
        const opts = parseSignatureSealBlock(blockContent);
        chartImageBuffer = generateSignatureSealLayoutPng(opts);
        figureCaption = opts.caption || "图示：老挝国家公章偏位与签署区相对位置规范图";
      } else if (isFlowchart) {
        const flowOpts = parseFlowchartBlock(blockContent);
        chartImageBuffer = generateFlowchartPng(blockContent);
        figureCaption = flowOpts.caption || flowOpts.title || "Flowchart (verify structure against source)";
      } else if (isSpectrum) {
        const params = parseSpectrumBlock(blockContent);
        // Fidelity Guard: Only render synthetic plot if explicit parameters were detected in document
        if (params.hasExplicitParameters) {
          chartImageBuffer = generateResponseSpectrumChartPng(params);
          figureCaption = params.caption || "图示：设计加速度反应谱曲线 (依据文中实测参数计算绘制)";
        } else {
          // Fallback: Do not emit fabricated curve! Formatted as technical parameter explanation block.
          figureCaption = params.caption || "图示：设计加速度反应谱说明（参数未详列，请以原件图样为准）";
        }
      } else if (isWind) {
        const params = parseWindBlock(blockContent);
        chartImageBuffer = generateWindPressureChartPng(params);
        figureCaption = params.caption || "图 6.2 建筑结构风压沿高度分布图 (Wind Pressure Profile)";
        if (params.formulas) topFormulas = params.formulas;
      } else if (isLayout) {
        const opts = parseSpecSheetBlock(blockContent);
        chartImageBuffer = generateSpecSheetLayoutPng(opts);
        figureCaption = opts.caption || "图示：标准版面与装订标尺样张";
      } else if (isDiagram) {
        const params = parseDiagramBlock(blockContent);
        // Fidelity Guard: Do not emit fake generic geometric boxes ("基准跨度 L"); only render if explicit parameters exist
        if (params.parameters && Object.keys(params.parameters).length > 0) {
          chartImageBuffer = generateEngineeringDiagramPng(params);
          figureCaption = params.caption || "图示：几何构造与尺寸标注特征图";
        }
        if (params.formulas) topFormulas = params.formulas;
      }

      if (chartImageBuffer) {
        // If there are formulas above/surrounding the figure, render them as math runs above the image
        if (topFormulas.length > 0) {
          topFormulas.forEach(formStr => {
            const mathChildren = parseLatexToDocxMathChildren(formStr);
            docElements.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new DMath({ children: mathChildren })],
                spacing: { before: 120, after: 60, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
              })
            );
          });
        }

        // Embed REAL high-DPI image directly into Word document
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: 'png',
                data: chartImageBuffer,
                transformation: {
                  width: 540,
                  height: customHeight || (isFlowchart ? 486 : (isSpectrum ? 288 : (isWind ? 265 : (isLayout ? 330 : 295)))),
                },
              }),
            ],
            spacing: { before: 100, after: 60 },
          })
        );
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: figureCaption,
                bold: true,
                size: 21, // 10.5pt (五号字规范图注)
                color: "0F172A",
                font: {
                  ascii: FONT_ENGLISH,
                  eastAsia: FONT_CHINESE_HEADING,
                  cs: FONT_LAO,
                },
              }),
            ],
            spacing: { before: 40, after: 120, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
          })
        );
        // Check if next line is a duplicate caption paragraph and skip it
        if (i < lines.length && (lines[i].trim() === figureCaption.trim() || (lines[i].trim().startsWith('图') && lines[i].trim().length > 5 && figureCaption.includes(lines[i].trim().slice(0, 10))))) {
          i++;
        }
        continue;
      }

      const isAuditBlock = codeType.includes('audit') || codeType.includes('params') || blockContent.includes('DIAGRAM-AUDIT-PARAMETERS') || (blockContent.trim().startsWith('[') && blockContent.includes('name'));
      if (isAuditBlock) {
        continue;
      }

      // If pure text code block (not a graphical diagram), format neatly
      const title = `【工程技术参数 / 数据块: ${codeType.toUpperCase() || 'CODE'}】`;
      docElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: title,
                          bold: true,
                          size: 22,
                          color: "0F766E",
                          font: { ascii: FONT_ENGLISH, eastAsia: FONT_CHINESE_HEADING, cs: FONT_LAO },
                        }),
                      ],
                      spacing: { before: 80, after: 60 },
                    }),
                    ...codeLines.map(
                      cLine =>
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: cLine,
                              size: 20,
                              font: {
                                ascii: cLine.includes('=') || cLine.includes('T') ? "Cambria Math" : "Consolas",
                                eastAsia: FONT_CHINESE_BODY,
                                cs: FONT_LAO,
                              },
                              color: "1E293B",
                            }),
                          ],
                          spacing: { before: 30, after: 30, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
                        })
                    ),
                  ],
                  margins: { top: 100, bottom: 100, left: 140, right: 140 },
                }),
              ],
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: "0D9488" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
        })
      );
      docElements.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }

    // 1. Table Detection
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map(c => c.trim());

        const isDivider = tableLines[1].replace(/[\s|:-]/g, '').length === 0;
        const dataRows = isDivider ? tableLines.slice(2) : tableLines.slice(1);

        const rawDataRows = dataRows.map(rowLine =>
          rowLine.split('|').slice(1, -1).map(c => c.trim())
        );

        // Calculate maximum columns across header and all rows so NO columns are ever truncated
        let maxCols = Math.max(headerCells.length, 1);
        rawDataRows.forEach(cells => {
          if (cells.length > maxCols) maxCols = cells.length;
        });

        const expandedHeaderCells = [...headerCells];
        while (expandedHeaderCells.length < maxCols) {
          expandedHeaderCells.push('');
        }

        const fullBlockText = tableLines.join('\n');
        const prevLineIndex = i - tableLines.length - 1;
        const prevLine = prevLineIndex >= 0 ? lines[prevLineIndex] : '';
        const isThreeLineTable = 
          prevLine.includes('three-line') || 
          prevLine.includes('三线表') || 
          fullBlockText.includes('three-line') || 
          fullBlockText.includes('三线表');

        const headerCellBorders = isThreeLineTable ? {
          top: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "1E293B" },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        } : {
          top: { style: BorderStyle.SINGLE, size: 8, color: "334155" },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "334155" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        };

        const tableRowElements: TableRow[] = [];

        // Header Row (Table header bold with light background & explicit cell borders)
        tableRowElements.push(
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: expandedHeaderCells.map(
              cellText => {
                const subLines = cellText.split(/<br\s*\/?>/i);
                return new TableCell({
                  shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
                  borders: headerCellBorders,
                  children: subLines.map(sLine => 
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: parseInlineRuns(sLine.trim(), { bold: true, color: "0F172A", size: 21, isHeading: true }),
                      spacing: { before: 60, after: 60, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
                    })
                  ),
                  margins: {
                    top: 100,
                    bottom: 100,
                    left: 120,
                    right: 120,
                  },
                });
              }
            ),
          })
        );

        // Data Rows
        rawDataRows.forEach((cells, rowIndex) => {
          const expandedCells = [...cells];
          while (expandedCells.length < maxCols) {
            expandedCells.push('');
          }

          const isLastRow = rowIndex === rawDataRows.length - 1;
          const dataCellBorders = isThreeLineTable ? {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.SINGLE, size: isLastRow ? 8 : 2, color: isLastRow ? "1E293B" : "E2E8F0" },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          } : {
            top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            bottom: { style: BorderStyle.SINGLE, size: isLastRow ? 8 : 4, color: isLastRow ? "334155" : "CBD5E1" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          };

          tableRowElements.push(
            new TableRow({
              cantSplit: true,
              children: expandedCells.map(
                cellText => {
                  const subLines = cellText.split(/<br\s*\/?>/i);
                  return new TableCell({
                    shading: {
                      fill: rowIndex % 2 === 1 ? "F1F5F9" : "FFFFFF",
                      type: ShadingType.CLEAR,
                    },
                    borders: dataCellBorders,
                    children: subLines.map(sLine => 
                      new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: parseInlineRuns(sLine.trim(), { size: 20 }),
                        spacing: { before: 40, after: 40, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
                      })
                    ),
                    margins: {
                      top: 80,
                      bottom: 80,
                      left: 120,
                      right: 120,
                    },
                  });
                }
              ),
            })
          );
        });

        const tableBorders = isThreeLineTable ? {
          top: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "64748B" },
          insideVertical: { style: BorderStyle.NONE },
        } : {
          // 100% Full Grid Table (全部框线：上下左右 + 内部横竖框线全复现)
          top: { style: BorderStyle.SINGLE, size: 8, color: "334155" },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "334155" },
          left: { style: BorderStyle.SINGLE, size: 8, color: "334155" },
          right: { style: BorderStyle.SINGLE, size: 8, color: "334155" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        };

        docElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRowElements,
            borders: tableBorders,
          })
        );
        docElements.push(new Paragraph({ spacing: { after: 120 } }));
      }
      continue;
    }

    // 2. Emblem / Header Detection & Vector Icons
    if (
      line.includes('[徽标') ||
      line.includes('[国徽') ||
      line.includes('[机构徽标') ||
      line.includes('[图标:') ||
      line.includes('[图标：') ||
      line.includes('[Emblem') ||
      line.includes('徽标: 老挝')
    ) {
      const orgMatch = line.match(/\[(?:徽标|国徽|机构徽标|图标|Emblem)[：:]\s*([^\]]+)\]/i);
      const orgName = orgMatch ? orgMatch[1].trim() : "国家与行业标准组织";
      const emblemImg = emblemBuffer || generateUniversalEmblemPng(orgName);
      if (emblemImg) {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: 'png',
                data: emblemImg,
                transformation: {
                  width: 72,
                  height: 72,
                },
              }),
            ],
            spacing: { before: 100, after: 80 },
          })
        );
      }
      i++;
      continue;
    }

    // 3. Headings
    if (line.startsWith('#')) {
      const level = (line.match(/^#+/) || ['#'])[0].length;
      const headingText = line.replace(/^#+\s*/, '').trim();

      const isCountryHeader = headingText.includes('老挝人民民主共和国') || headingText.includes('ສາທາລະນະລັດ');
      const isMotto = headingText.includes('和平 独立 民主 统一 繁荣') || headingText.includes('ສັນຕິພາບ');

      const isCenteredHeading = isCountryHeader || isMotto || level === 1;

      docElements.push(
        new Paragraph({
          heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          alignment: isCenteredHeading ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: parseInlineRuns(headingText, {
            bold: true,
            size: isMotto ? 24 : 28,
            color: "0F172A",
            isHeading: true,
          }),
          spacing: {
            before: isMotto ? 40 : 160,
            after: isMotto ? 160 : 80,
            line: LINE_SPACING_1_15,
            lineRule: LineRuleType.AUTO,
          },
        })
      );
      i++;
      continue;
    }

    // 4. Bullet lists
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const itemText = line.replace(/^[-*•]\s*/, '').trim();
      docElements.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineRuns(itemText, { size: 24 }),
          spacing: { before: 40, after: 40, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
        })
      );
      i++;
      continue;
    }

    // 5. Standard Body Paragraphs
    const isRightAligned = line.includes('万象市') || line.includes('日期:') || line.includes('签署:');
    docElements.push(
      new Paragraph({
        alignment: isRightAligned ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: parseInlineRuns(line, { size: 24 }),
        spacing: { before: 50, after: 50, line: LINE_SPACING_1_15, lineRule: LineRuleType.AUTO },
      })
    );
    i++;

    if (i === loopStartIndex) {
      i++;
    }
  }

  // A4 Paper: 210 x 297 mm
  // Margins: Top 20mm, Bottom 20mm, Left 30mm (Binding), Right 20mm
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(30),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        children: docElements.length > 0 ? docElements : [
          new Paragraph({
            children: [
              new TextRun({
                text: documentTitle,
                font: { ascii: FONT_ENGLISH, eastAsia: FONT_CHINESE_HEADING, cs: FONT_LAO },
                size: 28,
                bold: true,
              })
            ]
          })
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Downloads a markdown document as a formatted Word (.docx) file
 */
export async function downloadDocx(markdown: string, filename: string = "公文翻译.docx"): Promise<void> {
  const blob = await exportMarkdownToDocx(markdown, filename.replace(/\.docx$/i, ''));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
