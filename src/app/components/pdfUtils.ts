/**
 * PDF rendering using pdf.js loaded from CDN.
 * Renders pages to canvas and provides text layer positions for interactive overlay.
 */

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

let pdfjsLib: any = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(/* @vite-ignore */ PDFJS_CDN);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
  return pdfjsLib;
}

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
}

/**
 * Load a PDF document from an ArrayBuffer.
 */
export async function loadPdfDocument(data: ArrayBuffer): Promise<any> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ data }).promise;
}

/**
 * Render a single PDF page to a canvas and return text item positions.
 */
export async function renderPageToCanvas(
  pdfDoc: any,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ textItems: TextItem[]; viewport: any }> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Get text content for the interactive overlay
  const textContent = await page.getTextContent();
  const textItems: TextItem[] = [];

  for (const item of textContent.items as any[]) {
    if (!item.str || !item.str.trim()) continue;

    // PDF coordinates: origin is bottom-left, transform maps to viewport
    const tx = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const fontSize = Math.sqrt(
      item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]
    );

    textItems.push({
      str: item.str,
      x: tx[0],
      y: tx[1] - fontSize * scale,
      width: item.width * scale,
      height: fontSize * scale,
      fontName: item.fontName || '',
    });
  }

  return { textItems, viewport };
}

/**
 * Get the viewport dimensions for every page in a PDF (at scale=1).
 * Returns array of { width, height } in PDF points.
 */
export async function getPageDimensions(
  data: ArrayBuffer
): Promise<Array<{ width: number; height: number }>> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data }).promise;
  const dims: Array<{ width: number; height: number }> = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    dims.push({ width: vp.width, height: vp.height });
  }
  return dims;
}

/**
 * Decode a base64 data URL to an ArrayBuffer.
 */
export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}