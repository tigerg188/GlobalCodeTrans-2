import React, { useState, useMemo } from 'react';
import { 
  Sliders, 
  Search, 
  Download, 
  Copy, 
  Check, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Layers, 
  Activity, 
  Wind, 
  FileText,
  Eye,
  RefreshCw,
  X
} from 'lucide-react';
import { AuditParameterItem, parseDiagramAuditParameters, exportAuditParametersToCsv } from '../utils/diagramAuditUtils';

interface DiagramAuditSidebarProps {
  markdown: string;
  isEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  isOpen: boolean;
  onClose?: () => void;
  fileName?: string | null;
}

export const DiagramAuditSidebar: React.FC<DiagramAuditSidebarProps> = ({
  markdown,
  isEnabled,
  onToggleEnabled,
  isOpen,
  onClose,
  fileName
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Parse items from markdown
  const items = useMemo(() => {
    return parseDiagramAuditParameters(markdown);
  }, [markdown]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, selectedCategory]);

  const handleCopy = (item: AuditParameterItem) => {
    const text = `${item.name}: ${item.value} ${item.unit} (来源: ${item.location})`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    exportAuditParametersToCsv(items, `${fileName || '文档'}_图表参数复核清单.csv`);
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 lg:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col h-full z-20 shrink-0 font-sans transition-all">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30">
            <Sliders className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
              <span>图表参数复核工作台</span>
              <span className="bg-teal-500/20 text-teal-300 text-[10px] px-1.5 py-0.5 rounded border border-teal-500/30 font-mono">
                {items.length} 项
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              高精度图形/公式参数识图核对
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="关闭侧边栏"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Global Audit Toggle */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className={`w-4 h-4 ${isEnabled ? 'text-teal-600' : 'text-slate-400'}`} />
          <span className="text-xs font-bold text-slate-700">图表参数复核开关</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
        </label>
      </div>

      {isEnabled ? (
        <>
          {/* Search & Category Filter */}
          <div className="p-3 border-b border-slate-200 bg-white space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="搜索参数名、数值、单位或图名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px]">
              {[
                { id: 'all', label: '全部' },
                { id: 'spectrum', label: '地震反应谱' },
                { id: 'wind', label: '风压荷载' },
                { id: 'structure', label: '结构尺寸' },
                { id: 'formula', label: '公式推导' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-1 rounded-md font-semibold shrink-0 transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parameter Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/60">
            {filteredItems.length > 0 ? (
              filteredItems.map(item => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-teal-500/50 transition-all group relative"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.category === 'spectrum' && <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      {item.category === 'wind' && <Wind className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                      {item.category === 'structure' && <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      {item.category === 'formula' && <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                      <span className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(item)}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                      title="复制参数"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-teal-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Value & Unit Highlight */}
                  <div className="flex items-baseline gap-1.5 my-1 bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <span className="text-base font-extrabold text-teal-700 font-mono tracking-tight">
                      {item.value}
                    </span>
                    {item.unit && item.unit !== '-' && (
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        {item.unit}
                      </span>
                    )}
                  </div>

                  {/* Context & Status */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="truncate max-w-[170px]" title={item.location}>
                      📍 {item.location}
                    </span>

                    {item.status === 'ok' && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 正确识出
                      </span>
                    )}
                    {item.status === 'warning' && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> 建议核对
                      </span>
                    )}
                    {item.status === 'info' && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        <Info className="w-3 h-3 text-slate-400" /> 参考标注
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sliders className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-700 mb-1">
                  {items.length === 0 ? '暂未识出图表参数' : '无匹配筛选结果'}
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {items.length === 0
                    ? '请上传包含抗震反应谱曲线、风压分布图或工程结构示意图的文档并进行翻译，AI将自动提取图中参数于此展现。'
                    : '请尝试修改搜索关键字或切换分类标签。'}
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {items.length > 0 && (
            <div className="p-3 border-t border-slate-200 bg-white">
              <button
                onClick={handleExportCsv}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                <span>导出图表参数复核表 (.csv)</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <Eye className="w-10 h-10 mb-3 text-slate-300" />
          <p className="text-xs font-bold text-slate-600 mb-1">图表参数复核功能已关闭</p>
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
            开启右上角开关后，模型将在翻译过程中额外提取工程图纸、曲线及公式中的标注参数（名/值/单位），方便您对比核对原图。
          </p>
          <button
            onClick={() => onToggleEnabled(true)}
            className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            开启复核模式
          </button>
        </div>
      )}
    </div>
  );
};
