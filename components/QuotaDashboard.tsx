import React, { useState, useEffect } from 'react';
import { 
  quotaTracker, 
  QuotaState, 
  ModelQuotaInfo,
  getTimeUntilReset, 
  MODEL_CONFIGS 
} from '../services/quotaTracker';

interface QuotaDashboardProps {
  currentModel: string;
  onSelectModel: (model: string) => void;
}

export const QuotaDashboard: React.FC<QuotaDashboardProps> = ({
  currentModel,
  onSelectModel
}) => {
  const [quotaState, setQuotaState] = useState<QuotaState>(() => quotaTracker.getState());
  const [resetCountdown, setResetCountdown] = useState(getTimeUntilReset());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Subscribe to quotaTracker updates
  useEffect(() => {
    const unsubscribe = quotaTracker.subscribe((newState) => {
      setQuotaState({ ...newState });
    });
    return unsubscribe;
  }, []);

  // Update countdown every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setResetCountdown(getTimeUntilReset());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Normalize model key
  const safeModelKey = currentModel.includes('3.1-flash-lite')
    ? 'gemini-3.1-flash-lite'
    : (currentModel.includes('3-flash-preview')
      ? 'gemini-3-flash-preview'
      : (currentModel.includes('flash-latest')
        ? 'gemini-flash-latest'
        : (currentModel.includes('3.8-flash') ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite')));

  const activeModelInfo: ModelQuotaInfo = quotaState.models[safeModelKey] || {
    model: safeModelKey,
    displayName: MODEL_CONFIGS[safeModelKey]?.displayName || safeModelKey,
    limitTokens: 4000000,
    dailyRequestLimit: 1500,
    usedTokens: 0,
    requestCount: 0,
    isExhausted: false,
    lastUpdated: Date.now()
  };

  const usedTokens = activeModelInfo.usedTokens;
  const limitTokens = activeModelInfo.limitTokens;
  const isExhausted = activeModelInfo.isExhausted || usedTokens >= limitTokens;
  const usagePercent = Math.min(100, Number(((usedTokens / limitTokens) * 100).toFixed(1)));
  const remainingPercent = Math.max(0, Number((100 - usagePercent).toFixed(1)));

  // RPD Request Metrics & Real-time RPM
  const totalRequestsToday = quotaTracker.getTotalRequestsToday();
  const currentModelRequests = activeModelInfo.requestCount || 0;
  const rpdLimit = activeModelInfo.dailyRequestLimit || 1500;
  const rpdPercent = Math.min(100, Number(((totalRequestsToday / rpdLimit) * 100).toFixed(1)));
  const currentRpm = quotaTracker.getCurrentRpm();

  // Format large numbers with commas or K/M
  const formatTokens = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toLocaleString();
  };

  const handleResetCurrent = (e: React.MouseEvent) => {
    e.stopPropagation();
    quotaTracker.resetModel(safeModelKey);
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl border border-slate-700/80 shadow-md overflow-hidden transition-all duration-200">
      {/* Header bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 flex items-center justify-between cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 text-xs">
            📊
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-100 tracking-tight">API 频次与配额监控</span>
              {isExhausted ? (
                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full animate-pulse">
                  配额告急
                </span>
              ) : currentRpm >= 12 ? (
                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full animate-pulse">
                  高频压测中
                </span>
              ) : (
                <span className="px-1.5 py-0.2 text-[9px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  正常通畅
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              频次: <span className={currentRpm >= 12 ? 'text-amber-400 font-bold' : 'text-teal-300 font-semibold'}>{currentRpm} RPM</span>
              <span className="mx-1 text-slate-600">|</span>
              今日调用: <span className="text-indigo-300 font-semibold">{totalRequestsToday}次</span> / {rpdLimit}
              <span className="mx-1 text-slate-600">|</span>
              Tokens: <span className="text-amber-300">{formatTokens(usedTokens)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-indigo-300/80 font-mono bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-700/40">
            ⏳ {resetCountdown.formatted}
          </span>
          <svg 
            className={`w-3.5 h-3.5 text-slate-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-3 bg-slate-900/95 border-t border-slate-800 space-y-3 text-xs">
          {/* Active Model Token Quota Progress */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <span>当前通道:</span>
                <span className="text-indigo-300 font-semibold">{activeModelInfo.displayName}</span>
              </span>
              <span className="font-mono text-slate-300 text-[10px]">
                Token 剩余 <strong className={remainingPercent > 20 ? 'text-emerald-400' : 'text-rose-400'}>{remainingPercent}%</strong>
              </span>
            </div>

            {/* Token Progress Track */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60 p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isExhausted 
                    ? 'bg-rose-500' 
                    : (usagePercent > 80 ? 'bg-amber-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400')
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 font-mono">
              <span>Token 消耗: {usedTokens.toLocaleString()}</span>
              <span>日上限: {limitTokens.toLocaleString()}</span>
            </div>
          </div>

          {/* RPD (Requests Per Day) Frequency Gauge */}
          <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/50 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-teal-300 font-bold flex items-center gap-1">
                <span>⚡ API 调用频次 (RPD 监控):</span>
              </span>
              <span className="font-mono text-[10px] text-slate-300">
                今日累计 <strong className="text-teal-300">{totalRequestsToday}</strong> / {rpdLimit} 次 ({rpdPercent}%)
              </span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-700/60 p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  rpdPercent > 85 ? 'bg-rose-500' : (rpdPercent > 60 ? 'bg-amber-400' : 'bg-gradient-to-r from-teal-500 to-cyan-400')
                }`}
                style={{ width: `${rpdPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span>当前模型: {currentModelRequests} 次调用</span>
              <span className="text-emerald-400 font-medium">双页/批模式节省 ~50% 调用</span>
            </div>
          </div>

          {/* Model Health Matrix Grid */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 flex items-center justify-between">
              <span>各通道独立配额状态 (分桶隔离):</span>
              <button 
                onClick={handleResetCurrent}
                title="校准本地用量统计"
                className="text-[9px] text-slate-400 hover:text-indigo-300 underline cursor-pointer"
              >
                校准本模型用量
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(MODEL_CONFIGS).map(([mKey, cfg]) => {
                const info = quotaState.models[mKey];
                const isCur = mKey === safeModelKey;
                const mExhausted = info?.isExhausted || (info && info.usedTokens >= info.limitTokens);

                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => onSelectModel(mKey)}
                    className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isCur 
                        ? 'border-indigo-500 bg-indigo-950/50 shadow-xs' 
                        : (mExhausted 
                          ? 'border-rose-900/40 bg-rose-950/20 opacity-70 hover:opacity-100' 
                          : 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-700')
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[10px] font-medium truncate ${isCur ? 'text-indigo-200' : 'text-slate-300'}`}>
                        {cfg.displayName.replace('Gemini ', '')}
                      </span>
                      {mExhausted ? (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="当日配额已耗尽" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="通道正常畅通" />
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5 flex justify-between">
                      <span>{mExhausted ? '已达上限' : `${formatTokens(info?.usedTokens || 0)} · ${info?.requestCount || 0}次`}</span>
                      {isCur && <span className="text-indigo-300 font-sans">当前</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Warning / Recommendation Banner */}
          {isExhausted && (
            <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-500/40 text-[10px] text-rose-200 flex flex-col gap-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-rose-300">
                <span>⚠️ 当前模型 [{activeModelInfo.displayName}] 今日配额已用完</span>
              </div>
              <p className="text-slate-300 leading-tight">
                Google 免费层为每种模型提供<strong>独立的 400 万配额池</strong>。系统建议立即切换至有额度的通道继续翻译：
              </p>
              <button
                type="button"
                onClick={() => onSelectModel('gemini-3.1-flash-lite')}
                className="w-full py-1 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded shadow-xs text-[10px] cursor-pointer"
              >
                ⚡ 一键切换至【Gemini 3.1 Flash Lite (独立健康通道)】
              </button>
            </div>
          )}

          {/* Reset Time Footer */}
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400 font-mono">
            <span>重置周期: 每日 00:00 PST (美西)</span>
            <span className="text-indigo-300 font-semibold">约 {resetCountdown.formatted} 后刷新</span>
          </div>
        </div>
      )}
    </div>
  );
};
