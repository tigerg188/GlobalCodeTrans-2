/**
 * GlobalCodeTrans - Diagram Parameter Audit Utility
 * 
 * Automatically parses engineering diagram parameters, formulas, and chart annotations
 * from translation output into structured parameter cards for side-by-side verification.
 */

export interface AuditParameterItem {
  id: string;
  name: string;
  value: string;
  unit: string;
  location: string;
  category: 'spectrum' | 'wind' | 'structure' | 'formula' | 'spec';
  status: 'ok' | 'warning' | 'info';
  note?: string;
}

export function parseDiagramAuditParameters(markdown: string): AuditParameterItem[] {
  if (!markdown) return [];

  const items: AuditParameterItem[] = [];
  const seenKeys = new Set<string>();

  const addItem = (item: Omit<AuditParameterItem, 'id'>) => {
    const key = `${item.name.toLowerCase()}_${item.value}_${item.location}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    items.push({
      id: `param_${Math.random().toString(36).slice(2, 9)}`,
      ...item
    });
  };

  // 1. Parse JSON block inside ```diagram-audit-parameters ... ``` if generated
  const jsonBlockMatch = markdown.match(/```(?:diagram-audit-parameters|audit-params|chart-params)\s*\n([\s\S]*?)\n```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (p && (p.name || p.param || p.parameter)) {
            const name = p.name || p.param || p.parameter || '未知参数';
            const value = p.value || p.val || '未确定';
            const unit = p.unit || p.u || '-';
            const location = p.location || p.source || p.caption || '工程图纸';
            const statusStr = String(p.status || '');
            const isOk = statusStr.includes('无误') || statusStr.includes('一致') || statusStr.includes('正常') || statusStr.includes('匹配');
            const isWarn = statusStr.includes('比对') || statusStr.includes('警示') || statusStr.includes('差异') || statusStr.includes('核对');

            let category: AuditParameterItem['category'] = 'structure';
            if (/spectrum|反应谱|地震|SDS|SD1|T0|Ts/i.test(name + location)) category = 'spectrum';
            else if (/wind|风压|风速|z_max|Cp|Kd|Kzt/i.test(name + location)) category = 'wind';
            else if (/formula|公式|方程|计算|式/i.test(name + location)) category = 'formula';
            else if (/page|margin|border|公文|版心|标尺/i.test(name + location)) category = 'spec';

            addItem({
              name,
              value,
              unit,
              location,
              category,
              status: isWarn ? 'warning' : (isOk ? 'ok' : 'info'),
              note: p.note || p.description || p.status || '已提取识图参数'
            });
          }
        }
      }
    } catch {
      // Ignore JSON parse errors in codeblocks
    }
  }

  // 2. Parse ```chart:response-spectrum blocks
  const spectrumMatches = markdown.matchAll(/```chart:response-spectrum[\s\S]*?\n```/g);
  for (const match of spectrumMatches) {
    const block = match[0];
    const captionMatch = block.match(/caption:\s*([^\n]+)/i) || block.match(/title:\s*([^\n]+)/i);
    const loc = captionMatch ? captionMatch[1].trim() : '图 6.1 设计加速度反应谱曲线';

    const paramLine = block.match(/parameters:\s*([^\n]+)/i);
    if (paramLine) {
      const line = paramLine[1];
      const pairs = line.split(/[,;\s]+/);
      for (const pair of pairs) {
        const kv = pair.match(/([A-Za-z0-9_\{\}]+)\s*=\s*([0-9\.]+)([a-zA-Z%]*)/);
        if (kv) {
          const rawName = kv[1];
          let name = rawName;
          let unit = kv[3] || '';
          if (rawName.includes('SDS')) { name = '短周期设计加速度 SDS'; unit = unit || 'g'; }
          else if (rawName.includes('SD1')) { name = '1.0秒设计加速度 SD1'; unit = unit || 'g'; }
          else if (rawName.includes('T0')) { name = '反应谱起始拐点 T0'; unit = unit || 's'; }
          else if (rawName.includes('Ts')) { name = '反应谱平台终止拐点 Ts'; unit = unit || 's'; }
          else if (rawName.includes('TL')) { name = '长周期转变拐点 TL'; unit = unit || 's'; }

          addItem({
            name,
            value: kv[2],
            unit,
            location: loc,
            category: 'spectrum',
            status: 'ok',
            note: '已识出坐标系特征拐点'
          });
        }
      }
    }
  }

  // 3. Parse ```chart:wind-pressure blocks
  const windMatches = markdown.matchAll(/```chart:wind-pressure[\s\S]*?\n```/g);
  for (const match of windMatches) {
    const block = match[0];
    const captionMatch = block.match(/caption:\s*([^\n]+)/i) || block.match(/title:\s*([^\n]+)/i);
    const loc = captionMatch ? captionMatch[1].trim() : '图 6.2 建筑结构风压沿高度分布图';

    const paramLine = block.match(/parameters:\s*([^\n]+)/i);
    if (paramLine) {
      const line = paramLine[1];
      const pairs = line.split(/[,;\s]+/);
      for (const pair of pairs) {
        const kv = pair.match(/([A-Za-z0-9_]+)\s*=\s*([0-9\.]+|[A-Z0-9]+)([a-zA-Z\/]*)/);
        if (kv) {
          const rawName = kv[1];
          let name = rawName;
          let unit = kv[3] || '';
          if (rawName === 'V') { name = '基本风速 V'; unit = unit || 'm/s'; }
          else if (rawName === 'Exposure') { name = '地面粗糙度类别 Exposure'; unit = unit || '-'; }
          else if (rawName === 'Kd') { name = '风向系数 Kd'; unit = unit || '-'; }
          else if (rawName === 'Kzt') { name = '地形系数 Kzt'; unit = unit || '-'; }
          else if (rawName.includes('max') || rawName.includes('height') || rawName === 'H') { name = '建筑最高高度 H'; unit = unit || 'm'; }

          addItem({
            name,
            value: kv[2],
            unit,
            location: loc,
            category: 'wind',
            status: 'ok',
            note: '风荷载计算参数'
          });
        }
      }
    }
  }

  // 4. Parse ```chart:engineering-diagram blocks
  const diagramMatches = markdown.matchAll(/```chart:engineering-diagram[\s\S]*?\n```/g);
  for (const match of diagramMatches) {
    const block = match[0];
    const captionMatch = block.match(/caption:\s*([^\n]+)/i) || block.match(/title:\s*([^\n]+)/i);
    const loc = captionMatch ? captionMatch[1].trim() : '工程构造与剖面示意图';

    const paramLine = block.match(/parameters:\s*([^\n]+)/i);
    if (paramLine) {
      const line = paramLine[1];
      const pairs = line.split(/[,;\s]+/);
      for (const pair of pairs) {
        const kv = pair.match(/([A-Za-z0-9_]+)\s*=\s*([0-9\.]+|[A-Za-z0-9]+)([a-zA-Z\/]*)/);
        if (kv) {
          addItem({
            name: `结构参数 ${kv[1]}`,
            value: kv[2],
            unit: kv[3] || '-',
            location: loc,
            category: 'structure',
            status: 'ok',
            note: '节点/构件标高尺寸'
          });
        }
      }
    }
  }

  // 5. Parse "其中：" / "式中：" variable list items ($Var$ : description)
  const varDefRegex = /(?:-|\*|•)\s*\$([A-Za-z0-9_\{\}\\]+)\$\s*[：:]\s*([^\n]+)/g;
  let varMatch;
  while ((varMatch = varDefRegex.exec(markdown)) !== null) {
    const varSymbol = varMatch[1].replace(/[\{\}\\]/g, '');
    const desc = varMatch[2].trim();
    if (desc) {
      // Extract numeric value from desc if present
      const valMatch = desc.match(/([0-9\.]+)\s*([a-zA-Z%m\/s]+)?/);
      addItem({
        name: `变量 $${varSymbol}$ (${desc.split(/[\(（,，;；]/)[0]})`,
        value: valMatch ? valMatch[1] : '符号定义',
        unit: valMatch && valMatch[2] ? valMatch[2] : '公式参数',
        location: '结构与荷载计算公式条文',
        category: 'formula',
        status: 'info',
        note: desc
      });
    }
  }

  return items;
}

export function exportAuditParametersToCsv(items: AuditParameterItem[], fileName: string = '图表参数复核表.csv') {
  if (!items || items.length === 0) return;

  const headers = ['参数名称', '识别数值', '物理单位', '图表/条文来源', '参数类别', '核对状态', '说明'];
  const rows = items.map(item => [
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.value.replace(/"/g, '""')}"`,
    `"${item.unit.replace(/"/g, '""')}"`,
    `"${item.location.replace(/"/g, '""')}"`,
    `"${item.category}"`,
    `"${item.status === 'ok' ? '正常' : (item.status === 'warning' ? '需要核对' : '参考')}"`,
    `"${(item.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
