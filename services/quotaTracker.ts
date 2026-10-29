/**
 * Gemini API Quota Tracker & Real-Time Dashboard Service
 * Tracks token usage per model, calculates remaining quota percentages,
 * monitors daily limits (e.g. 4,000,000 tokens), detects exhaustion,
 * tracks rolling RPM (Requests Per Minute), manages rate-limit cooldowns,
 * and enables seamless automatic multi-model rotation without human intervention.
 */

export interface ModelQuotaInfo {
  model: string;
  displayName: string;
  limitTokens: number;
  usedTokens: number;
  requestCount: number;
  dailyRequestLimit: number;
  isExhausted: boolean;
  rateLimitCooldownUntil?: number; // timestamp until which this channel is cooling down from 429
  consecutiveRateLimits?: number;
  lastErrorMessage?: string;
  lastUpdated: number;
}

export interface QuotaState {
  date: string; // YYYY-MM-DD in PST (Google Cloud quota reset timezone)
  models: Record<string, ModelQuotaInfo>;
}

const STORAGE_KEY = 'gemini_quota_tracker_v3';

// Standard Google Cloud Generative Language Free Tier Limits (Tokens & Requests per model per day)
export const MODEL_CONFIGS: Record<string, { displayName: string; defaultLimit: number; defaultRpdLimit: number }> = {
  'gemini-3.1-flash-lite': {
    displayName: 'Gemini 3.1 Flash Lite',
    defaultLimit: 4000000,
    defaultRpdLimit: 1500
  },
  'gemini-3-flash-preview': {
    displayName: 'Gemini 3 Flash Preview',
    defaultLimit: 4000000,
    defaultRpdLimit: 1500
  },
  'gemini-flash-latest': {
    displayName: 'Gemini Flash Latest',
    defaultLimit: 4000000,
    defaultRpdLimit: 1500
  },
  'gemini-3.8-flash': {
    displayName: 'Gemini 3.8 Flash',
    defaultLimit: 4000000,
    defaultRpdLimit: 1500
  }
};

/**
 * Returns current date string in US Pacific Time (PST/PDT),
 * which is the official reset timezone for Google Cloud Gemini API quotas.
 */
export function getPSTDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date()); // Returns "YYYY-MM-DD"
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Computes exact time until next midnight PST (00:00:00 US Pacific Time)
 */
export function getTimeUntilReset(): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  resetDatePST: string;
} {
  const now = new Date();
  
  const pstTimeString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const pstNow = new Date(pstTimeString);
  
  const pstTomorrow = new Date(pstNow);
  pstTomorrow.setDate(pstTomorrow.getDate() + 1);
  pstTomorrow.setHours(0, 0, 0, 0);

  const diffMs = Math.max(0, pstTomorrow.getTime() - pstNow.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    formatted: `${hours}小时 ${minutes.toString().padStart(2, '0')}分`,
    resetDatePST: pstTomorrow.toISOString().split('T')[0]
  };
}

class QuotaTrackerService {
  private state: QuotaState;
  private listeners: Set<(state: QuotaState) => void> = new Set();
  private modelSwitchListeners: Set<(oldModel: string, newModel: string, reason: string) => void> = new Set();
  private recentRequestTimestamps: number[] = [];

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): QuotaState {
    const currentDate = getPSTDateString();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: QuotaState = JSON.parse(raw);
        if (parsed.date === currentDate && parsed.models) {
          for (const [key, cfg] of Object.entries(MODEL_CONFIGS)) {
            if (!parsed.models[key]) {
              parsed.models[key] = {
                model: key,
                displayName: cfg.displayName,
                limitTokens: cfg.defaultLimit,
                dailyRequestLimit: cfg.defaultRpdLimit,
                usedTokens: 0,
                requestCount: 0,
                isExhausted: false,
                lastUpdated: Date.now()
              };
            } else {
              if (!parsed.models[key].dailyRequestLimit) {
                parsed.models[key].dailyRequestLimit = cfg.defaultRpdLimit;
              }
            }
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load quota state from localStorage', e);
    }

    const freshModels: Record<string, ModelQuotaInfo> = {};
    for (const [key, cfg] of Object.entries(MODEL_CONFIGS)) {
      freshModels[key] = {
        model: key,
        displayName: cfg.displayName,
        limitTokens: cfg.defaultLimit,
        dailyRequestLimit: cfg.defaultRpdLimit,
        usedTokens: 0,
        requestCount: 0,
        isExhausted: false,
        rateLimitCooldownUntil: 0,
        consecutiveRateLimits: 0,
        lastErrorMessage: undefined,
        lastUpdated: Date.now()
      };
    }

    return {
      date: currentDate,
      models: freshModels
    };
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save quota state to localStorage', e);
    }
    this.notify();
  }

  private notify() {
    for (const cb of this.listeners) {
      try {
        cb(this.state);
      } catch (err) {
        console.error('Error in quota listener:', err);
      }
    }
  }

  public subscribe(cb: (state: QuotaState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public onAutoSwitchModel(cb: (oldModel: string, newModel: string, reason: string) => void): () => void {
    this.modelSwitchListeners.add(cb);
    return () => {
      this.modelSwitchListeners.delete(cb);
    };
  }

  public notifyModelSwitch(oldModel: string, newModel: string, reason: string) {
    for (const cb of this.modelSwitchListeners) {
      try {
        cb(oldModel, newModel, reason);
      } catch (err) {
        console.error('Error in model switch listener:', err);
      }
    }
  }

  public getState(): QuotaState {
    const today = getPSTDateString();
    if (this.state.date !== today) {
      this.state = this.loadState();
      this.saveState();
    }
    return this.state;
  }

  /**
   * Explicitly record an API request attempt (RPD & RPM tracking)
   */
  public recordRequest(model: string) {
    this.getState();
    const safeModel = this.normalizeModelName(model);

    // Track for rolling 60-second RPM
    const now = Date.now();
    this.recentRequestTimestamps.push(now);
    // keep only last 60 seconds
    this.recentRequestTimestamps = this.recentRequestTimestamps.filter(t => now - t <= 60000);

    if (!this.state.models[safeModel]) {
      this.state.models[safeModel] = {
        model: safeModel,
        displayName: MODEL_CONFIGS[safeModel]?.displayName || safeModel,
        limitTokens: MODEL_CONFIGS[safeModel]?.defaultLimit || 4000000,
        dailyRequestLimit: MODEL_CONFIGS[safeModel]?.defaultRpdLimit || 1500,
        usedTokens: 0,
        requestCount: 0,
        isExhausted: false,
        lastUpdated: now
      };
    }

    const item = this.state.models[safeModel];
    item.requestCount += 1;
    item.lastUpdated = now;
    this.saveState();
  }

  /**
   * Get rolling Requests Per Minute across all models
   */
  public getCurrentRpm(): number {
    const now = Date.now();
    this.recentRequestTimestamps = this.recentRequestTimestamps.filter(t => now - t <= 60000);
    return this.recentRequestTimestamps.length;
  }

  /**
   * Get total API requests made today across all models
   */
  public getTotalRequestsToday(): number {
    const state = this.getState();
    return Object.values(state.models).reduce((sum, m) => sum + (m.requestCount || 0), 0);
  }

  /**
   * Record token consumption for a model
   */
  public recordUsage(model: string, tokens: number) {
    this.getState();
    const safeModel = this.normalizeModelName(model);
    
    if (!this.state.models[safeModel]) {
      this.state.models[safeModel] = {
        model: safeModel,
        displayName: MODEL_CONFIGS[safeModel]?.displayName || safeModel,
        limitTokens: MODEL_CONFIGS[safeModel]?.defaultLimit || 4000000,
        dailyRequestLimit: MODEL_CONFIGS[safeModel]?.defaultRpdLimit || 1500,
        usedTokens: 0,
        requestCount: 0,
        isExhausted: false,
        lastUpdated: Date.now()
      };
    }

    const item = this.state.models[safeModel];
    item.usedTokens += Math.max(1, tokens);
    item.consecutiveRateLimits = 0;
    item.rateLimitCooldownUntil = 0; // reset cooldown on success
    item.lastUpdated = Date.now();

    if (item.usedTokens >= item.limitTokens) {
      item.isExhausted = true;
    }

    this.saveState();
  }

  /**
   * Record when a model encounters a transient 429 rate limit or 503 high demand
   * Sets temporary cooldown so automatic rotation picks an unthrottled peer channel.
   */
  public recordRateLimitHit(model: string, cooldownSeconds: number = 45, errorMsg?: string) {
    this.getState();
    const safeModel = this.normalizeModelName(model);
    const now = Date.now();

    if (!this.state.models[safeModel]) {
      this.state.models[safeModel] = {
        model: safeModel,
        displayName: MODEL_CONFIGS[safeModel]?.displayName || safeModel,
        limitTokens: 4000000,
        dailyRequestLimit: 1500,
        usedTokens: 0,
        requestCount: 1,
        isExhausted: false,
        lastUpdated: now
      };
    }

    const item = this.state.models[safeModel];
    item.consecutiveRateLimits = (item.consecutiveRateLimits || 0) + 1;
    // Exponential cooldown backoff: 40s -> 70s -> 110s
    const dynamicCooldown = cooldownSeconds * Math.min(3, item.consecutiveRateLimits);
    item.rateLimitCooldownUntil = now + dynamicCooldown * 1000;
    if (errorMsg) item.lastErrorMessage = errorMsg;
    item.lastUpdated = now;

    this.saveState();
  }

  /**
   * Record when a model has hit true daily quota exhaustion
   */
  public recordExhausted(model: string, errorMsg?: string, detectedLimit?: number) {
    this.getState();
    const safeModel = this.normalizeModelName(model);
    
    if (!this.state.models[safeModel]) {
      this.state.models[safeModel] = {
        model: safeModel,
        displayName: MODEL_CONFIGS[safeModel]?.displayName || safeModel,
        limitTokens: detectedLimit || 4000000,
        dailyRequestLimit: MODEL_CONFIGS[safeModel]?.defaultRpdLimit || 1500,
        usedTokens: detectedLimit || 4000000,
        requestCount: 1,
        isExhausted: true,
        lastErrorMessage: errorMsg,
        lastUpdated: Date.now()
      };
    } else {
      const item = this.state.models[safeModel];
      if (detectedLimit && detectedLimit > 0) {
        item.limitTokens = detectedLimit;
      }
      item.usedTokens = Math.max(item.usedTokens, item.limitTokens);
      item.isExhausted = true;
      item.lastErrorMessage = errorMsg;
      item.lastUpdated = Date.now();
    }

    this.saveState();
  }

  /**
   * Check if a specific model is exhausted today
   */
  public isExhausted(model: string): boolean {
    const safeModel = this.normalizeModelName(model);
    const item = this.getState().models[safeModel];
    return !!item?.isExhausted;
  }

  /**
   * Check if a model is currently in a temporary rate-limit cooldown
   */
  public isCoolingDown(model: string): boolean {
    const safeModel = this.normalizeModelName(model);
    const item = this.getState().models[safeModel];
    if (!item?.rateLimitCooldownUntil) return false;
    return item.rateLimitCooldownUntil > Date.now();
  }

  /**
   * Get the best healthy model with available quota today and no active rate-limit cooldown
   */
  public getHealthyModel(preferredModel: string = 'gemini-3.1-flash-lite'): string {
    const safePreferred = this.normalizeModelName(preferredModel);
    
    // Healthy channels priority list
    const healthyPriority = [
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-flash-latest'
    ];

    // If preferred is ready and not cooling down or exhausted, use it
    if (!this.isExhausted(safePreferred) && !this.isCoolingDown(safePreferred)) {
      return safePreferred;
    }

    // Search for a healthy model that is neither exhausted nor cooling down
    for (const m of healthyPriority) {
      if (!this.isExhausted(m) && !this.isCoolingDown(m)) {
        return m;
      }
    }

    // If all models are cooling down, pick the one with earliest cooldown expiry
    let bestModel = 'gemini-3.1-flash-lite';
    let minCooldown = Infinity;
    for (const m of healthyPriority) {
      if (this.isExhausted(m)) continue;
      const cd = this.state.models[m]?.rateLimitCooldownUntil || 0;
      if (cd < minCooldown) {
        minCooldown = cd;
        bestModel = m;
      }
    }

    return bestModel;
  }

  /**
   * Reset tracking state
   */
  public resetModel(model?: string) {
    this.getState();
    if (model) {
      const safe = this.normalizeModelName(model);
      if (this.state.models[safe]) {
        this.state.models[safe].usedTokens = 0;
        this.state.models[safe].isExhausted = false;
        this.state.models[safe].rateLimitCooldownUntil = 0;
        this.state.models[safe].consecutiveRateLimits = 0;
        this.state.models[safe].requestCount = 0;
        this.state.models[safe].lastErrorMessage = undefined;
        this.state.models[safe].lastUpdated = Date.now();
      }
    } else {
      for (const m of Object.values(this.state.models)) {
        m.usedTokens = 0;
        m.isExhausted = false;
        m.rateLimitCooldownUntil = 0;
        m.consecutiveRateLimits = 0;
        m.requestCount = 0;
        m.lastErrorMessage = undefined;
        m.lastUpdated = Date.now();
      }
    }
    this.saveState();
  }

  public normalizeModelName(m: string): string {
    if (!m) return 'gemini-3.1-flash-lite';
    if (m.includes('3.1-flash-lite')) return 'gemini-3.1-flash-lite';
    if (m.includes('3-flash-preview')) return 'gemini-3-flash-preview';
    if (m.includes('flash-latest')) return 'gemini-flash-latest';
    if (m.includes('3.8-flash')) return 'gemini-3.8-flash';
    return m;
  }
}

export const quotaTracker = new QuotaTrackerService();
