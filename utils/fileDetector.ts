import * as XLSX from 'xlsx';
import { SupportedFileType } from '../types';

/**
 * Robust document type detector using file extension, MIME type,
 * and binary magic bytes inspection.
 */
export function detectDocumentType(file: File, buffer?: ArrayBuffer): SupportedFileType {
  const fileName = (file.name || '').trim().toLowerCase();
  const mime = (file.type || '').trim().toLowerCase();

  // 1. Primary extension matching
  if (
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.xlsm') ||
    fileName.endsWith('.xlsb') ||
    fileName.endsWith('.xltx') ||
    fileName.endsWith('.xltm')
  ) {
    return 'excel';
  }

  if (
    fileName.endsWith('.docx') ||
    fileName.endsWith('.doc') ||
    fileName.endsWith('.dotx')
  ) {
    return 'word';
  }

  if (
    fileName.endsWith('.md') ||
    fileName.endsWith('.markdown') ||
    fileName.endsWith('.txt')
  ) {
    return 'markdown';
  }

  if (fileName.endsWith('.pdf')) {
    return 'pdf';
  }

  if (
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.webp') ||
    fileName.endsWith('.bmp') ||
    fileName.endsWith('.gif') ||
    fileName.endsWith('.tif') ||
    fileName.endsWith('.tiff')
  ) {
    return 'image';
  }

  // 2. MIME type inspection
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    mime === 'application/csv'
  ) {
    return 'excel';
  }

  if (mime.includes('wordprocessing') || mime.includes('msword')) {
    return 'word';
  }

  if (mime === 'application/pdf') {
    return 'pdf';
  }

  if (mime.startsWith('image/')) {
    return 'image';
  }

  if (mime === 'text/markdown' || mime === 'text/plain') {
    return 'markdown';
  }

  // 3. Binary Magic Bytes Sniffing (if buffer is available)
  if (buffer && buffer.byteLength >= 4) {
    const bytes = new Uint8Array(buffer.slice(0, 16));

    // PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'pdf';
    }

    // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image';
    }

    // JPEG magic bytes: 0xFF, 0xD8, 0xFF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image';
    }

    // GIF magic bytes: GIF8
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image';
    }

    // BMP magic bytes: BM (0x42, 0x4D)
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return 'image';
    }

    // ZIP format (PK\x03\x04): Used by .xlsx, .docx
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      // Test if SheetJS can parse worksheets
      try {
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
          return 'excel';
        }
      } catch {
        // Not a valid workbook, might be docx
        return 'word';
      }
    }

    // OLE2 Compound File (0xD0, 0xCF, 0x11, 0xE0): Used by legacy .xls and .doc
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
      try {
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
          return 'excel';
        }
      } catch {
        return 'word';
      }
    }
  }

  // 4. Default safe fallback:
  // If the user uploaded something unknown, DO NOT silently label as image!
  // Check if it can be parsed as text
  return 'markdown';
}
