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
    this.timeout = 30000; // 30 seconds (increase default to avoid premature aborts)
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
          throw new Error(`HTTP error! status: ${response.status}`);
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
  async getChats(): Promise<ApiResponse<any[]>> {
    return this.request('/chats');
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
    useMemory?: boolean; // Enable/disable memory
  }): Promise<{ success: boolean; text?: string; error?: string }> {
    if (data.image) {
      // For images, use FormData (if backend supports it)
      const formData = new FormData();
      formData.append('prompt', data.message);
      formData.append('image', data.image);
      formData.append('type', 'image');
      if (data.userId) formData.append('userId', data.userId);
      if (data.useMemory !== undefined) formData.append('useMemory', String(data.useMemory));
      
      return this.request('/ask-ai', {
        method: 'POST',
        body: formData,
        headers: {}, // Remove Content-Type to let browser set boundary for FormData
      });
    } else {
      // For text only, use JSON with memory support
      return this.request('/ask-ai', {
        method: 'POST',
        body: JSON.stringify({
          prompt: data.message,
          type: 'text',
          userId: data.userId,
          useMemory: data.useMemory !== false // Default to true if not specified
        }),
      });
    }
  }

  /**
   * Generate an image from prompt using the backend /ask-ai endpoint with type=image
   */
  async generateImage(prompt: string): Promise<{
    success: boolean;
    imageBase64?: string | null;
    imageUri?: string | null;
    altText?: string | null;
    error?: string;
  }> {
    return this.request('/ask-ai', {
      method: 'POST',
      body: JSON.stringify({ prompt, type: 'image' }),
    });
  }

  /**
   * Process a document file (base64) and extract text using backend /process-document
   */
  async processDocument(options: {
    fileBase64: string;
    mimeType?: string;
    prompt?: string;
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
        body: JSON.stringify({ fileBase64: options.fileBase64, mimeType: options.mimeType, prompt: options.prompt }),
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
}

// Create singleton instance
export const apiService = new ApiService();

// Helper functions for common patterns
export const handleApiError = (error: any): string => {
  if (error.message) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
};

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