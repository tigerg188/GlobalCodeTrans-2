import mammoth from 'mammoth';

export interface DocChunk {
  index: number;
  title: string;
  content: string;
}

/**
 * Checks if the array buffer starts with Microsoft Compound Document (OLE2) magic bytes:
 * 0xD0, 0xCF, 0x11, 0xE0 (indicates legacy Word 97-2003 binary .doc format)
 */
export function isLegacyBinaryDoc(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16));
  // Standard OLE2 / Compound File Binary Format magic bytes (0xD0 0xCF 0x11 0xE0)
  if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
    return true;
  }
  // RTF format magic bytes: {\rtf
  if (bytes[0] === 0x7B && bytes[1] === 0x5C && bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66) {
    return true;
  }
  return false;
}

/**
 * Extracts plain text and paragraph structure from legacy Word 97-2003 (.doc) binary streams
 */
export function extractTextFromLegacyDoc(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const textChunks: string[] = [];
  
  // Strategy 1: Scan for valid UTF-16LE text sequences (standard in Word 97-2003 text stream)
  let currentUtf16 = '';
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    // Common readable Unicode ranges (ASCII, Latin, CJK, Lao, General Punctuation)
    if (
      (code >= 0x0020 && code <= 0x007E) || // Printable ASCII
      (code >= 0x00A0 && code <= 0x024F) || // Latin
      (code >= 0x0E80 && code <= 0x0EFF) || // Lao
      (code >= 0x2000 && code <= 0x206F) || // Punctuation
      (code >= 0x3000 && code <= 0x303F) || // CJK symbols
      (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
      code === 0x000A || code === 0x000D || code === 0x0009 // Newlines and tabs
    ) {
      currentUtf16 += String.fromCharCode(code);
    } else {
      if (currentUtf16.trim().length >= 4) {
        textChunks.push(currentUtf16.trim());
      }
      currentUtf16 = '';
    }
  }
  if (currentUtf16.trim().length >= 4) {
    textChunks.push(currentUtf16.trim());
  }

  // Filter out internal metadata chunks (WordDocument, SummaryInformation, etc.)
  const cleanParagraphs = textChunks.filter(chunk => {
    if (chunk.includes('WordDocument') || chunk.includes('CompObj') || chunk.includes('Normal.dotm') || chunk.includes('Microsoft Word')) {
      return false;
    }
    // Must contain actual readable words or letters
    return /[\w\u4E00-\u9FFF\u0E80-\u0EFF]/.test(chunk);
  });

  if (cleanParagraphs.length > 0) {
    return cleanParagraphs.join('\n\n');
  }

  // Strategy 2: Fallback ASCII stream scanner
  let currentAscii = '';
  const asciiChunks: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      currentAscii += String.fromCharCode(b);
    } else {
      if (currentAscii.trim().length >= 6) {
        asciiChunks.push(currentAscii.trim());
      }
      currentAscii = '';
    }
  }
  if (currentAscii.trim().length >= 6) {
    asciiChunks.push(currentAscii.trim());
  }

  return asciiChunks
    .filter(c => !c.startsWith('Root Entry') && !c.startsWith('Data') && !c.includes('Microsoft'))
    .join('\n\n');
}

/**
 * Converts HTML from mammoth into well-structured Markdown, preserving table delimiters,
 * bold, underline, headings, and lists.
 */
function convertHtmlToMarkdown(html: string): string {
  // 1. Process <table> elements to ensure valid GFM markdown tables with header dividers
  let md = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match, tableContent) => {
    const rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    if (rows.length === 0) return '';

    const parsedRows: string[] = [];
    let maxCols = 0;

    rows.forEach((rowHtml: string) => {
      const cells = rowHtml.match(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
      if (cells.length > maxCols) maxCols = cells.length;
      
      const cleanCells = cells.map((cell: string) => {
        let content = cell.replace(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi, '$2');
        content = content.replace(/<br\s*\/?>/gi, '<br>');
        content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1<br>');
        content = content.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
        content = content.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
        content = content.replace(/<u>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
        content = content.replace(/<ins>([\s\S]*?)<\/ins>/gi, '<u>$1</u>');
        content = content.replace(/<(?!\/?(u|br|b|strong))[^>]+>/g, '').trim();
        content = content.replace(/(?:<br\s*\/?>\s*)+$/gi, '');
        return content.replace(/\|/g, '\\|');
      });

      if (cleanCells.length > 0) {
        parsedRows.push('| ' + cleanCells.join(' | ') + ' |');
      }
    });

    if (parsedRows.length === 0) return '';

    // Insert GFM delimiter row after the first row
    const delimiterRow = '| ' + Array(Math.max(maxCols, 1)).fill(':---').join(' | ') + ' |';
    parsedRows.splice(1, 0, delimiterRow);

    return '\n\n' + parsedRows.join('\n') + '\n\n';
  });

  // 2. Standard formatting
  md = md
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<u>([\s\S]*?)<\/u>/gi, '<u>$1</u>')
    .replace(/<ins>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
    .replace(/<em>(.*?)<\/em>/gi, '$1') // Avoid italics in technical standards
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?!\/?(u|br|b|strong))[^>]+>/g, ''); // strip remaining tags except formatting

  return md.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extracts text and structured markdown from a Word (.docx or legacy .doc) file
 */
export async function parseDocxFile(buffer: ArrayBuffer): Promise<{ text: string; chunks: DocChunk[] }> {
  // Check if file is legacy binary Word 97-2003 (.doc) or RTF
  if (isLegacyBinaryDoc(buffer)) {
    const extractedText = extractTextFromLegacyDoc(buffer);
    if (!extractedText.trim()) {
      throw new Error("检测到旧版 Word 97-2003 (.doc) 二进制格式，且未能提取到有效字符。建议在 Word 或 WPS 中将该文件“另存为”现代 .docx 格式或 PDF 格式后再行上传。");
    }
    const chunks = splitTextIntoChunks(extractedText, 1800);
    return { text: extractedText, chunks };
  }

  try {
    const result = await (mammoth as any).convertToHtml(
      { arrayBuffer: buffer },
      {
        styleMap: [
          "u => u",
          "b => strong",
          "strike => del",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
        ]
      }
    );
    let md = convertHtmlToMarkdown(result.value || '');

    if (!md) {
      // Fallback to raw text if html was empty
      const rawRes = await mammoth.extractRawText({ arrayBuffer: buffer });
      md = rawRes.value || '';
    }

    const chunks = splitTextIntoChunks(md, 1800);
    return { text: md, chunks };
  } catch (err: any) {
    // If mammoth throws a zip error because the user renamed a .doc to .docx or uploaded legacy format
    if (err.message && (err.message.includes('central directory') || err.message.includes('zip') || isLegacyBinaryDoc(buffer))) {
      const fallbackText = extractTextFromLegacyDoc(buffer);
      if (fallbackText.trim()) {
        const chunks = splitTextIntoChunks(fallbackText, 1800);
        return { text: fallbackText, chunks };
      }
      throw new Error("Word 文档解析说明：该文件为旧版 Word 97-2003 (.doc) 二进制格式（非 modern .docx 压缩包）。请在 Word/WPS 中将文件“另存为”现代 .docx 格式或 PDF 格式后上传以完整复现全部表格与图形排版。");
    }
    throw new Error(`Word 文档解析失败: ${err.message || '未知错误'}`);
  }
}


/**
 * Parses Markdown or plain text content into structured chunks
 */
export function parseMarkdownFile(content: string): { text: string; chunks: DocChunk[] } {
  const cleanContent = content.trim();
  const chunks = splitTextIntoChunks(cleanContent, 1800);
  return { text: cleanContent, chunks };
}

/**
 * Splits long text/markdown into coherent chunks with context safety (~1500-2000 chars)
 */
export function splitTextIntoChunks(text: string, targetLength: number = 1800): DocChunk[] {
  if (text.length <= targetLength) {
    return [{ index: 1, title: '全篇正文', content: text }];
  }

  // Split by double line breaks (paragraphs) or headers
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: DocChunk[] = [];
  let currentContent = '';
  let chunkIdx = 1;

  for (const para of paragraphs) {
    if ((currentContent.length + para.length > targetLength) && currentContent.length > 0) {
      chunks.push({
        index: chunkIdx++,
        title: `第 ${chunkIdx - 1} 章节`,
        content: currentContent.trim()
      });
      currentContent = para;
    } else {
      currentContent += (currentContent ? '\n\n' : '') + para;
    }
  }

  if (currentContent.trim()) {
    chunks.push({
      index: chunkIdx,
      title: `第 ${chunkIdx} 章节`,
      content: currentContent.trim()
    });
  }

  return chunks;
}
