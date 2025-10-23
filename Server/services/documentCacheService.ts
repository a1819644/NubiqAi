// Server/services/documentCacheService.ts

interface DocumentData {
  summary: string;
  chunks: string[];
  fullText: string;
  fileName: string;
  createdAt: Date;
}

const documentCache = new Map<string, DocumentData>();

// Simple unique ID generator
const generateDocumentId = () => `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const storeDocument = (data: { fileName: string, fullText: string }): { docId: string, summary: string } => {
  const docId = generateDocumentId();
  
  // Simple chunking logic (e.g., by paragraph)
  const chunks = data.fullText.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 0);

  // For now, we'll use a placeholder summary. We'll integrate AI summarization next.
  const summary = `Document "${data.fileName}" has been processed and is ready for questions. It contains ${chunks.length} paragraphs.`;

  const documentData: DocumentData = {
    fileName: data.fileName,
    fullText: data.fullText,
    summary,
    chunks,
    createdAt: new Date(),
  };

  documentCache.set(docId, documentData);
  console.log(`📄 Stored document in cache. ID: ${docId}, Chunks: ${chunks.length}`);
  
  return { docId, summary };
};

export const getDocument = (docId: string): DocumentData | undefined => {
  return documentCache.get(docId);
};

export const searchChunks = (docId: string, query: string): { summary: string, relevantChunks: string[] } | null => {
  const document = getDocument(docId);
  if (!document) {
    return null;
  }

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2); // Ignore short words
  if (queryWords.length === 0) {
    // If no meaningful query words, just return the summary
    return { summary: document.summary, relevantChunks: [] };
  }

  const scoredChunks = document.chunks.map((chunk, index) => {
    let score = 0;
    const chunkLower = chunk.toLowerCase();
    for (const word of queryWords) {
      if (chunkLower.includes(word)) {
        score++;
      }
    }
    return { chunk, score, index };
  });

  const relevant = scoredChunks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Get top 3 most relevant chunks

  const chunkMap = new Map<number, string>();
  for (const item of relevant) {
    // Add the relevant chunk
    chunkMap.set(item.index, item.chunk);
    // Add the chunk before for context, if it exists and isn't already included
    if (item.index > 0 && !chunkMap.has(item.index - 1)) {
      chunkMap.set(item.index - 1, document.chunks[item.index - 1]);
    }
    // Add the chunk after for context, if it exists and isn't already included
    if (item.index < document.chunks.length - 1 && !chunkMap.has(item.index + 1)) {
      chunkMap.set(item.index + 1, document.chunks[item.index + 1]);
    }
  }

  const sortedChunks = Array.from(chunkMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(entry => `...[Chunk ${entry[0] + 1}]...\n${entry[1]}`);

  return {
    summary: document.summary,
    relevantChunks: sortedChunks,
  };
};

// Clean up old documents periodically to manage memory
setInterval(() => {
  const now = new Date();
  for (const [docId, data] of documentCache.entries()) {
    // Evict documents older than 1 hour
    if (now.getTime() - data.createdAt.getTime() > 3600 * 1000) {
      documentCache.delete(docId);
      console.log(`🧹 Evicted old document from cache: ${docId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour
