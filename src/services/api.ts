// API service layer for backend integration
// Ready for real API integration

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
}

class ApiService {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api';
    this.timeout = 120000; // 120 seconds (2 minutes) - for long responses like code generation
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // If sending FormData, DO NOT set Content-Type manually (browser must set boundary)
    const isFormData = typeof FormData !== 'undefined' && (options as any)?.body instanceof FormData;
    const mergedHeaders: Record<string, string> = {
      ...(options.headers as any),
    };
    if (!isFormData) {
      mergedHeaders['Content-Type'] = mergedHeaders['Content-Type'] || 'application/json';
    }

    const config: RequestInit = {
      ...options,
      headers: mergedHeaders,
    };

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    // Implement a small retry for aborts and provide clearer timeout errors
    const maxAttempts = 2;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Try to parse JSON error to get message and success flag
          let errMessage = `HTTP error! status: ${response.status}`;
          try {
            const maybeJson = await response.json();
            if (maybeJson?.error) errMessage = String(maybeJson.error);
          } catch {}
          const err: any = new Error(errMessage);
          err.status = response.status;
          throw err;
        }

        const data = await response.json();
        return data;
      } catch (err: any) {
        clearTimeout(timeoutId);

        // Normalize AbortError to a friendlier, retryable error
        if (err && (err.name === 'AbortError' || err.message?.toLowerCase?.().includes('aborted') || err.message?.toLowerCase?.().includes('timeout'))) {
          console.warn(`API request timed out (attempt ${attempt}/${maxAttempts}) for: ${endpoint}`);
          if (attempt >= maxAttempts) {
            const timeoutError = new Error('Request timed out. The server is taking too long to respond.');
            console.error(`API request failed: ${endpoint}`, timeoutError);
            throw timeoutError;
          }

          // short exponential backoff before retrying
          await new Promise((r) => setTimeout(r, 250 * attempt));
          continue; // retry
        }

        // Non-abort/non-timeout errors - rethrow with some context
        console.error(`API request failed: ${endpoint}`, err);
        throw err;
      }
    }

    // Shouldn't reach here, but keep TS happy
    throw new Error('Failed to complete request');
  }

  // Binary request helper (for file downloads)
  private async requestBlob(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Blob> {
    const url = `${this.baseURL}${endpoint}`;
    const isFormData = typeof FormData !== 'undefined' && (options as any)?.body instanceof FormData;
    const mergedHeaders: Record<string, string> = {
      ...(options.headers as any),
    };
    if (!isFormData) {
      mergedHeaders['Content-Type'] = mergedHeaders['Content-Type'] || 'application/json';
    }
    const config: RequestInit = { ...options, headers: mergedHeaders };
    const resp = await fetch(url, config);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.blob();
  }

  // Authentication endpoints
  async signInWithGoogle(idToken: string): Promise<ApiResponse<{ user: any; token: string }>> {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  async signIn(credentials: {
    email: string;
    password: string;
  }): Promise<ApiResponse<{ user: any; token: string }>> {
    return this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async signOut(): Promise<ApiResponse<null>> {
    const result = await this.request<null>('/auth/signout', {
      method: 'POST',
    });
    
    localStorage.removeItem('auth_token');
    return result;
  }

  async verifyToken(): Promise<ApiResponse<{ user: any }>> {
    return this.request('/auth/verify', {
      method: 'GET',
    });
  }

  // Chat endpoints
  // Smart two-tier loading: local first (instant), then Pinecone (background)
  async getChats(userId: string, source: 'local' | 'pinecone' | 'all' = 'local'): Promise<ApiResponse<any[]>> {
    return this.request(`/chats?userId=${encodeURIComponent(userId)}&source=${source}`);
  }

  async createChat(title: string): Promise<ApiResponse<any>> {
    return this.request('/chats', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async sendMessage(data: {
    chatId: string;
    content: string;
    attachments?: string[];
  }): Promise<ApiResponse<any>> {
    return this.request(`/chats/${data.chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content: data.content,
        attachments: data.attachments,
      }),
    });
  }

  async uploadFile(file: File): Promise<ApiResponse<{ url: string; filename: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request('/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set boundary for FormData
    });
  }

  // AI endpoints
  async askAI(data: {
    message: string;
    image?: File;
    userId?: string; // Add user ID for memory support
    userName?: string; // 🎯 NEW! User name for auto-profile creation
    chatId?: string; // 🎯 NEW! Chat ID for chat-scoped memory
    messageCount?: number; // 🎯 NEW! Message count to detect new vs continuing chat
    conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; // 🎯 Includes system messages for document context
    conversationSummary?: string; // 🎯 NEW! Summary of older messages to save tokens
    useMemory?: boolean; // Enable/disable memory
    documentId?: string; // 🎯 NEW! Document ID for RAG retrieval
  }): Promise<{ 
    success: boolean; 
    text?: string; 
    error?: string;
    imageBase64?: string | null;
    imageUri?: string | null;
    imageLocalUri?: string | null;
    isImageGeneration?: boolean;
    export?: { format: 'pdf' | 'docx' | 'csv' | 'txt' };
    metadata?: {
      tokens?: number;
      candidatesTokenCount?: number;
      promptTokenCount?: number;
      duration?: number;
    };
  }> {
    if (data.image) {
      // For images, use FormData (if backend supports it)
      const formData = new FormData();
      formData.append('prompt', data.message);
      formData.append('image', data.image);
      formData.append('type', 'image');
      if (data.userId) formData.append('userId', data.userId);
      if (data.userName) formData.append('userName', data.userName); // 🎯 NEW!
      if (data.chatId) formData.append('chatId', data.chatId); // 🎯 NEW!
      if (data.messageCount !== undefined) formData.append('messageCount', String(data.messageCount)); // 🎯 NEW!
      if (data.useMemory !== undefined) formData.append('useMemory', String(data.useMemory));
      if (data.documentId) formData.append('documentId', data.documentId); // 🎯 NEW! For RAG
      
      return this.request('/ask-ai', {
        method: 'POST',
        body: formData,
        headers: {}, // Remove Content-Type to let browser set boundary for FormData
      });
    } else {
      // For text only, use JSON with memory support + chat-scoping
      return this.request('/ask-ai', {
        method: 'POST',
        body: JSON.stringify({
          prompt: data.message,
          type: 'text',
          userId: data.userId,
          userName: data.userName,                // 🎯 NEW! For auto-profile creation
          chatId: data.chatId,                    // 🎯 NEW! For chat-scoped memory
          messageCount: data.messageCount,        // 🎯 NEW! Detect new vs continuing
          conversationHistory: data.conversationHistory, // 🎯 NEW! Previous messages for context
          conversationSummary: data.conversationSummary, // 🎯 NEW! Summary of older messages
          useMemory: data.useMemory !== false, // Default to true if not specified
          documentId: data.documentId            // 🎯 NEW! For RAG document retrieval
        }),
      });
    }
  }

  /**
   * Stream AI response using Server-Sent Events
   * Provides real-time text generation (like ChatGPT typing effect)
   */
  async askAIStream(data: {
    message: string;
    userId?: string;
    userName?: string;
    chatId?: string;
    messageCount?: number;
    conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    conversationSummary?: string;
    useMemory?: boolean;
    onChunk: (text: string, isCached?: boolean) => void;
    onComplete: (metadata: { duration: number; cached?: boolean }) => void;
    onError: (error: string) => void;
    signal?: AbortSignal;
  }): Promise<void> {
    const url = `${this.baseURL}/ask-ai-stream`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: data.message,
          userId: data.userId,
          userName: data.userName,
          chatId: data.chatId,
          messageCount: data.messageCount,
          conversationHistory: data.conversationHistory,
          conversationSummary: data.conversationSummary,
          memory: data.useMemory !== false,
        }),
        signal: data.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read the response body as a stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (lines ending with \n\n)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim() || !message.startsWith('data: ')) continue;

          try {
            const jsonStr = message.slice(6); // Remove 'data: ' prefix
            const parsed = JSON.parse(jsonStr);

            if (parsed.error) {
              data.onError(parsed.error);
              return;
            }

            if (parsed.done) {
              data.onComplete({
                duration: parsed.duration || 0,
                cached: parsed.cached || false,
              });
              return;
            }

            if (parsed.text) {
              data.onChunk(parsed.text, parsed.cached);
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE message:', message, parseError);
          }
        }
      }

      // Handle any remaining buffer
      if (buffer.trim() && buffer.startsWith('data: ')) {
        try {
          const jsonStr = buffer.slice(6);
          const parsed = JSON.parse(jsonStr);
          if (parsed.done) {
            data.onComplete({
              duration: parsed.duration || 0,
              cached: parsed.cached || false,
            });
          }
        } catch (parseError) {
          console.warn('Failed to parse final SSE message:', buffer);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted by user');
        return;
      }
      console.error('Streaming error:', err);
      data.onError(err.message || 'Streaming failed');
    }
  }

  /**
   * Generate an image from prompt using the backend /ask-ai endpoint with type=image
   * Image generation can take 30-90 seconds, so we use a longer timeout
   */
  async generateImage(
    prompt: string, 
    userId?: string, 
    chatId?: string, 
    userName?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> // 🎯 Includes system messages for document context
  ): Promise<{
    success: boolean;
    imageBase64?: string | null;
    imageUri?: string | null;
    imageLocalUri?: string | null;
    altText?: string | null;
    error?: string;
    metadata?: {
      tokens?: number;
      candidatesTokenCount?: number;
      promptTokenCount?: number;
      duration?: number;
    };
  }> {
    // Image generation can take 30-90 seconds, use longer timeout
    const url = `${this.baseURL}/ask-ai`;
    const controller = new AbortController();
    const timeoutMs = 90 * 1000; // 90 seconds timeout for image generation
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          type: 'image',
          userId,
          chatId,
          userName,
          conversationHistory // 🎯 NEW! Include conversation context
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      if (err.name === 'AbortError') {
        return {
          success: false,
          error: 'Image generation timed out (90 seconds). The AI model may be busy. Please try again.'
        };
      }
      
      console.error('Image generation error:', err);
      return {
        success: false,
        error: err.message || 'Failed to generate image'
      };
    }
  }

  /**
   * Process a document file (base64) and extract text using backend /process-document
   */
  async processDocument(options: {
    fileBase64: string;
    mimeType?: string;
    prompt?: string;
    userId?: string;
    storeInMemory?: boolean;
  }): Promise<{ success: boolean; extractedText?: string; error?: string }> {
    // Use a longer timeout for document processing (3 minutes)
    const url = `${this.baseURL}/process-document`;
    const controller = new AbortController();
    const timeoutMs = 3 * 60 * 1000; // 3 minutes
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: options.fileBase64,
          mimeType: options.mimeType,
          prompt: options.prompt,
          userId: options.userId,
          storeInMemory: options.storeInMemory,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`HTTP error! status: ${resp.status} ${txt}`);
      }

      const data = await resp.json();
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err && (err.name === 'AbortError' || err.message?.toLowerCase?.().includes('aborted') || err.message?.toLowerCase?.().includes('timeout'))) {
        return { success: false, error: 'Request timed out. Document processing may take longer for large files.' };
      }
      console.error('processDocument failed:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /** Edit an image (base64) with a prompt */
  async editImage(options: { imageBase64: string; editPrompt: string; model?: string }): Promise<{ success: boolean; imageBase64?: string | null; imageUri?: string | null; altText?: string | null; error?: string }> {
    const url = `${this.baseURL}/edit-image`;
    const controller = new AbortController();
    const timeoutMs = 2 * 60 * 1000; // 2 minutes
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: options.imageBase64, editPrompt: options.editPrompt, model: options.model }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`HTTP error! status: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err && (err.name === 'AbortError' || err.message?.toLowerCase?.().includes('aborted') || err.message?.toLowerCase?.().includes('timeout'))) {
        return { success: false, error: 'Request timed out. Image editing may take longer.' };
      }
      console.error('editImage failed:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /** Edit an image using a mask (both base64) */
  async editImageWithMask(options: { imageBase64: string; maskBase64: string; editPrompt: string; model?: string }): Promise<{ success: boolean; imageBase64?: string | null; imageUri?: string | null; altText?: string | null; error?: string }> {
    const url = `${this.baseURL}/edit-image-with-mask`;
    const controller = new AbortController();
    const timeoutMs = 2 * 60 * 1000; // 2 minutes
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: options.imageBase64, maskBase64: options.maskBase64, editPrompt: options.editPrompt, model: options.model }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`HTTP error! status: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err && (err.name === 'AbortError' || err.message?.toLowerCase?.().includes('aborted') || err.message?.toLowerCase?.().includes('timeout'))) {
        return { success: false, error: 'Request timed out. Image editing may take longer.' };
      }
      console.error('editImageWithMask failed:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  // User management
  async updateProfile(data: any): Promise<ApiResponse<any>> {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Memory management
  async storeMemory(data: {
    content: string;
    type?: 'conversation' | 'document' | 'note';
    source?: string;
    userId?: string;
    tags?: string[];
  }): Promise<ApiResponse<{ memoryId: string }>> {
    return this.request('/store-memory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async storeMemories(data: {
    memories: Array<{
      content: string;
      type?: string;
      source?: string;
      userId?: string;
      tags?: string[];
    }>;
  }): Promise<ApiResponse<{ memoryIds: string[] }>> {
    return this.request('/store-memories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async searchMemories(data: {
    query: string;
    topK?: number;
    threshold?: number;
    userId?: string;
    type?: string;
  }): Promise<ApiResponse<{
    query: string;
    results: Array<{
      id: string;
      content: string;
      score: number;
      metadata: {
        timestamp: number;
        type: 'conversation' | 'document' | 'note';
        source?: string;
        userId?: string;
        tags?: string[];
      };
    }>;
    count: number;
  }>> {
    return this.request('/search-memory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMemory(memoryId: string): Promise<ApiResponse<any>> {
    return this.request(`/memory/${memoryId}`, {
      method: 'DELETE',
    });
  }

  async getMemoryStats(): Promise<ApiResponse<{
    stats: {
      totalVectors: number;
      indexDimension: number;
    };
  }>> {
    return this.request('/memory-stats');
  }

  // Enhanced ask-ai with memory support
  async askAiWithMemory(data: {
    prompt: string;
    type?: 'text' | 'image';
    model?: string;
    useMemory?: boolean;
    userId?: string;
  }): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const resp = await fetch(`${this.baseURL}/ask-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`HTTP error! status: ${resp.status} ${txt}`);
      }
      const result = await resp.json();
      return result;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err && (err.name === 'AbortError' || err.message?.toLowerCase?.().includes('aborted') || err.message?.toLowerCase?.().includes('timeout'))) {
        return { success: false, error: 'Request timed out.' };
      }
      console.error('askAiWithMemory failed:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Workspace endpoints - commented out since workspace is disabled
  // async getWorkspaceStats(): Promise<ApiResponse<any>> {
  //   return this.request('/workspace/stats');
  // }

  // async getProjects(): Promise<ApiResponse<any[]>> {
  //   return this.request('/workspace/projects');
  // }

  // Settings endpoints - commented out since settings is disabled
  // async updateSettings(settings: any): Promise<ApiResponse<any>> {
  //   return this.request('/settings', {
  //     method: 'PUT',
  //     body: JSON.stringify(settings),
  //   });
  // }

  /**
   * End chat session - triggers batch persistence to Pinecone
   * Call this when user switches to a new chat
   */
  async endChat(data: { userId: string; chatId: string }): Promise<{ success: boolean }> {
    return this.request('/end-chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Save all chats at once (batch operation) - bypasses cooldown
   * Use for critical events: sign-out, app close, etc.
   * 🎯 NEW: Ensures all conversations + images are saved to Pinecone
   */
  async saveAllChats(data: { userId: string; chatIds: string[] }): Promise<{ success: boolean; message?: string }> {
    return this.request('/save-all-chats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Export content as a file
  async exportContent(params: { content: string; format: 'pdf' | 'docx' | 'csv' | 'txt'; filename?: string }): Promise<Blob> {
    return this.requestBlob('/export', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Friendly error mapping for UI
  public static toFriendlyError(err: any): string {
    if (!err) return 'Unknown error';
    const msg = (typeof err === 'string' ? err : err.message) || 'Unknown error';
    const status = (err as any)?.status;
    if (status === 409) {
      return 'Another request is already processing for this chat. Please wait for it to finish.';
    }
    if (/timeout|timed out|abort/i.test(msg)) {
      return 'Request timed out. The server is taking too long to respond.';
    }
    if (/network/i.test(msg)) {
      return 'Network error. Check your connection and try again.';
    }
    return msg;
  }
}

// Create singleton instance
export const apiService = new ApiService();
export const handleApiError = (err: any) => ApiService.toFriendlyError(err);

export const withApiErrorHandling = async <T>(
  apiCall: () => Promise<T>,
  fallback?: T
): Promise<T | null> => {
  try {
    return await apiCall();
  } catch (error) {
    console.error('API call failed:', error);
    return fallback || null;
  }
};

// Environment-based configuration
export const config = {
  apiUrl: (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api',
  wsUrl: (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:8000',
  enableVoiceRecording: (import.meta as any).env?.VITE_ENABLE_VOICE_RECORDING === 'true',
  enableFileUpload: (import.meta as any).env?.VITE_ENABLE_FILE_UPLOAD === 'true',
};