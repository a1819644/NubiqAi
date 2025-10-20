// documentExtractionService.ts
// Lightweight local extractors to complement AI-based extraction

export async function extractTextFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; method: string }> {
  try {
    switch (mimeType) {
      case 'text/plain': {
        const text = buffer.toString('utf8');
        return { text, method: 'plain-text' };
      }
      case 'application/pdf': {
        try {
          const pdfParse = (await import('pdf-parse')).default as any;
          const result = await pdfParse(buffer);
          const text: string = (result?.text || '').trim();
          if (text) {
            return { text, method: 'pdf-parse' };
          }
        } catch (err) {
          console.warn('pdf-parse failed:', err);
        }
        break;
      }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        try {
          const mammoth = await import('mammoth');
          const out = await (mammoth as any).extractRawText({ buffer });
          const text: string = (out?.value || '').trim();
          if (text) {
            return { text, method: 'mammoth' };
          }
        } catch (err) {
          console.warn('mammoth (docx) failed:', err);
        }
        break;
      }
      default: {
        // For unknown types, try UTF-8 decode as a last resort
        try {
          const text = buffer.toString('utf8');
          if (text && /[\x20-\x7E\n\r\t]/.test(text)) {
            return { text, method: 'utf8-guess' };
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Local extraction failed:', err);
  }
  return { text: '', method: 'none' };
}
