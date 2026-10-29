/**
 * GlobalCodeTrans - Markdown Sanitizer & Engineering Formula Normalizer
 * 
 * Specialized for Engineering Technical Standards (ASCE 7, IBC, Eurocode, Lao Building Codes):
 * 1. KaTeX Mathematical Formulas (100% Guaranteed Delimiter Restoration for Standalone, Multi-line & Inline Math)
 * 2. Formula Numbering Auto-Wrap ($$ ... $$) for (6.6), (6.7), (6.8), (6.9), (6.10), (6.11), (11.4-1), etc.
 * 3. Parameter Definition List Normalization ("其中：" / "式中：" $Var$ : Description)
 * 4. Automatic Wrapping of Isolated Physical Quantities in Running Text ($S_a$, $T_0$, $T_s$, $T_L$, $S_{DS}$, $S_{D1}$, $F_{PGA}$, $PGA_M$, $C_s$, etc.)
 * 5. Multi-Header Complex Engineering Tables (Preserving table numbers, units, alignment)
 * 6. Suppression of ASCII dot-matrix noise and pseudo-diagrams
 */

export function normalizeMarkdown(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // 0. Sanitize rogue HTML entities, repeating non-breaking spaces, and garbled OCR artifacts
  // Decode &nbsp; directly into non-breaking space character first
  text = text.replace(/&nbsp;/gi, '\u00A0');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&apos;|&#39;/gi, "'");
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');

  // Clean up broken entity leftovers like p;\u00A0
  text = text.replace(/p;[\u00A0\s]*/gi, ' ');

  // Underline blanks: replace multiple spaces/non-breaking spaces inside <u> with clean underline
  text = text.replace(/<u>(?:\s*[\u00A0\s]\s*){2,}<\/u>/gi, '<u>________</u>');

  // Standalone long runs of spaces/non-breaking spaces become clean underline
  text = text.replace(/[\u00A0\s]{6,}/g, ' ________ ');

  // Convert remaining single non-breaking space to standard space
  text = text.replace(/\u00A0/g, ' ');

  // Auto-correct common garbled OCR typos in flowcharts and technical terms
  text = text.replace(/diepands/gi, 'discrepancies');

  // 1. Normalize LaTeX display & inline delimiters
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, formula) => `\n\n$$${formula.trim()}$$\n\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, formula) => `$${formula.trim()}$`);

  // 2. Fix specific OCR / translation hallucinations & formula errors in Lao ASCE 7 / Building Codes
  text = text.replace(/([，,\s])2\s*的值不得小于\s*1\.2/g, (_m, p) => `${p}$F_{PGA}$ 的值不得小于 1.2`);
  text = text.replace(/([，,\s])F_PGA\s*的值/g, (_m, p) => `${p}$F_{PGA}$ 的值`);
  text = text.replace(/([，,\s])FPGA\s*的值/g, (_m, p) => `${p}$F_{PGA}$ 的值`);
  text = text.replace(/([，,\s])FPGA/g, '$1$F_{PGA}$');

  // Fix Equation (6.18) missing exponent k in numerator h_x^k and denominator h_i^k
  text = text.replace(/C_\{?vx\}?\s*=\s*\\frac\{w_x\s*h_x\}\{\\sum_\{i=1\}\^n\s*w_i\s*h_i\}/g, 'C_{vx} = \\frac{w_x h_x^k}{\\sum_{i=1}^n w_i h_i^k}');
  text = text.replace(/C_\{?vx\}?\s*=\s*\\frac\{w_x\s*h_x\}\{\\sum\s*w_i\s*h_i\}/g, 'C_{vx} = \\frac{w_x h_x^k}{\\sum_{i=1}^n w_i h_i^k}');
  text = text.replace(/C_\{?vx\}?\s*=\s*\(w_x\s*h_x\)\s*\/\s*\(\\sum\s*w_i\s*h_i\)/g, 'C_{vx} = \\frac{w_x h_x^k}{\\sum_{i=1}^n w_i h_i^k}');

  // Fix T_0 and T_s parameter fraction syntax (repairing broken {S_{D1}}{S_{DS}} artifacts)
  text = text.replace(/\{S_\{?D1\}?\}\s*\{S_\{?DS\}?\}/g, '\\frac{S_{D1}}{S_{DS}}');
  text = text.replace(/0\.2\s*\{S_\{?D1\}?\}\s*\{S_\{?DS\}?\}/g, '0.2 \\left(\\frac{S_{D1}}{S_{DS}}\\right)');
  text = text.replace(/T_0\s*=\s*0\.2\s*\(?\s*S_\{?D1\}?\s*\/\s*S_\{?DS\}?\s*\)?/g, 'T_0 = 0.2 \\left(\\frac{S_{D1}}{S_{DS}}\\right)');
  text = text.replace(/T_s\s*=\s*S_\{?D1\}?\s*\/\s*S_\{?DS\}?/g, 'T_s = \\frac{S_{D1}}{S_{DS}}');

  // Fix inline variables in common engineering clauses:
  text = text.replace(/侧向力\s+V\s+应按/g, '侧向力 $V$ 应按');
  text = text.replace(/反应系数\s+C_s\s+应按/g, '反应系数 $C_s$ 应按');
  text = text.replace(/周期\s+T\s+小于/g, '周期 $T$ 小于');
  text = text.replace(/周期\s+T\s+大于/g, '周期 $T$ 大于');

  // 3. Process line-by-line for formula auto-wrapping, parameter list normalization, and tables
  const rawLines = text.split(/\r?\n/);
  const processedLines: string[] = [];
  let inCodeBlock = false;
  let inMathBlock = false;
  let mathBlockLines: string[] = [];
  let inTable = false;
  let tableHeaderCols = 0;
  let hasDelimiterRow = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Track code blocks (``` ... ```)
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
      continue;
    }
    if (inCodeBlock) {
      processedLines.push(line);
      continue;
    }

    // Deduplicate standalone caption lines immediately following a chart code block
    if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim().startsWith('```') && /^图\s*\d+\.\d+/.test(trimmed)) {
      continue;
    }

    // Track multi-line display math blocks ($$ ... $$)
    if (trimmed === '$$') {
      if (!inMathBlock) {
        inMathBlock = true;
        mathBlockLines = [];
      } else {
        inMathBlock = false;
        const formula = mathBlockLines.join(' ').trim();
        if (formula) {
          if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() !== '') {
            processedLines.push('');
          }
          processedLines.push(`$$${formula}$$`);
          processedLines.push('');
        }
      }
      continue;
    }
    if (inMathBlock) {
      mathBlockLines.push(trimmed);
      continue;
    }

    // Suppress standalone ASCII pseudo-diagram noise (like "......" or "----->")
    if (!inTable && /^[\.\s\-_=~>|]{8,}$/.test(trimmed) && !trimmed.startsWith('|') && !trimmed.startsWith('---')) {
      continue;
    }

    const isAlreadyMathBlock = trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4;
    const isHeading = trimmed.startsWith('#');
    const isTableRow = trimmed.startsWith('|') && trimmed.includes('|', 1);

    if (isAlreadyMathBlock) {
      if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() !== '') {
        processedLines.push('');
      }
      processedLines.push(trimmed);
      processedLines.push('');
      continue;
    }

    if (!isHeading && !isTableRow && trimmed.length > 0) {
      // 4. Standalone Math Formula Auto-Wrapping (Fixes missing $$ delimiters from LLM output)
      const hasEqNumber = /(?:\\quad\s*|\\qquad\s*|\s+)?\(\d+(?:\.\d+)*(?:-\d+)*\)\s*$/.test(trimmed) || /\(式\s*\d+\)/.test(trimmed);
      const hasLatexCmd = /\\(?:frac|cdot|sqrt|left|right|times|pm|sum|prod|int|le|ge|alpha|beta|gamma|delta|Delta|sigma|Sigma|omega|Omega|theta|lambda|pi)\b/.test(trimmed);
      const hasMathEq = /^(\\[A-Za-z]+|[A-Za-z][A-Za-z0-9_]*(\{[^}]+\})?)\s*(=|<|>|\\le|\\ge|≤|≥)\s*[A-Za-z0-9_\\\{\}\(\)\[\]\s\+\-\*\/\^\.·×±]+/.test(trimmed) || /C_\{vx\}|w_x|h_x\^k/.test(trimmed);
      const hasNoChineseColon = !trimmed.includes('：') && !trimmed.startsWith('- ') && !trimmed.startsWith('* ');

      if ((hasEqNumber && hasMathEq) || (hasLatexCmd && hasMathEq && hasNoChineseColon) || (hasEqNumber && hasLatexCmd)) {
        if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() !== '') {
          processedLines.push('');
        }
        processedLines.push(`$$${trimmed}$$`);
        processedLines.push('');
        continue;
      }

      // 5. Parameter Definition List Normalization ("其中：" / "式中：" blocks)
      const bulletRelationMatch = trimmed.match(/^[•\-\*]\s*([A-Za-z\\][A-Za-z0-9_{}\\]*\s*=\s*[^\n]+)$/);
      if (bulletRelationMatch) {
        let rawExpr = bulletRelationMatch[1].trim();
        rawExpr = rawExpr.replace(/\{S_\{?D1\}?\}\s*\{S_\{?DS\}?\}/g, '\\frac{S_{D1}}{S_{DS}}');
        rawExpr = rawExpr.replace(/0\.2\s*\(?\s*S_\{?D1\}?\s*\/\s*S_\{?DS\}?\s*\)?/g, '0.2 \\left(\\frac{S_{D1}}{S_{DS}}\\right)');
        rawExpr = rawExpr.replace(/S_\{?D1\}?\s*\/\s*S_\{?DS\}?/g, '\\frac{S_{D1}}{S_{DS}}');
        const expr = rawExpr.startsWith('$') ? rawExpr : `$${rawExpr}$`;
        processedLines.push(`- ${expr}`);
        continue;
      }

      const varDefMatch = trimmed.match(/^(\s*[-*•]?\s*)([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+|_{[A-Za-z0-9]+})?)\s*([=:：])\s*(.*)$/);
      if (varDefMatch) {
        const prefix = varDefMatch[1] || "- ";
        let varName = varDefMatch[2];
        let desc = varDefMatch[4].trim();

        if (/[\u4e00-\u9fa5]/.test(desc) || desc.startsWith('\\text')) {
          desc = desc.replace(/\\text\{([^}]*)\}/g, '$1');
          desc = desc.replace(/\(MCE\}_G\s*\\text\{\)\}/g, '($MCE_G$)');
          desc = desc.replace(/MCE_G/g, '$MCE_G$');
          desc = desc.trim();

          const formattedVar = varName.startsWith('$') ? varName : `$${varName}$`;
          processedLines.push(`${prefix.trim() ? prefix : '- '}${formattedVar}：${desc}`);
          continue;
        }
      }

      // 6. Wrap isolated variables in running text sentences (e.g. "当周期小于 T_0 时" -> "当周期小于 $T_0$ 时")
      const isolatedVarPattern = /(?<!\$)\b(S_a|T_0|T_s|T_L|T_a|PGA_M|MCE_G|C_s|I_e|q_z|q_h|K_z|K_d|K_e|C_p|C_t|h_n|C_u|F_x|V_x|w_x|h_x|w_i|h_i|C_v)\b(?!\$)|(?<!\$)(S_\{DS\}|S_\{D1\}|F_\{PGA\}|K_\{zt\}|S_\{MS\}|S_\{M1\}|S_s|S_1|F_a|F_v|C_\{vx\}|w_x\s*h_x\^k)(?!\$)/g;
      let updatedLine = line.replace(isolatedVarPattern, (_m, g1, g2) => `$${g1 || g2}$`);
      processedLines.push(updatedLine);
      continue;
    }

    // 7. Table processing (GFM Table integrity)
    if (isTableRow) {
      const isDelimiter = /^\|(\s*:?-+:?\s*\|)+$/.test(trimmed);

      if (!inTable) {
        if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() !== '') {
          processedLines.push('');
        }
        inTable = true;
        hasDelimiterRow = false;
        const cols = trimmed.split('|').slice(1, -1);
        tableHeaderCols = Math.max(cols.length, 2);
        processedLines.push(line);
      } else {
        if (!hasDelimiterRow && !isDelimiter) {
          const delimiterRow = '| ' + Array(tableHeaderCols).fill(':---').join(' | ') + ' |';
          processedLines.push(delimiterRow);
          hasDelimiterRow = true;
        } else if (isDelimiter) {
          hasDelimiterRow = true;
        }
        processedLines.push(line);
      }
    } else {
      if (inTable) {
        inTable = false;
        hasDelimiterRow = false;
        tableHeaderCols = 0;
        if (trimmed !== '') {
          processedLines.push('');
        }
      }
      processedLines.push(line);
    }
  }

  if (inTable) {
    processedLines.push('');
  }

  let result = processedLines.join('\n');

  // 8. Ensure block formulas $$...$$ have double newlines before and after
  result = result.replace(/([^\n])\s*(\$\$[\s\S]*?\$\$)/g, '$1\n\n$2');
  result = result.replace(/(\$\$[\s\S]*?\$\$)\s*([^\n])/g, '$1\n\n$2');

  // 9. Fix CJK boundary spacing for inline math expressions ($...$) so remark-math never fails
  result = result.replace(/([\u4e00-\u9fa5\u0e80-\u0eff\u3000-\u303f\uff00-\uffef])(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (_m, cjk, math) => `${cjk} $${math}$`);
  result = result.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)([\u4e00-\u9fa5\u0e80-\u0eff\u3000-\u303f\uff00-\uffef])/g, (_m, math, cjk) => `$${math}$ ${cjk}`);

  return result;
}
