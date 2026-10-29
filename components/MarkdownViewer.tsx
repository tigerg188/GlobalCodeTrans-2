import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import katex from 'katex';
import { normalizeMarkdown } from '../utils/markdownSanitizer';
import { ResponseSpectrumChart, WindPressureChart, SpecSheetLayoutViewer, EngineeringDiagramViewer } from './EngineeringCharts';
import { 
  OfficialDocMarginViewer, 
  OfficialHeaderGridViewer, 
  OfficialSignatureSealViewer,
  OfficialFlowchartViewer,
  OfficialDimensionViewer
} from './OfficialDocLayoutComponents';
import { UniversalSvgViewer } from './UniversalSvgViewer';

interface MarkdownViewerProps {
  content?: string;
  markdown?: string;
}

const LAO_EMBLEM_LOCAL_SRC = "/lao_emblem.png";
const LAO_EMBLEM_FALLBACK_SRC = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Emblem_of_Laos_%281991-2025%29.svg/960px-Emblem_of_Laos_%281991-2025%29.svg.png";

/**
 * GlobalCodeTrans MarkdownViewer
 * 
 * High-Precision Features:
 * 1. KaTeX Auto-Detection: Automatically detects $$ and $ symbols and activates KaTeX.
 * 2. Cambria Math Font Priority: Prioritizes 'Cambria Math' for all engineering formulas.
 * 3. 1:1 Official Layout: Fixed 14pt upright headings, 12pt centered upright motto, 1.15 line height.
 * 4. Vector Engineering Diagrams: Response spectrum curves, wind pressure profiles, and spec sheet rulers.
 */
const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, markdown }) => {
  const rawContent = content ?? markdown ?? "";

  // 1. KaTeX Mathematical Formulas Auto-Detection Logic ($$ and $ symbols)
  const containsMath = React.useMemo(() => {
    if (!rawContent) return false;
    return (
      rawContent.includes('$$') || 
      /(?:^|[^\\])\$[^\$\n]+?\$/.test(rawContent) ||
      rawContent.includes('\\[') ||
      rawContent.includes('\\(')
    );
  }, [rawContent]);

  // 2. Preprocess & normalize markdown structure
  const textContent = React.useMemo(() => {
    return normalizeMarkdown(rawContent);
  }, [rawContent]);

  // 3. Dynamic plugins allocation: activates remark-math and rehype-katex when math is detected
  const remarkPlugins = React.useMemo(() => {
    if (containsMath) {
      return [remarkGfm, [remarkMath, { singleDollarTextMath: true }]] as any[];
    }
    return [remarkGfm] as any[];
  }, [containsMath]);

  const rehypePlugins = React.useMemo(() => {
    const plugins: any[] = [rehypeRaw];
    if (containsMath) {
      plugins.push([rehypeKatex, { 
        throwOnError: false, 
        errorColor: '#dc2626',
        strict: false,
        trust: true 
      }]);
    }
    return plugins;
  }, [containsMath]);

  if (!textContent.trim()) {
    return (
      <div className="text-center text-slate-400 py-12 text-xs font-sans">
        暂无可显示的 Markdown 文本
      </div>
    );
  }

  return (
    <div 
      className="markdown-content text-slate-800 leading-[1.15] font-serif w-full max-w-[210mm] mx-auto bg-white px-8 sm:px-12 md:px-16 lg:px-20 py-8 [&_*]:!not-italic"
      style={{
        fontFamily: "'Times New Roman', 'Phetsarath OT', 'Phetsarath', 'SimSun', 'Songti SC', 'STSong', serif",
        fontSize: "12pt",
        lineHeight: "1.15",
      }}
    >
      {/* Scoped CSS ensuring Cambria Math font takes highest priority in KaTeX mathematical formulas */}
      <style>{`
        @font-face {
          font-family: 'Cambria Math';
          src: local('Cambria Math'), local('Cambria-Math');
        }
        .markdown-content .katex {
          font-family: 'Cambria Math', 'KaTeX_Math', 'KaTeX_Main', 'Times New Roman', serif !important;
          font-size: 1.05em;
          text-rendering: optimizeLegibility;
        }
        .markdown-content .katex * {
          font-family: 'Cambria Math', 'KaTeX_Math', 'KaTeX_Main', serif !important;
        }
        .markdown-content .katex .mathnormal,
        .markdown-content .katex .mathit {
          font-family: 'Cambria Math', 'KaTeX_Math', serif !important;
          font-style: italic !important;
        }
        .markdown-content .katex .mord,
        .markdown-content .katex .mathrm,
        .markdown-content .katex .mbin,
        .markdown-content .katex .mrel,
        .markdown-content .katex .minner,
        .markdown-content .katex .mopen,
        .markdown-content .katex .mclose {
          font-family: 'Cambria Math', 'KaTeX_Math', 'KaTeX_Main', serif !important;
        }
        .markdown-content .katex-display {
          font-family: 'Cambria Math', 'KaTeX_Math', 'KaTeX_Main', 'Times New Roman', serif !important;
          margin: 1.15em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.35rem 0.5rem;
          border-radius: 0.375rem;
          background-color: rgba(248, 250, 252, 0.65);
        }
      `}</style>

      {/* KaTeX Automatic Detection Status Indicator Banner */}
      {containsMath && (
        <div className="flex items-center justify-between pb-2.5 mb-4 border-b border-teal-200/60 bg-teal-50/50 px-3 py-1.5 rounded-lg text-[11px] text-teal-800 font-sans select-none">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span>检测到工程数学公式 • KaTeX 高精度排版已自动激活</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-teal-900/80 font-mono bg-white/80 px-2 py-0.5 rounded border border-teal-200/70 shadow-2xs">
            <span>数学字体:</span>
            <span className="font-bold text-teal-700">Cambria Math (优先)</span>
          </div>
        </div>
      )}

      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          // 徽标图片渲染（使用 span.block 避免在 <p> 内产生非法的 <div> 嵌套）
          img: ({ src, alt }) => {
            const isEmblem = (alt && alt.includes('国徽')) || (src && src.includes('Emblem_of_Laos'));
            return (
              <span className="block text-center my-3">
                <img
                  src={isEmblem ? LAO_EMBLEM_LOCAL_SRC : src}
                  alt={alt || "老挝人民民主共和国国徽"}
                  onError={(e) => {
                    e.currentTarget.src = LAO_EMBLEM_FALLBACK_SRC;
                  }}
                  className="inline-block w-20 h-auto object-contain mx-auto drop-shadow-sm select-none"
                />
              </span>
            );
          },

          // 文本标题固定14pt (H1: 国名/顶部机构名)
          h1: ({ children }) => (
            <h1 
              className="font-bold text-slate-900 mt-4 mb-2 text-center tracking-normal font-sans not-italic"
              style={{
                fontFamily: "'Times New Roman', 'Phetsarath OT', 'Phetsarath', 'SimHei', 'Heiti SC', 'Microsoft YaHei', sans-serif",
                fontSize: "14pt",
                lineHeight: "1.15",
                fontStyle: "normal",
              }}
            >
              {children}
            </h1>
          ),

          // 文本标题固定14pt (H2: 文件类型，如法令/决定/命令)
          h2: ({ children }) => (
            <h2 
              className="font-bold text-slate-900 mt-3 mb-2 text-center tracking-normal font-sans not-italic"
              style={{
                fontFamily: "'Times New Roman', 'Phetsarath OT', 'Phetsarath', 'SimHei', 'Heiti SC', 'Microsoft YaHei', sans-serif",
                fontSize: "14pt",
                lineHeight: "1.15",
                fontStyle: "normal",
              }}
            >
              {children}
            </h2>
          ),

          // H3: 判断是否为国家格言（格言全部为12pt居中加粗单行间距）；若为文件主题/章节则固定14pt
          h3: ({ children }) => {
            const titleText = React.Children.toArray(children).join('');
            const isMotto = 
              titleText.includes('和平') && 
              (titleText.includes('独立') || titleText.includes('民主') || titleText.includes('统一') || titleText.includes('繁荣'));

            if (isMotto) {
              return (
                <h3 
                  className="text-center font-bold text-slate-900 my-1 font-serif not-italic"
                  style={{
                    fontFamily: "'Times New Roman', 'Phetsarath OT', 'Phetsarath', 'SimSun', 'Songti SC', 'STSong', serif",
                    fontSize: "12pt",
                    lineHeight: "1.15",
                    fontStyle: "normal",
                  }}
                >
                  {children}
                </h3>
              );
            }

            return (
              <h3 
                className="font-bold text-slate-800 mt-3 mb-2 text-center font-sans not-italic"
                style={{
                  fontFamily: "'Times New Roman', 'Phetsarath OT', 'Phetsarath', 'SimHei', 'Heiti SC', 'Microsoft YaHei', sans-serif",
                  fontSize: "14pt",
                  lineHeight: "1.15",
                  fontStyle: "normal",
                }}
              >
                {children}
              </h3>
            );
          },

          // 文本标题固定14pt (H4: 第X条 条款标题)
          h4: ({ children }) => (
            <h4 
              className="font-bold text-slate-900 mt-3.5 mb-1.5 text-left font-sans not-italic"
              style={{
                fontFamily: "'Times New Roman', 'Phetsarath OT', 'Phetsarath', 'SimHei', 'Heiti SC', 'Microsoft YaHei', sans-serif",
                fontSize: "14pt",
                lineHeight: "1.15",
                fontStyle: "normal",
              }}
            >
              {children}
            </h4>
          ),

          p: ({ children }) => {
            const paraText = React.Children.toArray(children).join('');

            // 1. 自动连接填充高清老挝国徽（返回 <p> 保持合法段落结构，避免 <div> 嵌套在 <p> 内）
            if (
              paraText.startsWith('[徽标') || 
              paraText.startsWith('[Emblem') || 
              paraText.startsWith('[Logo') || 
              paraText.includes('老挝国徽')
            ) {
              return (
                <p className="text-center my-3 select-none">
                  <img 
                    src={LAO_EMBLEM_LOCAL_SRC}
                    alt="老挝人民民主共和国国徽"
                    onError={(e) => {
                      e.currentTarget.src = LAO_EMBLEM_FALLBACK_SRC;
                    }}
                    className="inline-block w-20 h-auto object-contain mx-auto"
                  />
                </p>
              );
            }

            // 2. 国家格言检测：全部为12pt，居中，行距1.15，加粗，正体排版
            const isMotto = 
              paraText.includes('和平') && 
              (paraText.includes('独立') || paraText.includes('民主') || paraText.includes('统一') || paraText.includes('繁荣'));

            if (isMotto) {
              return (
                <p 
                  className="text-center font-bold text-slate-900 my-1 not-italic font-serif"
                  style={{
                    fontFamily: "'Times New Roman', 'Phetsarath OT', 'Phetsarath', 'SimSun', 'Songti SC', 'STSong', serif",
                    fontSize: "12pt",
                    lineHeight: "1.15",
                    fontStyle: "normal",
                  }}
                >
                  {children}
                </p>
              );
            }

            // 3. 文本流程图/字符线框图 (ASCII / Box Drawing Characters) 高保真等宽渲染
            const isAsciiDiagram = /[┌┬┐├┼┤└┴┘│─━┃┏┓┗┛▼▲]/.test(paraText);
            if (isAsciiDiagram) {
              return (
                <div className="my-4 p-4 bg-slate-50 border border-slate-300 rounded-lg overflow-x-auto shadow-2xs font-mono text-xs leading-relaxed text-slate-800 whitespace-pre">
                  {children}
                </div>
              );
            }

            // 4. 签发地点与日期靠右对齐
            const isRightAlign = 
              paraText.includes('地点与日期') || 
              paraText.includes('签发地点') || 
              (paraText.startsWith('**地点') && paraText.includes('**'));

            return (
              <p 
                className={`my-1.5 text-slate-800 text-justify ${isRightAlign ? 'text-right' : ''} not-italic`}
                style={{ 
                  textIndent: 0, 
                  marginBlock: '4px',
                  fontSize: "12pt",
                  lineHeight: "1.15",
                  fontStyle: "normal",
                  fontFamily: "'Times New Roman', 'Phetsarath OT', 'Phetsarath', 'SimSun', 'Songti SC', 'STSong', serif",
                }}
              >
                {children}
              </p>
            );
          },

          // 列表项与款项 (正文12pt，行距1.15)
          ul: ({ children }) => (
            <ul className="my-2 ml-6 list-disc space-y-1 text-slate-800 not-italic" style={{ fontSize: "12pt", lineHeight: "1.15" }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-6 list-decimal space-y-1 text-slate-800 not-italic" style={{ fontSize: "12pt", lineHeight: "1.15" }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-[1.15] pl-1 not-italic" style={{ fontSize: "12pt", lineHeight: "1.15", fontStyle: "normal" }}>
              {children}
            </li>
          ),

          // 引用块（签署栏等），正体不倾斜，行距1.15
          blockquote: ({ children }) => {
            return (
              <blockquote 
                className="my-3 pl-4 text-right border-r-2 border-slate-300 pr-4 py-1 text-slate-900 font-sans not-italic"
                style={{ fontSize: "12pt", lineHeight: "1.15", fontStyle: "normal" }}
              >
                {children}
              </blockquote>
            );
          },

          // 严格禁止任何斜体 (em / i 强制正体)
          em: ({ children }) => (
            <span className="not-italic font-normal" style={{ fontStyle: "normal" }}>
              {children}
            </span>
          ),

          // 表格支持（全框线标准：外边框 + 内部单元格全线覆盖）
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-sm border border-slate-400 shadow-2xs font-sans text-xs">
              <table className="min-w-full border-collapse border border-slate-400">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100/80 text-slate-900 font-bold border-b-2 border-slate-400">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50/70 border-b border-slate-300">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-center font-bold text-slate-900 border border-slate-300 bg-slate-50/50">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-slate-800 border border-slate-300 align-top leading-relaxed">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-slate-900 not-italic" style={{ fontStyle: "normal" }}>
              {children}
            </strong>
          ),
          b: ({ children }) => (
            <strong className="font-bold text-slate-900 not-italic" style={{ fontStyle: "normal" }}>
              {children}
            </strong>
          ),
          u: ({ children }) => (
            <u className="underline decoration-slate-800 decoration-1 underline-offset-2 font-medium">
              {children}
            </u>
          ),
          ins: ({ children }) => (
            <u className="underline decoration-slate-800 decoration-1 underline-offset-2 font-medium">
              {children}
            </u>
          ),
          // Code block and Engineering diagrams
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\S+)/.exec(className || '');
            const lang = match ? match[1].toLowerCase() : '';
            const codeString = String(children).replace(/\n$/, '');

            // Direct KaTeX rendering for math/latex/equation code blocks
            const isMathBlock = lang === 'math' || lang === 'latex' || lang === 'katex' || lang === 'formula' || lang === 'equation' ||
              (!lang && (codeString.includes('\\frac') || codeString.includes('\\sqrt') || (codeString.includes('=') && (codeString.includes('^') || codeString.includes('_')))));

            if (!inline && isMathBlock) {
              try {
                const rendered = katex.renderToString(codeString, {
                  displayMode: true,
                  throwOnError: false,
                  errorColor: '#dc2626',
                });
                return (
                  <div 
                    className="katex-display my-3.5 py-1.5 overflow-x-auto text-center bg-slate-50/70 rounded border border-slate-200/50 shadow-2xs"
                    dangerouslySetInnerHTML={{ __html: rendered }}
                  />
                );
              } catch {
                return <pre className="text-rose-500 font-mono text-xs p-2">{codeString}</pre>;
              }
            }

            const isSvg = lang === 'svg' || (codeString.includes('<svg') && codeString.includes('</svg>')) || codeString.trim().startsWith('<?xml');
            const isFlowchart = lang.includes('flowchart') || lang.includes('process') || lang.includes('workflow') || (codeString.includes('steps:') && (codeString.includes('->') || codeString.includes('→') || codeString.includes('- ')));
            const isDimension = lang.includes('dimension') || (codeString.includes('纸张标准规格') || (codeString.includes('装订') && codeString.includes('mm') && !codeString.includes('margins:')));
            const isAuditParams = lang.includes('audit') || lang.includes('params');
            const isDocMargin = lang.includes('margin') || (lang.includes('layout') && (codeString.includes('marginLeft') || codeString.includes('margins:') || codeString.includes('装订') || codeString.includes('binding')));
            const isHeaderGrid = lang.includes('header') || lang.includes('letterhead') || (lang.includes('layout') && (codeString.includes('countryName') || codeString.includes('ministry') || codeString.includes('motto')));
            const isSignatureSeal = lang.includes('seal') || lang.includes('signature') || codeString.includes('sealDiameter') || codeString.includes('signatory') || codeString.includes('骑年盖月');
            const isSpectrum = lang.includes('spectrum') || lang.includes('response') || codeString.includes('SDS');
            const isWind = lang.includes('wind') || lang.includes('pressure') || (codeString.includes('qz') && codeString.includes('Cp'));
            const isLayout = lang.includes('layout') || lang.includes('spec-sheet') || lang.includes('blueprint');
            const isDiagram = lang.includes('diagram') || lang.includes('chart') || lang.includes('figure') || lang.includes('drawing') || lang.includes('detail') || lang.includes('section') || codeString.includes('caption:');

            if (!inline && isSvg) {
              return <UniversalSvgViewer content={codeString} />;
            }
            if (!inline && isFlowchart) {
              return <OfficialFlowchartViewer content={codeString} />;
            }
            if (!inline && isDimension) {
              return <OfficialDimensionViewer content={codeString} />;
            }

            if (!inline && isAuditParams) {
              try {
                const parsed = JSON.parse(codeString);
                if (Array.isArray(parsed)) {
                  return (
                    <div className="my-6 bg-slate-900 text-slate-100 rounded-xl p-4 shadow-md font-sans border border-slate-800">
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
                          <span>📊 识图与工程图表参数复核清单</span>
                        </div>
                        <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded font-mono">
                          {parsed.length} 项标注
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {parsed.map((item: any, idx: number) => (
                          <div key={idx} className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 flex flex-col justify-between">
                            <div className="text-[11px] font-semibold text-slate-300 truncate">{item.name || item.param}</div>
                            <div className="text-sm font-extrabold text-teal-400 font-mono my-1">
                              {item.value} <span className="text-xs text-slate-400 font-normal">{item.unit !== '-' ? item.unit : ''}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center justify-between">
                              <span className="truncate">{item.location}</span>
                              <span className="text-teal-400 font-medium">{item.status || '已复核'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch {
                // fallback to code block
              }
            }

            if (!inline && isDocMargin) {
              return <OfficialDocMarginViewer content={codeString} />;
            }
            if (!inline && isHeaderGrid) {
              return <OfficialHeaderGridViewer content={codeString} />;
            }
            if (!inline && isSignatureSeal) {
              return <OfficialSignatureSealViewer content={codeString} />;
            }
            if (!inline && isSpectrum) {
              return <ResponseSpectrumChart content={codeString} />;
            }
            if (!inline && isWind) {
              return <WindPressureChart content={codeString} />;
            }
            if (!inline && isLayout) {
              return <SpecSheetLayoutViewer content={codeString} />;
            }
            if (!inline && isDiagram) {
              return <EngineeringDiagramViewer content={codeString} />;
            }

            if (!inline) {
              return (
                <div className="relative my-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 font-mono text-xs">
                  {lang && (
                    <div className="px-3 py-1 bg-slate-800 text-[10px] text-teal-400 font-bold uppercase tracking-wider border-b border-slate-700 flex justify-between items-center">
                      <span>{lang}</span>
                    </div>
                  )}
                  <pre className="p-3 overflow-x-auto leading-relaxed">
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }

            // Inline math fallback if wrapped in backticks or inline equation
            if (inline && (codeString.startsWith('$') && codeString.endsWith('$') && codeString.length > 2)) {
              try {
                const rendered = katex.renderToString(codeString.slice(1, -1), {
                  displayMode: false,
                  throwOnError: false,
                });
                return <span className="katex-inline" dangerouslySetInnerHTML={{ __html: rendered }} />;
              } catch {}
            }

            return (
              <code className="bg-slate-100 text-teal-800 px-1 py-0.5 rounded font-mono text-[11px] border border-slate-200" {...props}>
                {children}
              </code>
            );
          },
          hr: () => (
            <div className="relative my-8 text-center select-none print:break-before-page">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-200 rounded-full shadow-2xs">
                  文档分页 / 分段标记
                </span>
              </div>
            </div>
          ),
        }}
      >
        {textContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
