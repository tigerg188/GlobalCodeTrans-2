/**
 * GlobalCodeTrans - LaTeX Formula Consistency Checker & Correction Engine
 * 
 * Compares source LaTeX formulas with translated LaTeX output,
 * detects structural anomalies, KaTeX syntax errors, missing exponents/fractions,
 * highlights discrepancies, and provides real-time in-place correction.
 */
import katex from 'katex';

export interface LatexFormulaItem {
  id: string;
  index: number;
  rawTarget: string;         // The exact raw substring in the translated markdown (including $$ or $)
  cleanTarget: string;       // Math content without enclosing $ or $$
  isDisplay: boolean;        // true if $$...$$, false if $...$
  eqNumber?: string;         // e.g. "(6.10)", "(6.18)"
  sourceFormula?: string;    // Matched source formula if available
  suggestedFix?: string;     // Recommended corrected formula
  hasMismatch: boolean;      // Whether a discrepancy or structural error is detected
  status: 'consistent' | 'warning' | 'error';
  diagnostics: string[];     // Detailed explanation of mismatched structures
  lineIndex?: number;
}

export interface FormulaConsistencyReport {
  totalCount: number;
  consistentCount: number;
  mismatchCount: number;
  errorCount: number;
  items: LatexFormulaItem[];
}

/**
 * Extracts formula numbering like "(6.9)", "(6.10)", "(6.18)", "(11.4-1)"
 */
function extractEqNumber(formula: string): string | undefined {
  const match = formula.match(/(?:\\quad|\\qquad|\s+)?\(((?:\d+\.?)+(?:-\d+)?)\)\s*$/);
  if (match) return `(${match[1]})`;
  const plainMatch = formula.match(/\((\d+(?:\.\d+)+(?:-\d+)?)\)/);
  if (plainMatch) return `(${plainMatch[1]})`;
  return undefined;
}

/**
 * Validates KaTeX compilability and captures exact syntax errors
 */
function testKaTeX(formula: string, displayMode: boolean): { isValid: boolean; errorMsg?: string } {
  try {
    katex.renderToString(formula, {
      displayMode,
      throwOnError: true,
      strict: false,
    });
    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, errorMsg: err?.message || 'KaTeX 语法解析失败' };
  }
}

/**
 * Inspects a LaTeX formula for structural anomalies against standard engineering conventions
 */
function analyzeFormulaStructure(
  raw: string,
  clean: string,
  isDisplay: boolean,
  sourceFormula?: string
): { diagnostics: string[]; suggestedFix?: string; status: 'consistent' | 'warning' | 'error' } {
  const diagnostics: string[] = [];
  let suggested = clean;
  let hasError = false;
  let hasWarning = false;

  // 1. Test KaTeX syntax
  const katexTest = testKaTeX(clean, isDisplay);
  if (!katexTest.isValid) {
    hasError = true;
    diagnostics.push(`语法错误: ${katexTest.errorMsg?.replace(/^KaTeX parse error:\s*/i, '') || '无法解析'}`);
  }

  // 2. Check for unbalanced curly braces
  let openBraces = 0;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{' && (i === 0 || clean[i - 1] !== '\\')) openBraces++;
    if (clean[i] === '}' && (i === 0 || clean[i - 1] !== '\\')) openBraces--;
  }
  if (openBraces !== 0) {
    hasError = true;
    diagnostics.push(`花括号不匹配: 缺少 ${openBraces > 0 ? openBraces + ' 个闭合 \"}\"' : Math.abs(openBraces) + ' 个开放 \"{\"'}`);
  }

  // 3. Structural check: Missing fraction syntax (e.g. {S_{D1}}{S_{DS}} without \frac)
  if (/\{[^{}]+?\}\s*\{[^{}]+?\}/.test(clean) && !clean.includes('\\frac')) {
    hasWarning = true;
    diagnostics.push('分式结构异常: 检测到花括号裸露相邻，缺少 \\frac 引导');
    suggested = suggested.replace(/\{([^{}]+?)\}\s*\{([^{}]+?)\}/g, '\\frac{$1}{$2}');
  }

  // 4. Structural check: Equation (6.18) missing exponent k on h_x or h_i
  if (/C_\{?vx\}?/.test(clean) || /w_x\s*h_x/.test(clean) || /w_i\s*h_i/.test(clean)) {
    if ((clean.includes('w_x h_x') && !clean.includes('h_x^k')) || (clean.includes('w_i h_i') && !clean.includes('h_i^k'))) {
      hasWarning = true;
      diagnostics.push('关键指数缺失: 式 (6.18) 中高度指数 ^k 未保留 (h_x 或 h_i 缺少 ^k)');
      suggested = suggested
        .replace(/w_x\s*h_x(?!\^)/g, 'w_x h_x^k')
        .replace(/w_i\s*h_i(?!\^)/g, 'w_i h_i^k');
    }
  }

  // 5. Structural check: F_PGA transcription
  if (/FPGA\b/.test(clean) && !clean.includes('F_{PGA}')) {
    hasWarning = true;
    diagnostics.push('场地系数符号异常: "FPGA" 建议规范化为 F_{PGA}');
    suggested = suggested.replace(/\bFPGA\b/g, 'F_{PGA}');
  }

  // 6. Structural check: T0 and Ts fraction format
  if (/T_0\s*=\s*0\.2\s*\(?S_\{?D1\}?\s*\/\s*S_\{?DS\}?\)?/.test(clean)) {
    hasWarning = true;
    diagnostics.push('特征周期表达建议: T_0 分式应使用 0.2 \\left(\\frac{S_{D1}}{S_{DS}}\\right)');
    suggested = suggested.replace(/0\.2\s*\(?S_\{?D1\}?\s*\/\s*S_\{?DS\}?\)?/g, '0.2 \\left(\\frac{S_{D1}}{S_{DS}}\\right)');
  }

  // 7. Structural check: Chinese text inside math without \text{}
  const rawChineseMatch = clean.match(/[\u4e00-\u9fa5]+/g);
  if (rawChineseMatch) {
    const hasRawChinese = rawChineseMatch.some(cn => !clean.includes(`\\text{${cn}}`) && !clean.includes(`\\mathrm{${cn}}`));
    if (hasRawChinese) {
      hasWarning = true;
      diagnostics.push('公式内混入裸露汉字: 数学模式内汉字建议使用 \\text{...} 包裹或移至“其中：”列表');
    }
  }

  // 8. If source formula is provided, compare structures universally
  if (sourceFormula && sourceFormula.trim()) {
    const cleanSource = sourceFormula.replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim();
    
    // Universal LaTeX commands to exclude from variable checking
    const latexCommands = new Set([
      'frac', 'left', 'right', 'sum', 'prod', 'int', 'quad', 'qquad', 'text', 'mathrm',
      'mathbf', 'mathit', 'cdot', 'times', 'div', 'sqrt', 'alpha', 'beta', 'gamma',
      'delta', 'epsilon', 'theta', 'lambda', 'mu', 'nu', 'pi', 'rho', 'sigma', 'tau',
      'phi', 'psi', 'omega', 'Delta', 'Sigma', 'Omega', 'leq', 'geq', 'neq', 'approx',
      'in', 'partial', 'infty', 'limits', 'to', 'over', 'overbrace', 'underbrace'
    ]);

    // Extract dynamic symbols & subscripts from source formula (e.g. PGA_M, F_{PGA}, h_x, w_i, C_s, etc.)
    const symbolRegex = /\\?([A-Za-z]+(?:_\{?[A-Za-z0-9]+\}?)?)/g;
    let sm;
    const extractedSourceSymbols = new Set<string>();
    while ((sm = symbolRegex.exec(cleanSource)) !== null) {
      const sym = sm[1];
      if (sym && !latexCommands.has(sym) && sym.length >= 1) {
        extractedSourceSymbols.add(sym);
      }
    }

    // Check missing key variables from source
    for (const v of extractedSourceSymbols) {
      const vSimple = v.replace(/[\{\}]/g, '');
      const sourceHas = cleanSource.includes(v) || cleanSource.includes(vSimple);
      const targetHas = clean.includes(v) || clean.includes(vSimple);
      if (sourceHas && !targetHas) {
        hasWarning = true;
        diagnostics.push(`变量缺失: 原文包含符号 ${v}，译文公式中未找到`);
      }
    }

    // Check fraction count consistency
    const sourceFracs = (cleanSource.match(/\\frac/g) || []).length;
    const targetFracs = (clean.match(/\\frac/g) || []).length;
    if (sourceFracs !== targetFracs && sourceFracs > 0) {
      hasWarning = true;
      diagnostics.push(`分式数量不匹配: 原文含 ${sourceFracs} 个分式，译文含 ${targetFracs} 个分式`);
    }

    // Check square root count consistency
    const sourceSqrts = (cleanSource.match(/\\sqrt/g) || []).length;
    const targetSqrts = (clean.match(/\\sqrt/g) || []).length;
    if (sourceSqrts !== targetSqrts && sourceSqrts > 0) {
      hasWarning = true;
      diagnostics.push(`根号数量不匹配: 原文含 ${sourceSqrts} 个 \\sqrt，译文含 ${targetSqrts} 个`);
    }

    // Check exponent counts
    const sourcePowers = (cleanSource.match(/\^/g) || []).length;
    const targetPowers = (clean.match(/\^/g) || []).length;
    if (sourcePowers > targetPowers) {
      hasWarning = true;
      diagnostics.push(`上标指数缺失: 原文包含 ${sourcePowers} 处上标 (^)，译文仅含 ${targetPowers} 处`);
    }
  }

  const status = hasError ? 'error' : (hasWarning ? 'warning' : 'consistent');
  return {
    diagnostics,
    suggestedFix: suggested !== clean ? suggested : undefined,
    status
  };
}

/**
 * Extracts and inspects all LaTeX formulas from translated Markdown
 * and optionally matches with source markdown formulas
 */
export function inspectLatexConsistency(
  translatedMarkdown: string,
  sourceText?: string
): FormulaConsistencyReport {
  if (!translatedMarkdown) {
    return { totalCount: 0, consistentCount: 0, mismatchCount: 0, errorCount: 0, items: [] };
  }

  // 1. Extract source formulas if source text available
  const sourceFormulas: { eqNo?: string; formula: string; clean: string }[] = [];
  if (sourceText) {
    const srcDisplayRegex = /\$\$([\s\S]*?)\$\$/g;
    let sm;
    while ((sm = srcDisplayRegex.exec(sourceText)) !== null) {
      const clean = sm[1].trim();
      const eqNo = extractEqNumber(clean);
      sourceFormulas.push({ eqNo, formula: sm[0], clean });
    }
  }

  const items: LatexFormulaItem[] = [];
  let index = 0;

  // 2. Extract Display Math ($$ ... $$)
  const displayRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;
  while ((match = displayRegex.exec(translatedMarkdown)) !== null) {
    index++;
    const rawTarget = match[0];
    const cleanTarget = match[1].trim();
    const eqNumber = extractEqNumber(cleanTarget);

    // Try finding matching source formula by equation number or sequential index
    let matchedSource: string | undefined;
    if (eqNumber) {
      const found = sourceFormulas.find(s => s.eqNo === eqNumber);
      if (found) matchedSource = found.clean;
    }
    if (!matchedSource && sourceFormulas[index - 1]) {
      matchedSource = sourceFormulas[index - 1].clean;
    }

    const analysis = analyzeFormulaStructure(rawTarget, cleanTarget, true, matchedSource);

    items.push({
      id: `math_disp_${index}_${Math.random().toString(36).slice(2, 7)}`,
      index,
      rawTarget,
      cleanTarget,
      isDisplay: true,
      eqNumber,
      sourceFormula: matchedSource,
      suggestedFix: analysis.suggestedFix,
      hasMismatch: analysis.status !== 'consistent',
      status: analysis.status,
      diagnostics: analysis.diagnostics
    });
  }

  // 3. Extract Inline Math ($ ... $) (ignoring currency symbols like $100 or already extracted display math)
  const inlineRegex = /(?<!\$)\$([^\$\n]+?)\$(?!\$)/g;
  let inMatch;
  while ((inMatch = inlineRegex.exec(translatedMarkdown)) !== null) {
    const rawTarget = inMatch[0];
    const cleanTarget = inMatch[1].trim();

    // Skip pure numbers or currency
    if (/^[0-9\.,\s]+$/.test(cleanTarget)) continue;
    // Skip if extremely short non-math string
    if (cleanTarget.length === 1 && !/[A-Za-z\\]/.test(cleanTarget)) continue;

    index++;
    const eqNumber = extractEqNumber(cleanTarget);
    const analysis = analyzeFormulaStructure(rawTarget, cleanTarget, false);

    items.push({
      id: `math_inl_${index}_${Math.random().toString(36).slice(2, 7)}`,
      index,
      rawTarget,
      cleanTarget,
      isDisplay: false,
      eqNumber,
      suggestedFix: analysis.suggestedFix,
      hasMismatch: analysis.status !== 'consistent',
      status: analysis.status,
      diagnostics: analysis.diagnostics
    });
  }

  const consistentCount = items.filter(it => it.status === 'consistent').length;
  const mismatchCount = items.filter(it => it.status === 'warning').length;
  const errorCount = items.filter(it => it.status === 'error').length;

  return {
    totalCount: items.length,
    consistentCount,
    mismatchCount,
    errorCount,
    items
  };
}

/**
 * Replaces a target formula in the full Markdown document
 */
export function replaceFormulaInMarkdown(
  markdown: string,
  targetItem: LatexFormulaItem,
  newCleanFormula: string
): string {
  const newRaw = targetItem.isDisplay ? `$$${newCleanFormula}$$` : `$${newCleanFormula}$`;
  return markdown.replace(targetItem.rawTarget, newRaw);
}

/**
 * Batch auto-fixes all detected structural defects across all formulas in the document
 */
export function batchAutoFixAllFormulas(markdown: string): { updatedMarkdown: string; fixedCount: number } {
  let text = markdown;
  let fixedCount = 0;

  const report = inspectLatexConsistency(text);
  for (const item of report.items) {
    if (item.suggestedFix && item.suggestedFix !== item.cleanTarget) {
      const newRaw = item.isDisplay ? `$$${item.suggestedFix}$$` : `$${item.suggestedFix}$`;
      text = text.replace(item.rawTarget, newRaw);
      fixedCount++;
    }
  }

  return { updatedMarkdown: text, fixedCount };
}
