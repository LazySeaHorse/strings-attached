/**
 * Shared file-reading utilities used by Header, TabBar, EmptyState, ClassicView.
 */

import { loadPdfDocument } from '../pdfUtils';
import type { DocumentData } from '../stores/types';

/** Read a File as a base64 data URL string. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Load a file (PDF, markdown, or text) and return a DocumentData object
 * ready to pass to `addDocument()`.
 *
 * Throws on unsupported file types or load failures.
 */
export async function buildDocumentFromFile(file: File): Promise<DocumentData> {
  if (file.type === 'application/pdf') {
    const dataUrl = await readFileAsDataUrl(file);
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await loadPdfDocument(arrayBuffer);
    return {
      id: crypto.randomUUID(),
      type: 'pdf',
      content: '',
      title: file.name.replace(/\.pdf$/i, ''),
      pdfDataUrl: dataUrl,
      pdfNumPages: pdfDoc.numPages,
    };
  }

  if (
    file.type === 'text/plain' ||
    file.type === 'text/markdown' ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.txt')
  ) {
    const text = await file.text();
    return {
      id: crypto.randomUUID(),
      type: 'markdown',
      content: text.trim(),
      title: file.name.replace(/\.(md|txt)$/i, ''),
    };
  }

  throw new Error('Unsupported file type. Try PDF, .md, or .txt.');
}