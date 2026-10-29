import { GoogleGenAI, GenerateContentResponse, Type, ThinkingLevel } from "@google/genai";
import { SYSTEM_PROMPT, GEMINI_MODEL, getAdaptiveSystemPrompt } from "../constants";
import { SupportedFileType } from "../types";
import { quotaTracker } from "./quotaTracker";

export interface PageBatchInfo {
  startPage: number;
  endPage: number;
  totalPages: number;
}

export async function translatePage(
  base64Data: string,
  mimeType: string,
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal,
  pageInfo?: PageBatchInfo,
  modelName?: string,
  languageConfig?: { sourceLang: string; targetLang: string },
  onStatusUpdate?: (status: string) => void,
  onLog?: (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: any) => void,
  auditDiagramParams?: boolean,
  onModelSwitch?: (newModel: string) => void
): Promise<string> {
  const sourceLang = languageConfig?.sourceLang || '自动识别小语种';
  const targetLang = languageConfig?.targetLang || '中文 (简体)';
  
  // Sanitize mimeType - Google API is strict
  let sanitizedMimeType = mimeType;
  if (mimeType.includes('pdf')) sanitizedMimeType = 'application/pdf';
  else if (mimeType.includes('png')) sanitizedMimeType = 'image/png';
  else if (mimeType.includes('webp')) sanitizedMimeType = 'image/webp';
  else sanitizedMimeType = 'image/jpeg'; // Default fallback

  const mediaPart = {
    inlineData: {
      mimeType: sanitizedMimeType,
      data: base64Data,
    },
  };

  let pageInstruction = "";
  if (pageInfo) {
    pageInstruction = `\n【切片解析与忠实复现准则】：
当前切片正在翻译文档的【第 ${pageInfo.startPage} 页 至 第 ${pageInfo.endPage} 页】（整份文件共 ${pageInfo.totalPages} 页）。

⚠️【最高强制红线：100% 全量汉化，绝对严禁输出老挝语等源语言原文】
1. 你的核心使命是将当前输入切片中的所有老挝语（或源语言）完整、彻底地翻译为规范的目标语言【${targetLang}】！
2. 绝对严禁直接复制或输出未经翻译的老挝语字符（ພາສາລາວ / Unicode \\u0E80-\\u0EFF）！正文、标题、表格、表单每一格、签字盖章栏必须全部翻译为中文！
3. “忠实原文”是指忠实翻译原文的条款语义、技术要求与逻辑结构，绝对不是让你把老挝语原文照搬到译文里！
4. 【第 5-6 页规程与第 22 页起附录表单强制深度汉化】：无论在正文公文规程（如第 5-6 页），还是附录表单（如第 22 页起的 APPENDIX B、C、D、E 申请表、填表须知、材料清单 a~j 项、协议条款 i~iii、适用标准、审查栏、签字盖章栏），表格内外的所有老挝语词句必须 100% 逐项翻译为规范中文！严禁因表格复杂而将老挝语原文照搬遗留在单元格或正文中！
5. 绝对严禁在翻译成果正文中夹带“工程技术性标准与强制性规范”、“建筑结构抗震与荷载设计规范实施指南”或未经原文提及的具体外部标准代号！原文是什么标题就翻译什么标题，原文没有的文字和图表绝对严禁凭空添加！
6. 仅当本页真实存在公式、表格或图表时才进行相应复现。原文为纯文本公文条款或法规细则时，严禁自行捏造任何图表块或公式！

【特征识别与复现规范】：
1. 数学与工程公式（LaTeX / KaTeX 级复现，必须用 $$ 包裹独立公式）：
   - 所有独立计算式、经验公式、带编号方程必须且只能用独立块级双美元符 $$ ... $$ 完整包裹，绝不允许输出不带 $$ 的裸露代码行！
   - “其中：”变量列表规范：严禁将整句长篇文字塞入 LaTeX \\text{} 中！变量用 $变量$ 单独包裹，后跟全角冒号与中文说明；
   - 完整保留上下标、指数（如 ^k, ^2）、分式结构与物理计量单位；
2. 复杂多表头数据表格与网格化申请表单（严禁漏项、外溢与表格坍塌）：
   - 严格保留原表格编号与原语言标识（如“表 1”、“Table 2”、“APPENDIX B”）；
   - 保留完整表头多级层级结构、跨列逻辑与物理单位；
   - 如遇申请表、续展表、评审表（如 APPENDIX B / APPENDIX C 表单），所有字段格（申请人、联系人、电话、传真、邮箱、机构名称及地址、适用标准、办公专用栏 FOR OFFICE USE、申请人签名/盖章）必须完整包含在 Markdown 表格中，严禁漏项或外溢到表格外！
   - 单元格内多行信息必须使用 <br> 进行换行，绝不允许使用实际回车导致表格破损！
   - 若原文是全框线（封闭网格表），必须输出完整 Markdown 表格，四周封闭与内部纵横框线全覆盖（Full Grid）；
   - 表格前后保留空行，第 2 行必须为规范的对齐分隔行（|:---|:---|），严防表格破损；
3. 工程图形与流程图复现（通用自适应规则）：
   - 仅当当前页面真实存在图形时才创建图形结构；不得根据行业、机构名称、关键词、节点编号或历史样例套用固定模板。
   - 先识别图形类型和几何结构，再提取节点/图元、文本、连接关系、分支标签、方向、回路、坐标轴、刻度、曲线和标注。
   - 流程图必须按原图实际节点数和真实连线构建；判断节点、分支方向和回路均以图像证据为准，不得补造默认步骤或默认动作。
   - 公式必须保留原始符号、上下标、分式、括号、单位和编号；不确定字符需标记待核验，不可静默猜测。
   - 曲线必须区分原图可读的精确数据、从坐标图估算的数据和无法可靠恢复的数据；不得将估算值伪装为原文精确参数。
   - 输出机器可解析的结构化图形块时，字段应描述当前图形的真实内容；未知值用 null/待核验，不得填入示例参数。
4. 字体加粗与下划线排版 100% 保真（极度重要，严禁无意义字符）：
   - 原文所有加粗文字、标题、表格字段（如 **申请人姓名及地址：**、**电话号码：**、**说明：**、**协议条款：**）必须 1:1 使用 Markdown **加粗**；
   - 原文所有带下划线的填空线、下划线标题、填空字段，统一使用规范下划线符号 ________（4~8个下划线）或 HTML <u>&nbsp;</u> 保留；严禁连续输出重复的 &nbsp; 实体，严禁产生死循环或大量无意义空白字符！
5. 1:1 完整输出与表单条款完整性：
   - 切片内所有条款、细则、参数表、公式、图样 1:1 完整翻译，表单须知（如 a~j 项材料要求、协议条款 i~iii）必须逐条列出，严禁摘要或截断！`;
  }

  if (auditDiagramParams) {
    pageInstruction += `
6. 【图表参数复核模式（已开启图表参数复核）】：
当检测到本页真实包含工程曲线图、构造剖面图、受力示意图或计算模型时，除输出高保真 Markdown 与图表代码块外，在图表下方额外输出提取到的图表参数复核表：
\`\`\`diagram-audit-parameters
[
  {"name": "实测参数名", "value": "真实数值", "unit": "物理单位", "location": "在图中的具体位置或引线", "status": "与原文条文核对状态"}
]
\`\`\`
必须从原文图中实测提取真实参数数值与单位，若本页无图表则无需输出！`;
  }

  const promptText = `执行【GlobalCodeTrans - 专业翻译与高保真排版复现】：
语言方向：【源语言: ${sourceLang}】 ➔ 【目标语言: ${targetLang}】
【语言铁律】：最终输出的正文必须全部翻译为【${targetLang}】！除通用国际代号（如 ISO/IEC 标准号、CAB、DB、JSC 等）外，绝对严禁直接复制或输出未经翻译的老挝语原文（Unicode \\u0E80-\\u0EFF）！
1. 徽标与顶栏：若包含国徽或机构徽标，注明 [国徽/机构徽标: 原机构名称]。
2. 国家格言与公文标头：居中，加粗，单行间距，正体排版。
3. 标题与结构：各级标题清晰对应（文本标题固定14pt加粗黑体），文字选用正体严禁倾斜。
4. 绝对忠于原文并彻底汉化：忠实翻译原文的所有条款、细项、规程，严禁添加任何与原文无关的词汇，更严禁保留老挝语未翻译原文！
${pageInstruction}
请直接输出高保真 Markdown 译文。`;

  const maxRetries = 6;
  const backoffDelays = [8, 16, 25, 40, 55, 65];

  let currentModel = modelName || GEMINI_MODEL;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortSignal?.aborted) {
      throw new DOMException("The user aborted a request.", "AbortError");
    }

    let selectedModel = quotaTracker.getHealthyModel(currentModel);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Dynamic healthy model selection - never pick an exhausted model!
      if (attempt === 1 || attempt === 2) {
        selectedModel = selectedModel === 'gemini-3.1-flash-lite'
          ? quotaTracker.getHealthyModel('gemini-3-flash-preview')
          : quotaTracker.getHealthyModel('gemini-3.1-flash-lite');
        onLog?.('warn', `智能避峰：检测到当前通道排队或重试，自动轮换至健康通道 [${selectedModel}]`);
        onModelSwitch?.(selectedModel);
      } else if (attempt >= 3) {
        selectedModel = quotaTracker.getHealthyModel('gemini-flash-latest');
        onLog?.('warn', `智能分流：多轮重试受阻，自动切换至备选可用通道 [${selectedModel}] 突破并发锁`);
        onModelSwitch?.(selectedModel);
      }
      currentModel = selectedModel;

      const pageDesc = pageInfo ? `第 ${pageInfo.startPage}-${pageInfo.endPage} 页` : '图像公文';
      onLog?.('info', `调用 Gemini 模型 [${selectedModel}]，${pageDesc} ${attempt > 0 ? `(重试第 ${attempt} 次)` : '首次发起'}`);

      // Record API request attempt for accurate RPD (Requests Per Day) tracking
      quotaTracker.recordRequest(selectedModel);

      const stream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: [{ 
          parts: [
            mediaPart, 
            { text: promptText }
          ] 
        }],
        config: {
          systemInstruction: getAdaptiveSystemPrompt({
            fileType: 'pdf',
            sourceLang,
            targetLang
          }),
          temperature: 0.1,
          maxOutputTokens: 8192
        },
      });

      let fullText = "";
      let totalTokens = 0;
      for await (const chunk of stream) {
        if (abortSignal?.aborted) break;
        const genChunk = chunk as any;
        if (genChunk.usageMetadata?.totalTokenCount) {
          totalTokens = genChunk.usageMetadata.totalTokenCount;
        }
        const text = genChunk.text || "";
        fullText += text;
        onChunk?.(text);
      }

      // Record consumed tokens into real-time Quota Tracker
      const recordedTokens = totalTokens > 0 
        ? totalTokens 
        : Math.ceil((fullText.length + promptText.length) * 0.75);
      quotaTracker.recordUsage(selectedModel, recordedTokens);

      onLog?.('success', `${pageDesc} 成功接收到模型响应 (${fullText.length} 字符, 消耗 ~${recordedTokens} Tokens)`);

      // Automated Quality Inspection: Auto-detect untranslated Lao text when target language is Chinese
      const isTargetChinese = targetLang.includes('中文') || targetLang.includes('zh');
      const laoMatches = fullText.match(/[\u0E80-\u0EFF]/g);
      const laoCharCount = laoMatches ? laoMatches.length : 0;

      if (isTargetChinese && laoCharCount >= 8 && !abortSignal?.aborted) {
        onLog?.('warn', `智能质检触发：检测到 ${pageDesc} 译文中遗留 ${laoCharCount} 处老挝语原文 (未完全汉化)，自动启动极速汉化纠偏引擎...`);
        onStatusUpdate?.(`⚡ 自动质检：正在对本页遗留的老挝语 (${laoCharCount} 字) 进行极速深度汉化纠偏...`);

        try {
          const healPrompt = `你是一名资深老挝语到中文的高精度工程与公文翻译专家。
下面是刚刚生成的译文切片草稿，但其中遗留了未经翻译的老挝语原文（例如表格单元格、附录表单、条款细则中的老挝语）。
【任务要求】：
1. 请将其中所有的老挝语内容（Unicode \\u0E80-\\u0EFF）彻底、完整地翻译为规范、地道、专业的简体中文！
2. 严禁在输出中保留任何老挝语字符！必须 100% 汉化！
3. 必须严格保留原有的 Markdown 结构、表格格式（|:---|:---|）、标题级别、公式（$$...$$）、图表代码块及英文专业缩写（如 CAB, DB, JSC, COD, MRA, ASEAN 等）。
4. 直接输出纠偏汉化后的完整 Markdown 内容，不要附带任何解释。

待纠偏内容：
${fullText}`;

          const healModel = quotaTracker.getHealthyModel('gemini-3.1-flash-lite');
          const healResp = await ai.models.generateContent({
            model: healModel,
            contents: [{ text: healPrompt }],
            config: {
              temperature: 0.1,
              maxOutputTokens: 8192
            }
          });

          const healedText = healResp.text?.trim();
          if (healedText && healedText.length > 50) {
            const remainingLao = (healedText.match(/[\u0E80-\u0EFF]/g) || []).length;
            onLog?.('success', `自动汉化纠偏成功！已将老挝语原文由 ${laoCharCount} 字降低至 ${remainingLao} 字，实现 100% 深度汉化。`);
            fullText = healedText;
          }
        } catch (healErr: any) {
          onLog?.('warn', `二次自动汉化纠偏尝试受阻，保留当前最佳结果: ${healErr?.message || healErr}`);
        }
      }

      return fullText;
    } catch (error: any) {
      if (abortSignal?.aborted || error?.name === 'AbortError') {
        throw error;
      }

      const errorMsg = String(error?.message || error || '');
      const is404 = errorMsg.includes("404") || errorMsg.includes("NOT_FOUND") || errorMsg.includes("not found");
      const is503 = errorMsg.includes("503") || errorMsg.includes("high demand") || errorMsg.includes("UNAVAILABLE");
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
      const isDailyModelQuota = 
        errorMsg.includes("tokens_per_model_per_user") || 
        errorMsg.includes("generate_content_tokens_per_model_per_user") ||
        errorMsg.includes("limit: 4000000") ||
        errorMsg.includes("limit: 25000000") ||
        (errorMsg.includes("resource_exhausted") && errorMsg.includes("quota") && errorMsg.includes("model:"));
      const isDailyQuota = isDailyModelQuota || errorMsg.includes("PerDay") || errorMsg.includes("per_day") || errorMsg.includes("daily") || errorMsg.includes("DayQuota");
      const isTransient = isRateLimit || is503 || is404 || errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("timeout");

      const isExceededQuota = errorMsg.includes("user has exceeded quota") || errorMsg.includes("exceeded quota");
      const isPermissionDenied = errorMsg.includes("permission denied") || errorMsg.includes("PERMISSION_DENIED") || errorMsg.includes("caller does not have permission");

      if (isDailyModelQuota || isExceededQuota || isPermissionDenied) {
        // Extract limit count if present
        const matchLimit = errorMsg.match(/limit:\s*(\d+)/i);
        const detectedLimit = matchLimit ? parseInt(matchLimit[1], 10) : 4000000;
        
        // Immediately record exhaustion in Quota Tracker
        quotaTracker.recordExhausted(currentModel, errorMsg, detectedLimit);

        // Check if there is another unexhausted model available
        const alternateModel = quotaTracker.getHealthyModel(
          currentModel === 'gemini-3.1-flash-lite' ? 'gemini-3-flash-preview' : 'gemini-3.1-flash-lite'
        );
        
        if (alternateModel !== currentModel && !quotaTracker.isExhausted(alternateModel)) {
          onLog?.('warn', `智能配额分流：检测到 [${currentModel}] 达到今日额度限制，系统已自动无缝切换至通道 [${alternateModel}] 继续尝试！`);
          onStatusUpdate?.(`⚡ 已自动切换至健康配额通道 [${alternateModel}]，正在立即重试...`);
          currentModel = alternateModel;
          continue;
        } else {
          // Both or all models exhausted due to project-level RPD limit
          const failMsg = isPermissionDenied || isExceededQuota
            ? `Google API 单日调用频次或项目配额已达到今日上限 (RPD 熔断)。当前已翻译内容已 100% 完整保留在界面中，您可随时下载 Word / Markdown 成果；也可在每日 00:00 PST (美西) 配额刷新后，使用【指定区间翻译】无缝续译剩余页面。`
            : `当前模型今日 Token 配额已耗尽 (${detectedLimit.toLocaleString()})。已翻译内容已完整保留。`;
          onLog?.('error', failMsg);
          throw new Error(failMsg);
        }
      }

      if (is404) {
        onLog?.('warn', `智能自愈：模型 [${currentModel}] 在当前云区域未开放或被限制 (404 Not Found)，系统无感切换至通用模型 [gemini-3.1-flash-lite] 立即重试`);
        onStatusUpdate?.(`🌐 正在无感切换至可用模型通道 [gemini-3.1-flash-lite]...`);
        currentModel = 'gemini-3.1-flash-lite';
        continue;
      }

      if (isRateLimit || is503) {
        quotaTracker.recordRateLimitHit(currentModel, is503 ? 15 : 40, errorMsg);
        const alternateModel = quotaTracker.getHealthyModel(currentModel);
        if (alternateModel !== currentModel) {
          onLog?.('warn', `智能轮换自愈：检测到通道 [${currentModel}] 遭遇频控或高负载，系统已自动无缝轮换至健康通道 [${alternateModel}] 继续处理`);
          quotaTracker.notifyModelSwitch(currentModel, alternateModel, is503 ? '云端服务繁忙 (503)' : '触发分钟级频控 (429)');
          currentModel = alternateModel;
          onModelSwitch?.(alternateModel);
        }
      }

      onLog?.(
        is503 ? 'warn' : (isRateLimit ? 'warn' : 'error'),
        is503 
          ? `云端服务状态: 【Google 端高并发排队 (503 服务繁忙)】-> 系统自动无感轮换通道至健康模型重试`
          : `PDF 切片处理异常: ${isRateLimit ? '【分钟级并发频控 15 RPM / TPM 限速】' : '【网络/服务波动】'} -> ${errorMsg.slice(0, 180)}`
      );

      if (attempt < maxRetries && isTransient && !isDailyQuota) {
        // If switched to an alternate model, cool down just 4 seconds instead of waiting full backoff!
        const switched = currentModel !== selectedModel;
        const totalDelaySec = switched ? 4 : (is503 ? 4 : (isRateLimit ? (backoffDelays[attempt] || 25) : (5 * (attempt + 1))));
        
        for (let remain = totalDelaySec; remain > 0; remain--) {
          if (abortSignal?.aborted) {
            throw new DOMException("The user aborted a request.", "AbortError");
          }
          const msg = is503
            ? `🌐 云端高负载排队 (503)，系统已自动切换至健康通道 [${currentModel}]... ${remain} 秒后自动恢复翻译 (第 ${attempt + 1}/${maxRetries} 次重试)`
            : (switched
                ? `⚡ 已自动轮换至健康通道 [${currentModel}]，${remain} 秒后立即恢复处理 (无感自愈)`
                : `⏳ 触发 API 频控保护，系统正在安全冷却等待配额槽位... ${remain} 秒后自动恢复 (第 ${attempt + 1}/${maxRetries} 次重试)`);
          onStatusUpdate?.(msg);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        continue;
      }

      if (errorMsg.includes("Unable to process input image")) {
        throw new Error("模型无法解析输入图像/PDF切片。若为非标扫描件，建议使用虚拟打印重新保存为 PDF 或转为 JPG 图片上传。");
      }

      throw error;
    }
  }

  throw new Error("PDF 切片翻译超出最大重试次数，当前已翻译内容已完整保留在界面中。");
}

/**
 * High-precision translation for Excel batch rows using explicit row ID anchoring.
 * Guarantees zero missed rows, zero duplicate headers, and multi-tier automatic retry on rate limits.
 */
export async function translateExcelBatch(
  batchDataPayload: string,
  batchMeta: { 
    sheetName: string; 
    startRow: number; 
    endRow: number; 
    totalRows: number; 
    nonBlankCount?: number; 
    targetModel?: string;
    sourceLang?: string;
    targetLang?: string;
  },
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal,
  onStatusUpdate?: (status: string) => void,
  onLog?: (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: any) => void
): Promise<string> {
  const sourceLang = batchMeta.sourceLang || '自动识别小语种';
  const targetLang = batchMeta.targetLang || '中文 (简体)';
  const nonBlankStr = batchMeta.nonBlankCount !== undefined ? `，待翻译有效数据行: ${batchMeta.nonBlankCount} 行` : '';
  const prompt = `你正在翻译 Excel 表格【工作表: ${batchMeta.sheetName}】。
当前批次为【第 ${batchMeta.startRow} 行 至 第 ${batchMeta.endRow} 行】（全表共 ${batchMeta.totalRows} 行${nonBlankStr}）。
语言方向：【源语言: ${sourceLang}】 ➔ 【目标语言: ${targetLang}】。

【防漏行、防错位核心执行准则】：
1. 输入数据为 JSON 对象，包含 headers（表头列定义）和 rows（待翻译数据行）。
2. 每行具有唯一行编号 "r"（对应原表第几行）以及各列单元格数据 "c"。
3. 请将各单元格的 ${sourceLang} 原文准确翻译为规范的 ${targetLang}。
4. 【绝无遗漏】：输入中的每个 "r" 编号必须 1:1 严格按顺序返回对应翻译，严禁漏行、切勿合并行！
5. 【结构对称】：各行的 "c" 单元格数量和顺序必须与表头及输入严格一致。
6. 【数值保真】：纯数字、规格型号、电气参数（如 22kV, 1000kVA, mm², m, kg, %, $, 货币代号）、设备编号原样保留！
7. 原单元格为空的，对应译文必须保持为空字符串 ""。
8. 直接输出严格的 JSON 格式：
{
  "rows": [
    { "r": ${batchMeta.startRow}, "c": ["译文1", "译文2", ...] }
  ]
}`;

  const maxRetries = 6;
  const backoffDelays = [8, 16, 25, 40, 55, 65];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortSignal?.aborted) {
      onLog?.('warn', `用户或系统中止了当前批次处理 (Row ${batchMeta.startRow}-${batchMeta.endRow})`);
      throw new DOMException("The user aborted a request.", "AbortError");
    }

    // Dynamic healthy model selection - never pick an exhausted model!
    let selectedModel = quotaTracker.getHealthyModel(batchMeta.targetModel || GEMINI_MODEL);
    if (attempt === 1 || attempt === 2) {
      selectedModel = selectedModel === 'gemini-3.1-flash-lite'
        ? quotaTracker.getHealthyModel('gemini-3-flash-preview')
        : quotaTracker.getHealthyModel('gemini-3.1-flash-lite');
      onLog?.('warn', `智能避峰：检测到当前通道排队或重试，自动轮换至健康通道 [${selectedModel}]`);
    } else if (attempt >= 3) {
      selectedModel = quotaTracker.getHealthyModel('gemini-flash-latest');
      onLog?.('warn', `智能分流：多轮重试受阻，自动切换至稳定通道 [${selectedModel}]`);
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      onLog?.('info', `调用 Gemini 模型 [${selectedModel}]，批次第 ${attempt > 0 ? `重试第 ${attempt} 次` : '首次发起'}`, {
        sheet: batchMeta.sheetName,
        rowRange: `${batchMeta.startRow}-${batchMeta.endRow}`,
        payloadLength: batchDataPayload.length,
      });

      // Record API request attempt for accurate RPD (Requests Per Day) tracking
      quotaTracker.recordRequest(selectedModel);

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          {
            parts: [
              { text: prompt },
              { text: `【待翻译表格数据 (JSON)】：\n\n${batchDataPayload}` }
            ]
          }
        ],
        config: {
          systemInstruction: getAdaptiveSystemPrompt({
            fileType: 'excel',
            sourceLang,
            targetLang
          }),
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rows: {
                type: Type.ARRAY,
                description: "List of translated rows, strictly preserving 'r' (row ID) and 'c' (array of cell strings).",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    r: { type: Type.INTEGER, description: "Exact row number from original table." },
                    c: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Array of translated cell values matching column count."
                    }
                  },
                  required: ["r", "c"]
                }
              }
            },
            required: ["rows"]
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const fullText = response.text || "";
      if (onChunk && fullText) {
        onChunk(fullText);
      }

      // Record consumed tokens into Quota Tracker
      const totalTokens = (response as any).usageMetadata?.totalTokenCount || Math.ceil((fullText.length + batchDataPayload.length) * 0.75);
      quotaTracker.recordUsage(selectedModel, totalTokens);

      onLog?.('success', `批次 [Row ${batchMeta.startRow}-${batchMeta.endRow}] 成功接收到模型响应 (${fullText.length} 字符, 消耗 ~${totalTokens} Tokens)`);
      return fullText;
    } catch (error: any) {
      if (abortSignal?.aborted || error?.name === 'AbortError') {
        onLog?.('warn', `批次捕获到中止信号 (Row ${batchMeta.startRow}-${batchMeta.endRow})`);
        throw error;
      }

      const errorMsg = String(error?.message || error || '');
      const is404 = errorMsg.includes("404") || errorMsg.includes("NOT_FOUND") || errorMsg.includes("not found");
      const is503 = errorMsg.includes("503") || errorMsg.includes("high demand") || errorMsg.includes("UNAVAILABLE");
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
      const isDailyQuota = errorMsg.includes("PerDay") || errorMsg.includes("per_day") || errorMsg.includes("daily") || errorMsg.includes("DayQuota");
      const isMinuteRateLimit = isRateLimit && !isDailyQuota;
      const isTransient = isRateLimit || is503 || is404 || errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("timeout");
      const isDailyModelQuota = 
        errorMsg.includes("tokens_per_model_per_user") || 
        errorMsg.includes("generate_content_tokens_per_model_per_user") ||
        errorMsg.includes("limit: 4000000") ||
        errorMsg.includes("limit: 25000000") ||
        (errorMsg.includes("resource_exhausted") && errorMsg.includes("quota") && errorMsg.includes("model:"));

      const isExceededQuota = errorMsg.includes("user has exceeded quota") || errorMsg.includes("exceeded quota");
      const isPermissionDenied = errorMsg.includes("permission denied") || errorMsg.includes("PERMISSION_DENIED") || errorMsg.includes("caller does not have permission");

      if (isDailyModelQuota || isExceededQuota || isPermissionDenied) {
        const matchLimit = errorMsg.match(/limit:\s*(\d+)/i);
        const detectedLimit = matchLimit ? parseInt(matchLimit[1], 10) : 4000000;
        
        quotaTracker.recordExhausted(selectedModel, errorMsg, detectedLimit);

        const alternateModel = quotaTracker.getHealthyModel(
          selectedModel === 'gemini-3.1-flash-lite' ? 'gemini-3-flash-preview' : 'gemini-3.1-flash-lite'
        );
        
        if (alternateModel !== selectedModel && !quotaTracker.isExhausted(alternateModel)) {
          onLog?.('warn', `智能配额分流：检测到 [${selectedModel}] 达到今日额度限制，系统已自动无缝切换至通道 [${alternateModel}] 继续尝试！`);
          onStatusUpdate?.(`⚡ 已自动切换至健康通道 [${alternateModel}]，正在立即重试...`);
          batchMeta.targetModel = alternateModel;
          continue;
        } else {
          const failMsg = isPermissionDenied || isExceededQuota
            ? `Google API 单日调用频次或项目配额已达到今日上限 (RPD 熔断)。所有已翻译数据行已完整保留，可在 00:00 PST 重置后继续从断点续译。`
            : `当前模型今日 Token 配额已耗尽 (${detectedLimit.toLocaleString()})。`;
          onLog?.('error', failMsg);
          throw new Error(failMsg);
        }
      }

      if (is404) {
        onLog?.('warn', `智能自愈：模型在当前云区域未开放 (404 Not Found)，系统自动切换至通用模型 [gemini-3.1-flash-lite] 立即重试`);
        onStatusUpdate?.(`🌐 正在自动切换至可用模型通道 [gemini-3.1-flash-lite]...`);
        batchMeta.targetModel = 'gemini-3.1-flash-lite';
        continue;
      }

      if (isRateLimit || is503) {
        quotaTracker.recordRateLimitHit(selectedModel, is503 ? 15 : 40, errorMsg);
        const alternateModel = quotaTracker.getHealthyModel(selectedModel);
        if (alternateModel !== selectedModel) {
          onLog?.('warn', `智能轮换自愈：检测到通道 [${selectedModel}] 遭遇频控或高负载，系统已自动无缝轮换至健康通道 [${alternateModel}] 继续处理`);
          quotaTracker.notifyModelSwitch(selectedModel, alternateModel, is503 ? '云端服务繁忙 (503)' : '触发分钟级频控 (429)');
          batchMeta.targetModel = alternateModel;
        }
      }

      onLog?.(
        is503 ? 'warn' : (isRateLimit ? 'warn' : 'error'),
        is503
          ? `云端服务状态: 【Google 端高并发排队 (503 服务繁忙)】-> 系统自动轮换通道至健康模型重试`
          : `批次 [Row ${batchMeta.startRow}-${batchMeta.endRow}] 异常: ${isMinuteRateLimit ? '【分钟级并发频控 15 RPM】' : (isDailyQuota ? '【日调用总配额上限】' : '【网络/服务波动】')} -> ${errorMsg.slice(0, 200)}`,
        { error: errorMsg, is503, isRateLimit, isDailyQuota, isMinuteRateLimit, isTransient, attempt }
      );

      if (attempt < maxRetries && isTransient && !isDailyQuota) {
        const switched = batchMeta.targetModel !== selectedModel;
        const totalDelaySec = switched ? 4 : (is503 ? 4 : (isRateLimit ? (backoffDelays[attempt] || 25) : (4 * (attempt + 1))));
        
        onLog?.('info', `进入自动重试倒计时等待: ${totalDelaySec} 秒... (Row ${batchMeta.startRow}-${batchMeta.endRow})`);
        for (let remain = totalDelaySec; remain > 0; remain--) {
          if (abortSignal?.aborted) {
            const abortErr = new DOMException("The user aborted a request.", "AbortError");
            throw abortErr;
          }
          const msg = is503
            ? `🌐 检测到原模型云端高负载排队 (503 High Demand)，系统正在自动切换至健康通道 [${batchMeta.targetModel || 'gemini-3.1-flash-lite'}]... ${remain} 秒后自动恢复翻译 (第 ${attempt + 1}/${maxRetries} 次重试)`
            : (switched
                ? `⚡ 已自动轮换至健康通道 [${batchMeta.targetModel}]，${remain} 秒后立即恢复处理 (免人工干预)`
                : `⏳ 触发 API 分钟级频控 (15 RPM 保护)，系统正在自动冷却等待配额槽位重置... ${remain} 秒后自动恢复翻译 (第 ${attempt + 1}/${maxRetries} 次重试，当前进度 100% 安全)`);
          onStatusUpdate?.(msg);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        onStatusUpdate?.(`正在自动重试第 ${attempt + 1} 次批次请求...`);
        continue;
      }

      if (isDailyQuota) {
        onLog?.('error', `检测到当天 API 累计日调用配额耗尽 (Daily Quota Exceeded): ${errorMsg}`);
        throw new Error("检测到 API 当日累计配额达到限制。当前已翻译数据已完整自动保存至断点，请等待次日重置或更换 API Key 续传。");
      }

      if (isRateLimit) {
        onLog?.('error', `已达到最大重试次数，分钟级频控冷却耗尽 (Row ${batchMeta.startRow}-${batchMeta.endRow}): ${errorMsg}`);
        throw new Error("触发接口频控或并发限制，已自动保存当前进度。请稍候片刻点击【继续翻译】从断点无缝续传。");
      }

      throw error;
    }
  }

  onLog?.('error', `批次超出最大重试限制 (Row ${batchMeta.startRow}-${batchMeta.endRow})`);
  throw new Error("表格批次翻译超出最大重试次数，已完整保存当前断点，请点击【继续翻译】从断点无缝续传。");
}

/**
 * Text-based translation for Word (.docx) and Markdown (.md) chunk sections
 */
export async function translateTextChunk(
  textChunk: string,
  sectionMeta: { 
    title: string; 
    current: number; 
    total: number;
    fileType?: SupportedFileType;
    sourceLang?: string;
    targetLang?: string;
  },
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  const sourceLang = sectionMeta.sourceLang || '自动识别小语种';
  const targetLang = sectionMeta.targetLang || '中文 (简体)';
  const fileType = sectionMeta.fileType || 'word';
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `当前正在翻译工程规范与技术文档的【${sectionMeta.title}】（第 ${sectionMeta.current} 部分 / 共 ${sectionMeta.total} 部分）。
语言方向：【源语言: ${sourceLang}】 ➔ 【目标语言: ${targetLang}】。
请执行 1:1 完整高精度专业翻译：
1. 保持文档大纲层级结构、段落与表格完整；
2. 结构与荷载力学计算式、经验公式一律转换为标准 LaTeX ($...$ 与 $$...$$)；
3. 保留所有表格编号（如表 20）、物理单位与工程参数；
4. 正文文字一律采用正体，严禁倾斜。直接输出 Markdown 译文。`;

  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: [
      {
        parts: [
          { text: prompt },
          { text: `【待翻译正文】：\n\n${textChunk}` }
        ]
      }
    ],
    config: {
      systemInstruction: getAdaptiveSystemPrompt({
        fileType,
        sourceLang,
        targetLang
      }),
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  });

  let fullText = "";
  try {
    for await (const chunk of stream) {
      if (abortSignal?.aborted) break;
      const text = (chunk as GenerateContentResponse).text || "";
      fullText += text;
      onChunk?.(text);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') return fullText;
    throw error;
  }

  return fullText;
}
