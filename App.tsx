import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload as UploadIcon, 
  Play as PlayIcon, 
  Square as StopIcon, 
  RotateCcw as ResetIcon, 
  Download as DownloadIcon, 
  FileText as WordIcon,
  Globe as GlobeIcon, 
  AlertTriangle as ErrorIcon,
  Loader2 as SpinnerIcon,
  Layers as LayersIcon,
  CheckCircle2 as CheckIcon,
  ListFilter as FilterIcon,
  FileCheck2 as FileCheckIcon,
  FileSpreadsheet as ExcelIcon,
  FileCode as MarkdownIcon,
  Table as TableIcon,
  Sparkles,
  Info as InfoIcon,
  RefreshCw,
  X,
  ArrowLeftRight,
  Sliders,
  Sigma
} from 'lucide-react';
import { 
  AppLanguage, 
  TranslationState, 
  TranslationMode, 
  ExcelSheetInfo 
} from './types';
import { 
  I18N, 
  GEMINI_MODEL, 
  APP_NAME, 
  SUPPORTED_SOURCE_LANGUAGES, 
  SUPPORTED_TARGET_LANGUAGES 
} from './constants';
import { 
  translatePage, 
  translateExcelBatch, 
  translateTextChunk 
} from './services/geminiService';
import { QuotaDashboard } from './components/QuotaDashboard';
import { quotaTracker } from './services/quotaTracker';
import { 
  fileToBase64, 
  downloadMarkdown, 
  downloadDocx,
  parseExcelFile,
  calculateOptimalExcelBatchSize,
  generateExcelPreflightAssessment,
  formatRowsToIndexedBatch,
  reconcileBatchRows,
  formatRowsToMarkdownTable,
  parseMarkdownTableToRows,
  buildTranslatedExcelWorkbook,
  downloadExcelFile,
  parseDocxFile,
  parseMarkdownFile,
  DocChunk,
  detectDocumentType
} from './utils/fileUtils';
import { ExcelPreflightAssessment, ExecutionLogEntry } from './types';
import { getPDFPageCount, extractPDFPageRange } from './utils/pdfUtils';
import MarkdownViewer from './components/MarkdownViewer';
import ExcelGridViewer from './components/ExcelGridViewer';
import { ExecutionLogger } from './components/ExecutionLogger';
import { DiagramAuditSidebar } from './components/DiagramAuditSidebar';
import { parseDiagramAuditParameters } from './utils/diagramAuditUtils';
import { LatexConsistencyPanel } from './components/LatexConsistencyPanel';
import { inspectLatexConsistency } from './utils/latexConsistencyChecker';

const PRESET_RANGES = [
  { label: "1-3 页 (1625号通知主文)", start: 1, end: 3 },
  { label: "4-13 页 (1431号总则与标准)", start: 4, end: 13 },
  { label: "14-18 页 (逆变器/电缆规格表)", start: 14, end: 18 },
  { label: "19-24 页 (断路器/防孤岛/罚则)", start: 19, end: 24 },
  { label: "25-32 页 (申请表与流程图)", start: 25, end: 32 },
  { label: "33-36 页 (单线图/系统拓扑图)", start: 33, end: 36 },
  { label: "46-51 页 (设备数据采集表)", start: 46, end: 51 },
  { label: "52-58 页 (等效侧力ELF/抗震力学公式)", start: 52, end: 58 },
  { label: "58-67 页 (标准购电合同文本)", start: 58, end: 67 },
  { label: "68 页 (能矿部2188号通知)", start: 68, end: 68 },
  { label: "69-79 页 (2585号技术规程)", start: 69, end: 79 },
  { label: "80-86 页 (3161号购电决定)", start: 80, end: 86 }
];

const STANDARD_ACCEPT = ".xlsx,.xls,.csv,.xlsm,.xlsb,.docx,.doc,.pdf,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/pdf,text/plain,image/*";

interface CheckpointInfo {
  sheetName: string;
  rowsCount: number;
  lastRow: number;
  totalRows: number;
}

interface PdfCheckpointInfo {
  fileName: string;
  lastPage: number;
  totalPages: number;
  markdown: string;
  timestamp?: number;
}

const App: React.FC = () => {
  const [lang, setLang] = useState<AppLanguage>(AppLanguage.CN);
  const [state, setState] = useState<TranslationState>({
    isProcessing: false,
    sourceFiles: [],
    fileType: null,
    translatedMarkdown: "",
    error: null,
    originalFileName: null,
    totalPages: 1,
    currentBatchStart: 0,
    currentBatchEnd: 0,
    progressPercent: 0,
    statusMessage: "",
    translatedExcelRows: {},
  });

  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [translationMode, setTranslationMode] = useState<TranslationMode>(TranslationMode.ALL);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(3);
  const [batchSize, setBatchSize] = useState<number>(1); // 1 page per batch for PDF (lowest token consumption & maximum quota preservation)
  const [excelRowBatchSize, setExcelRowBatchSize] = useState<number>(20); // 20-row standard table sweet spot
  const [appendMode, setAppendMode] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [allowAnyExtension, setAllowAnyExtension] = useState<boolean>(false);

  // Diagram Parameter Audit state & sidebar drawer toggle
  const [auditDiagramParams, setAuditDiagramParams] = useState<boolean>(true);
  const [isAuditSidebarOpen, setIsAuditSidebarOpen] = useState<boolean>(false);
  const [isLatexInspectorOpen, setIsLatexInspectorOpen] = useState<boolean>(false);

  // User-configurable Source & Target Languages (adaptive for any low-resource / universal language pair)
  const [sourceLang, setSourceLang] = useState<string>(() => {
    try {
      return localStorage.getItem('app_source_lang') || '老挝语 (Lao / ພາສາລາວ)';
    } catch {
      return '老挝语 (Lao / ພາສາລາວ)';
    }
  });

  const [targetLang, setTargetLang] = useState<string>(() => {
    try {
      return localStorage.getItem('app_target_lang') || '中文 (简体) - 规范商务与工程';
    } catch {
      return '中文 (简体) - 规范商务与工程';
    }
  });

  const handleSourceLangChange = (val: string) => {
    setSourceLang(val);
    try {
      localStorage.setItem('app_source_lang', val);
    } catch {}
    addExecutionLog('info', '语言配置', `用户切换源语言为: 【${val}】`);
  };

  const handleTargetLangChange = (val: string) => {
    setTargetLang(val);
    try {
      localStorage.setItem('app_target_lang', val);
    } catch {}
    addExecutionLog('info', '语言配置', `用户切换目标语言为: 【${val}】`);
  };

  // Selected AI Engine Model
  const [selectedEngineModel, setSelectedEngineModel] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('app_selected_model');
      if (stored && stored !== 'gemini-3.8-flash' && stored !== 'gemini-2.5-flash') return stored;
      return 'gemini-3.1-flash-lite';
    } catch {
      return 'gemini-3.1-flash-lite';
    }
  });

  const handleModelChange = (model: string) => {
    setSelectedEngineModel(model);
    try {
      localStorage.setItem('app_selected_model', model);
    } catch {}
    addExecutionLog('info', '模型切换', `用户切换翻译底座模型为: [${model}]`);
  };

  const handleSwapLanguages = () => {
    const prevSrc = sourceLang;
    const prevTgt = targetLang;
    setSourceLang(prevTgt);
    setTargetLang(prevSrc);
    try {
      localStorage.setItem('app_source_lang', prevTgt);
      localStorage.setItem('app_target_lang', prevSrc);
    } catch {}
    addExecutionLog('info', '语言配置', `已互换翻译方向: 【${prevTgt}】 ➔ 【${prevSrc}】`);
  };

  // Excel view controls
  const [excelViewTab, setExcelViewTab] = useState<'grid' | 'markdown'>('grid');
  const [currentSheetIndex, setCurrentSheetIndex] = useState<number>(0);
  const [checkpointNotice, setCheckpointNotice] = useState<CheckpointInfo | null>(null);
  const [pdfCheckpointNotice, setPdfCheckpointNotice] = useState<PdfCheckpointInfo | null>(null);

  // Execution logger state with localStorage crash persistence
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('laodoc_persistent_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage parse errors
    }
    return [];
  });
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState<boolean>(true);

  // References for memory preservation across pipeline runs
  const rawPdfBytesRef = useRef<Uint8Array | null>(null);
  const rawPdfDocRef = useRef<any>(null);
  const rawDocChunksRef = useRef<DocChunk[]>([]);
  const excelSheetsRef = useRef<ExcelSheetInfo[]>([]);
  const translatedExcelRowsRef = useRef<Record<string, string[][]>>({});
  const translatedExcelBufferRef = useRef<Uint8Array | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchPacingMsRef = useRef<number>(2000);

  /**
   * High-fidelity logging helper with synchronous crash-resilient persistence
   */
  const addExecutionLog = (level: ExecutionLogEntry['level'], stage: string, message: string, details?: any) => {
    const entry: ExecutionLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      stage,
      level,
      message,
      details
    };
    console.log(`[${entry.stage}] [${entry.level.toUpperCase()}] ${entry.message}`, details || '');
    setExecutionLogs(prev => {
      // Keep last 400 entries to prevent memory overflow
      const next = [...prev, entry];
      const trimmed = next.length > 400 ? next.slice(next.length - 400) : next;
      try {
        localStorage.setItem('laodoc_persistent_logs', JSON.stringify(trimmed));
      } catch {
        // quota exceeded fallback
      }
      return trimmed;
    });
  };

  const clearExecutionLogs = () => {
    setExecutionLogs([]);
    try {
      localStorage.removeItem('laodoc_persistent_logs');
    } catch {}
  };

  const ui = I18N[lang];

  // Source doc text for formula consistency comparison
  const sourceDocText = React.useMemo(() => {
    if (rawDocChunksRef.current && rawDocChunksRef.current.length > 0) {
      return rawDocChunksRef.current.map(c => c.content).join('\n\n');
    }
    return undefined;
  }, [state.sourceFiles]);

  // LaTeX Consistency Report for current translation
  const latexReport = React.useMemo(() => {
    return inspectLatexConsistency(state.translatedMarkdown, sourceDocText);
  }, [state.translatedMarkdown, sourceDocText]);

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('laoDocLang') as AppLanguage;
      if (savedLang && Object.values(AppLanguage).includes(savedLang)) {
        setLang(savedLang);
      } else {
        const browserLang = navigator.language || '';
        if (browserLang.includes('lo')) setLang(AppLanguage.LAO);
        else if (browserLang.includes('en')) setLang(AppLanguage.EN);
      }
    } catch {
      // In sandboxed iframes or private modes
    }
  }, []);

  // Listen for automatic model rotation events from quotaTracker
  useEffect(() => {
    const unsub = quotaTracker.onAutoSwitchModel((oldM, newM, reason) => {
      setSelectedEngineModel(newM);
      try {
        localStorage.setItem('app_selected_model', newM);
      } catch {}
      addExecutionLog('warn', '智能通道自动轮换', `触发机制: 【${reason}】。底座模型已由 [${oldM}] 自动轮换至可用健康通道 [${newM}]，无需人工干预并自动继续任务。`);
    });
    return unsub;
  }, []);

  // 防误触刷新保护：翻译进行中若用户或系统意外触碰刷新/后退，给予浏览器确认弹窗
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isProcessing) {
        e.preventDefault();
        e.returnValue = '翻译任务正在进行中，刷新会导致页面重载。已翻译的批次已保存在缓存中，您确定要离开吗？';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isProcessing]);

  const handleLangChange = (newLang: AppLanguage) => {
    setLang(newLang);
    try {
      localStorage.setItem('laoDocLang', newLang);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  };

  const resetAll = () => {
    abortControllerRef.current?.abort();
    rawPdfBytesRef.current = null;
    rawPdfDocRef.current = null;
    rawDocChunksRef.current = [];
    excelSheetsRef.current = [];
    translatedExcelRowsRef.current = {};
    translatedExcelBufferRef.current = null;
    setCheckpointNotice(null);
    setPdfCheckpointNotice(null);
    setCurrentSheetIndex(0);

    setState({
      isProcessing: false,
      sourceFiles: [],
      fileType: null,
      translatedMarkdown: "",
      error: null,
      originalFileName: null,
      totalPages: 1,
      currentBatchStart: 0,
      currentBatchEnd: 0,
      progressPercent: 0,
      statusMessage: "",
      translatedExcelRows: {},
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const stopTranslation = () => {
    abortControllerRef.current?.abort();
    setState(prev => ({ 
      ...prev, 
      isProcessing: false,
      statusMessage: "已暂停/停止翻译，已翻译的数据已完全保存在内存与缓存中。"
    }));
  };

  /**
   * Unified file parsing & loading logic
   */
  const processUploadedFile = async (file: File) => {
    resetAll();
    addExecutionLog('info', '文件解析', `收到待处理文件: ${file.name} (大小: ${(file.size / 1024).toFixed(1)} KB)`);

    try {
      const buffer = await file.arrayBuffer();
      const detectedType = detectDocumentType(file, buffer);
      addExecutionLog('info', '格式识别', `文件格式识别结果: ${detectedType}`);

      if (detectedType === 'excel') {
        const parsed = parseExcelFile(buffer);
        if (parsed.sheets.length === 0) {
          throw new Error("Excel 工作簿中未检测到有效数据，请检查工作表是否为空。");
        }

        const sheetsWithPreflight = parsed.sheets.map(s => ({
          ...s,
          preflight: generateExcelPreflightAssessment(s.totalRows, s.totalCols, calculateOptimalExcelBatchSize(s.totalCols))
        }));

        excelSheetsRef.current = sheetsWithPreflight;
        const mainSheet = sheetsWithPreflight[0];
        const totalRowsAllSheets = sheetsWithPreflight.reduce((acc, s) => acc + s.totalRows, 0);
        const maxCols = Math.max(...sheetsWithPreflight.map(s => s.totalCols), 1);
        const optimalBatch = calculateOptimalExcelBatchSize(maxCols);
        
        addExecutionLog('success', '工作表解析', `成功加载 Excel: 共 ${sheetsWithPreflight.length} 个 Sheet，主表【${mainSheet.sheetName}】${mainSheet.totalRows} 行 × ${mainSheet.totalCols} 列，建议批次: ${optimalBatch} 行/批`);

        setExcelRowBatchSize(optimalBatch);
        setRangeStart(1);
        setRangeEnd(Math.min(mainSheet.totalRows, optimalBatch));

        // Check if there is a saved checkpoint in sessionStorage for this sheet
        try {
          const savedKey = `laodoc_ckpt_${file.name}_${mainSheet.sheetName}`;
          const savedJson = sessionStorage.getItem(savedKey);
          if (savedJson) {
            const parsedCkpt = JSON.parse(savedJson);
            if (parsedCkpt && Array.isArray(parsedCkpt.rows) && parsedCkpt.rows.length > 0) {
              addExecutionLog('info', '缓存扫描', `发现本地历史断点记录: 工作表【${mainSheet.sheetName}】已保存 ${parsedCkpt.rows.length} 行译文 (最后翻译至第 ${parsedCkpt.lastRow || parsedCkpt.rows.length} 行)`);
              setCheckpointNotice({
                sheetName: mainSheet.sheetName,
                rowsCount: parsedCkpt.rows.length,
                lastRow: parsedCkpt.lastRow || parsedCkpt.rows.length,
                totalRows: mainSheet.totalRows
              });
            }
          }
        } catch {
          // ignore storage read issues
        }

        setState(prev => ({
          ...prev,
          sourceFiles: ['EXCEL_LOADED'],
          fileType: 'excel',
          originalFileName: file.name,
          totalPages: mainSheet.totalRows,
          excelSheets: sheetsWithPreflight,
          excelBatchSize: optimalBatch,
          translatedExcelRows: {},
          statusMessage: `已就绪：检测到 Excel 表格【${mainSheet.sheetName}】，共 ${totalRowsAllSheets} 行 × ${maxCols} 列（前置预估：约 ${mainSheet.preflight?.totalBatches || Math.ceil(mainSheet.totalRows / optimalBatch)} 次调用，耗时 ~${Math.round((mainSheet.preflight?.estimatedDurationSec || 60) / 60)} 分钟）`,
        }));
      } else if (detectedType === 'word') {
        const parsedDoc = await parseDocxFile(buffer);
        rawDocChunksRef.current = parsedDoc.chunks;

        setRangeStart(1);
        setRangeEnd(Math.min(parsedDoc.chunks.length, 3));

        setState(prev => ({
          ...prev,
          sourceFiles: ['WORD_LOADED'],
          fileType: 'word',
          originalFileName: file.name,
          totalPages: parsedDoc.chunks.length,
          statusMessage: `已就绪：Word 文档 ${file.name}，共拆解为 ${parsedDoc.chunks.length} 个分段流水线批次`,
        }));
      } else if (detectedType === 'markdown') {
        const text = new TextDecoder('utf-8').decode(buffer);
        const parsedMd = parseMarkdownFile(text);
        rawDocChunksRef.current = parsedMd.chunks;

        setRangeStart(1);
        setRangeEnd(Math.min(parsedMd.chunks.length, 3));

        setState(prev => ({
          ...prev,
          sourceFiles: ['MARKDOWN_LOADED'],
          fileType: 'markdown',
          originalFileName: file.name,
          totalPages: parsedMd.chunks.length,
          statusMessage: `已就绪：Markdown/文本文件 ${file.name}，共拆解为 ${parsedMd.chunks.length} 个章节批次`,
        }));
      } else if (detectedType === 'pdf') {
        const bytes = new Uint8Array(buffer);
        rawPdfBytesRef.current = bytes;
        try {
          const { PDFDocument } = await import('pdf-lib');
          rawPdfDocRef.current = await PDFDocument.load(bytes, { ignoreEncryption: true });
        } catch {
          rawPdfDocRef.current = null;
        }
        const pages = await getPDFPageCount(bytes);

        setRangeStart(1);
        setRangeEnd(Math.min(pages, 3));

        // Check for existing PDF checkpoint
        try {
          const pdfCkptKey = `laodoc_pdf_ckpt_${file.name}`;
          const savedCkptJson = localStorage.getItem(pdfCkptKey) || sessionStorage.getItem(pdfCkptKey);
          if (savedCkptJson) {
            const parsed = JSON.parse(savedCkptJson);
            if (parsed && parsed.lastCompletedPage > 0 && parsed.markdown) {
              setPdfCheckpointNotice({
                fileName: file.name,
                lastPage: parsed.lastCompletedPage,
                totalPages: pages,
                markdown: parsed.markdown,
                timestamp: parsed.timestamp
              });
              addExecutionLog('info', '断点检测', `检测到此 PDF 存在历史断点备份 (已保存前 ${parsed.lastCompletedPage} 页译文)`);
            }
          }
        } catch (e) {
          // ignore
        }

        setState(prev => ({
          ...prev,
          sourceFiles: ['PDF_LOADED'],
          fileType: 'pdf',
          originalFileName: file.name,
          totalPages: pages,
          statusMessage: `已就绪：检测到 PDF 文件 ${file.name}，共 ${pages} 页`,
        }));
      } else if (detectedType === 'image') {
        const base64 = await fileToBase64(file);
        rawPdfBytesRef.current = null;
        setState(prev => ({
          ...prev,
          sourceFiles: [base64],
          fileType: 'image',
          originalFileName: file.name,
          totalPages: 1,
          statusMessage: `已就绪：图像公文文件 ${file.name}`,
        }));
      } else {
        throw new Error(`未能识别文件【${file.name}】的格式。系统支持：Excel 表格 (.xlsx, .xls, .csv)、Word 文档 (.docx)、Markdown/纯文本 (.md, .txt)、PDF 公文 (.pdf) 以及常见图片格式。`);
      }
    } catch (err: any) {
      console.error("File processing error:", err);
      setState(prev => ({ 
        ...prev, 
        error: err.message || "无法读取上传的文件，请确保文件未损坏且格式正确。" 
      }));
    }
  };

  /**
   * Restore checkpoint from sessionStorage
   */
  const handleRestoreCheckpoint = () => {
    if (!checkpointNotice || !state.originalFileName) return;
    try {
      const savedKey = `laodoc_ckpt_${state.originalFileName}_${checkpointNotice.sheetName}`;
      const savedJson = sessionStorage.getItem(savedKey);
      if (savedJson) {
        const parsedCkpt = JSON.parse(savedJson);
        if (parsedCkpt && Array.isArray(parsedCkpt.rows)) {
          translatedExcelRowsRef.current[checkpointNotice.sheetName] = parsedCkpt.rows;
          const nextRow = Math.min(parsedCkpt.lastRow + 1, checkpointNotice.totalRows);
          setRangeStart(nextRow);
          setRangeEnd(Math.min(checkpointNotice.totalRows, nextRow + excelRowBatchSize - 1));

          addExecutionLog('success', '断点恢复', `成功激活“记忆功能”！已无损找回【${checkpointNotice.sheetName}】前 ${parsedCkpt.rows.length} 行译文，自动对准第 ${nextRow} 行续传`);

          setState(prev => ({
            ...prev,
            currentBatchStart: nextRow,
            currentBatchEnd: parsedCkpt.lastRow,
            progressPercent: Math.round((parsedCkpt.rows.length / checkpointNotice.totalRows) * 100),
            translatedExcelRows: { ...translatedExcelRowsRef.current },
            statusMessage: `已成功载入断点缓存！前 ${parsedCkpt.rows.length} 行数据已恢复，可直接点击【启动全量翻译】从第 ${nextRow} 行继续。`
          }));
        }
      }
    } catch (err: any) {
      console.error("Failed to restore checkpoint:", err);
    } finally {
      setCheckpointNotice(null);
    }
  };

  /**
   * Restore PDF checkpoint from localStorage
   */
  const handleRestorePdfCheckpoint = () => {
    if (!pdfCheckpointNotice) return;
    try {
      const nextPage = Math.min(pdfCheckpointNotice.totalPages, pdfCheckpointNotice.lastPage + 1);
      setRangeStart(nextPage);
      setRangeEnd(Math.min(pdfCheckpointNotice.totalPages, nextPage + batchSize - 1));
      setAppendMode(true);

      addExecutionLog('success', '断点恢复', `成功激活“记忆功能”！已无损找回 PDF 前 ${pdfCheckpointNotice.lastPage} 页译文，自动对准第 ${nextPage} 页续传`);

      setState(prev => ({
        ...prev,
        translatedMarkdown: pdfCheckpointNotice.markdown,
        progressPercent: Math.round((pdfCheckpointNotice.lastPage / pdfCheckpointNotice.totalPages) * 100),
        statusMessage: `已成功载入 PDF 历史断点！前 ${pdfCheckpointNotice.lastPage} 页译文已完整恢复，可直接点击【启动全量翻译】从第 ${nextPage} 页继续。`
      }));
    } catch (err: any) {
      console.error("Failed to restore pdf checkpoint:", err);
    } finally {
      setPdfCheckpointNotice(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  /**
   * Pipeline for Excel translation with rate-limit protection & zero DOM bloat
   */
  const executeExcelTranslationPipeline = async (startRow: number, endRow: number, stepSize: number, append: boolean) => {
    if (!excelSheetsRef.current || excelSheetsRef.current.length === 0) return;
    abortControllerRef.current = new AbortController();

    const sheet = excelSheetsRef.current[currentSheetIndex] || excelSheetsRef.current[0];
    const totalTargetRows = endRow - startRow + 1;

    addExecutionLog('info', 'Excel流水线', `启动 Excel 翻译: 工作表【${sheet.sheetName}】，范围 ${startRow} ~ ${endRow} 行，批次步长: ${stepSize} 行/批 (增量模式: ${append ? '是' : '否'})`);

    setState(prev => ({
      ...prev,
      isProcessing: true,
      translatedMarkdown: append ? prev.translatedMarkdown : "",
      error: null,
      progressPercent: Math.round(((translatedExcelRowsRef.current[sheet.sheetName]?.length || 0) / sheet.totalRows) * 100),
      statusMessage: `开始执行 Excel 表格分批翻译【工作表: ${sheet.sheetName}，第 ${startRow} 行 至 第 ${endRow} 行，每批 ${stepSize} 行】...`
    }));

    if (!translatedExcelRowsRef.current[sheet.sheetName] || !append) {
      if (!append) {
        translatedExcelRowsRef.current[sheet.sheetName] = [];
      }
    }

    let rowsFinished = (translatedExcelRowsRef.current[sheet.sheetName]?.length || 0);

    try {
      for (let currStart = startRow; currStart <= endRow; currStart += stepSize) {
        if (abortControllerRef.current.signal.aborted) {
          addExecutionLog('warn', 'Excel流水线', `检测到中断信号，提前终止循环 (停在 Row ${currStart})`);
          break;
        }

        const currEnd = Math.min(currStart + stepSize - 1, endRow);
        const slice0Idx = currStart - 1;
        const sliceEnd0Idx = currEnd;
        const batchRows = sheet.dataRows.slice(slice0Idx, sliceEnd0Idx);

        const currentOverallPercent = Math.min(100, Math.round((currStart / sheet.totalRows) * 100));

        addExecutionLog('info', '分批发起', `开始处理批次 [Row ${currStart}-${currEnd}] (切片长度: ${batchRows.length} 行, 当前总进度 ${currentOverallPercent}%)`);

        setState(prev => ({
          ...prev,
          currentBatchStart: currStart,
          currentBatchEnd: currEnd,
          progressPercent: currentOverallPercent,
          statusMessage: `正在翻译表格【${sheet.sheetName}】第 ${currStart}-${currEnd} 行 / 共 ${sheet.totalRows} 行 (${currentOverallPercent}%)...`
        }));

        const batchData = formatRowsToIndexedBatch(sheet.headers, batchRows, currStart);

        const chosenModel = selectedEngineModel;

        let batchResultText = "";
        if (batchData.items.length === 0) {
          addExecutionLog('info', '空行跳过', `批次 [Row ${currStart}-${currEnd}] 全部为空行，跳过 API 调用直接透传`);
          batchResultText = JSON.stringify({ rows: [] });
        } else {
          let streamBuffer = "";
          batchResultText = await translateExcelBatch(
            batchData.jsonPayload,
            {
              sheetName: sheet.sheetName,
              startRow: currStart,
              endRow: currEnd,
              totalRows: sheet.totalRows,
              nonBlankCount: batchData.items.length,
              targetModel: chosenModel,
              sourceLang,
              targetLang
            },
            (chunk) => {
              streamBuffer += chunk;
            },
            abortControllerRef.current.signal,
            (statusNote) => {
              if (statusNote.includes('频控') || statusNote.includes('冷却') || statusNote.includes('429')) {
                batchPacingMsRef.current = 5500;
                addExecutionLog('warn', '频控等待', statusNote);
              }
              setState(prev => ({ ...prev, statusMessage: statusNote }));
            },
            (level, msg, details) => {
              addExecutionLog(level, '模型交互', msg, details);
            }
          );
          if (!batchResultText && streamBuffer) {
            batchResultText = streamBuffer;
          }
        }

        // Zero-loss reconciliation against original rows
        let { reconciledRows, translatedCount, missingCount, missingRowIds } = reconcileBatchRows(
          batchResultText,
          currStart,
          currEnd,
          sheet.totalCols,
          batchRows,
          batchData.blankRowIndices
        );

        addExecutionLog('info', '数据核对', `批次 [Row ${currStart}-${currEnd}] 初步核对: 成功解析 ${translatedCount} 行, 缺失待补 ${missingCount} 行`);

        // === AI 智能化核心改进：自动查漏补缺机制 (Auto-Patch Missing Rows) ===
        // 如果批次中存在被漏译或截断的行，系统主动针对缺失行发起微型定向精准补译，严禁用户承担责任！
        if (missingCount > 0 && missingRowIds.length > 0 && !abortControllerRef.current.signal.aborted) {
          addExecutionLog('warn', '智能查漏', `检测到 ${missingRowIds.length} 行译文缺失 (行号: ${missingRowIds.join(', ')})，防频控安全缓冲 4200ms 后触发系统级微型精准补译...`);
          setState(prev => ({
            ...prev,
            statusMessage: `⚡ 智能纠偏：检测到 ${missingRowIds.length} 行译文在主批次被截断，安全缓冲后自动发起精准补译 (免去人工干预)...`
          }));

          // Strict RPM protection: ensure at least 5s delay before sending the micro-patch request
          await new Promise(resolve => setTimeout(resolve, 5000));

          try {
            // Prepare micro-batch payload only containing the missing rows
            const patchItems = missingRowIds.map(rId => {
              const localIdx = rId - currStart;
              const rawCells = batchRows[localIdx] || [];
              return {
                r: rId,
                c: rawCells.map((c: any) => (c !== undefined && c !== null ? String(c) : ''))
              };
            });

            const patchPayload = JSON.stringify({
              headers: sheet.headers,
              rows: patchItems
            }, null, 2);

            let patchStreamBuffer = "";
            const patchResultText = await translateExcelBatch(
              patchPayload,
              {
                sheetName: sheet.sheetName,
                startRow: missingRowIds[0],
                endRow: missingRowIds[missingRowIds.length - 1],
                totalRows: sheet.totalRows,
                nonBlankCount: patchItems.length,
                targetModel: 'gemini-3.1-flash-lite',
                sourceLang,
                targetLang
              },
              (chunk) => {
                patchStreamBuffer += chunk;
              },
              abortControllerRef.current.signal,
              (statusNote) => {
                setState(prev => ({ ...prev, statusMessage: statusNote }));
              },
              (level, msg, details) => {
                addExecutionLog(level, '智能补译', msg, details);
              }
            );

            const finalPatchText = patchResultText || patchStreamBuffer;
            if (finalPatchText) {
              let patchedRowsMap = new Map<number, string[]>();
              try {
                let clean = finalPatchText.trim();
                if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
                const fb = clean.indexOf('{');
                const lb = clean.lastIndexOf('}');
                if (fb !== -1 && lb !== -1) clean = clean.slice(fb, lb + 1);
                const parsedPatch = JSON.parse(clean);
                const rowsArr = Array.isArray(parsedPatch?.rows) ? parsedPatch.rows : (Array.isArray(parsedPatch) ? parsedPatch : []);
                for (const item of rowsArr) {
                  const rNum = Number(item.r || item.id || item.row);
                  if (!isNaN(rNum) && Array.isArray(item.c)) {
                    patchedRowsMap.set(rNum, item.c.map((val: any) => String(val ?? '')));
                  }
                }
              } catch (e) {
                // regex fallback
                const rx = /\{\s*"(?:r|id|row)"\s*:\s*["']?(\d+)["']?\s*,\s*"(?:c|cells|data)"\s*:\s*(\[[^\]]*\])\s*\}/g;
                let m: RegExpExecArray | null;
                while ((m = rx.exec(finalPatchText)) !== null) {
                  try {
                    const rId = parseInt(m[1], 10);
                    const cells = JSON.parse(m[2]);
                    if (Array.isArray(cells)) patchedRowsMap.set(rId, cells.map((v: any) => String(v ?? '')));
                  } catch {}
                }
              }

              // Merge patched rows into reconciledRows
              let patchedCount = 0;
              for (const rId of missingRowIds) {
                const localIdx = rId - currStart;
                const patchedCells = patchedRowsMap.get(rId);
                if (patchedCells && patchedCells.length > 0) {
                  const padded: string[] = [];
                  for (let c = 0; c < sheet.totalCols; c++) {
                    const val = patchedCells[c];
                    padded.push(val !== undefined && val !== null ? String(val) : '');
                  }
                  reconciledRows[localIdx] = padded;
                  patchedCount++;
                }
              }

              translatedCount += patchedCount;
              missingCount = Math.max(0, missingCount - patchedCount);
              addExecutionLog('success', '补译成功', `自动查漏补缺完成！成功挽回补齐 ${patchedCount} 行缺失译文 (剩余保真: ${missingCount} 行)`);
            }
          } catch (patchErr: any) {
            addExecutionLog('warn', '智能补译', `微型补译尝试失败，已保留原单元格保真数据: ${patchErr?.message}`);
          }
        }
        
        // Exact index-based insertion into sheetRows to guarantee 1:1 row alignment
        const sheetRows = [...(translatedExcelRowsRef.current[sheet.sheetName] || [])];
        for (let i = 0; i < reconciledRows.length; i++) {
          sheetRows[slice0Idx + i] = reconciledRows[i];
        }
        translatedExcelRowsRef.current[sheet.sheetName] = sheetRows;

        // Save session checkpoint after each batch to prevent data loss
        try {
          if (state.originalFileName) {
            const savedKey = `laodoc_ckpt_${state.originalFileName}_${sheet.sheetName}`;
            sessionStorage.setItem(savedKey, JSON.stringify({
              sheetName: sheet.sheetName,
              lastRow: currEnd,
              rows: sheetRows,
              timestamp: Date.now()
            }));
            addExecutionLog('info', '断点备份', `已将断点持久化缓存至 sessionStorage (${sheetRows.length} 行)`);
          }
        } catch (storageErr: any) {
          addExecutionLog('warn', '断点备份', `sessionStorage 存储限制 (不影响内存): ${storageErr?.message}`);
        }

        const batchMdTable = formatRowsToMarkdownTable(sheet.headers, reconciledRows);
        const batchDivider = `\n\n---\n\n### 📊 工作表【${sheet.sheetName}】第 ${currStart} - ${currEnd} 行译文（共 ${sheet.totalRows} 行）\n\n`;
        rowsFinished = sheetRows.length;
        const newPercent = Math.min(100, Math.round((currEnd / sheet.totalRows) * 100));

        setState(prev => ({
          ...prev,
          translatedExcelRows: { ...translatedExcelRowsRef.current },
          translatedMarkdown: prev.translatedMarkdown + batchDivider + batchMdTable,
          progressPercent: newPercent,
          statusMessage: missingCount > 0 
            ? `表格第 ${currStart}-${currEnd} 行已完成（${translatedCount} 行已翻译，${missingCount} 行原样保留），安全定速巡航准备下一批次...`
            : `表格第 ${currStart}-${currEnd} 行全部完成（100% 对齐），安全定速巡航准备下一批次...`
        }));

        if (currEnd < endRow) {
          // Proactive pacing to guarantee <= 11-12 RPM, eliminating 429 errors
          const pacingMs = batchPacingMsRef.current || 5200;
          addExecutionLog('info', '定速巡航', `防频控安全休眠 ${pacingMs}ms，准备发起 Row ${currEnd + 1} ...`);
          await new Promise(res => setTimeout(res, pacingMs));
        }
      }

      if (!abortControllerRef.current.signal.aborted) {
        addExecutionLog('success', 'Excel流水线', `所有批次执行完毕，正在合成完整 Excel 工作簿...`);
        const allSheetsToExport = excelSheetsRef.current.map(s => ({
          sheetName: s.sheetName,
          headers: s.headers,
          rows: translatedExcelRowsRef.current[s.sheetName] || s.dataRows
        }));
        translatedExcelBufferRef.current = buildTranslatedExcelWorkbook(allSheetsToExport);
        addExecutionLog('success', '工作簿生成', `Excel 工作簿构建成功 (字节数: ${translatedExcelBufferRef.current?.length || 0})`);

        setState(prev => ({
          ...prev,
          isProcessing: false,
          progressPercent: 100,
          statusMessage: `🎉 Excel 表格翻译全部完成！已处理 ${totalTargetRows} 行数据，可点击左侧【导出 Excel 工作簿 (.xlsx)】下载。`
        }));
      }
    } catch (err: any) {
      const isAbort = 
        err?.name === 'AbortError' || 
        err?.message === 'AbortError' || 
        String(err?.message || '').includes('aborted') || 
        Boolean(abortControllerRef.current?.signal.aborted);

      if (!isAbort) {
        addExecutionLog('error', '异常拦截', `Excel 翻译流水线中断: ${err?.message || err}`, { stack: err?.stack });
        console.error("Excel pipeline error:", err);
        setState(prev => ({
          ...prev,
          error: err.message || "Excel 表格翻译发生异常，进度已完整保存。",
          isProcessing: false,
          statusMessage: "处理已安全暂停，已翻译的数据已完整保存在内存中，可随时点击【继续翻译】断点续传。"
        }));
      } else {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          statusMessage: "翻译已按您的要求安全暂停，当前进度已完整保存，可随时点击【继续翻译】从断点无缝续传。"
        }));
      }
    }
  };

  /**
   * Pipeline for Word / Markdown text chunks
   */
  const executeDocTextPipeline = async (startChunk: number, endChunk: number, append: boolean) => {
    if (rawDocChunksRef.current.length === 0) return;
    abortControllerRef.current = new AbortController();

    const targetChunks = rawDocChunksRef.current.slice(startChunk - 1, endChunk);
    const totalTargetChunks = targetChunks.length;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      translatedMarkdown: append ? prev.translatedMarkdown : "",
      error: null,
      progressPercent: 0,
      statusMessage: `开始执行文档分段流水线 (第 ${startChunk} 段 至 第 ${endChunk} 段 / 共 ${rawDocChunksRef.current.length} 段)...`
    }));

    let chunksDone = 0;

    try {
      for (const chunk of targetChunks) {
        if (abortControllerRef.current.signal.aborted) break;

        const currentPct = Math.round((chunksDone / totalTargetChunks) * 100);
        setState(prev => ({
          ...prev,
          currentBatchStart: chunk.index,
          currentBatchEnd: chunk.index,
          progressPercent: currentPct,
          statusMessage: `正在翻译 ${chunk.title} (${chunk.index}/${rawDocChunksRef.current.length})...`
        }));

        const sectionHeader = `\n\n---\n\n### 📝 ${chunk.title}\n\n`;
        setState(prev => ({
          ...prev,
          translatedMarkdown: prev.translatedMarkdown + sectionHeader
        }));

        await translateTextChunk(
          chunk.content,
          {
            title: chunk.title,
            current: chunk.index,
            total: rawDocChunksRef.current.length,
            fileType: state.fileType || undefined,
            sourceLang,
            targetLang
          },
          (text) => {
            setState(prev => ({
              ...prev,
              translatedMarkdown: prev.translatedMarkdown + text
            }));
          },
          abortControllerRef.current.signal
        );

        chunksDone++;
        const newPct = Math.min(100, Math.round((chunksDone / totalTargetChunks) * 100));

        setState(prev => ({
          ...prev,
          progressPercent: newPct,
          statusMessage: `${chunk.title} 已完成，准备处理下一段...`
        }));

        if (chunksDone < totalTargetChunks) {
          await new Promise(res => setTimeout(res, 500));
        }
      }

      if (!abortControllerRef.current.signal.aborted) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          progressPercent: 100,
          statusMessage: `文档流水线顺利完成！共处理 ${chunksDone} 部分。`
        }));
      }
    } catch (err: any) {
      const isAbort = 
        err?.name === 'AbortError' || 
        err?.message === 'AbortError' || 
        String(err?.message || '').includes('aborted') || 
        Boolean(abortControllerRef.current?.signal.aborted);

      if (!isAbort) {
        setState(prev => ({
          ...prev,
          error: err.message || "文档翻译发生异常，请重试当前批次。",
          isProcessing: false,
          statusMessage: "处理中断，已保存之前翻译结果。"
        }));
      } else {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          statusMessage: "翻译已安全暂停，已保存已翻译的部分。"
        }));
      }
    }
  };

  /**
   * Pipeline for Multi-page PDF or single image
   */
  const executePDFPipeline = async (startPage: number, endPage: number, stepSize: number, append: boolean) => {
    if (state.sourceFiles.length === 0 || state.isProcessing) return;
    abortControllerRef.current = new AbortController();

    const isImage = state.fileType === 'image';

    setState(prev => ({
      ...prev,
      isProcessing: true,
      translatedMarkdown: append ? prev.translatedMarkdown : "",
      error: null,
      progressPercent: 0,
      statusMessage: isImage
        ? `正在翻译图像公文...`
        : `开始执行分页流水线 (第 ${startPage} 页 至 第 ${endPage} 页 / 共 ${state.totalPages} 页)...`
    }));

    try {
      if (isImage) {
        const base64 = state.sourceFiles[0];
        let imageAccumulated = append ? state.translatedMarkdown : "";
        await translatePage(
          base64,
          'image/jpeg',
          (chunk) => {
            imageAccumulated += chunk;
            setState(prev => ({
              ...prev,
              translatedMarkdown: imageAccumulated
            }));
          },
          abortControllerRef.current.signal,
          undefined,
          selectedEngineModel,
          { sourceLang, targetLang },
          (statusNote) => {
            setState(prev => ({ ...prev, statusMessage: statusNote }));
          },
          (level, msg, details) => {
            addExecutionLog(level, '图像公文', msg, details);
          },
          auditDiagramParams,
          (newModel) => {
            setSelectedEngineModel(newModel);
            try { localStorage.setItem('app_selected_model', newModel); } catch {}
          }
        );

        setState(prev => ({
          ...prev,
          isProcessing: false,
          progressPercent: 100,
          statusMessage: "翻译已全部完成！"
        }));
        return;
      }

      const totalPagesInJob = endPage - startPage + 1;
      let pagesCompleted = 0;
      let accumulatedMarkdown = append ? state.translatedMarkdown : "";

      let currStart = startPage;
      while (currStart <= endPage) {
        if (abortControllerRef.current.signal.aborted) break;

        const currEnd = Math.min(currStart + stepSize - 1, endPage);
        const batchPercent = Math.round((pagesCompleted / totalPagesInJob) * 100);

        setState(prev => ({
          ...prev,
          currentBatchStart: currStart,
          currentBatchEnd: currEnd,
          progressPercent: batchPercent,
          statusMessage: `正在处理 第 ${currStart}${currEnd > currStart ? `-${currEnd}` : ''} 页 / 共 ${state.totalPages} 页 (${batchPercent}%)...`
        }));

        const slice = await extractPDFPageRange(
          rawPdfDocRef.current || rawPdfBytesRef.current!,
          currStart,
          currEnd
        );
        
        const pageHeader = `\n\n---\n\n### 📄 第 ${currStart}${currEnd > currStart ? `-${currEnd}` : ''} 页 / 共 ${state.totalPages} 页\n\n`;
        
        let batchAccumulatedText = "";
        let lastRenderTime = 0;
        const baseBeforeBatch = accumulatedMarkdown;
        let actualBatchEnd = currEnd;

        try {
          await translatePage(
            slice.base64,
            'application/pdf',
            (chunk) => {
              batchAccumulatedText += chunk;
              const now = Date.now();
              // Throttle streaming renders to prevent V8 memory exhaustion and UI tab freeze
              if (now - lastRenderTime > 280) {
                lastRenderTime = now;
                setState(prev => ({
                  ...prev,
                  translatedMarkdown: baseBeforeBatch + pageHeader + batchAccumulatedText
                }));
              }
            },
            abortControllerRef.current.signal,
            {
              startPage: currStart,
              endPage: currEnd,
              totalPages: state.totalPages
            },
            selectedEngineModel,
            { sourceLang, targetLang },
            (statusNote) => {
              setState(prev => ({ ...prev, statusMessage: statusNote }));
            },
            (level, msg, details) => {
              addExecutionLog(level, 'PDF切片', msg, details);
            },
            auditDiagramParams,
            (newModel) => {
              setSelectedEngineModel(newModel);
              try { localStorage.setItem('app_selected_model', newModel); } catch {}
            }
          );
        } catch (batchErr: any) {
          if (currEnd > currStart && !abortControllerRef.current.signal.aborted) {
            const errStr = String(batchErr?.message || batchErr || '');
            const is503 = errStr.includes("503") || errStr.includes("high demand") || errStr.includes("UNAVAILABLE");
            const isRateLimit = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
            const reason = is503 ? "云端高负载排队" : (isRateLimit ? "多页并发限流" : "批次请求超时");

            addExecutionLog('warn', '自适应降级', `第 ${currStart}-${currEnd} 页因【${reason}】受阻，系统已自动平滑降级为单页精细模式，优先翻译第 ${currStart} 页...`);
            setState(prev => ({
              ...prev,
              statusMessage: `⚡ 自适应降级：当前批次（第 ${currStart}-${currEnd} 页）受阻，系统已自动启动单页精细模式，正在翻译第 ${currStart} 页...`
            }));

            const singleSlice = await extractPDFPageRange(
              rawPdfDocRef.current || rawPdfBytesRef.current!,
              currStart,
              currStart
            );
            const singleHeader = `\n\n---\n\n### 📄 第 ${currStart} 页 / 共 ${state.totalPages} 页\n\n`;
            let singleText = "";
            let singleLastRender = 0;

            quotaTracker.recordRateLimitHit(selectedEngineModel, 40, errStr);
            const autoHealthyModel = quotaTracker.getHealthyModel(selectedEngineModel);
            if (autoHealthyModel !== selectedEngineModel) {
              setSelectedEngineModel(autoHealthyModel);
              try {
                localStorage.setItem('app_selected_model', autoHealthyModel);
              } catch {}
              addExecutionLog('warn', '智能通道自愈切换', `第 ${currStart}-${currEnd} 页因云端高频限制触发自愈：底座模型已由 [${selectedEngineModel}] 自动无感轮换为健康通道 [${autoHealthyModel}]`);
            }
            const fallbackModel = autoHealthyModel;

            // Automatically synchronize batch size to 1 in both loop variable and UI state
            if (stepSize > 1) {
              stepSize = 1;
              setBatchSize(1);
              addExecutionLog('warn', '自适应批次降级', `检测到云端并发频控，系统已自动将后续批次步长降为 1 页/批 巡航模式，保障后续页面平稳完成，避免频繁触发频控报警。界面每批处理页数已自动更新为 1。`);
            }

            await translatePage(
              singleSlice.base64,
              'application/pdf',
              (chunk) => {
                singleText += chunk;
                const now = Date.now();
                if (now - singleLastRender > 280) {
                  singleLastRender = now;
                  setState(prev => ({
                    ...prev,
                    translatedMarkdown: baseBeforeBatch + singleHeader + singleText
                  }));
                }
              },
              abortControllerRef.current.signal,
              {
                startPage: currStart,
                endPage: currStart,
                totalPages: state.totalPages
              },
              fallbackModel,
              { sourceLang, targetLang },
              (statusNote) => {
                setState(prev => ({ ...prev, statusMessage: statusNote }));
              },
              (level, msg, details) => {
                addExecutionLog(level, '单页精细', msg, details);
              },
              auditDiagramParams,
              (newModel) => {
                setSelectedEngineModel(newModel);
                try { localStorage.setItem('app_selected_model', newModel); } catch {}
              }
            );

            actualBatchEnd = currStart;
            batchAccumulatedText = singleText;
          } else {
            throw batchErr;
          }
        }

        const effectiveHeader = actualBatchEnd > currStart
          ? pageHeader
          : `\n\n---\n\n### 📄 第 ${currStart} 页 / 共 ${state.totalPages} 页\n\n`;

        accumulatedMarkdown = baseBeforeBatch + effectiveHeader + batchAccumulatedText;
        const pagesInThisStep = actualBatchEnd - currStart + 1;
        pagesCompleted += pagesInThisStep;
        const newPercent = Math.min(100, Math.round((pagesCompleted / totalPagesInJob) * 100));

        // Automated Formula & Diagram Consistency Check on completed page batch
        try {
          const batchLatex = inspectLatexConsistency(batchAccumulatedText);
          if (batchLatex.mismatchCount > 0 || batchLatex.errorCount > 0) {
            const warningSnippets = batchLatex.items
              .filter(it => it.hasMismatch)
              .map(it => `${it.eqNumber || '公式#' + it.index} (${it.diagnostics[0] || '结构异常'})`)
              .slice(0, 3);
            addExecutionLog('warn', '公式一致性告警', `第 ${currStart}${actualBatchEnd > currStart ? `-${actualBatchEnd}` : ''} 页发现 ${batchLatex.mismatchCount + batchLatex.errorCount} 处公式结构待纠偏: ${warningSnippets.join('; ')}。侧边栏已高亮显示并支持一键智能纠偏。`);
          } else if (batchLatex.totalCount > 0) {
            addExecutionLog('info', '公式一致性核验', `第 ${currStart}${actualBatchEnd > currStart ? `-${actualBatchEnd}` : ''} 页共核验 ${batchLatex.totalCount} 处公式，符号与结构规范一致。`);
          }

          if (auditDiagramParams) {
            const diagramParams = parseDiagramAuditParameters(batchAccumulatedText);
            if (diagramParams.length > 0) {
              addExecutionLog('info', '图表参数复核', `第 ${currStart}${actualBatchEnd > currStart ? `-${actualBatchEnd}` : ''} 页提取到 ${diagramParams.length} 项图表标注参数 (已自动载入复核侧边栏)`);
            }
          }
        } catch {
          // ignore inspection errors
        }

        setState(prev => ({
          ...prev,
          translatedMarkdown: accumulatedMarkdown,
          progressPercent: newPercent,
          statusMessage: `第 ${currStart}${actualBatchEnd > currStart ? `-${actualBatchEnd}` : ''} 页已完成，安全定速巡航准备下一批次...`
        }));

        // Persist PDF checkpoint after each batch to prevent any data loss
        try {
          if (state.originalFileName) {
            const ckpt = {
              fileName: state.originalFileName,
              lastCompletedPage: actualBatchEnd,
              totalPages: state.totalPages,
              markdown: accumulatedMarkdown,
              timestamp: Date.now()
            };
            localStorage.setItem(`laodoc_pdf_ckpt_${state.originalFileName}`, JSON.stringify(ckpt));
            addExecutionLog('info', '断点备份', `PDF 已成功将第 1 至第 ${actualBatchEnd} 页成果持久化存储`);
          }
        } catch (e: any) {
          try {
            sessionStorage.setItem(`laodoc_pdf_ckpt_${state.originalFileName}`, JSON.stringify({
              fileName: state.originalFileName,
              lastCompletedPage: actualBatchEnd,
              totalPages: state.totalPages,
              markdown: accumulatedMarkdown,
              timestamp: Date.now()
            }));
          } catch {}
        }

        if (actualBatchEnd < endPage) {
          // Strictly adhere to 5s pacing to guarantee <= 12 RPM, avoiding 15 RPM rate limits
          addExecutionLog('info', '定速巡航', `防频控安全休眠 5000ms，准备处理第 ${actualBatchEnd + 1} 页...`);
          await new Promise(res => setTimeout(res, 5000));
        }

        currStart = actualBatchEnd + 1;
      }

      if (!abortControllerRef.current.signal.aborted) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          progressPercent: 100,
          statusMessage: `翻译流水线已顺利完成！共处理 ${totalPagesInJob} 页。`
        }));
      }
    } catch (err: any) {
      const isAbort = 
        err?.name === 'AbortError' || 
        err?.message === 'AbortError' || 
        String(err?.message || '').includes('aborted') || 
        Boolean(abortControllerRef.current?.signal.aborted);

      if (!isAbort) {
        setState(prev => ({
          ...prev,
          error: err.message || "翻译处理发生异常，请检查网络后点击重试当前批次。",
          isProcessing: false,
          statusMessage: "处理中断，已保存前面所有已完成的页码内容。"
        }));
      } else {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          statusMessage: "翻译已安全暂停，已保存前面所有已完成的页码内容。"
        }));
      }
    }
  };

  /**
   * Router to trigger pipeline according to file type
   */
  const handleStartAll = () => {
    if (state.fileType === 'excel') {
      const sheet = excelSheetsRef.current[currentSheetIndex] || excelSheetsRef.current[0];
      const translatedCount = translatedExcelRowsRef.current[sheet.sheetName]?.length || 0;
      const start = translatedCount > 0 && translatedCount < sheet.totalRows ? translatedCount + 1 : 1;
      executeExcelTranslationPipeline(start, sheet.totalRows, excelRowBatchSize, start > 1);
    } else if (state.fileType === 'word' || state.fileType === 'markdown') {
      executeDocTextPipeline(1, state.totalPages, false);
    } else {
      executePDFPipeline(1, state.totalPages, batchSize, false);
    }
  };

  const handleStartRange = () => {
    const s = Math.max(1, Math.min(rangeStart, state.totalPages));
    const e = Math.max(s, Math.min(rangeEnd, state.totalPages));

    if (state.fileType === 'excel') {
      executeExcelTranslationPipeline(s, e, excelRowBatchSize, appendMode);
    } else if (state.fileType === 'word' || state.fileType === 'markdown') {
      executeDocTextPipeline(s, e, appendMode);
    } else {
      executePDFPipeline(s, e, batchSize, appendMode);
    }
  };

  const handleResumeCurrentBatch = () => {
    setState(prev => ({ ...prev, error: null }));
    if (state.fileType === 'excel') {
      const sheet = excelSheetsRef.current[currentSheetIndex] || excelSheetsRef.current[0];
      const translatedCount = translatedExcelRowsRef.current[sheet.sheetName]?.length || 0;
      const startRow = Math.max(1, translatedCount + 1);
      addExecutionLog('info', '用户操作', `用户触发【立即从断点继续翻译】，目标起始行: 第 ${startRow} 行 / 共 ${sheet.totalRows} 行`);
      executeExcelTranslationPipeline(startRow, sheet.totalRows, excelRowBatchSize, true);
    } else if (state.currentBatchStart > 0) {
      if (state.fileType === 'word' || state.fileType === 'markdown') {
        executeDocTextPipeline(state.currentBatchStart, state.totalPages, true);
      } else {
        executePDFPipeline(state.currentBatchStart, state.totalPages, batchSize, true);
      }
    } else {
      handleStartAll();
    }
  };

  const handleDownload = () => {
    const name = state.originalFileName ? state.originalFileName.split('.')[0] : 'document';
    downloadMarkdown(state.translatedMarkdown, `${name}-译文.md`);
  };

  const handleDownloadWord = async () => {
    if (!state.translatedMarkdown || isExportingWord) return;
    try {
      setIsExportingWord(true);
      const name = state.originalFileName ? state.originalFileName.split('.')[0] : 'document';
      await downloadDocx(state.translatedMarkdown, `${name}-译文.docx`);
    } catch (err: any) {
      console.error("Failed to generate docx:", err);
      setState(prev => ({ ...prev, error: "Word 文档生成失败: " + (err?.message || "未知错误") }));
    } finally {
      setIsExportingWord(false);
    }
  };

  /**
   * Export Excel - Strictly restricted to Excel original documents
   */
  const handleDownloadExcel = async () => {
    if (state.fileType !== 'excel' || isExportingExcel) return;
    try {
      setIsExportingExcel(true);
      let buffer = translatedExcelBufferRef.current;
      
      // If buffer not generated yet, try to compile from collected rows
      if (!buffer && excelSheetsRef.current.length > 0) {
        const allSheetsToExport = excelSheetsRef.current.map(s => ({
          sheetName: s.sheetName,
          headers: s.headers,
          rows: translatedExcelRowsRef.current[s.sheetName] || s.dataRows
        }));
        buffer = buildTranslatedExcelWorkbook(allSheetsToExport);
        translatedExcelBufferRef.current = buffer;
      }

      if (!buffer) {
        throw new Error("尚未生成已翻译的表格数据，请先启动并完成表格翻译。");
      }

      const name = state.originalFileName ? state.originalFileName.split('.')[0] : 'spreadsheet';
      downloadExcelFile(buffer, `${name}-译文工作簿.xlsx`);
    } catch (err: any) {
      setState(prev => ({ ...prev, error: "Excel 导出失败: " + (err?.message || "未知错误") }));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const activeSheet = excelSheetsRef.current[currentSheetIndex] || excelSheetsRef.current[0];
  const activeSheetTranslatedRows = activeSheet ? (translatedExcelRowsRef.current[activeSheet.sheetName] || []) : [];

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#0F172A] text-white shadow-xl px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-2">
            <span className="text-lg font-black italic">G</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                {ui.title}
              </h1>
              <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> 工程规范专业复现版 v2.5
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">
              国家与行业强制性标准 • 建筑/结构/消防/抗震 • LaTeX 公式/多表头/特征曲线/公文样张 • 1:1 版式复现
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Source & Target Language Selector in Header */}
          <div className="hidden md:flex items-center gap-2 bg-slate-800/90 rounded-xl px-3 py-1.5 border border-slate-700/80 shadow-inner">
            <span className="text-[11px] text-slate-400 font-medium">源语言:</span>
            <select
              value={sourceLang}
              onChange={(e) => handleSourceLangChange(e.target.value)}
              aria-label="选择源语言"
              className="bg-slate-900 text-teal-300 text-xs font-semibold px-2 py-1 rounded-lg border border-slate-700 outline-none cursor-pointer focus:ring-1 focus:ring-teal-500 max-w-[170px] truncate"
            >
              {SUPPORTED_SOURCE_LANGUAGES.map(sl => (
                <option key={sl.code} value={sl.name} className="bg-slate-800 text-white">{sl.name}</option>
              ))}
            </select>

            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 mx-0.5 shrink-0" />

            <span className="text-[11px] text-slate-400 font-medium">目标语言:</span>
            <select
              value={targetLang}
              onChange={(e) => handleTargetLangChange(e.target.value)}
              aria-label="选择目标语言"
              className="bg-slate-900 text-emerald-300 text-xs font-semibold px-2 py-1 rounded-lg border border-slate-700 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500 max-w-[170px] truncate"
            >
              {SUPPORTED_TARGET_LANGUAGES.map(tl => (
                <option key={tl.code} value={tl.name} className="bg-slate-800 text-white">{tl.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-slate-800/80 rounded-full px-3.5 py-1.5 border border-slate-700">
            <GlobeIcon className="w-3.5 h-3.5 text-teal-400 mr-2" />
            <select
              value={lang}
              onChange={(e) => handleLangChange(e.target.value as AppLanguage)}
              aria-label="选择界面语言"
              className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer pr-1"
            >
              <option value={AppLanguage.CN} className="bg-slate-800 text-white">简体中文 (ZH)</option>
              <option value={AppLanguage.EN} className="bg-slate-800 text-white">English (EN)</option>
              <option value={AppLanguage.LAO} className="bg-slate-800 text-white">ພາສາລາວ (LO)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-[1px_0_10px_rgba(0,0,0,0.03)] z-10 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Real-time Daily Quota Dashboard */}
            <QuotaDashboard 
              currentModel={selectedEngineModel} 
              onSelectModel={handleModelChange} 
            />

            {/* Upload Section */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">文档 / 表格上传</h3>
                {state.originalFileName && (
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100 flex items-center gap-1">
                    <FileCheckIcon className="w-3 h-3" /> 已载入
                  </span>
                )}
              </div>

              {/* Upload Drop Zone */}
              <label 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
                className={`group relative flex flex-col items-center justify-center w-full min-h-[130px] border-2 border-dashed rounded-2xl transition-all cursor-pointer shadow-sm text-center px-4 py-3 ${
                  isDragging 
                    ? 'border-teal-500 bg-teal-50/60 scale-[1.01]' 
                    : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/30'
                }`}
              >
                <div className="flex flex-col items-center justify-center">
                  <div className={`mb-2 transition-colors transform group-hover:scale-110 duration-200 ${isDragging ? 'text-teal-600 scale-110' : 'text-slate-400 group-hover:text-teal-500'}`}>
                    <UploadIcon className="w-7 h-7" />
                  </div>
                  <p className="text-[12px] font-bold text-slate-700 group-hover:text-teal-700 leading-tight">
                    {state.originalFileName ? state.originalFileName : "点击选择或直接拖拽文件到此处"}
                  </p>
                  <p className="text-[10px] text-teal-600 font-semibold mt-1.5 flex items-center gap-1">
                    <ExcelIcon className="w-3.5 h-3.5 text-emerald-600" />
                    支持 Excel (.xlsx/.xls) • Word • Markdown • PDF
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1">
                    超大表格智能按行切分与断点自动保护
                  </p>
                </div>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  className="hidden" 
                  accept={allowAnyExtension ? "*" : STANDARD_ACCEPT}
                  onChange={handleFileUpload} 
                />
              </label>

              {/* Format Filter Hint & Toggle */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span className="flex items-center gap-1">
                  <InfoIcon className="w-3 h-3 text-slate-400" />
                  已预设全格式筛选
                </span>
                <label className="flex items-center gap-1 cursor-pointer text-slate-600 hover:text-teal-700 select-none">
                  <input 
                    type="checkbox" 
                    checked={allowAnyExtension} 
                    onChange={(e) => setAllowAnyExtension(e.target.checked)}
                    className="w-3 h-3 rounded border-slate-300 text-teal-600 focus:ring-0 cursor-pointer"
                  />
                  <span>对话框显示全部格式 (*.*)</span>
                </label>
              </div>

              {/* Checkpoint Notice Banner */}
              {checkpointNotice && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200/90 text-xs animate-in fade-in duration-200 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>检测到 Excel 历史翻译缓存</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckpointNotice(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    工作表【{checkpointNotice.sheetName}】已保存 <strong>{checkpointNotice.rowsCount}</strong> 行译文。
                  </p>
                  <button
                    type="button"
                    onClick={handleRestoreCheckpoint}
                    className="w-full py-1.5 px-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>一键恢复并从第 {checkpointNotice.lastRow + 1} 行续传</span>
                  </button>
                </div>
              )}

              {/* PDF Checkpoint Notice Banner */}
              {pdfCheckpointNotice && (
                <div className="mt-3 p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-300 text-xs animate-in fade-in duration-200 space-y-2 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5 text-amber-950 font-bold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>检测到 PDF 历史记忆断点</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfCheckpointNotice(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    文件《{pdfCheckpointNotice.fileName}》已完整保全前 <strong>{pdfCheckpointNotice.lastPage}</strong> 页译文（共 {pdfCheckpointNotice.totalPages} 页）。
                  </p>
                  <button
                    type="button"
                    onClick={handleRestorePdfCheckpoint}
                    className="w-full py-1.5 px-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>一键恢复译文并从第 {pdfCheckpointNotice.lastPage + 1} 页续传</span>
                  </button>
                </div>
              )}

              {/* Document Metadata Badge */}
              {state.sourceFiles.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[11px] font-medium">识别类型：</span>
                    <span className="font-extrabold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                      {state.fileType === 'excel' && <><ExcelIcon className="w-3 h-3 text-emerald-600" /> Excel 表格</>}
                      {state.fileType === 'word' && <><WordIcon className="w-3 h-3 text-blue-600" /> Word 文档</>}
                      {state.fileType === 'markdown' && <><MarkdownIcon className="w-3 h-3 text-indigo-600" /> Markdown / 文本</>}
                      {state.fileType === 'pdf' && '📑 PDF 官方公文'}
                      {state.fileType === 'image' && '🖼️ 图像公文'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[11px] font-medium">数据规模：</span>
                    <span className="font-extrabold text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded-md font-mono">
                      {state.fileType === 'excel' ? `共 ${state.totalPages} 行数据` : `共 ${state.totalPages} 页/段`}
                    </span>
                  </div>

                  {state.fileType === 'excel' && activeSheet && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">已译进度：</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {activeSheetTranslatedRows.length} / {activeSheet.totalRows} 行 ({Math.round(((activeSheetTranslatedRows.length) / activeSheet.totalRows) * 100)}%)
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">文件原名：</span>
                    <span className="font-semibold text-slate-700 truncate max-w-[150px]" title={state.originalFileName || ''}>
                      {state.originalFileName}
                    </span>
                  </div>
                </div>
              )}

              {/* Language Pair Configuration Card */}
              <div className="mt-3 p-3.5 bg-gradient-to-br from-slate-50 to-teal-50/40 rounded-xl border border-slate-200/90 space-y-2.5 text-xs animate-in fade-in duration-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
                    <GlobeIcon className="w-3.5 h-3.5 text-teal-600" />
                    <span>多语种自适应设定</span>
                  </div>
                  <span className="text-[9px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded">通用自适应</span>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-200/60">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">源语言 (原稿语种):</label>
                    <select
                      value={sourceLang}
                      onChange={(e) => handleSourceLangChange(e.target.value)}
                      aria-label="设定源语言"
                      className="w-full bg-white text-xs font-semibold text-slate-700 py-1.5 px-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer shadow-xs"
                    >
                      {SUPPORTED_SOURCE_LANGUAGES.map(sl => (
                        <option key={sl.code} value={sl.name}>{sl.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">目标语言 (翻译输出):</label>
                    <select
                      value={targetLang}
                      onChange={(e) => handleTargetLangChange(e.target.value)}
                      aria-label="设定目标语言"
                      className="w-full bg-white text-xs font-semibold text-slate-700 py-1.5 px-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer shadow-xs"
                    >
                      {SUPPORTED_TARGET_LANGUAGES.map(tl => (
                        <option key={tl.code} value={tl.name}>{tl.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* AI Engine Model Selection Card */}
              <div className="mt-3 p-3 bg-gradient-to-br from-indigo-50/70 to-slate-50 rounded-xl border border-indigo-200/70 space-y-2 text-xs animate-in fade-in duration-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>AI 翻译底座模型</span>
                  </div>
                  <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">多模型分流</span>
                </div>

                <div>
                  <select
                    value={selectedEngineModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    aria-label="选择AI模型"
                    className="w-full bg-white text-xs font-semibold text-slate-700 py-1.5 px-2 rounded-lg border border-indigo-200 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs"
                  >
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (独立配额·推荐首选·实测通畅)</option>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (官方独立备选通道·实测通畅)</option>
                    <option value="gemini-flash-latest">Gemini Flash Latest (标准通用自动更新)</option>
                    <option value="gemini-3.8-flash">Gemini 3.8 Flash (高精解析通道)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                    💡 默认首选 <strong>Gemini 3.1 Flash Lite</strong>，触发频控 429/503 时系统将自动无感轮换通道。
                  </p>
                </div>

                {/* Real-Time API Statistics & Multi-Model Rotation */}
                <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-indigo-100 text-[10.5px]">
                  <div className="bg-white p-1.5 rounded-lg border border-indigo-100/80">
                    <div className="text-[9.5px] text-slate-400">今日 API 累计调用</div>
                    <div className="font-bold text-indigo-700 font-mono">
                      {quotaTracker.getTotalRequestsToday()} 次
                    </div>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-indigo-100/80">
                    <div className="text-[9.5px] text-slate-400">实时调用频次</div>
                    <div className="font-bold text-teal-700 font-mono">
                      {quotaTracker.getCurrentRpm()} RPM <span className="text-[9px] text-slate-400 font-normal">(&lt;15安全限)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-indigo-900/80 pt-0.5">
                  <span className="text-slate-500">通道状态：</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    健康活跃 · 自动自愈轮换
                  </span>
                </div>
              </div>

              {/* Pre-Flight Assessment & Free Quota Protection Card */}
              {state.fileType === 'excel' && activeSheet && (
                <div className="mt-3 p-3 bg-gradient-to-br from-emerald-50 to-teal-50/70 rounded-xl border border-emerald-200/90 text-xs space-y-2 animate-in fade-in duration-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-950 font-extrabold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>前置测算与配额保护分析</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-mono">
                      1 批 = 1 次 API
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-emerald-200/60">
                    <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-100">
                      <div className="text-[10px] text-slate-400">所需批次 / API 调用</div>
                      <div className="font-black text-emerald-800 font-mono text-xs">
                        {Math.ceil(activeSheet.totalRows / excelRowBatchSize)} 批 (仅 {Math.ceil(activeSheet.totalRows / excelRowBatchSize)} 次)
                      </div>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-100">
                      <div className="text-[10px] text-slate-400">预计定速总耗时</div>
                      <div className="font-black text-teal-800 font-mono text-xs">
                        ~{Math.max(1, Math.round((Math.ceil(activeSheet.totalRows / excelRowBatchSize) * 5.4) / 60 * 10) / 10)} 分钟
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-[10.5px] text-emerald-900/90 leading-tight">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">自适应降级模型：</span>
                      <span className="font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                        {activeSheet.totalRows > 150 ? 'Gemini 3.1 Flash Lite (极速高配额)' : 'Gemini 3.8 Flash (高精)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">免费日配额占用：</span>
                      <span className="font-bold font-mono text-slate-700">
                        {((Math.ceil(activeSheet.totalRows / excelRowBatchSize) / 1500) * 100).toFixed(1)}% / 1500次
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">巡航节拍控制：</span>
                      <span className="font-bold text-teal-700 font-mono">
                        5.2 秒/批 (约 11.5 RPM &lt; 15 安全限)
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-700/80 leading-normal border-t border-emerald-200/50 pt-1">
                    💡 <strong>计费真相</strong>：单批次无论包含多少行只计 <strong>1 次 API 请求</strong>。系统采用 5.2 秒定速巡航，远离 15 RPM 峰值，零撞墙打满全表。
                  </p>
                </div>
              )}
            </section>

            {/* Translation Mode & Settings */}
            {state.sourceFiles.length > 0 && (
              <section className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">分批控制机制</h3>
                  <span className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Token 防溢出保护
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTranslationMode(TranslationMode.ALL)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      translationMode === TranslationMode.ALL
                        ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <LayersIcon className="w-3.5 h-3.5" />
                    <span>连续批量流水线</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTranslationMode(TranslationMode.RANGE)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      translationMode === TranslationMode.RANGE
                        ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <FilterIcon className="w-3.5 h-3.5" />
                    <span>指定区间翻译</span>
                  </button>
                </div>

                {/* Adaptive Batch Size Selector for Excel */}
                {state.fileType === 'excel' ? (
                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-900 font-bold">每批翻译行数：</span>
                      <select
                        value={excelRowBatchSize}
                        onChange={(e) => setExcelRowBatchSize(Number(e.target.value))}
                        aria-label="选择每批翻译行数"
                        className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value={10}>10 行 / 批（超稳·高密度复杂表格）</option>
                        <option value={15}>15 行 / 批（安全平稳型，防任何漏行）</option>
                        <option value={20}>20 行 / 批（✨ 推荐甜点位·零截断兼顾高速度）</option>
                        <option value={25}>25 行 / 批（标准轻量清单）</option>
                        <option value={35}>35 行 / 批（极速大批次）</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-emerald-700 leading-tight">
                      内置<strong>【自动查漏补缺机制】</strong>：每批完成后自动核对，如检测到截断即刻微型定向补齐，确保 100% 译文覆盖。
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-bold">{ui.batchSizeLabel}：</span>
                      <select
                        value={batchSize}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                        aria-label="选择每批处理页数"
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value={1}>1 页 / 批（最高精细度）</option>
                        <option value={2}>2 页 / 批（推荐，防截断）</option>
                        <option value={3}>3 页 / 批（适合纯文字章）</option>
                        <option value={4}>4 页 / 批（高速）</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      按批次切片消除长文档截断，图表与单线图拓扑完整展开。
                    </p>
                  </div>
                )}

                {/* Range Controls */}
                {translationMode === TranslationMode.RANGE && (
                  <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60 space-y-2 text-xs">
                    <div className="font-bold text-teal-900 text-[11px] flex items-center justify-between">
                      <span>{state.fileType === 'excel' ? '数据行区间选择' : ui.pageRangeTitle}</span>
                      <span className="text-teal-600 font-mono">1 ~ {state.totalPages}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center bg-white border border-teal-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 mr-1.5">从</span>
                        <input
                          type="number"
                          min={1}
                          max={state.totalPages}
                          value={rangeStart}
                          onChange={(e) => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
                          aria-label="起始区间"
                          className="w-full text-center font-bold text-slate-800 outline-none"
                        />
                        <span className="text-[10px] text-slate-400">{state.fileType === 'excel' ? '行' : '页'}</span>
                      </div>
                      <span className="text-teal-400 font-bold">~</span>
                      <div className="flex-1 flex items-center bg-white border border-teal-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 mr-1.5">至</span>
                        <input
                          type="number"
                          min={1}
                          max={state.totalPages}
                          value={rangeEnd}
                          onChange={(e) => setRangeEnd(Math.min(state.totalPages, parseInt(e.target.value) || 1))}
                          aria-label="截止区间"
                          className="w-full text-center font-bold text-slate-800 outline-none"
                        />
                        <span className="text-[10px] text-slate-400">{state.fileType === 'excel' ? '行' : '页'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 pt-2 border-t border-teal-100">
                      <label className="flex items-center justify-between text-slate-700 text-[11px] font-bold cursor-pointer">
                        <span className="flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-teal-600" />
                          <span>图表参数复核 (图纸/曲线识图)</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={auditDiagramParams}
                          onChange={(e) => setAuditDiagramParams(e.target.checked)}
                          className="rounded border-teal-400 text-teal-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                        />
                      </label>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        开启后，模型将不仅输出翻译文本，还会额外提取图中识别到的参数标注列表（参数名、数值、单位）并在侧边栏展示。
                      </p>
                    </div>

                    {/* LaTeX Formula Consistency Inspector Shortcut */}
                    <div className="flex flex-col gap-1 pt-2 border-t border-teal-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsLatexInspectorOpen(prev => !prev);
                          if (!isLatexInspectorOpen) setIsAuditSidebarOpen(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
                          isLatexInspectorOpen
                            ? 'bg-slate-900 text-teal-300 border-slate-800'
                            : 'bg-white hover:bg-teal-50/70 border-teal-200 text-teal-900'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Sigma className="w-3.5 h-3.5 text-teal-600" />
                          <span>LaTeX 公式一致性检测面板</span>
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          latexReport.mismatchCount + latexReport.errorCount > 0
                            ? 'bg-rose-100 text-rose-700 font-bold'
                            : 'bg-teal-100 text-teal-800'
                        }`}>
                          {latexReport.totalCount} 式
                          {latexReport.mismatchCount + latexReport.errorCount > 0 && ` (${latexReport.mismatchCount + latexReport.errorCount}待纠偏)`}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-[11px]">
                      <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={appendMode}
                          onChange={(e) => setAppendMode(e.target.checked)}
                          className="rounded border-teal-400 text-teal-600 focus:ring-0 cursor-pointer"
                        />
                        <span>追加到现有译文后面</span>
                      </label>
                    </div>

                    {/* Quick Preset Buttons for Lao PDF documents */}
                    {state.fileType === 'pdf' && (
                      <div className="pt-2 border-t border-teal-100">
                        <span className="text-[10px] text-teal-800 font-bold block mb-1.5">快捷章节选择：</span>
                        <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1 text-[10px]">
                          {PRESET_RANGES.map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setRangeStart(preset.start);
                                setRangeEnd(Math.min(preset.end, state.totalPages));
                              }}
                              className="text-left px-2 py-1 rounded bg-white hover:bg-teal-100/70 border border-teal-100 text-slate-700 truncate transition-colors cursor-pointer"
                              title={preset.label}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                  {!state.isProcessing ? (
                    <button
                      type="button"
                      onClick={translationMode === TranslationMode.ALL ? handleStartAll : handleStartRange}
                      className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-95 text-xs"
                    >
                      <PlayIcon className="w-4 h-4 fill-white" />
                      <span>
                        {translationMode === TranslationMode.ALL 
                          ? (activeSheetTranslatedRows.length > 0 && activeSheetTranslatedRows.length < state.totalPages 
                              ? `从第 ${activeSheetTranslatedRows.length + 1} 行继续全量翻译` 
                              : "启动全量翻译") 
                          : "执行指定区间翻译"}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopTranslation}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <StopIcon className="w-4 h-4 fill-white" />
                      <span>{ui.stop}</span>
                    </button>
                  )}

                  {/* Resume button if stopped midway */}
                  {!state.isProcessing && activeSheetTranslatedRows.length > 0 && activeSheetTranslatedRows.length < state.totalPages && (
                    <button
                      type="button"
                      onClick={handleResumeCurrentBatch}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <PlayIcon className="w-3.5 h-3.5 fill-white" />
                      <span>从第 {activeSheetTranslatedRows.length + 1} {state.fileType === 'excel' ? '行' : '页'}继续翻译</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={state.isProcessing}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                  >
                    <ResetIcon className="w-3.5 h-3.5" />
                    <span>{ui.reset}</span>
                  </button>
                </div>
              </section>
            )}

            {/* Export Section */}
            {(state.translatedMarkdown || activeSheetTranslatedRows.length > 0) && (
              <section className="space-y-2 pt-3 border-t border-slate-100">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">导出译文成品</h3>

                {/* 1. Excel Export Button: Enabled ONLY for original Excel inputs */}
                {state.fileType === 'excel' ? (
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    disabled={isExportingExcel || state.isProcessing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs disabled:opacity-50"
                  >
                    {isExportingExcel ? (
                      <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ExcelIcon className="w-3.5 h-3.5" />
                    )}
                    <span>{ui.downloadExcel} ({activeSheetTranslatedRows.length} 行)</span>
                  </button>
                ) : (
                  <div className="relative group">
                    <button
                      type="button"
                      disabled
                      className="w-full bg-slate-100 text-slate-400 border border-slate-200 font-bold py-2 px-3 rounded-xl flex items-center justify-between text-xs cursor-not-allowed opacity-75"
                    >
                      <span className="flex items-center gap-1.5">
                        <ExcelIcon className="w-3.5 h-3.5" />
                        <span>导出 Excel 表格 (.xlsx)</span>
                      </span>
                      <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-normal">
                        仅限 Excel 原件
                      </span>
                    </button>
                    <div className="hidden group-hover:block absolute bottom-full left-0 right-0 mb-1 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-lg z-20 leading-tight">
                      按规格要求：导出 Excel 格式仅限于原始文档为 Excel 表格，其他格式请使用下方 Word 或 Markdown 导出。
                    </div>
                  </div>
                )}

                {/* 2. Word Export Button: Universally available */}
                <button
                  type="button"
                  onClick={handleDownloadWord}
                  disabled={isExportingWord}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs disabled:opacity-50"
                >
                  {isExportingWord ? (
                    <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <WordIcon className="w-3.5 h-3.5" />
                  )}
                  <span>{ui.downloadWord}</span>
                </button>

                {/* 3. Markdown Export Button: Universally available */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  <span>{ui.downloadMd}</span>
                </button>
              </section>
            )}
          </div>
        </aside>

        {/* Right Main Content Panel */}
        <section className="flex-1 flex flex-col overflow-hidden bg-slate-100">
          {/* Progress / Status Bar */}
          {(state.isProcessing || state.statusMessage || state.error) && (
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3 flex-1 mr-4">
                {state.isProcessing && <SpinnerIcon className="w-4 h-4 text-teal-600 animate-spin" />}
                {state.error && <ErrorIcon className="w-4 h-4 text-rose-500" />}
                {!state.isProcessing && !state.error && state.progressPercent === 100 && (
                  <CheckIcon className="w-4 h-4 text-teal-600" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-xs font-bold truncate ${state.error ? 'text-rose-600' : 'text-slate-700'}`}>
                      {state.error || state.statusMessage}
                    </p>
                    {state.error && !state.isProcessing && (
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <button
                          type="button"
                          onClick={handleResumeCurrentBatch}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <PlayIcon className="w-3 h-3 fill-white" />
                          <span>
                            {state.fileType === 'excel'
                              ? `从断点第 ${activeSheetTranslatedRows.length + 1} 行继续`
                              : `立即重试当前批次`}
                          </span>
                        </button>

                        {(state.error.includes("quota") || state.error.includes("429") || state.error.includes("exceeded")) && (
                          <button
                            type="button"
                            onClick={() => {
                              handleModelChange('gemini-3.1-flash-lite');
                              if (state.fileType === 'pdf') {
                                setBatchSize(1);
                              }
                              setState(prev => ({ ...prev, error: null, statusMessage: "已切换为 Gemini 3.1 Flash Lite 并自动调为 1 页/批，正在恢复翻译..." }));
                              setTimeout(() => {
                                handleResumeCurrentBatch();
                              }, 200);
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="自动切换为拥有独立高配额的 Flash-Lite 引擎并调为 1页/批，避开频控与配额限额"
                          >
                            <Sparkles className="w-3 h-3 text-amber-200" />
                            <span>一键切为 Flash-Lite (独立配额) 继续</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {state.isProcessing && (
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div 
                        className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${state.progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {state.isProcessing && (
                <span className="text-xs font-extrabold text-teal-700 font-mono">
                  {state.progressPercent}%
                </span>
              )}
            </div>
          )}

          {/* Translation Preview Viewer */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto h-full flex flex-col">
              {state.fileType === 'excel' && excelSheetsRef.current.length > 0 ? (
                <div className="h-full flex flex-col">
                  {/* View mode toggle: Grid vs Markdown */}
                  <div className="flex items-center justify-between pb-3">
                    <div className="flex items-center bg-slate-200/80 p-1 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setExcelViewTab('grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          excelViewTab === 'grid'
                            ? 'bg-white text-emerald-800 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>表格结构网格 (高性能)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcelViewTab('markdown')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          excelViewTab === 'markdown'
                            ? 'bg-white text-teal-800 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <WordIcon className="w-3.5 h-3.5 text-teal-600" />
                        <span>Markdown 排版视图</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                      ⚡ 虚拟分页引擎 • 内存常驻防溢出保护
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {excelViewTab === 'grid' ? (
                      <ExcelGridViewer
                        sheetInfo={activeSheet}
                        allSheets={excelSheetsRef.current}
                        currentSheetIndex={currentSheetIndex}
                        onSelectSheet={setCurrentSheetIndex}
                        translatedRows={activeSheetTranslatedRows}
                        currentBatchStart={state.currentBatchStart}
                        currentBatchEnd={state.currentBatchEnd}
                        isProcessing={state.isProcessing}
                      />
                    ) : (
                      <div className="bg-slate-200/60 rounded-2xl p-4 sm:p-6 md:p-8 h-full overflow-y-auto flex justify-center">
                        <div className="w-full max-w-[210mm] bg-white rounded-sm shadow-md border border-slate-200/80">
                          <MarkdownViewer markdown={state.translatedMarkdown} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : state.translatedMarkdown ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Top Bar for Markdown Preview & Audit Sidebar Toggle */}
                  <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">译文高保真排版预览</span>
                      {auditDiagramParams && (
                        <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] px-2 py-0.5 rounded font-medium">
                          图表参数复核已开启
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* LaTeX Consistency Inspector Toggle Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLatexInspectorOpen(prev => !prev);
                          if (!isLatexInspectorOpen) setIsAuditSidebarOpen(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isLatexInspectorOpen
                            ? 'bg-slate-900 text-teal-300 shadow-xs ring-1 ring-slate-800'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs'
                        }`}
                        title="打开 LaTeX 公式结构一致性检测与纠偏面板"
                      >
                        <Sigma className="w-3.5 h-3.5 text-teal-500" />
                        <span>LaTeX 公式一致性检测</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          latexReport.mismatchCount + latexReport.errorCount > 0
                            ? 'bg-rose-500 text-white font-bold'
                            : 'bg-teal-600 text-white'
                        }`}>
                          {latexReport.totalCount} 式
                          {latexReport.mismatchCount + latexReport.errorCount > 0 && ` (${latexReport.mismatchCount + latexReport.errorCount}待纠偏)`}
                        </span>
                      </button>

                      {/* Diagram Audit Sidebar Toggle Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsAuditSidebarOpen(prev => !prev);
                          if (!isAuditSidebarOpen) setIsLatexInspectorOpen(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isAuditSidebarOpen
                            ? 'bg-slate-900 text-teal-300 shadow-xs ring-1 ring-slate-800'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs'
                        }`}
                        title="打开工程图表参数复核侧边栏"
                      >
                        <Sliders className="w-3.5 h-3.5 text-teal-500" />
                        <span>图表参数复核</span>
                        <span className="bg-teal-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                          {parseDiagramAuditParameters(state.translatedMarkdown).length} 项
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-200/60">
                    {/* Main Markdown Content */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex justify-center">
                      <div className="w-full max-w-[210mm] bg-white rounded-sm shadow-md border border-slate-200/80">
                        <MarkdownViewer markdown={state.translatedMarkdown} />
                      </div>
                    </div>

                    {/* Diagram Audit Sidebar Panel */}
                    <DiagramAuditSidebar
                      markdown={state.translatedMarkdown}
                      isEnabled={auditDiagramParams}
                      onToggleEnabled={setAuditDiagramParams}
                      isOpen={isAuditSidebarOpen}
                      onClose={() => setIsAuditSidebarOpen(false)}
                      fileName={state.originalFileName}
                    />

                    {/* LaTeX Formula Consistency Inspector Panel */}
                    <LatexConsistencyPanel
                      markdown={state.translatedMarkdown}
                      sourceText={sourceDocText}
                      isOpen={isLatexInspectorOpen}
                      onClose={() => setIsLatexInspectorOpen(false)}
                      onUpdateMarkdown={(newMd) => {
                        setState(prev => ({
                          ...prev,
                          translatedMarkdown: newMd
                        }));
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                  <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <ExcelIcon className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-700 mb-1">
                    工程技术类国家与行业标准规范专业翻译与排版复现工作台
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    在左侧上传 Excel 表格 (.xlsx/.xls/.csv)、Word 文档 (.docx)、Markdown 或 PDF 扫描件。系统将自动进行格式识别与防溢出分批，译文将在本窗口实时呈现。
                  </p>
                </div>
              )}

              {/* Execution Logger Component */}
              <ExecutionLogger
                logs={executionLogs}
                onClearLogs={clearExecutionLogs}
                isOpen={isLogDrawerOpen}
                onToggleOpen={() => setIsLogDrawerOpen(!isLogDrawerOpen)}
                isTranslating={state.isProcessing}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
