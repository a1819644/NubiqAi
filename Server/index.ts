// server.ts (TypeScript)
require('dotenv').config();
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import type { Part } from '@google/genai';

const app = express();
const port = Number(process.env.PORT ?? 8000);

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// init Gemini client safely
let ai: GoogleGenAI | undefined;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('GoogleGenAI client initialized.');
  } else {
    console.warn('GEMINI_API_KEY missing from .env; Gemini client not initialized.');
  }
} catch (err) {
  console.error('Failed to initialize GoogleGenAI client:', err);
}

// Home / health
app.get('/api', (req, res) => res.json({ ok: true }));

/**
 * POST /api/ask-ai
 * body: { prompt: string, type?: 'text' | 'image', model?: string }
 */
app.post('/api/ask-ai', async (req, res) => {
  if (!ai) return res.status(500).json({ error: 'Gemini client not initialized' });

  try {
    const { prompt, type = 'text', model } = req.body;
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt (string) is required' });

    const textModel = model ?? 'gemini-2.5-flash';
    const imageModel = model ?? 'gemini-2.5-flash-image-preview';

    if (type === 'image') {
      const response = await ai.models.generateContent({
        model: imageModel,
        contents: [prompt],
      });

      const parts: Part[] = response?.candidates?.[0]?.content?.parts ?? [];
      let imageBase64: string | null = null;
      let imageUri: string | null = null;
      let altText: string | null = null;

      for (const part of parts) {
        if ((part as any).inlineData?.data) imageBase64 = (part as any).inlineData.data;
        if ((part as any).fileData?.fileUri) imageUri = (part as any).fileData.fileUri;
        if ((part as any).text) altText = (part as any).text ?? altText;
      }

      return res.json({ success: true, imageBase64, imageUri, altText, raw: response });
    }

    // TEXT
    const response = await ai.models.generateContent({ model: textModel, contents: [prompt] });
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => p.text ?? '').join('');

    return res.json({ success: true, text, raw: response });

  } catch (err: any) {
    console.error('ask-ai error:', err);
    return res.status(500).json({ success: false, error: err?.message ?? String(err) });
  }
});

/**
 * POST /api/process-document
 * body: { fileBase64?: string, filePath?: string, mimeType?: string, prompt?: string }
 */
app.post('/api/process-document', async (req, res) => {
  if (!ai) return res.status(500).json({ error: 'Gemini process-document client not initialized' });

  try {
    const { fileBase64, filePath, mimeType: clientMime, prompt } = req.body;

    let base64Data = '';
    let mimeType = clientMime || 'application/pdf';

    if (fileBase64 && typeof fileBase64 === 'string') {
      base64Data = fileBase64;
    } else if (filePath && typeof filePath === 'string') {
      const fs = await import('fs');
      const buffer = fs.readFileSync(filePath);
      base64Data = buffer.toString('base64');
      if (!clientMime) {
        if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (filePath.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (filePath.endsWith('.txt')) mimeType = 'text/plain';
      }
    } else {
      return res.status(400).json({ error: 'fileBase64 or filePath is required' });
    }

    // Check file size (base64 encoded size estimation)
    const estimatedSizeMB = (base64Data.length * 0.75) / (1024 * 1024); // Convert from base64 to actual size
    console.log(`Processing document: ~${estimatedSizeMB.toFixed(1)}MB`);
    
    if (estimatedSizeMB > 20) {
      console.warn(`Large file detected: ${estimatedSizeMB.toFixed(1)}MB - processing may be slow`);
    }

    // Use Gemini for document processing
    const defaultPrompt = 'Extract all text content from this document. Provide a clean, well-formatted extraction of the text.';
    const userPrompt = prompt && typeof prompt === 'string' && prompt.trim() 
      ? prompt.trim() 
      : defaultPrompt;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { text: userPrompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
    });

    const extractedText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return res.json({ success: true, extractedText, raw: response });

  } catch (err: any) {
    console.error('process-document error:', err);

    // Provide more specific error messages for common large file issues
    let errorMessage = err?.message ?? String(err);
    if (errorMessage.includes('payload') || errorMessage.includes('too large')) {
      errorMessage = 'File too large. Please try a smaller file (under 20MB).';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('deadline')) {
      errorMessage = 'Processing timeout. Large files may take too long to process.';
    } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      errorMessage = 'API quota exceeded. Please try again later or use a smaller file.';
    }

    return res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * POST /api/edit-image
 * body: { imageBase64: string, editPrompt: string, model?: string }
 */
app.post('/api/edit-image', async (req, res) => {
  if (!ai) return res.status(500).json({ error: 'Gemini client not initialized' });

  try {
    const { imageBase64, editPrompt, model } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 (string) is required' });
    }
    if (!editPrompt || typeof editPrompt !== 'string') {
      return res.status(400).json({ error: 'editPrompt (string) is required' });
    }

    const imageModel = model ?? 'gemini-2.5-flash-image-preview';

    // Create a prompt that combines the edit instruction with the image
    const combinedPrompt = `Edit this image based on the following instruction: ${editPrompt}. Generate a new version of the image with the requested modifications.`;

    const response = await ai.models.generateContent({
      model: imageModel,
      contents: [
        {
          parts: [
            { text: combinedPrompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
    });

    const parts: Part[] = response?.candidates?.[0]?.content?.parts ?? [];
    let newImageBase64: string | null = null;
    let imageUri: string | null = null;
    let altText: string | null = null;

    for (const part of parts) {
      if ((part as any).inlineData?.data) newImageBase64 = (part as any).inlineData.data;
      if ((part as any).fileData?.fileUri) imageUri = (part as any).fileData.fileUri;
      if ((part as any).text) altText = (part as any).text ?? altText;
    }

    return res.json({ success: true, imageBase64: newImageBase64, imageUri, altText, raw: response });

  } catch (err: any) {
    console.error('edit-image error:', err);
    return res.status(500).json({ success: false, error: err?.message ?? String(err) });
  }
});

/**
 * POST /api/edit-image-with-mask
 * body: { imageBase64: string, maskBase64: string, editPrompt: string, model?: string }
 */
app.post('/api/edit-image-with-mask', async (req, res) => {
  if (!ai) return res.status(500).json({ error: 'Gemini client not initialized' });

  try {
    const { imageBase64, maskBase64, editPrompt, model } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 (string) is required' });
    }
    if (!maskBase64 || typeof maskBase64 !== 'string') {
      return res.status(400).json({ error: 'maskBase64 (string) is required' });
    }
    if (!editPrompt || typeof editPrompt !== 'string') {
      return res.status(400).json({ error: 'editPrompt (string) is required' });
    }

    const imageModel = model ?? 'gemini-2.5-flash-image';

    // Create a detailed prompt that explains the mask-based editing
    const combinedPrompt = `You are editing an image with marked areas. The first image is the original, and the second image shows the marked areas (colored markings) that need to be edited.

Instructions:
- Focus your edits ONLY on the marked/colored areas in the mask image
- Leave unmarked areas unchanged
- Apply this edit to the marked areas: ${editPrompt}
- Generate a new version of the original image with only the marked areas modified

Original image and marking mask are provided below.`;

    const response = await ai.models.generateContent({
      model: imageModel,
      contents: [
        {
          parts: [
            { text: combinedPrompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType: 'image/png',
              },
            },
            {
              inlineData: {
                data: maskBase64,
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
    });

    const parts: Part[] = response?.candidates?.[0]?.content?.parts ?? [];
    let newImageBase64: string | null = null;
    let imageUri: string | null = null;
    let altText: string | null = null;

    for (const part of parts) {
      if ((part as any).inlineData?.data) newImageBase64 = (part as any).inlineData.data;
      if ((part as any).fileData?.fileUri) imageUri = (part as any).fileData.fileUri;
      if ((part as any).text) altText = (part as any).text ?? altText;
    }

    return res.json({ success: true, imageBase64: newImageBase64, imageUri, altText, raw: response });

  } catch (err: any) {
    console.error('edit-image-with-mask error:', err);
    return res.status(500).json({ success: false, error: err?.message ?? String(err) });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});