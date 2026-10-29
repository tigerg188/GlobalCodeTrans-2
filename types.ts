export enum AppLanguage {
  CN = 'zh-CN',
  EN = 'en-US',
  LAO = 'lo-LA'
}

export enum TranslationMode {
  ALL = 'all',       // 全文档/全表格自动分批流水线
  RANGE = 'range',   // 指定页码或行区间
}

export type SupportedFileType = 'pdf' | 'excel' | 'word' | 'markdown' | 'image';

export interface ExcelPreflightAssessment {
  totalRows: number;
  totalCols: number;
  batchSize: number;
  totalBatches: number;
  estimatedApiCalls: number;
  recommendedModel: string;
  recommendedModelName: string;
  estimatedDurationSec: number;
  quotaSafetyTier: 'optimal' | 'moderate' | 'high_volume';
  quotaDailyPercent: number; // Percentage of 1,500 daily free tier
  pacingIntervalSec: number;
}

export interface ExcelSheetInfo {
  sheetName: string;
  totalRows: number;
  totalCols: number;
  headers: string[];
  dataRows: any[][];
  preflight?: ExcelPreflightAssessment;
}

export interface TranslationState {
  isProcessing: boolean;
  sourceFiles: string[]; // Base64 strings or markers
  fileType: SupportedFileType | null;
  translatedMarkdown: string;
  error: string | null;
  originalFileName: string | null;
  totalPages: number; // For PDF (pages), Excel (total rows or batches), Word/MD (total sections)
  currentBatchStart: number;
  currentBatchEnd: number;
  progressPercent: number;
  statusMessage: string;
  
  // Excel-specific persistent state
  excelSheets?: ExcelSheetInfo[];
  excelBatchSize?: number;
  translatedExcelRows?: Record<string, string[][]>; // sheetName -> rows
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

export interface ExecutionLogEntry {
  id: string;
  timestamp: string | number;
  timeStr?: string;
  level: LogLevel;
  stage: 'FILE_LOAD' | 'PREFLIGHT' | 'BATCH_CALL' | 'RECONCILE' | 'PACING' | 'ABORT' | 'ERROR' | 'EXPORT' | string;
  title?: string;
  message: string;
  details?: any;
  batchInfo?: {
    sheetName?: string;
    startRow?: number;
    endRow?: number;
    totalRows?: number;
    attempt?: number;
    durationMs?: number;
  };
}

export interface UIContent {
  title: string;
  upload: string;
  startExecution: string;
  stop: string;
  reset: string;
  saveToDrive: string;
  downloadMd: string;
  downloadWord: string;
  downloadExcel: string;
  errorTitle: string;
  retry: string;
  dropzoneText: string;
  processingText: string;
  translateAll: string;
  translateRange: string;
  pageRangeTitle: string;
  batchSizeLabel: string;
  fileInfoPages: string;
}

export type I18nData = Record<AppLanguage, UIContent>;

