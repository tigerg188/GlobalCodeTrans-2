import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  Wind, 
  Compass, 
  Scale, 
  Calculator, 
  Sliders, 
  Search, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  RefreshCw, 
  X, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Eye,
  Info,
  Layers
} from 'lucide-react';
import { ExtractedChartParameter, extractChartParameters } from '../utils/chartParameterExtractor';
import * as XLSX from 'xlsx';

interface ChartParameterAuditSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  markdownContent: string;
  enableChartAudit: boolean;
  onToggleChartAudit: (enabled: boolean) => void;
  onReExtract?: () => void;
}

export const ChartParameterAuditSidebar: React.FC<ChartParameterAuditSidebarProps> = ({
  isOpen,
  onClose,
  markdownContent,
  enableChartAudit,
  onToggleChartAudit,
  onReExtract,
}) => {
  const [searchTerm, setSearchCategory] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Extract parameters from translated Markdown
  const parameters = useMemo(() => {
    return extractChartParameters(markdownContent);
  }, [markdownContent]);

  // Filtered parameters based on category & search
  const filteredParameters = useMemo(() => {
    return parameters.filter(param => {
      const matchesCategory = activeCategory === 'all' || param.category === activeCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !term || 
        param.symbol.toLowerCase().includes(term) || 
        param.name.toLowerCase().includes(term) || 
        String(param.value).toLowerCase().includes(term) || 
        param.sourceDiagram.toLowerCase().includes(term);
      
      return matchesCategory && matchesSearch;
    });
  }, [parameters, activeCategory, searchTerm]);

  // Count by category
  const categoryCounts = useMemo(() => {
    return {
      all: parameters.length,
      seismic: parameters.filter(p => p.category === 'seismic').length,
      wind: parameters.filter(p => p.category === 'wind').length,
      geometry: parameters.filter(p => p.category === 'geometry').length,
      load: parameters.filter(p => p.category === 'load').length,
      formula: parameters.filter(p => p.category === 'formula').length,
    };
  }, [parameters]);

  const handleCopyItem = (param: ExtractedChartParameter) => {
    const textToCopy = `${param.name} (${param.symbol}): ${param.value} ${param.unit} [${param.sourceDiagram}]`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(param.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllAsMarkdown = () => {
    if (parameters.length === 0) return;
    const header = "| 参数符号 | 参数中文名称 | 识别数值 | 物理单位 | 关联工程图纸 / 章节 |\n|:---|:---|:---|:---|:---|\n";
    const rows = parameters.map(p => `| $${p.symbol}$ | ${p.name} | **${p.value}** | ${p.unit || '-'} | ${p.sourceDiagram} |`).join('\n');
    navigator.clipboard.writeText(header + rows);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExportExcel = () => {
    if (parameters.length === 0) return;
    const exportData = parameters.map((p, index) => ({
      '序号': index + 1,
      '参数符号': p.symbol,
      '参数中文名称': p.name,
      '识别数值': p.value,
      '物理单位': p.unit,
      '参数分类': p.category === 'seismic' ? '抗震反应谱' : (p.category === 'wind' ? '抗风荷载' : (p.category === 'geometry' ? '结构尺寸标高' : (p.category === 'load' ? '荷载力学' : '通用参数'))),
      '关联工程图纸 / 章节': p.sourceDiagram,
      '核验状态': p.confidence === 'high' ? '自动高精度确认' : '建议对比核对',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "图表参数复核表");
    XLSX.writeFile(wb, `GlobalCodeTrans_图表参数复核表_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col font-sans text-slate-800 animate-in slide-in-from-right duration-200">
      {/* Header Bar */}
      <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              图表参数复核与数值校验
            </h3>
            <p className="text-[11px] text-slate-400">
              工程图纸标注 & 算式参数实时对比提取
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="关闭侧边栏"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Switch Toggle Bar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${enableChartAudit ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`} />
            <div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>图表参数复核功能</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${enableChartAudit ? 'bg-teal-100 text-teal-800 font-bold' : 'bg-slate-100 text-slate-500'}`}>
                  {enableChartAudit ? '已开启' : '已关闭'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                开启后大模型将强化识图并额外提取参数列表
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enableChartAudit}
              onChange={(e) => onToggleChartAudit(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>

        {/* Feature Notice Banner */}
        {enableChartAudit && (
          <div className="mt-2.5 px-3 py-1.5 bg-teal-50/80 border border-teal-200/70 rounded-lg text-[11px] text-teal-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
              <span>智能参数复核模式已就绪，当前已复核 <strong className="text-teal-900 font-bold">{parameters.length}</strong> 项参数</span>
            </div>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 overflow-x-auto flex items-center gap-1.5 text-xs select-none">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${activeCategory === 'all' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          全部 ({categoryCounts.all})
        </button>
        <button
          onClick={() => setActiveCategory('seismic')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${activeCategory === 'seismic' ? 'bg-blue-600 text-white font-bold' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
        >
          <Activity className="w-3 h-3" /> 抗震谱线 ({categoryCounts.seismic})
        </button>
        <button
          onClick={() => setActiveCategory('wind')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${activeCategory === 'wind' ? 'bg-teal-600 text-white font-bold' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
        >
          <Wind className="w-3 h-3" /> 抗风荷载 ({categoryCounts.wind})
        </button>
        <button
          onClick={() => setActiveCategory('geometry')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${activeCategory === 'geometry' ? 'bg-purple-600 text-white font-bold' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
        >
          <Compass className="w-3 h-3" /> 几何标高 ({categoryCounts.geometry})
        </button>
        <button
          onClick={() => setActiveCategory('load')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${activeCategory === 'load' ? 'bg-amber-600 text-white font-bold' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
        >
          <Scale className="w-3 h-3" /> 荷载力学 ({categoryCounts.load})
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 bg-slate-50 border-b border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜索参数符号 (如 SDS, V)、名称或图号..."
            value={searchTerm}
            onChange={(e) => setSearchCategory(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchCategory('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Parameter Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {filteredParameters.length === 0 ? (
          <div className="text-center py-12 px-6 bg-white rounded-2xl border border-slate-200 shadow-2xs my-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Info className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 mb-1">
              {parameters.length === 0 ? "暂未检测到工程图表参数" : "未找到匹配的搜索参数"}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto mb-4">
              {parameters.length === 0 
                ? "请先在上方开启“图表参数复核”开关，并上传包含结构曲线图、风压立面图或节点构造示意图的 PDF/图片文档。"
                : "请尝试清除搜索关键词或切换到“全部”标签页。"}
            </p>
            {parameters.length === 0 && onReExtract && (
              <button
                onClick={onReExtract}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm shadow-teal-600/20"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 重新解析提取当前文档
              </button>
            )}
          </div>
        ) : (
          filteredParameters.map((param) => (
            <div
              key={param.id}
              className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-teal-300 transition-all font-sans group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-900 text-teal-300 rounded font-mono text-xs font-bold border border-slate-800">
                    ${param.symbol}$
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 tracking-tight">
                    {param.name}
                  </h4>
                </div>
                <button
                  onClick={() => handleCopyItem(param)}
                  className="p-1 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  title="复制该参数说明"
                >
                  {copiedId === param.id ? (
                    <Check className="w-3.5 h-3.5 text-teal-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Parameter Highlighted Value */}
              <div className="my-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-baseline justify-between">
                <div className="text-xs text-slate-500 font-medium">识别数值 / 单位:</div>
                <div className="text-sm font-extrabold text-teal-800 font-mono tracking-wide">
                  {param.value} <span className="text-xs font-normal text-slate-600">{param.unit}</span>
                </div>
              </div>

              {/* Source Diagram & Category Badges */}
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-serif">
                <div className="flex items-center gap-1 font-sans text-slate-600 font-medium truncate max-w-[220px]" title={param.sourceDiagram}>
                  <Layers className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{param.sourceDiagram}</span>
                </div>

                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-teal-50 text-teal-700 border border-teal-200/60">
                  {param.category === 'seismic' ? '抗震反应谱' : (param.category === 'wind' ? '抗风荷载' : (param.category === 'geometry' ? '尺寸标高' : '荷载参数'))}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Action Bar */}
      <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
        <button
          onClick={handleCopyAllAsMarkdown}
          disabled={parameters.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          {copiedAll ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedAll ? '已复制 Markdown 表格' : '复制复核表 (MD)'}</span>
        </button>

        <button
          onClick={handleExportExcel}
          disabled={parameters.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm shadow-teal-600/20"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>导出复核表 (.xlsx)</span>
        </button>
      </div>
    </div>
  );
};

export default ChartParameterAuditSidebar;
