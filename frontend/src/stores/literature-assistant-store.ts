import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import literatureAssistantAPI, {
  Session,
  Message,
  Document,
  LiteratureConfig,
  Prompts,
  CustomPrompt,
  PublicSession,
  CommunitySettings
} from '@/services/api';
import { toast } from 'sonner';

const isQuotaExceededError = (error: unknown): boolean => {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  return false;
};

const STREAM_FLUSH_INTERVAL_MS = 80;

const lastStorageWrites = new Map<string, string>();

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    try {
      const value = window.localStorage.getItem(name);
      if (typeof value === 'string') lastStorageWrites.set(name, value);
      return value;
    } catch (error) {
      console.warn('[Store] localStorage.getItem failed:', error);
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    if (lastStorageWrites.get(name) === value) return;
    lastStorageWrites.set(name, value);
    try {
      window.localStorage.setItem(name, value);
    } catch (error) {
      console.warn('[Store] localStorage.setItem failed:', error);
      if (isQuotaExceededError(error)) {
        try {
          window.localStorage.removeItem(name);
          window.localStorage.setItem(name, value);
        } catch (retryError) {
          console.warn('[Store] localStorage.setItem retry failed:', retryError);
        }
      }
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    lastStorageWrites.delete(name);
    try {
      window.localStorage.removeItem(name);
    } catch (error) {
      console.warn('[Store] localStorage.removeItem failed:', error);
    }
  }
};

interface LiteratureAssistantState {
  sessions: Session[];
  currentSession: Session | null;
  isLoadingSessions: boolean;
  messages: Message[];
  isLoadingMessages: boolean;
  isSending: boolean;
  documents: Document[];
  isUploading: boolean;
  uploadProgress: number;
  config: LiteratureConfig | null;
  prompts: Prompts | null;
  customPrompts: CustomPrompt[];
  backgroundStreaming: Record<string, { id: string; content: string; isFinal: boolean; kind?: string; taskType?: string }>;
  error: string | null;
  sidebarOpen: boolean;
  communitySettings: CommunitySettings | null;
  publicSessions: PublicSession[];
  isLoadingCommunity: boolean;
  communitySearchQuery: string;
  summaryProvider: string;
  assistantProvider: string;
  selectedTaskType: string | null;
  showChatInput: boolean;

  initialize: () => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createSession: (title?: string) => Promise<Session>;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setCurrentSession: (session: Session | null) => void;
  uploadDocument: (sessionId: string, file: File) => Promise<Document>;
  uploadDocumentFromUrl: (sessionId: string, url: string) => Promise<Document>;
  deleteDocument: (documentId: string) => Promise<void>;
  downloadDocument: (documentId: string, filename: string) => void;
  sendMessage: (sessionId: string, message: string, taskType?: string, customPrompt?: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  regenerateSummary: (sessionId: string, taskType: string, customPrompt?: string) => Promise<void>;
  aiRenameCurrentSession: () => Promise<void>;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
  setSummaryProvider: (provider: string) => void;
  setAssistantProvider: (provider: string) => void;
  setSelectedTaskType: (taskType: string | null) => void;
  setShowChatInput: (show: boolean) => void;
  loadConfig: () => Promise<void>;
  loadPrompts: () => Promise<void>;
  loadCustomPrompts: () => Promise<void>;
  addCustomPrompt: (name: string, prompt: string) => Promise<void>;
  deleteCustomPrompt: (id: string) => Promise<void>;
  _overlayStreamingIfAny: (sessionId: string, messages: Message[]) => Message[];
  loadCommunitySettings: () => Promise<void>;
  updateCommunitySettings: (shareEnabled: boolean) => Promise<void>;
  toggleSessionPublic: (sessionId: string, isPublic: boolean) => Promise<void>;
  loadPublicSessions: (search?: string) => Promise<void>;
  copyPublicSession: (sessionId: string) => Promise<Session>;
  setCommunitySearchQuery: (query: string) => void;
}

export const useLiteratureAssistantStore = create<LiteratureAssistantState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSession: null,
      isLoadingSessions: false,
      messages: [],
      isLoadingMessages: false,
      isSending: false,
      documents: [],
      isUploading: false,
      uploadProgress: 0,
      config: null,
      prompts: null,
      customPrompts: [],
      backgroundStreaming: {},
      error: null,
      sidebarOpen: false,
      communitySettings: null,
      publicSessions: [],
      isLoadingCommunity: false,
      communitySearchQuery: '',
      summaryProvider: 'gemini-2.5-pro',
      assistantProvider: 'gemini-2.5-pro',
      selectedTaskType: null,
      showChatInput: false,

      initialize: async () => {
        try {
          await Promise.all([
            get().loadConfig(),
            get().loadPrompts(),
            get().loadSessions(),
            get().loadCustomPrompts()
          ]);
        } catch (error) {
          console.error('Failed to initialize:', error);
          const message = error instanceof Error ? error.message : 'Initialization failed';
          set({ error: message });
        }
      },

      loadSessions: async () => {
        set({ isLoadingSessions: true, error: null });
        try {
          const sessions = await literatureAssistantAPI.getSessions();
          set({ sessions, isLoadingSessions: false });
        } catch (error) {
          console.error('Failed to load sessions:', error);
          const message = error instanceof Error ? error.message : 'Failed to load sessions';
          set({ error: message, isLoadingSessions: false });
        }
      },

      loadSession: async (sessionId: string) => {
        set({ isLoadingMessages: true, error: null, isSending: false });
        try {
          const session = await literatureAssistantAPI.getSession(sessionId);
          const overlaid = get()._overlayStreamingIfAny(sessionId, session.messages || []);
          set({
            currentSession: session,
            messages: overlaid,
            documents: session.documents || [],
            isLoadingMessages: false,
            isSending: false
          });
        } catch (error) {
          console.error('Failed to load session:', error);
          const message = error instanceof Error ? error.message : 'Failed to load session';
          set({ error: message, isLoadingMessages: false, isSending: false });
        }
      },

      createSession: async (title?: string) => {
        try {
          const session = await literatureAssistantAPI.createSession({ title });
          set(state => ({
            sessions: [session, ...state.sessions],
            currentSession: session,
            messages: [],
            documents: []
          }));
          return session;
        } catch (error) {
          console.error('Failed to create session:', error);
          const message = error instanceof Error ? error.message : 'Failed to create session';
          set({ error: message });
          throw error;
        }
      },

      updateSessionTitle: async (sessionId: string, title: string) => {
        try {
          await literatureAssistantAPI.updateSession(sessionId, { title });
          set(state => ({
            sessions: state.sessions.map(s => s.id === sessionId ? { ...s, title } : s),
            currentSession: state.currentSession?.id === sessionId
              ? { ...state.currentSession, title }
              : state.currentSession
          }));
        } catch (error) {
          console.error('Failed to update session title:', error);
          const message = error instanceof Error ? error.message : 'Failed to update session title';
          set({ error: message });
        }
      },

      deleteSession: async (sessionId: string) => {
        try {
          await literatureAssistantAPI.deleteSession(sessionId);
          set(state => ({
            sessions: state.sessions.filter(s => s.id !== sessionId),
            currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
            messages: state.currentSession?.id === sessionId ? [] : state.messages,
            documents: state.currentSession?.id === sessionId ? [] : state.documents
          }));
        } catch (error) {
          console.error('Failed to delete session:', error);
          const message = error instanceof Error ? error.message : 'Failed to delete session';
          set({ error: message });
        }
      },

      setCurrentSession: (session: Session | null) => {
        set({
          currentSession: session,
          messages: session?.messages || [],
          documents: session?.documents || [],
          isSending: false
        });
      },

      uploadDocument: async (sessionId: string, file: File) => {
        set({ isUploading: true, uploadProgress: 0, error: null });
        try {
          const document = await literatureAssistantAPI.uploadDocument(
            sessionId,
            file,
            (progress) => set({ uploadProgress: progress })
          );
          set(state => ({
            documents: [...state.documents, document],
            sessions: state.sessions.map(s => {
              if (s.id === sessionId) {
                const currentDocs = s.documents || [];
                return {
                  ...s,
                  documents: [...currentDocs, document],
                  documentCount: (typeof s.documentCount === 'number' ? s.documentCount : currentDocs.length) + 1,
                  updated_at: Date.now() as unknown as number
                };
              }
              return s;
            }),
            isUploading: false,
            uploadProgress: 100
          }));
          setTimeout(() => set({ uploadProgress: 0 }), 1000);
          return document;
        } catch (error) {
          console.error('Failed to upload document:', error);
          const message = error instanceof Error ? error.message : 'Failed to upload document';
          set({ error: message, isUploading: false, uploadProgress: 0 });
          throw error;
        }
      },

      uploadDocumentFromUrl: async (sessionId: string, url: string) => {
        set({ isUploading: true, uploadProgress: 0, error: null });
        try {
          const document = await literatureAssistantAPI.uploadDocumentFromUrl(sessionId, url);
          set(state => ({
            documents: [...state.documents, document],
            sessions: state.sessions.map(s => {
              if (s.id === sessionId) {
                const currentDocs = s.documents || [];
                return {
                  ...s,
                  documents: [...currentDocs, document],
                  documentCount: (typeof s.documentCount === 'number' ? s.documentCount : currentDocs.length) + 1,
                  updated_at: Date.now() as unknown as number
                };
              }
              return s;
            }),
            isUploading: false,
            uploadProgress: 100
          }));
          setTimeout(() => set({ uploadProgress: 0 }), 1000);
          return document;
        } catch (error) {
          console.error('Failed to upload document from URL:', error);
          const message = error instanceof Error ? error.message : 'Failed to upload document from URL';
          set({ error: message, isUploading: false, uploadProgress: 0 });
          throw error;
        }
      },

      deleteDocument: async (documentId: string) => {
        try {
          await literatureAssistantAPI.deleteDocument(documentId);
          set(state => ({ documents: state.documents.filter(d => d.id !== documentId) }));
        } catch (error) {
          console.error('Failed to delete document:', error);
          const message = error instanceof Error ? error.message : 'Failed to delete document';
          set({ error: message });
        }
      },

      downloadDocument: (documentId: string, filename: string) => {
        literatureAssistantAPI.downloadDocument(documentId, filename);
      },

      sendMessage: async (sessionId: string, message: string, taskType?: string, customPrompt?: string) => {
        const isForeground = () => get().currentSession?.id === sessionId;
        if (isForeground()) set({ isSending: true, error: null });
        const streamingMsgId: string = `streaming-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

        try {
          const { assistantProvider } = get();

          let userMsgId: string | undefined;
          if (isForeground() && message.trim()) {
            userMsgId = crypto.randomUUID?.() || `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const tempUserMsg: Message = {
              id: userMsgId,
              session_id: sessionId,
              role: 'user',
              content: message,
              metadata: JSON.stringify({ taskType }),
              created_at: Date.now()
            };
            set(state => ({ messages: [...state.messages, tempUserMsg] }));
          }

          const streamingKey = `assistant-${sessionId}`;
          set(state => ({
            backgroundStreaming: {
              ...state.backgroundStreaming,
              [streamingKey]: { id: streamingMsgId, content: '', isFinal: false, kind: 'assistant' }
            }
          }));

          if (isForeground()) {
            const streamingMsg: Message = {
              id: streamingMsgId,
              session_id: sessionId,
              role: 'assistant',
              content: '',
              metadata: JSON.stringify({ providerId: assistantProvider, streaming: true }),
              created_at: Date.now()
            };
            set(state => ({ messages: [...state.messages, streamingMsg] }));
          }

          let streamedContent = '';
          let pending = '';
          let flushTimer: ReturnType<typeof setTimeout> | null = null;

          const flush = () => {
            if (!pending) return;
            streamedContent += pending;
            pending = '';
            const content = streamedContent;

            if (isForeground()) {
              set(state => ({
                messages: state.messages.map(m => m.id === streamingMsgId ? { ...m, content } : m)
              }));
            } else {
              set(state => ({
                backgroundStreaming: {
                  ...state.backgroundStreaming,
                  [streamingKey]: { id: streamingMsgId, content, isFinal: false, kind: 'assistant' }
                }
              }));
            }
          };

          const scheduleFlush = () => {
            if (flushTimer) return;
            flushTimer = setTimeout(() => {
              flushTimer = null;
              flush();
            }, STREAM_FLUSH_INTERVAL_MS);
          };

          const responseMessage = await literatureAssistantAPI.analyze(
            {
              sessionId,
              message: message || '请分析上传的文献',
              taskType,
              providerId: assistantProvider,
              customPrompt,
              userMessageId: userMsgId
            },
            (chunk) => {
              pending += chunk;
              scheduleFlush();
            }
          );

          if (flushTimer) clearTimeout(flushTimer);
          flush();

          try {
            const meta = responseMessage.metadata ? JSON.parse(responseMessage.metadata) : null;
            const warnings = Array.isArray(meta?.warnings)
              ? meta.warnings.map((x: unknown) => String(x)).filter(Boolean)
              : [];
            if (warnings.length > 0) {
              toast.warning('运行时提示', {
                description: warnings.slice(0, 2).join('\n') + (warnings.length > 2 ? `\n…共 ${warnings.length} 条` : ''),
              });
            }
          } catch {}

          if (isForeground()) {
            set(state => ({
              messages: state.messages.map(m =>
                m.id === streamingMsgId
                  ? { ...m, id: responseMessage.id, content: responseMessage.content, metadata: responseMessage.metadata }
                  : m
              ),
              isSending: false
            }));
            set(state => ({
              backgroundStreaming: { ...state.backgroundStreaming, [streamingKey]: { id: streamingMsgId, content: '', isFinal: true, kind: 'assistant' } }
            }));
            try {
              const refreshedSession = await literatureAssistantAPI.getSession(sessionId);
              if (refreshedSession.documents) {
                set({ documents: refreshedSession.documents });
              }
            } catch {}
          } else {
            toast.success('分析完成', {
              description: '点击查看生成结果',
              action: {
                label: '查看',
                onClick: async () => { await get().loadSession(sessionId); }
              }
            });
            set(state => ({
              backgroundStreaming: { ...state.backgroundStreaming, [streamingKey]: { id: streamingMsgId, content: '', isFinal: true, kind: 'assistant' } }
            }));
          }

          set(state => ({
            sessions: state.sessions.map(s => s.id === sessionId ? { ...s, updated_at: Date.now() as unknown as number } : s)
          }));
        } catch (error) {
          console.error('Failed to send message:', error);
          const errorMsg = error instanceof Error ? error.message : 'Failed to send message';
          set(state => ({ messages: state.messages.filter(m => m.id !== streamingMsgId) }));
          const streamingKey = `assistant-${sessionId}`;
          set(state => ({
            backgroundStreaming: {
              ...state.backgroundStreaming,
              [streamingKey]: { id: streamingMsgId, content: '', isFinal: true, kind: 'assistant' }
            }
          }));
          set({ isSending: false });
          if (isForeground()) set({ error: errorMsg });
          if (isForeground()) {
            set(state => ({
              messages: [
                ...state.messages,
                {
                  id: `error-${Date.now()}`,
                  session_id: sessionId,
                  role: 'assistant',
                  content: `抱歉，分析失败：${errorMsg}`,
                  metadata: JSON.stringify({ error: true }),
                  created_at: Date.now()
                } as Message
              ]
            }));
          } else {
            toast.error('后台分析失败', { description: errorMsg });
          }
          throw error;
        }
      },

      deleteMessage: async (messageId: string) => {
        try {
          await literatureAssistantAPI.deleteMessage(messageId);
          set(state => ({ messages: state.messages.filter(m => m.id !== messageId) }));
        } catch (error: any) {
          console.error('Failed to delete message:', error);
          if (error?.response?.status === 404) {
            set(state => ({ messages: state.messages.filter(m => m.id !== messageId) }));
            return;
          }
          toast.error('删除消息失败');
        }
      },

      regenerateSummary: async (sessionId: string, taskType: string, customPrompt?: string) => {
        const streamingMsgId: string = `summary-streaming-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
        const streamingKey = `summary-${sessionId}`;

        let streamedContent = '';
        let pending = '';
        let flushTimer: ReturnType<typeof setTimeout> | null = null;

        const flush = () => {
          if (!pending) return;
          streamedContent += pending;
          pending = '';
          const content = streamedContent;

          const isCurrent = get().currentSession?.id === sessionId;
          set(state => ({
            backgroundStreaming: {
              ...state.backgroundStreaming,
              [streamingKey]: { id: streamingMsgId, content, isFinal: false, kind: 'summary', taskType }
            },
            ...(isCurrent
              ? { messages: state.messages.map(m => m.id === streamingMsgId ? { ...m, content } : m) }
              : {})
          }));
        };

        const scheduleFlush = () => {
          if (flushTimer) return;
          flushTimer = setTimeout(() => {
            flushTimer = null;
            flush();
          }, STREAM_FLUSH_INTERVAL_MS);
        };

        try {
          const { summaryProvider } = get();

          set(state => ({
            backgroundStreaming: {
              ...state.backgroundStreaming,
              [streamingKey]: { id: streamingMsgId, content: '', isFinal: false, kind: 'summary', taskType }
            }
          }));

          if (get().currentSession?.id === sessionId) {
            const placeholder: Message = {
              id: streamingMsgId,
              session_id: sessionId,
              role: 'assistant',
              content: '',
              metadata: JSON.stringify({ taskType, providerId: summaryProvider, streaming: true }),
              created_at: Date.now()
            } as Message;
            set(state => ({ messages: [...state.messages, placeholder] }));
          }

          const responseMessage = await literatureAssistantAPI.analyze(
            {
              sessionId,
              message: '请分析上传的文献',
              taskType,
              providerId: summaryProvider,
              customPrompt
            },
            (chunk) => {
              pending += chunk;
              scheduleFlush();
            }
          );

          if (flushTimer) clearTimeout(flushTimer);
          flush();

          if (get().currentSession?.id === sessionId) {
            set(state => ({
              messages: state.messages.map(m =>
                m.id === streamingMsgId
                  ? { ...m, content: responseMessage.content, metadata: responseMessage.metadata }
                  : m
              ),
              sessions: state.sessions.map(s => s.id === sessionId ? { ...s, updated_at: Date.now() as unknown as number } : s)
            }));
          } else {
            set(state => ({
              sessions: state.sessions.map(s => s.id === sessionId ? { ...s, updated_at: Date.now() as unknown as number } : s)
            }));
          }

          set(state => ({
            backgroundStreaming: {
              ...state.backgroundStreaming,
              [streamingKey]: { id: streamingMsgId, content: '', isFinal: true, kind: 'summary', taskType }
            }
          }));

          if (get().currentSession?.id === sessionId) {
            try {
              const refreshedSession = await literatureAssistantAPI.getSession(sessionId);
              if (refreshedSession.documents) {
                set({ documents: refreshedSession.documents });
              }
            } catch {}
          }

          if (get().currentSession?.id !== sessionId) {
            toast.success('文献总结完成', {
              description: '点击查看生成结果',
              action: {
                label: '查看',
                onClick: async () => { await get().loadSession(sessionId); }
              }
            });
          }
        } catch (error) {
          console.error('Failed to regenerate summary:', error);
          if (flushTimer) clearTimeout(flushTimer);

          set(state => ({
            backgroundStreaming: {
              ...state.backgroundStreaming,
              [streamingKey]: { id: streamingMsgId, content: '', isFinal: true, kind: 'summary', taskType }
            }
          }));

          if (get().currentSession?.id === sessionId) {
            set(state => ({ messages: state.messages.filter(m => m.id !== streamingMsgId) }));
          }
          throw error;
        }
      },

      aiRenameCurrentSession: async () => {
        const session = get().currentSession;
        if (!session) return;
        try {
          const title = await literatureAssistantAPI.aiRenameSession(session.id);
          set(state => ({
            sessions: state.sessions.map(s => s.id === session.id ? { ...s, title } : s),
            currentSession: { ...state.currentSession!, title },
          }));
        } catch (error) {
          console.error('Failed to AI rename session:', error);
          const message = error instanceof Error ? error.message : 'AI 命名失败';
          set({ error: message });
          throw error;
        }
      },

      setError: (error: string | null) => set({ error }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
      setSummaryProvider: (provider: string) => set({ summaryProvider: provider }),
      setAssistantProvider: (provider: string) => set({ assistantProvider: provider }),
      setSelectedTaskType: (taskType: string | null) => set({ selectedTaskType: taskType }),
      setShowChatInput: (show: boolean) => set({ showChatInput: show }),

      loadConfig: async () => {
        try {
          const config = await literatureAssistantAPI.getConfig();
          const currentState = get();
          const availableProviders = config.providers || [];

          const shouldResetSummary = !currentState.summaryProvider ||
            !availableProviders.includes(currentState.summaryProvider);
          const shouldResetAssistant = !currentState.assistantProvider ||
            !availableProviders.includes(currentState.assistantProvider);

          set({
            config,
            summaryProvider: shouldResetSummary
              ? (config.defaultProvider || 'gemini-2.5-pro')
              : currentState.summaryProvider,
            assistantProvider: shouldResetAssistant
              ? ((config as any).assistantDefaultProvider || config.defaultProvider || 'gemini-2.5-pro')
              : currentState.assistantProvider
          });
        } catch (error) {
          console.error('Failed to load config:', error);
          const message = error instanceof Error ? error.message : 'Failed to load config';
          set({ error: message });
        }
      },

      loadPrompts: async () => {
        try {
          const prompts = await literatureAssistantAPI.getPrompts();
          set({ prompts });
        } catch (error) {
          console.error('Failed to load prompts:', error);
          const message = error instanceof Error ? error.message : 'Failed to load prompts';
          set({ error: message });
        }
      },

      loadCustomPrompts: async () => {
        try {
          const customPrompts = await literatureAssistantAPI.getCustomPrompts();
          set({ customPrompts });
        } catch (error) {
          console.error('Failed to load custom prompts:', error);
          const message = error instanceof Error ? error.message : 'Failed to load custom prompts';
          set({ error: message });
        }
      },

      addCustomPrompt: async (name: string, prompt: string) => {
        try {
          const item = await literatureAssistantAPI.createCustomPrompt(name, prompt);
          set(state => ({ customPrompts: [item, ...state.customPrompts] }));
          toast.success('已保存自定义模式');
        } catch (error) {
          console.error('Failed to create custom prompt:', error);
          const message = error instanceof Error ? error.message : 'Failed to create custom prompt';
          set({ error: message });
          throw error;
        }
      },

      deleteCustomPrompt: async (id: string) => {
        try {
          await literatureAssistantAPI.deleteCustomPrompt(id);
          set(state => ({ customPrompts: state.customPrompts.filter(p => p.id !== id) }));
          toast.success('已删除');
        } catch (error) {
          console.error('Failed to delete custom prompt:', error);
          const message = error instanceof Error ? error.message : 'Failed to delete custom prompt';
          set({ error: message });
        }
      },

      _overlayStreamingIfAny: (sessionId: string, messages: Message[]) => {
        const summaryKey = `summary-${sessionId}`;
        const assistantKey = `assistant-${sessionId}`;
        const backgroundStreaming = get().backgroundStreaming;

        let result = messages;

        const summaryBuf = backgroundStreaming[summaryKey];
        if (summaryBuf && !summaryBuf.isFinal && summaryBuf.content) {
          const exists = result.some(m => m.id === summaryBuf.id);
          if (exists) {
            result = result.map(m => (m.id === summaryBuf.id ? { ...m, content: summaryBuf.content } : m));
          } else {
            result = [
              ...result,
              {
                id: summaryBuf.id,
                session_id: sessionId,
                role: 'assistant',
                content: summaryBuf.content,
                metadata: JSON.stringify({ streaming: true, taskType: summaryBuf.taskType }),
                created_at: Date.now()
              } as Message
            ];
          }
        }

        const assistantBuf = backgroundStreaming[assistantKey];
        if (assistantBuf && !assistantBuf.isFinal && assistantBuf.content) {
          const exists = result.some(m => m.id === assistantBuf.id);
          if (exists) {
            result = result.map(m => (m.id === assistantBuf.id ? { ...m, content: assistantBuf.content } : m));
          } else {
            result = [
              ...result,
              {
                id: assistantBuf.id,
                session_id: sessionId,
                role: 'assistant',
                content: assistantBuf.content,
                metadata: JSON.stringify({ streaming: true }),
                created_at: Date.now()
              } as Message
            ];
          }
        }

        return result;
      },

      loadCommunitySettings: async () => {
        try {
          const settings = await literatureAssistantAPI.getCommunitySettings();
          set({ communitySettings: settings });
        } catch (error) {
          console.error('Failed to load community settings:', error);
          set({ communitySettings: { shareEnabled: false } });
        }
      },

      updateCommunitySettings: async (shareEnabled: boolean) => {
        try {
          const settings = await literatureAssistantAPI.updateCommunitySettings(shareEnabled);
          set({ communitySettings: settings });
          toast.success(shareEnabled ? '已开启分享' : '已关闭分享');
          get().loadSessions();
        } catch (error) {
          console.error('Failed to update community settings:', error);
          const message = error instanceof Error ? error.message : '更新设置失败';
          toast.error(message);
          throw error;
        }
      },

      toggleSessionPublic: async (sessionId: string, isPublic: boolean) => {
        try {
          await literatureAssistantAPI.toggleSessionPublic(sessionId, isPublic);
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === sessionId ? { ...s, is_public: isPublic ? 1 : 0 } : s
            ),
            currentSession: state.currentSession?.id === sessionId
              ? { ...state.currentSession, is_public: isPublic ? 1 : 0 }
              : state.currentSession
          }));
          toast.success(isPublic ? '已设为公开' : '已设为私有');
        } catch (error) {
          console.error('Failed to toggle session public:', error);
          const message = error instanceof Error ? error.message : '操作失败';
          toast.error(message);
          throw error;
        }
      },

      loadPublicSessions: async (search?: string) => {
        set({ isLoadingCommunity: true });
        try {
          const result = await literatureAssistantAPI.getPublicSessions({
            search: search || get().communitySearchQuery,
            limit: 100
          });
          set({ publicSessions: result.sessions, isLoadingCommunity: false });
        } catch (error) {
          console.error('Failed to load public sessions:', error);
          set({ isLoadingCommunity: false });
        }
      },

      copyPublicSession: async (sessionId: string) => {
        try {
          const session = await literatureAssistantAPI.copyPublicSession(sessionId);
          set(state => ({ sessions: [session, ...state.sessions] }));
          set(state => ({
            publicSessions: state.publicSessions.map(s =>
              s.id === sessionId ? { ...s, copy_count: (s.copy_count || 0) + 1 } : s
            )
          }));
          toast.success('已复制到我的文库');
          return session;
        } catch (error) {
          console.error('Failed to copy public session:', error);
          const message = error instanceof Error ? error.message : '复制失败';
          toast.error(message);
          throw error;
        }
      },

      setCommunitySearchQuery: (query: string) => {
        set({ communitySearchQuery: query });
      }
    }),
    {
      name: 'literature-assistant-storage',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        summaryProvider: state.summaryProvider,
        assistantProvider: state.assistantProvider,
        communitySettings: state.communitySettings
      })
    }
  )
);

export default useLiteratureAssistantStore;
