# 界面冻结版修订说明与自评

日期：2026-10-29

## 本次纠正的原因

上一版确实由修订过程改变了界面：`App.tsx` 删除了原有 PDF 快捷章节按钮；`OfficialDocLayoutComponents.tsx` 整体替换了原流程图预览组件；同时上一版包还移除了部分原始资源。以上改动越过了“只修改图形识别与复现”的范围。本包已改用 2026-10-26 原始完整项目包作为底稿。

## 本包的保留策略

- 原样保留原始 `App.tsx`、页面结构、CSS、控件、导航、工作流程、原始静态资源、依赖清单和锁文件。
- 仅覆盖提示词/识别和图形输出相关文件：`constants.ts`、`services/geminiService.ts`、`utils/chartImageGenerator.ts`、`utils/markdownSanitizer.ts`，以及 `utils/docxExport.ts` 中流程图缺省图注文字。
- 在 `components/OfficialDocLayoutComponents.tsx` 中仅替换流程图检测/解析函数区间，保留原有 `OfficialFlowchartViewer` JSX、样式和布局代码。
- 增加本部署约束文件与本报告。
- 未将本轮三份验收 PDF 复制到项目包中。

## 已执行的沙箱检查

- 以原始 ZIP 解压目录为基线重建包。
- 确认 `App.tsx` 与原始包一致（应无差异）。
- 确认 `index.css`、`index.html`、原始静态资源、依赖清单和锁文件从原包保留。
- 检查原流程图预览 JSX 区域未被替换，仅解析函数区域变更。
- ZIP 完整性检查在打包后执行。

## 仍然没有声称完成的能力

- DOCX 流程图输出当前仍可能经过 PNG 位图路径，未达到节点/连线原生可编辑验收标准。
- 本轮不宣称完整生产构建通过；需要在依赖安装完整的环境运行原项目 lint/build。
- 真实 PDF 到 DOCX 的端到端视觉对照及 Word 桌面端编辑性尚需验证。

## 使用方式

将完整 ZIP 导入 AI Studio Build，并把 `AI_STUDIO_DEPLOYMENT_CONSTRAINTS.md` 全文作为同一次任务指令。不要只上传提示词或局部源码。部署后首先检查原有页面、快捷章节选择、导航、上传、翻译和导出流程是否与原版一致，再测试公式/曲线/图形识别。
