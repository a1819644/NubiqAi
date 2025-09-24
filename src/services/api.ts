// API service layer for backend integration
// Currently using mock data, ready for real API integration

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
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    this.timeout = 10000; // 10 seconds
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

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
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
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Authentication endpoints
  async signIn(credentials: {
    email: string;
    password: string;
  }): Promise<ApiResponse<{ user: any; token: string }>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      message: 'Sign in successful',
      data: {
        user: {
          id: '1',
          email: credentials.email,
          firstName: 'John',
          lastName: 'Doe',
        },
        token: 'mock_jwt_token',
      },
    };
  }

  async signOut(): Promise<ApiResponse<null>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    localStorage.removeItem('auth_token');
    
    return {
      success: true,
      message: 'Sign out successful',
      data: null,
    };
  }

  // Chat endpoints
  async getChats(): Promise<ApiResponse<any[]>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      success: true,
      message: 'Chats fetched successfully',
      data: [],
    };
  }

  async createChat(title: string): Promise<ApiResponse<any>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      success: true,
      message: 'Chat created successfully',
      data: {
        id: Date.now().toString(),
        title,
        messages: [],
        createdAt: new Date().toISOString(),
      },
    };
  }

  async sendMessage(data: {
    chatId: string;
    content: string;
    attachments?: string[];
  }): Promise<ApiResponse<any>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    return {
      success: true,
      message: 'Message sent successfully',
      data: {
        id: Date.now().toString(),
        content: 'This is a mock AI response.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async uploadFile(file: File): Promise<ApiResponse<{ url: string; filename: string }>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: `https://mock-storage.com/${file.name}`,
        filename: file.name,
      },
    };
  }

  // User management
  async updateProfile(data: any): Promise<ApiResponse<any>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      success: true,
      message: 'Profile updated successfully',
      data,
    };
  }

  // Workspace endpoints
  async getWorkspaceStats(): Promise<ApiResponse<any>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      message: 'Workspace stats fetched successfully',
      data: {
        totalProjects: 12,
        activeChats: 48,
        teamMembers: 6,
        storageUsed: 2.3,
        storageLimit: 5.0,
      },
    };
  }

  async getProjects(): Promise<ApiResponse<any[]>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      success: true,
      message: 'Projects fetched successfully',
      data: [],
    };
  }

  // Settings endpoints
  async updateSettings(settings: any): Promise<ApiResponse<any>> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    };
  }
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
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8000',
  enableMockApi: import.meta.env.VITE_ENABLE_MOCK_API === 'true',
  enableVoiceRecording: import.meta.env.VITE_ENABLE_VOICE_RECORDING === 'true',
  enableFileUpload: import.meta.env.VITE_ENABLE_FILE_UPLOAD === 'true',
};