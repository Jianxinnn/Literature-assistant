import axios, { AxiosInstance } from 'axios';

// Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Session {
  id: string;
  user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  config: string;
  status: string;
  documentCount?: number;
  messageCount?: number;
  totalFileSize?: number;
  messages?: Message[];
  documents?: Document[];
  is_public?: number;
  copy_count?: number;
  isReadOnly?: boolean;
  analysis_status?: 'idle' | 'analyzing' | 'completed' | 'failed';
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: string;
  created_at: number;
}

export interface Document {
  id: string;
  session_id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: number;
  page_count?: number | null;
  parse_mode?: 'text_only' | 'image_aware';
  figureCount?: number;
}

export interface Figure {
  id: string;
  document_id?: string;
  label: string;
  caption?: string;
  page_number?: number;
  image_index?: number;
  file_name: string;
  file_size?: number;
}

export interface MineruStatus {
  available: boolean;
  message: string;
}

export interface PublicSession {
  id: string;
  user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  copy_count: number;
  document_count: number;
  total_file_size: number;
  analysis_count: number;
  view_count: number;
  documents?: Document[];
  messages?: Message[];
}

export interface CommunitySettings {
  shareEnabled: boolean;
  enabledAt?: number;
}

export interface ProviderDetail {
  multimodal: boolean;
  enabled: boolean;
}

export interface LiteratureConfig {
  providers: string[];
  providersDetail: Record<string, ProviderDetail>;
  defaultProvider: string;
  assistantDefaultProvider?: string;
  upload: {
    maxFileSizeMB: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    cleanupAfterDays: number;
  };
  session: {
    autoTitleLength: number;
    maxMessagesPerSession: number;
    defaultPageSize: number;
  };
}

export interface Prompts {
  system: {
    default: string;
  };
  tasks: {
    [key: string]: {
      name: string;
      prompt: string;
    };
  };
}

export interface CustomPrompt {
  id: string;
  name: string;
  prompt: string;
  created_at: number;
}

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

class LiteratureAssistantAPI {
  private api: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    this.api = axios.create({
      baseURL,
      timeout: 60000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use((config) => {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    }, (error) => {
      return Promise.reject(error);
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        const message = error.response?.data?.error || error.message || 'Unknown error';
        console.error('API Error:', message);
        return Promise.reject(error);
      }
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/health');
      return response.data.success;
    } catch {
      return false;
    }
  }

  async getConfig(): Promise<LiteratureConfig> {
    const response = await this.api.get('/config');
    return response.data.config;
  }

  async getPrompts(): Promise<Prompts> {
    const response = await this.api.get('/prompts');
    return response.data.prompts;
  }

  async getSessions(): Promise<Session[]> {
    const response = await this.api.get('/sessions');
    return response.data.sessions;
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.api.get(`/sessions/${sessionId}`);
    return response.data.session;
  }

  async createSession(data: { title?: string; config?: Record<string, unknown> }): Promise<Session> {
    const response = await this.api.post('/sessions', data);
    return response.data.session;
  }

  async updateSession(
    sessionId: string,
    data: { title?: string; config?: Record<string, unknown>; status?: string }
  ): Promise<Session> {
    const response = await this.api.patch(`/sessions/${sessionId}`, data);
    return response.data.session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.api.delete(`/sessions/${sessionId}`);
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.api.delete(`/messages/${messageId}`);
  }

  async uploadDocument(sessionId: string, file: File, onProgress?: (progress: number) => void): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);

    const response = await this.api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });

    return response.data.document;
  }

  async uploadDocumentFromUrl(sessionId: string, url: string): Promise<Document> {
    const response = await this.api.post('/upload-from-url', { sessionId, url });
    return response.data.document;
  }

  async analyze(
    data: {
      sessionId: string;
      message: string;
      taskType?: string;
      providerId?: string;
      customPrompt?: string;
      userMessageId?: string;
    },
    onChunk?: (chunk: string) => void
  ): Promise<Message> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let messageId = '';
    let warnings: string[] = [];

    if (!reader) {
      throw new Error('Stream not available');
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          let parsed: any;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (parsed.type === 'chunk') {
            fullContent += parsed.content;
            if (onChunk) onChunk(parsed.content);
          } else if (parsed.type === 'done') {
            messageId = parsed.messageId;
            fullContent = parsed.content;
            if (Array.isArray(parsed.warnings)) {
              warnings = parsed.warnings.map((x: unknown) => String(x)).filter(Boolean);
            }
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error);
          }
        }
      }
    }

    return {
      id: messageId,
      session_id: data.sessionId,
      role: 'assistant',
      content: fullContent,
      metadata: JSON.stringify({
        providerId: data.providerId,
        taskType: data.taskType || null,
        customPrompt: Boolean(data.customPrompt),
        warnings,
      }),
      created_at: Date.now(),
    };
  }

  async getDocument(documentId: string): Promise<Blob> {
    const response = await this.api.get(`/documents/${documentId}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.api.delete(`/documents/${documentId}`);
  }

  async aiRenameSession(sessionId: string): Promise<string> {
    const response = await this.api.post(`/sessions/${sessionId}/title/ai`);
    return response.data.title as string;
  }

  async downloadDocument(documentId: string, filename: string) {
    const blob = await this.getDocument(documentId);
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async getCustomPrompts(): Promise<CustomPrompt[]> {
    const response = await this.api.get('/custom-prompts');
    return response.data.prompts;
  }

  async createCustomPrompt(name: string, prompt: string): Promise<CustomPrompt> {
    const response = await this.api.post('/custom-prompts', { name, prompt });
    return response.data.prompt;
  }

  async deleteCustomPrompt(id: string): Promise<void> {
    await this.api.delete(`/custom-prompts/${id}`);
  }

  async getMineruStatus(): Promise<MineruStatus> {
    const response = await this.api.get('/mineru/status');
    return response.data;
  }

  async parseDocumentImages(documentId: string): Promise<{
    documentId: string;
    parseMode: string;
    markdownLength: number;
    figureCount: number;
    figures: Figure[];
  }> {
    const response = await this.api.post(`/documents/${documentId}/parse-images`);
    return response.data;
  }

  async getDocumentFigures(documentId: string): Promise<Figure[]> {
    const response = await this.api.get(`/documents/${documentId}/figures`);
    return response.data.figures;
  }

  getFigureUrl(figureId: string): string {
    return `${this.baseURL}/figures/${figureId}`;
  }

  getFigureUrlByLabel(documentId: string, label: string): string {
    return `${this.baseURL}/documents/${documentId}/figures/by-label/${encodeURIComponent(label)}`;
  }

  async getCommunitySettings(): Promise<CommunitySettings> {
    const response = await this.api.get('/community/settings');
    return response.data;
  }

  async updateCommunitySettings(shareEnabled: boolean): Promise<CommunitySettings> {
    const response = await this.api.post('/community/settings', { shareEnabled });
    return response.data;
  }

  async toggleSessionPublic(sessionId: string, isPublic: boolean): Promise<void> {
    await this.api.patch(`/sessions/${sessionId}/public`, { isPublic });
  }

  async getPublicSessions(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ sessions: PublicSession[]; total: number }> {
    const response = await this.api.get('/community/sessions', { params });
    return response.data;
  }

  async copyPublicSession(sessionId: string): Promise<Session> {
    const response = await this.api.post(`/community/copy/${sessionId}`);
    return response.data.session;
  }

  async recordView(sessionId: string): Promise<void> {
    await this.api.post(`/community/view/${sessionId}`);
  }
}

export const literatureAssistantAPI = new LiteratureAssistantAPI();
export default literatureAssistantAPI;
