import React, { useState, useEffect, useRef } from 'react';
import { ExecutionLogEntry } from '../types';

interface ExecutionLoggerProps {
  logs: ExecutionLogEntry[];
  onClearLogs: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  isTranslating: boolean;
}

export const ExecutionLogger: React.FC<ExecutionLoggerProps> = ({
  logs,
  onClearLogs,
  isOpen,
  onToggleOpen,
  isTranslating,
}) => {
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新日志
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'all') return true;
    return log.level === filterLevel;
  });

  const getLevelBadge = (level: ExecutionLogEntry['level']) => {
    switch (level) {
      case 'info':
        return <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">INFO</span>;
      case 'warn':
        return <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">WARN</span>;
      case 'error':
        return <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">ERR</span>;
      case 'success':
        return <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">DONE</span>;
    }
  };

  const exportLogsAsJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `translation_pipeline_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const copyLogsToClipboard = () => {
    const formatted = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.stage}] ${l.message}${l.details ? ' -> ' + JSON.stringify(l.details) : ''}`).join('\n');
    navigator.clipboard.writeText(formatted);
    alert('已成功复制完整执行日志到剪贴板！');
  };

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden mt-6 transition-all duration-200">
      {/* 头部面板条 */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/80 cursor-pointer select-none border-b border-slate-200 dark:border-slate-800"
        onClick={onToggleOpen}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isTranslating ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
            <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              全方位全流程执行日志
              <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-normal">
                {logs.length} 条
              </span>
            </h3>
          </div>
          {errorCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-rose-500 text-white font-medium rounded-full animate-pulse">
              {errorCount} 个异常
            </span>
          )}
          {warnCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium rounded-full">
              {warnCount} 个告警
            </span>
          )}
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={copyLogsToClipboard}
            className="text-xs px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
            title="复制日志供排错分析"
          >
            复制日志
          </button>
          <button
            type="button"
            onClick={exportLogsAsJson}
            className="text-xs px-2.5 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
            title="导出诊断JSON文件"
          >
            导出JSON
          </button>
          <button
            type="button"
            onClick={onClearLogs}
            className="text-xs px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition"
          >
            清空
          </button>
          <span className="text-slate-400 text-xs ml-1">
            {isOpen ? '▲ 收起' : '▼ 展开'}
          </span>
        </div>
      </div>

      {/* 展开后的日志详细视图 */}
      {isOpen && (
        <div className="p-3 bg-slate-950 text-slate-200 font-mono text-xs">
          {/* 工具栏 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">过滤级别:</span>
              {(['all', 'info', 'warn', 'error', 'success'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2 py-0.5 rounded text-[11px] uppercase ${
                    filterLevel === lvl
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
              />
              <span>跟踪最新 (Auto-scroll)</span>
            </label>
          </div>

          {/* 日志内容滚动列表 */}
          <div
            ref={logContainerRef}
            className="h-64 overflow-y-auto space-y-1.5 pr-2 font-mono scrollbar-thin scrollbar-thumb-slate-700"
          >
            {filteredLogs.length === 0 ? (
              <div className="text-slate-500 py-8 text-center italic">
                暂无日志记录。开始翻译后，所有步骤、分批、重试及错误将在此实时留痕。
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 py-1 px-1.5 rounded hover:bg-slate-900/80 transition ${
                    log.level === 'error'
                      ? 'bg-rose-950/40 border-l-2 border-rose-500'
                      : log.level === 'warn'
                      ? 'bg-amber-950/30 border-l-2 border-amber-500'
                      : log.level === 'success'
                      ? 'bg-emerald-950/30'
                      : ''
                  }`}
                >
                  <span className="text-slate-500 select-none shrink-0 text-[11px]">
                    {typeof log.timestamp === 'string'
                      ? (log.timestamp.split('T')[1]?.slice(0, 12) || log.timestamp)
                      : new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="shrink-0">{getLevelBadge(log.level)}</div>
                  <span className="text-cyan-400 font-medium shrink-0 text-[11px]">
                    [{log.stage}]
                  </span>
                  <div className="flex-1 break-all text-slate-300">
                    {log.message}
                    {log.details && (
                      <pre className="mt-1 p-1 bg-slate-900 rounded text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                        {typeof log.details === 'string'
                          ? log.details
                          : JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
