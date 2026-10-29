import React, { useState, useMemo } from 'react';
import { 
  Check, 
  AlertTriangle, 
  XCircle, 
  Copy, 
  Wand2, 
  Search, 
  X, 
  Sparkles, 
  ArrowRight,
  RefreshCw,
  Eye,
  CheckCircle2,
  FileCode,
  Edit3
} from 'lucide-react';
import katex from 'katex';
import { 
  LatexFormulaItem, 
  inspectLatexConsistency, 
  replaceFormulaInMarkdown, 
  batchAutoFixAllFormulas 
} from '../utils/latexConsistencyChecker';

interface LatexConsistencyPanelProps {
  markdown: string;
  sourceText?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdateMarkdown: (newMarkdown: string) => void;
}

export const LatexConsistencyPanel: React.FC<LatexConsistencyPanelProps> = ({
  markdown,
  sourceText,
  isOpen,
  onClose,
  onUpdateMarkdown,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mismatch' | 'consistent' | 'display'>('all');
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [editInputVal, setEditInputVal] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Run consistency analysis
  const report = useMemo(() => {
    return inspectLatexConsistency(markdown, sourceText);
  }, [markdown, sourceText]);

  // Filter items
  const filteredItems = useMemo(() => {
    return report.items.filter(item => {
      const matchSearch = 
        item.cleanTarget.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.eqNumber && item.eqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.diagnostics.some(d => d.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (filterType === 'mismatch') return item.hasMismatch;
      if (filterType === 'consistent') return !item.hasMismatch;
      if (filterType === 'display') return item.isDisplay;
      return true;
    });
  }, [report.items, searchTerm, filterType]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = (item: LatexFormulaItem) => {
    setEditingFormulaId(item.id);
    setEditInputVal(item.suggestedFix || item.cleanTarget);
  };

  const handleApplyFix = (item: LatexFormulaItem, formulaToUse?: string) => {
    const newFormula = formulaToUse !== undefined ? formulaToUse : editInputVal;
    if (!newFormula.trim()) return;

    const updated = replaceFormulaInMarkdown(markdown, item, newFormula.trim());
    onUpdateMarkdown(updated);
    setEditingFormulaId(null);
    showToast(`已纠偏公式 ${item.eqNumber || `#${item.index}`}`);
  };

  const handleBatchAutoFix = () => {
    const { updatedMarkdown, fixedCount } = batchAutoFixAllFormulas(markdown);
    if (fixedCount > 0) {
      onUpdateMarkdown(updatedMarkdown);
      showToast(`已一键自动纠偏 ${fixedCount} 处 LaTeX 公式缺陷！`);
    } else {
      showToast('所有公式结构良好，未发现可自动修复的缺陷。');
    }
  };

  const renderKaTeXPreview = (latex: string, isDisplay: boolean) => {
    try {
      const html = katex.renderToString(latex, {
        displayMode: isDisplay,
        throwOnError: false,
        errorColor: '#ef4444',
      });
      return <div className="overflow-x-auto py-1 text-slate-800" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <div className="text-xs text-rose-500 font-mono">公式渲染异常</div>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 lg:w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full z-30 shrink-0 font-sans transition-all">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30">
            <span className="font-serif font-black text-sm">∑</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
              <span>LaTeX 公式一致性检测</span>
              <span className="bg-teal-500/20 text-teal-300 text-[10px] px-1.5 py-0.5 rounded border border-teal-500/30 font-mono">
                {report.totalCount} 式
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              自动比对原文与译文公式结构，高亮纠偏
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="关闭面板"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Summary & Auto Fix Banner */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {report.consistentCount} 一致
          </span>
          {(report.mismatchCount > 0 || report.errorCount > 0) && (
            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              {report.mismatchCount + report.errorCount} 需纠偏
            </span>
          )}
        </div>

        {(report.mismatchCount > 0 || report.errorCount > 0) && (
          <button
            onClick={handleBatchAutoFix}
            className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer shrink-0"
            title="一键自动纠偏常见的指数漏写、分式损坏及定界符缺失"
          >
            <Wand2 className="w-3 h-3 text-teal-200" />
            <span>一键纠偏全部</span>
          </button>
        )}
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm transition-all animate-in fade-in">
          <Check className="w-3.5 h-3.5" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="p-3 border-b border-slate-200 bg-white space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="搜索公式编号、变量名 (如 6.18, PGA, V, Cs)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar">
          {[
            { id: 'all', label: `全部 (${report.totalCount})` },
            { id: 'mismatch', label: `待纠偏 (${report.mismatchCount + report.errorCount})` },
            { id: 'consistent', label: `结构一致 (${report.consistentCount})` },
            { id: 'display', label: `独立块级 ($$)` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as any)}
              className={`px-2 py-1 rounded-md font-semibold shrink-0 transition-all cursor-pointer ${
                filterType === f.id
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formula Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/70">
        {filteredItems.length > 0 ? (
          filteredItems.map(item => {
            const isEditing = editingFormulaId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-xl p-3 shadow-xs transition-all ${
                  item.status === 'error'
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : item.status === 'warning'
                    ? 'border-amber-300 ring-1 ring-amber-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Item Top Banner */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                      #{item.index}
                    </span>
                    {item.eqNumber && (
                      <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200 font-mono">
                        {item.eqNumber}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.isDisplay ? '$$ 块级' : '$ 行内'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.status === 'consistent' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" /> 结构一致
                      </span>
                    )}
                    {item.status === 'warning' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> 结构不匹配
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-medium border border-rose-200">
                        <XCircle className="w-3 h-3 text-rose-600" /> 语法错误
                      </span>
                    )}

                    <button
                      onClick={() => handleCopy(item.rawTarget, item.id)}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                      title="复制完整公式"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-teal-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Source Formula (if available) */}
                {item.sourceFormula && (
                  <div className="mb-2 p-2 bg-slate-100/80 rounded-lg border border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">原文源语 LaTeX:</span>
                    <code className="text-[11px] text-slate-700 font-mono block break-all">
                      {item.sourceFormula}
                    </code>
                  </div>
                )}

                {/* Current Translated Formula LaTeX Code & KaTeX Visual View */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 mb-2">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">译文当前 LaTeX:</span>
                  <code className="text-xs text-teal-900 font-mono block break-all font-semibold bg-white p-1.5 rounded border border-slate-200">
                    {item.cleanTarget}
                  </code>

                  {/* KaTeX Live Render */}
                  <div className="mt-2 pt-2 border-t border-slate-200/70 bg-white p-2 rounded text-center">
                    {renderKaTeXPreview(item.cleanTarget, item.isDisplay)}
                  </div>
                </div>

                {/* Diagnostics & Structural Differences Callout */}
                {item.diagnostics.length > 0 && (
                  <div className="mb-2 p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] space-y-1">
                    <div className="font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>检测到结构差异 / 缺陷:</span>
                    </div>
                    {item.diagnostics.map((diag, dIdx) => (
                      <div key={dIdx} className="text-amber-900 pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-amber-500">
                        {diag}
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Recommendation / Edit Actions */}
                {!isEditing ? (
                  <div className="pt-1 flex items-center justify-between gap-2">
                    {item.suggestedFix && item.suggestedFix !== item.cleanTarget ? (
                      <button
                        onClick={() => handleApplyFix(item, item.suggestedFix)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        title={`一键纠偏为推荐结构: ${item.suggestedFix}`}
                      >
                        <Wand2 className="w-3.5 h-3.5 text-teal-600" />
                        <span>采纳建议纠偏</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    <button
                      onClick={() => handleStartEdit(item)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>手动微调</span>
                    </button>
                  </div>
                ) : (
                  /* Interactive In-place Editor */
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="text-[10px] font-bold text-slate-600">编辑纠偏 LaTeX 代码:</div>
                    <textarea
                      rows={2}
                      value={editInputVal}
                      onChange={(e) => setEditInputVal(e.target.value)}
                      className="w-full text-xs font-mono p-2 bg-slate-100 border border-teal-400 rounded-lg focus:outline-none focus:bg-white text-slate-900"
                    />

                    {/* Preview of user's typed correction */}
                    <div className="p-2 bg-white rounded border border-slate-200 text-center">
                      <span className="text-[9px] text-slate-400 block mb-1">纠偏实时预览:</span>
                      {renderKaTeXPreview(editInputVal, item.isDisplay)}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingFormulaId(null)}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs font-medium cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleApplyFix(item)}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                      >
                        应用纠偏至译文
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3 font-serif font-bold text-lg">
              ∑
            </div>
            <h4 className="text-xs font-bold text-slate-700 mb-1">
              {report.totalCount === 0 ? '未检测到 LaTeX 公式' : '无符合条件的公式'}
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
              {report.totalCount === 0
                ? '当译文中包含数学力学计算式（如抗震基底剪力 V、反应谱短周期加速度 SDS、风压 qz 等）时，系统将自动在此提取并校验结构。'
                : '请尝试修改搜索词或切换筛选条件。'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between">
        <span>KaTeX 规范排版引擎校验</span>
        <button
          onClick={handleBatchAutoFix}
          className="text-teal-600 hover:text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>扫描并自动纠偏</span>
        </button>
      </div>
    </div>
  );
};
