/**
 * GlobalCodeTrans - Engineering Chart Parameter Extractor
 * 
 * Automatically parses translated engineering markdown and diagram blocks
 * to extract structured technical parameters (Name, Symbol, Value, Unit, Source Graphic).
 */

export interface ExtractedChartParameter {
  id: string;
  symbol: string;             // e.g. "SDS", "T0", "V", "qz", "H", "Cp", "Ta"
  name: string;               // e.g. "短周期设计加速度反应谱参数"
  value: string;              // e.g. "1.05", "0.08", "45", "60"
  unit: string;               // e.g. "g", "s", "m/s", "N/m²", "m", "kN"
  sourceDiagram: string;      // e.g. "图 6.1 设计加速度反应谱曲线"
  category: 'seismic' | 'wind' | 'geometry' | 'load' | 'formula' | 'general';
  confidence: 'high' | 'medium' | 'review_required';
  pageNumber?: number;
  rawLine?: string;
}

/**
 * Categorizes parameters based on symbol or name
 */
function inferCategory(symbol: string, name: string): 'seismic' | 'wind' | 'geometry' | 'load' | 'formula' | 'general' {
  const sym = symbol.toLowerCase();
  const nm = name.toLowerCase();

  if (sym.includes('s_d') || sym.includes('sds') || sym.includes('sd1') || sym.includes('t0') || sym.includes('ts') || sym.includes('tl') || sym.includes('pga') || nm.includes('地震') || nm.includes('反应谱') || nm.includes('周期')) {
    return 'seismic';
  }
  if (sym.includes('v') || sym.includes('q_z') || sym.includes('qz') || sym.includes('c_p') || sym.includes('cp') || sym.includes('kd') || sym.includes('kzt') || nm.includes('风压') || nm.includes('风速') || nm.includes('迎风')) {
    return 'wind';
  }
  if (sym.includes('h') || sym.includes('z') || sym.includes('l') || sym.includes('span') || nm.includes('高度') || nm.includes('跨度') || nm.includes('尺寸') || nm.includes('标高')) {
    return 'geometry';
  }
  if (sym.includes('p') || sym.includes('w') || sym.includes('q') || nm.includes('荷载') || nm.includes('重力') || nm.includes('剪力')) {
    return 'load';
  }
  if (nm.includes('公式') || nm.includes('计算式') || sym.includes('=')) {
    return 'formula';
  }
  return 'general';
}

/**
 * Extracts parameters from a Markdown string
 */
export function extractChartParameters(markdown: string): ExtractedChartParameter[] {
  if (!markdown) return [];

  const results: ExtractedChartParameter[] = [];
  const seenIds = new Set<string>();

  const lines = markdown.split(/\r?\n/);
  let currentDiagramTitle = "工程图纸/规范条款";
  let inAuditBlock = false;
  let inCodeBlock = false;
  let codeBlockType = "";
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code blocks (```chart:... or ```chart-audit:parameters)
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockType = trimmed.slice(3).trim().toLowerCase();
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        const blockContent = codeBlockLines.join('\n');

        // Process chart-audit:parameters block
        if (codeBlockType.includes('audit')) {
          parseAuditBlockContent(blockContent, currentDiagramTitle, results, seenIds);
        }
        // Process standard chart blocks (spectrum, wind, diagram)
        else if (codeBlockType.includes('chart') || codeBlockType.includes('spectrum') || codeBlockType.includes('wind') || codeBlockType.includes('diagram')) {
          parseChartBlockContent(codeBlockType, blockContent, results, seenIds);
        }
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(trimmed);
      continue;
    }

    // Detect figure captions (图 X.X xxx)
    const captionMatch = trimmed.match(/^图\s*(\d+(?:\.\d+)*)\s*(.*)/);
    if (captionMatch) {
      currentDiagramTitle = trimmed.replace(/\*+/g, '');
    }

    // Parse inline parameter definition lines like:
    // "- $S_{DS}$：短周期设计反应谱加速度参数"
    // "- $T_0 = 0.2 \left(\frac{S_{D1}}{S_{DS}}\right)$"
    // "• V = 45 m/s (设计基本风速)"
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const bulletContent = trimmed.replace(/^[-\*•]\s*/, '').replace(/\*+/g, '');

      // Pattern 1: $Symbol$：Name
      const paramDefMatch = bulletContent.match(/^\$?([A-Za-z0-9_\{\}\\\^]+)\$?\s*[:：]\s*(.*)/);
      if (paramDefMatch) {
        const symbol = paramDefMatch[1].replace(/[\$\\]/g, '').trim();
        const desc = paramDefMatch[2].trim();

        // Check if desc contains value & unit
        const valMatch = desc.match(/([0-9\.]+)\s*([A-Za-z°℃\/%²³]+)?/);
        const val = valMatch ? valMatch[1] : "-";
        const unit = valMatch && valMatch[2] ? valMatch[2] : "";

        addParam(results, seenIds, {
          symbol,
          name: desc.split(/[(（\s]/)[0] || desc,
          value: val,
          unit: unit,
          sourceDiagram: currentDiagramTitle,
          rawLine: trimmed,
        });
        continue;
      }

      // Pattern 2: $Symbol = Value Unit$ (Description)
      const paramEqMatch = bulletContent.match(/^\$?([A-Za-z0-9_\{\}\\\^]+)\$?\s*=\s*([0-9\.]+)\s*([A-Za-z\/%²³]+)?\s*(?:\(([^)]+)\)|（([^）]+)）)?/);
      if (paramEqMatch) {
        const symbol = paramEqMatch[1].replace(/[\$\\]/g, '').trim();
        const val = paramEqMatch[2];
        const unit = paramEqMatch[3] || "";
        const name = paramEqMatch[4] || paramEqMatch[5] || `${symbol} 参数`;

        addParam(results, seenIds, {
          symbol,
          name,
          value: val,
          unit,
          sourceDiagram: currentDiagramTitle,
          rawLine: trimmed,
        });
      }
    }
  }

  return results;
}

function parseAuditBlockContent(content: string, defaultDiagramTitle: string, results: ExtractedChartParameter[], seenIds: Set<string>) {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[-\*•]\s*/, '');
    if (!trimmed) continue;

    // Pattern: $Symbol$ = Value Unit (Name | Diagram)
    const match = trimmed.match(/^\$?([A-Za-z0-9_\{\}\\\^]+)\$?\s*=\s*([^\s(（]+)(?:\s*([A-Za-z\/%²³\u4e00-\u9fa5]+))?\s*(?:\(([^|）)]+)(?:\|([^)]+))?\)|（([^|）]+)(?:\|([^）]+))?）)?/);
    if (match) {
      const symbol = match[1].replace(/[\$\\]/g, '').trim();
      const val = match[2];
      const unit = match[3] || "";
      const name = match[4] || match[6] || `${symbol} 参数`;
      const diagram = match[5] || match[7] || defaultDiagramTitle;

      addParam(results, seenIds, {
        symbol,
        name: name.trim(),
        value: val,
        unit: unit.trim(),
        sourceDiagram: diagram.trim(),
        rawLine: line,
      });
    } else {
      // Fallback simple line
      const simpleMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(.*)/);
      if (simpleMatch) {
        addParam(results, seenIds, {
          symbol: simpleMatch[1],
          name: `${simpleMatch[1]} 参数`,
          value: simpleMatch[2],
          unit: "",
          sourceDiagram: defaultDiagramTitle,
          rawLine: line,
        });
      }
    }
  }
}

function parseChartBlockContent(codeType: string, content: string, results: ExtractedChartParameter[], seenIds: Set<string>) {
  let diagramTitle = "工程结构图表";
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('title:')) {
      diagramTitle = trimmed.replace('title:', '').trim();
    } else if (trimmed.startsWith('caption:')) {
      diagramTitle = trimmed.replace('caption:', '').trim();
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('parameters:') || trimmed.includes('T0') || trimmed.includes('SDS') || trimmed.includes('V=')) {
      const paramStr = trimmed.replace('parameters:', '').trim();
      const parts = paramStr.split(/[,;\n]/);

      for (const p of parts) {
        const kv = p.trim().match(/([A-Za-z0-9_\{\}\^]+)\s*=\s*([0-9\.]+)\s*([A-Za-z\/%²³]*)/);
        if (kv) {
          const symbol = kv[1];
          const val = kv[2];
          const unit = kv[3] || "";

          let name = `${symbol} 技术参数`;
          if (symbol === 'T0' || symbol === 'T_0') name = "短周期拐点周期";
          else if (symbol === 'Ts' || symbol === 'T_s') name = "反应谱平段终止周期";
          else if (symbol === 'TL' || symbol === 'T_L') name = "长周期转换周期";
          else if (symbol === 'SDS' || symbol === 'S_DS') name = "设计反应谱短周期加速度";
          else if (symbol === 'SD1' || symbol === 'S_D1') name = "设计反应谱 1 秒周期加速度";
          else if (symbol === 'V') name = "设计基本风速";
          else if (symbol === 'H' || symbol === 'z_max') name = "建筑结构总高度";
          else if (symbol === 'Kd') name = "风压风向系数";
          else if (symbol === 'Kzt') name = "地形风压放大系数";

          addParam(results, seenIds, {
            symbol,
            name,
            value: val,
            unit,
            sourceDiagram: diagramTitle,
            rawLine: p,
          });
        }
      }
    }
  }
}

function addParam(results: ExtractedChartParameter[], seenIds: Set<string>, p: { symbol: string; name: string; value: string; unit: string; sourceDiagram: string; rawLine?: string }) {
  const id = `${p.symbol}_${p.value}_${p.sourceDiagram}`.toLowerCase();
  if (seenIds.has(id)) return;
  seenIds.add(id);

  results.push({
    id,
    symbol: p.symbol,
    name: p.name,
    value: p.value,
    unit: p.unit,
    sourceDiagram: p.sourceDiagram,
    category: inferCategory(p.symbol, p.name),
    confidence: p.value !== "-" ? 'high' : 'medium',
    rawLine: p.rawLine,
  });
}
