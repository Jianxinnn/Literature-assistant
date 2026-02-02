import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Upload,
  Send,
  Plus,
  Trash2,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  BookOpen,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Sparkles,
  FileCheck,
  Zap,
  Grid,
  PanelLeftOpen,
  PanelLeftClose,
  Brain,
  Search,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  MousePointerClick,
  Sun,
  Moon,
  Layout,
  PenTool,
  Share2,
  MoreHorizontal,
  ThumbsUp,
  Bookmark,
  Library,
  FolderOpen,
  Home,
  Folder,
  FileStack,
  Info,
  Maximize2,
  Minimize2,
  Pencil,
  ImageIcon,
  Users,
  Copy,
  Globe,
  RefreshCw,
  LayoutGrid,
  LayoutList,
  Calendar,
  Lock,
  Unlock,
  Printer,
  Activity,
  Database,
  Box,
  Pin,
  PinOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useLiteratureAssistantStore } from '@/stores/literature-assistant-store';
import { useAuth } from '@/services/auth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import logo from '@/assets/logo.png';
import MermaidChart from '@/components/MermaidChart';
import type { Message, AdminStats } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';
import { literatureAssistantAPI } from '@/services/api';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { FigureAwareMarkdown } from '@/components/literature-assistant';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LiteratureAssistant: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  // 误触「+ New Chat」保护：记录进入 New Chat 前的会话与 UI 状态（仅用于空白新会话自动回退）
  const newChatDraftRef = useRef<null | {
    previousSessionId: string | null;
    previousShowRightPanel: boolean;
    previousShowPDFViewer: boolean;
    previousSelectedPDF: string | null;
    previousShowChatInput: boolean;
    draftSessionId: string;
  }>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [analyzingSessionId, setAnalyzingSessionId] = useState<string | null>(null);
  const [showMainSidebar, setShowMainSidebar] = useState(false);
  const [showUploadArea, setShowUploadArea] = useState(true);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [selectedPDF, setSelectedPDF] = useState<string | null>(null);
  const [showToolPanel, setShowToolPanel] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'assistant' | 'paper' | 'notes'>('assistant');
  const [showRightPanel, setShowRightPanel] = useState(() => {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem('literature_show_tools');
    if (raw === 'false') return false;
    return true;
  });
  const [sidebarView, setSidebarView] = useState<'new-chat' | 'library' | 'history'>('new-chat');
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<{id: string, title: string, timestamp: Date}>>([]);
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState('general');
  const [welcomeDragging, setWelcomeDragging] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  // Redesign State
  const [activeSidebarItem, setActiveSidebarItem] = useState<'new-chat' | 'library' | 'reading' | 'community' | 'user-data'>('new-chat');
  // 大家看（社区共享）相关状态 - 简化版
  const [communityPreviewSession, setCommunityPreviewSession] = useState<string | null>(null);
  // 新增：查看公开文献弹窗状态（存储完整的 session 对象以便渲染）
  const [viewingPublicSession, setViewingPublicSession] = useState<any | null>(null);
  const [communityViewMode, setCommunityViewMode] = useState<'list' | 'grid'>('list');
  const [communityTab, setCommunityTab] = useState<'discover' | 'mine'>('discover');
  const [rightPanelTab, setRightPanelTab] = useState<'assistant' | 'paper' | 'notes' | 'similar'>('assistant');
  const [libraryViewMode, setLibraryViewMode] = useState<'list' | 'grid'>('list');
  const [currentFolder, setCurrentFolder] = useState<string>('all');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  // CNS / Arxiv 收藏文章的 ID 列表（与 CNSLibrary 共享数据源）
  const [cnsBookmarkedArticleIds, setCnsBookmarkedArticleIds] = useState<number[]>([]);
  // CNS / Arxiv 收藏文章的基础信息列表，用于在 Library 中展示「CNS / Arxiv 收藏」分组
  const [cnsFavoriteArticles, setCnsFavoriteArticles] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [showSummaryPromptSwitcher, setShowSummaryPromptSwitcher] = useState(false);
  const [summaryTaskTypeForRegenerate, setSummaryTaskTypeForRegenerate] = useState<string | null>(null);
  // 左侧文献总结的版本索引（0 = 最早版本）；默认始终展示最新版本
  const [summaryVersionIndex, setSummaryVersionIndex] = useState<number | null>(null);
  const [showMultiUploadModeDialog, setShowMultiUploadModeDialog] = useState(false);
  const [pendingLibraryFiles, setPendingLibraryFiles] = useState<FileList | null>(null);
  const [multiUploadMode, setMultiUploadMode] = useState<'group' | 'separate'>(() => {
    if (typeof window === 'undefined') return 'group';
    const saved = window.localStorage.getItem('literature_multi_upload_mode');
    return saved === 'separate' ? 'separate' : 'group';
  });

  const handleOpenFile = async (sessionId: string) => {
    setSelectedFileId(sessionId);
    if (currentSession?.id !== sessionId) {
        await loadSession(sessionId);
    }
  };

  const handleOpenInReading = async (sessionId: string) => {
      await handleSelectSession(sessionId);
      setActiveSidebarItem('reading');
      setShowRightPanel(true);
      setSelectedFileId(null); // Close preview
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('literature_show_tools', showRightPanel ? 'true' : 'false');
  }, [showRightPanel]);
  // 是否在 UI 中预先显示“AI 正在分析”提示
  // 目前不再根据 URL 自动触发分析，因此默认关闭该提示，
  // 仅在用户主动点击阅读模式或自定义 Prompt 时通过 isAnalyzing 控制。
  const [preShowingAnalyzing] = useState<boolean>(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  // 对话输入框对齐/占位：锚定消息列容器用于动态底部留白
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  // 折叠控制：用户手动折叠后，不再自动展开（默认抑制自动展开，沉浸式）
  const [suppressAutoOpen, setSuppressAutoOpen] = useState(true);
  // 新增自定义模式对话框
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [createDialogHovered, setCreateDialogHovered] = useState(false);
  const [composerHovered, setComposerHovered] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  // 自动命名标记（避免重复命名）
  const [autoRenamedSessionId, setAutoRenamedSessionId] = useState<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const [mountedTheme, setMountedTheme] = useState(false);
  useEffect(() => setMountedTheme(true), []);
  // 滚动与定位
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false); // 默认不自动滚动
  const [isAtBottom, setIsAtBottom] = useState(true);
  // 分析失败提示块
  const [analysisError, setAnalysisError] = useState<{ message: string; taskType?: string } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [chatError, setChatError] = useState<{ message: string; userText?: string } | null>(null);
  // 左侧任务中心弹窗
  const [taskCenterOpen, setTaskCenterOpen] = useState(false);
  // 模型选择器 Popover 控制
  const [summaryModelPopoverOpen, setSummaryModelPopoverOpen] = useState(false);
  const [readingModelPopoverOpen, setReadingModelPopoverOpen] = useState(false);
  // 模型不兼容提示 Dialog
  const [showModelMismatchDialog, setShowModelMismatchDialog] = useState(false);
  const [pendingTaskType, setPendingTaskType] = useState<string | null>(null);

  // --- Dialog States ---
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [createFolderValue, setCreateFolderValue] = useState('');
  const [sessionToMoveId, setSessionToMoveId] = useState<string | null>(null);

  const [showDeleteFolderDialog, setShowDeleteFolderDialog] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  const [showRenameFolderDialog, setShowRenameFolderDialog] = useState(false);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);

  const [pinnedFolders, setPinnedFolders] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('literature_pinned_folders') || '[]');
      } catch { return []; }
    }
    return [];
  });

  const [showDeleteSessionDialog, setShowDeleteSessionDialog] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const [showRenameSessionDialog, setShowRenameSessionDialog] = useState(false);
  const [renameSessionValue, setRenameSessionValue] = useState('');
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);

  const { isAuthenticated } = useAuth();
  const {
    sessions,
    currentSession,
    messages,
    documents,
    config,
    prompts,
    error,
    sidebarOpen,
    summaryProvider,
    assistantProvider,
    selectedTaskType,
    showChatInput,
    isLoadingSessions,
    isLoadingMessages,
    isSending,
    isUploading,
    uploadProgress,
    initialize,
    loadSessions,
    loadSession,
    createSession,
    updateSessionTitle,
    deleteSession,
    uploadDocument,
    uploadDocumentFromUrl,
    deleteDocument,
    downloadDocument,
    sendMessage,
    regenerateSummary,
    setError,
    toggleSidebar,
    setSummaryProvider,
    setAssistantProvider,
    setSelectedTaskType,
    setShowChatInput,
    customPrompts,
    addCustomPrompt,
    deleteCustomPrompt,
    loadCustomPrompts,
    aiRenameCurrentSession,
    backgroundStreaming,
    // 大家看（社区共享）相关 - 简化版
    communitySettings,
    publicSessions,
    isLoadingCommunity,
    communitySearchQuery,
    loadCommunitySettings,
    updateCommunitySettings,
    toggleSessionPublic,
    loadPublicSessions,
    copyPublicSession,
    setCommunitySearchQuery
  } = useLiteratureAssistantStore();

  // 从 CNS Library 读取当前用户的 CNS / Arxiv 收藏文章（仅在浏览器端执行）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const loadCnsBookmarks = async () => {
      try {
        if (!isAuthenticated) {
          if (!cancelled) setCnsBookmarkedArticleIds([]);
          return;
        }
        const base = '/api/cns/articles-enhanced';
        const url = new URL(base, window.location.origin);
        url.searchParams.set('limit', '500');
        url.searchParams.set('offset', '0');
        url.searchParams.set('group', 'all');
        url.searchParams.set('sort', 'date');
        url.searchParams.set('order', 'desc');
        url.searchParams.set('filter', 'bookmarked');

        const resp = await fetch(url.toString());
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const list = Array.isArray(data.articles) ? data.articles : [];
        if (cancelled) return;
        const ids = list
          .map((a: any) => a?.id)
          .filter((id: unknown): id is number => typeof id === 'number');
        setCnsBookmarkedArticleIds(ids);
        setCnsFavoriteArticles(list);
      } catch (e) {
        if (cancelled) return;
        console.error('加载 CNS 收藏失败:', e);
        setCnsBookmarkedArticleIds([]);
      }
    };

    loadCnsBookmarks();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const isAnalyzing = analyzingSessionId === currentSession?.id;

  // Folder / status helpers
  const builtinFolderIds = ['want-to-read', 'reading', 'completed'] as const;

  // 判断一个会话是否对应 CNS / Arxiv 的收藏文章（通过 session.config 中的 source + articleId 与 CNSLibrary 共享）
  const isCnsFavoriteSession = (session: any): boolean => {
    if (!cnsBookmarkedArticleIds.length) return false;
    if (!session || !session.config) return false;
    try {
      const cfg =
        typeof session.config === 'string'
          ? JSON.parse(session.config || '{}')
          : session.config;
      if (!cfg || cfg.source !== 'cns') return false;
      const articleId = (cfg as any).articleId;
      if (articleId == null) return false;
      const numericId = Number(articleId);
      if (!Number.isFinite(numericId)) return false;
      if (!cnsBookmarkedArticleIds.includes(numericId)) return false;
      const docCount =
        typeof session.documentCount === 'number'
          ? session.documentCount
          : (session.documents?.length || 0);
      return docCount > 0;
    } catch {
      return false;
    }
  };

  const computeFolderCounts = () => {
    const counts: Record<string, number> = {
      all: 0,
      'want-to-read': 0,
      reading: 0,
      completed: 0
    };
    sessions.forEach((s) => {
      const docCount =
        typeof s.documentCount === 'number'
          ? s.documentCount
          : (s.documents?.length || 0);
      if (docCount <= 0) return; // 仅统计真正有文献的会话
      counts.all += 1;
      const status = s.status || 'active';
      if (status === 'want-to-read') {
        counts['want-to-read'] += 1;
      } else if (status === 'completed') {
        counts['completed'] += 1;
      } else {
        counts['reading'] += 1;
      }
    });
    return counts;
  };

  const folderCounts = computeFolderCounts();
  // CNS 收藏分组数量以收藏文章条目数为准；若加载失败则退回到已有会话数
  const cnsFavoriteCount =
    cnsFavoriteArticles.length > 0
      ? cnsFavoriteArticles.length
      : sessions.filter(isCnsFavoriteSession).length;

  // Dynamically discover custom folders from session.status + user-defined folders
  const customFolderIds = Array.from(
    new Set([
      ...customFolders,
      ...sessions
        .map((s) => s.status)
        .filter(
          (v): v is string =>
            !!v && v !== 'active' && !builtinFolderIds.includes(v as any)
        )
    ])
  );

  const folders = [
    { id: 'all', name: 'All Publications', icon: FileStack, count: folderCounts.all },
    { id: 'want-to-read', name: 'Want to read', icon: Folder, count: folderCounts['want-to-read'] },
    { id: 'reading', name: 'Reading', icon: FolderOpen, count: folderCounts.reading },
    { id: 'completed', name: 'Completed', icon: CheckCircle2, count: folderCounts.completed },
    // 与 CNSLibrary 共享收藏数据的系统分组：CNS / Arxiv 收藏
    { id: 'cns-favorites', name: 'CNS / Arxiv 收藏', icon: Bookmark, count: cnsFavoriteCount },
    ...customFolderIds.map((id) => ({
      id,
      name: id,
      icon: Folder,
      // 自定义分组的计数也仅统计包含文献的会话
      count: sessions.filter((s) => {
        if (s.status !== id) return false;
        const docCount =
          typeof s.documentCount === 'number'
            ? s.documentCount
            : (s.documents?.length || 0);
        return docCount > 0;
      }).length
    }))
  ];

  // Register global shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + U to upload
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        // Trigger upload if not already uploading
        if (!isUploading) {
             fileInputRef.current?.click();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isUploading]);

  // 支持通过 URL 查询参数自动打开 session
  // 注意：这里不再自动触发分析，避免每次刷新页面都重新跑一遍 summary
  // 深度阅读入口如需自动分析，应由 CNS 端只在首次创建会话时带上 autostart，
  // 页面本身只负责根据会话现状展示结果。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    if (!sessionId) return;

    (async () => {
      try {
        // 默认沉浸式：侧边、上传区收起；聊天框收起（立即生效，避免首屏抖动）
        setShowChatInput(false);
        setShowToolPanel(false);
        setShowPDFViewer(false);
        setShowMainSidebar(false);
        setShowUploadArea(false);
        setSuppressAutoOpen(true);
        setAutoScrollEnabled(true);

        await Promise.all([
          loadSession(sessionId),
          initialize()
        ]);

        const latestDocs = useLiteratureAssistantStore.getState().documents || [];
        if (latestDocs.length > 0) setSelectedPDF(latestDocs[0].id);
      } catch (e) {
        console.error('URL 自动打开会话失败:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 生成提示：使用页面内提示（保持 isSending 时在消息区域显示），不再使用右下角 toast

  // 初始化：若 URL 未指定 session，才考虑自动创建或打开会话
  useEffect(() => {
    (async () => {
      await initialize();
      const state = useLiteratureAssistantStore.getState();
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const sessionIdFromUrl = params?.get('session');

      // 为避免刷新后仍卡在上一次的 Reading 会话，这里不再默认打开最近会话，除非 URL 显式指定
      if (sessionIdFromUrl) {
        try {
          await loadSession(sessionIdFromUrl);
          const latestMessages = useLiteratureAssistantStore.getState().messages;
          setShowChatInput((latestMessages?.length || 0) > 0);
          setActiveSidebarItem('reading');
        } catch (e) {
          console.error('根据 URL 加载会话失败，退回新建模式:', e);
          await handleCreateSession();
        }
      } else if (!state.currentSession) {
        // 没有 URL 指定时，一律进入真正的 New Chat，新建一个干净会话
        try {
          await handleCreateSession();
        } catch (e) {
          console.error('自动创建会话失败:', e);
        }
      } else {
        // 已有 currentSession 但刷新进入：强制切到 New Chat 视图，不复用旧阅读 UI
        setActiveSidebarItem('new-chat');
        setShowChatInput(false);
      }

      // 新打开 Literature Assistant 页面时，默认不携带旧会话的 PDF 到 "Start New Chat" 视图
      setSelectedPDF(null);
      setShowPDFViewer(false);
    })();
  }, [initialize, loadSession]);

  // 右侧 Assistant 的模型选择：默认使用后端的 Gemini-2.5-Pro（已在 store 中设为初始值），
  // 这里不再强制覆盖，保留用户上一次选择（来自 zustand persist）。

  // 仅在非流式时自动滚动到底部，流式期间允许用户自由滚动
  useEffect(() => {
    if (!isSending && autoScrollEnabled) {
      scrollToBottom();
    }
  }, [messages, isSending, autoScrollEnabled]);

  // 当展开输入框时，默认对齐到底部（非流式）
  useEffect(() => {
    if (showChatInput && !isSending && autoScrollEnabled) {
      scrollToBottom();
    }
  }, [showChatInput, isSending, autoScrollEnabled]);

  // 有消息时默认展开输入框（在非流式状态；用户手动折叠后不再自动展开）
  useEffect(() => {
    if (messages.length > 0 && !isSending && !showChatInput && !suppressAutoOpen) {
      setShowChatInput(true);
    }
  }, [messages.length, isSending, showChatInput, suppressAutoOpen, setShowChatInput]);

  // 兜底修复：当右侧 Assistant 面板激活且当前会话存在，但本地 messages 中没有任何用户消息时，
  // 自动从后端重新加载一次当前会话的消息，避免在路由切换/标签页恢复等场景下出现「对话区只剩背景板」的情况。
  const [autoReloadedSessionId, setAutoReloadedSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!currentSession) return;
    if (rightPanelTab !== 'assistant') return;
    if (isLoadingMessages) return;

    const hasUserMessage = messages.some(
      (m) => m.role === 'user' && (m.content || '').trim().length > 0
    );
    if (hasUserMessage) return;

    // 避免对同一个会话反复触发自动刷新
    if (autoReloadedSessionId === currentSession.id) return;

    (async () => {
      try {
        await loadSession(currentSession.id);
        setAutoReloadedSessionId(currentSession.id);
      } catch (e) {
        console.error('自动重新加载会话消息失败:', e);
      }
    })();
  }, [
    currentSession?.id,
    rightPanelTab,
    isLoadingMessages,
    messages,
    autoReloadedSessionId,
    loadSession
  ]);

  useEffect(() => {
    setCreateDialogHovered(false);
  }, [showCreateCustom]);

  useEffect(() => {
    if (!showChatInput) {
      setComposerHovered(false);
      setComposerFocused(false);
    }
  }, [showChatInput]);

  // Close action menu on outside click or Escape
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // 关闭功能弹出菜单
      if (showActionMenu) {
        const menu = actionMenuRef.current;
        const trigger = actionTriggerRef.current;
        if (menu && !menu.contains(target) && trigger && !trigger.contains(target)) {
          setShowActionMenu(false);
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowActionMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showActionMenu]);

  const scrollToBottom = () => {
    const vp = viewportRef.current;
    if (vp) {
      vp.scrollTo({ top: vp.scrollHeight, behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  const scrollToTop = () => {
    const vp = viewportRef.current;
    if (vp) {
      vp.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const handleViewportScroll: React.UIEventHandler<HTMLDivElement> = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const atBottom = vp.scrollHeight - (vp.scrollTop + vp.clientHeight) <= 16;
    setIsAtBottom(atBottom);
    if (!atBottom) setAutoScrollEnabled(false);
  };

  // Custom prompt UI state
  const [showAddCustomPrompt, setShowAddCustomPrompt] = useState(false);
  const [customPromptName, setCustomPromptName] = useState("");
  const [customPromptText, setCustomPromptText] = useState("");

  // New Chat 文件上传进度（支持多 PDF）
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [currentUploadName, setCurrentUploadName] = useState('');
  const [currentUploadProgress, setCurrentUploadProgress] = useState(0);
  const [urlToLoad, setUrlToLoad] = useState('');
  const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);

  const isNewChatView = activeSidebarItem === 'new-chat';
  const hasAssistantMessagesForCurrentSession = messages.some(
    (m) => m.role === 'assistant' && (m.content || '').trim().length > 0
  );

		  const handleCreateSession = async () => {
		    try {
          const previousSessionId = useLiteratureAssistantStore.getState().currentSession?.id ?? null;
          const previousShowRightPanel = showRightPanel;
          const previousShowPDFViewer = showPDFViewer;
          const previousSelectedPDF = selectedPDF;
          const previousShowChatInput = showChatInput;

		      const session = await createSession();

          newChatDraftRef.current = {
            previousSessionId,
            previousShowRightPanel,
            previousShowPDFViewer,
            previousSelectedPDF,
            previousShowChatInput,
            draftSessionId: session.id
          };
		      // 强制切换到真正的 New Chat 视图，清空上一轮阅读状态
		      setActiveSidebarItem('new-chat');
		      setShowChatInput(false);
		      setSelectedTaskType(null);
	      // New Chat 欢迎区：进入新会话时不继承上一轮选中的阅读模式
	      setSelectedWelcomeTask(null);
	      setShowUploadArea(true);
	      setRightPanelTab('assistant');
	      setSelectedPDF(null);
	      setShowPDFViewer(false);
      setShowRightPanel(false);
      setSummaryTaskTypeForRegenerate(null);
    } catch (error) {
      toast.error('创建对话失败');
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    await loadSession(sessionId);
    // 使用最新的 Store 状态判断是否显示输入框，避免闭包中旧值
    const latestMessages = useLiteratureAssistantStore.getState().messages;
    setShowChatInput((latestMessages?.length || 0) > 0);
    // 切换会话后，若右侧 PDF 预览已打开，则同步到当前会话的文档；否则关闭
    const latestDocs = useLiteratureAssistantStore.getState().documents || [];
    if (showPDFViewer) {
      if (latestDocs.length > 0) {
        setSelectedPDF(latestDocs[0].id);
      } else {
        setSelectedPDF(null);
        setShowPDFViewer(false);
      }
    } else {
      // 预览未打开时也清理上一个会话的选择，避免误显示旧文档
      setSelectedPDF(latestDocs.length > 0 ? latestDocs[0].id : null);
    }
  };

  const maybeRestorePreviousSessionFromNewChatDraft = async () => {
    const draft = newChatDraftRef.current;
    if (!draft) return false;
    if (activeSidebarItem !== 'new-chat') return false;
    if (currentSession?.id !== draft.draftSessionId) return false;

    const isDraftEmpty = documents.length === 0 && messages.length === 0;
    if (!isDraftEmpty) {
      newChatDraftRef.current = null;
      return false;
    }
    if (!draft.previousSessionId) {
      newChatDraftRef.current = null;
      return false;
    }

    await handleSelectSession(draft.previousSessionId);
    setShowRightPanel(draft.previousShowRightPanel);
    setShowPDFViewer(draft.previousShowPDFViewer);
    setSelectedPDF(draft.previousSelectedPDF);
    setShowChatInput(draft.previousShowChatInput);
    await deleteSession(draft.draftSessionId);
    newChatDraftRef.current = null;
    return true;
  };

  const handleDeleteSession = (sessionId: string) => {
      setDeleteSessionId(sessionId);
      setShowDeleteSessionDialog(true);
  };

  const confirmDeleteSession = async () => {
      if (!deleteSessionId) return;
      try {
          await deleteSession(deleteSessionId);
          toast.success('对话已删除');
      } catch (e) {
          console.error(e);
          toast.error('删除失败');
      }
      setShowDeleteSessionDialog(false);
  };

  const [selectedWelcomeTask, setSelectedWelcomeTask] = useState<string | null>(null);

  // ... existing state ...

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Library 模式：多文件上传时弹出模式选择，并复用上传进度条
    if (activeSidebarItem === 'library') {
      const firstFile = files[0];
      if (!firstFile) return;
      if (firstFile.type !== 'application/pdf') {
        toast.error(`${firstFile.name} 不是 PDF 文件`);
        return;
      }

      if (files.length > 1) {
        setPendingLibraryFiles(files);
        setShowMultiUploadModeDialog(true);
        return;
      }

      // 初始化进度（Library 也可共用 New Chat 的进度条 UI）
      setUploadingCount(files.length);
      setUploadedCount(0);
      setCurrentUploadProgress(0);
      setCurrentUploadName('');

      // 单文件上传：仍然创建单一文献会话
      let statusForNew: string | null = null;
      try {
        const baseName = firstFile.name.replace(/\.[^/.]+$/, '');
        const session = await createSession(baseName || undefined);

        if (currentFolder !== 'all') {
          if (currentFolder === 'reading') {
            statusForNew = 'reading';
          } else {
            statusForNew = currentFolder;
          }
        }

        if (statusForNew) {
          try {
            await literatureAssistantAPI.updateSession(session.id, { status: statusForNew as string });
          } catch (e) {
            console.error('设置新会话状态失败:', e);
          }
        }

        try {
          setCurrentUploadName(firstFile.name);
          // 通过 store 的 uploadDocument 统一管理文档列表
          const doc = await uploadDocument(session.id, firstFile);
          if (doc) {
            // store 内部已更新 documents，这里仅做进度展示
            setUploadedCount(1);
          }
          toast.success(`${firstFile.name} 上传成功`);
        } catch (error) {
          console.error('上传失败:', error);
          toast.error(`${firstFile.name} 上传失败`);
        }

        await loadSessions();
        setSelectedFileId(session.id);
      } catch (error) {
        console.error('创建会话或上传失败:', error);
        toast.error('创建新文献会话失败');
      }
      // 轻微延迟后清理进度条
      setTimeout(() => {
        setUploadingCount(0);
        setUploadedCount(0);
        setCurrentUploadName('');
        setCurrentUploadProgress(0);
      }, 800);

      return;
    }

    // 非 Library 模式：沿用原有逻辑，优先复用当前会话
    let targetSessionId = currentSession?.id;

    if (!targetSessionId) {
      try {
        const firstFile = files[0];
        const baseName = firstFile ? firstFile.name.replace(/\.[^/.]+$/, '') : '';
        const session = await createSession(baseName || undefined);
        targetSessionId = session.id;
      } catch (error) {
        toast.error('创建新对话失败');
        return;
      }
    }

	    const uploadedDocIds: string[] = [];

    // 初始化多文件上传进度（New Chat）
    if (activeSidebarItem === 'new-chat') {
      setUploadingCount(files.length);
      setUploadedCount(0);
      setCurrentUploadProgress(0);
      setCurrentUploadName('');
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name} 不是 PDF 文件`);
        continue;
      }
      try {
        // 记录当前正在上传的文件名
        if (activeSidebarItem === 'new-chat') {
          setCurrentUploadName(file.name);
          setCurrentUploadProgress(0);
        }

	        // 通过 store 的 uploadDocument 统一上传与状态管理
	        const doc = await uploadDocument(targetSessionId, file);
	        if (doc) uploadedDocIds.push(doc.id);
	        // 第一个 PDF 上传成功时，如会话标题为空或默认值，则更新为文件名（去后缀）
	        if (i === 0) {
	          const baseName = file.name.replace(/\.[^/.]+$/, '');
	          const cs = useLiteratureAssistantStore.getState().currentSession;
	          const isSameSession = cs && cs.id === targetSessionId;
          const rawTitle = cs?.title ? cs.title.trim() : '';
          if (isSameSession && baseName && (!rawTitle || rawTitle === '新对话')) {
            try {
              await updateSessionTitle(targetSessionId, baseName);
            } catch (e) {
              console.error('自动更新会话标题失败:', e);
	            }
	          }
	        }
          if (activeSidebarItem === 'new-chat') {
            toast.success(`《${file.name}》上传成功，请选择一个阅读模式或自定义模式开始分析。`);
          } else {
            toast.success(`${file.name} 上传成功`);
          }

	        if (activeSidebarItem === 'new-chat') {
	          setUploadedCount((prev) => prev + 1);
	        }
	      } catch (error) {
        console.error('上传失败:', error);
        toast.error(`${file.name} 上传失败`);
      }
    }

    // 所有文件处理完后，短暂保留进度条再清除
    if (activeSidebarItem === 'new-chat') {
      setTimeout(() => {
        setUploadingCount(0);
        setUploadedCount(0);
        setCurrentUploadName('');
        setCurrentUploadProgress(0);
      }, 800);
    }

    // Start New Chat 欢迎区：若选择了任务，则在上传后自动触发一次分析
	    if (activeSidebarItem === 'new-chat') {
	      if (selectedWelcomeTask && uploadedDocIds.length > 0) {
	        setTimeout(() => {
	          handleTaskClick(selectedWelcomeTask);
	        }, 500);
	      }
	    }
	  };

  const guessTitleFromUrl = (raw: string): { title?: string; filenameHint?: string } => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return {};
    const normalized = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const u = new URL(normalized);
      const host = u.hostname.toLowerCase();

      if (host === 'arxiv.org' || host === 'www.arxiv.org') {
        const pathname = u.pathname || '';
        let id = '';
        if (pathname.startsWith('/abs/')) id = pathname.slice('/abs/'.length);
        else if (pathname.startsWith('/pdf/')) id = pathname.slice('/pdf/'.length);
        id = id.replace(/\/+$/, '').replace(/\.pdf$/i, '');
        if (id) {
          const base = `arXiv-${id.replace(/\//g, '_')}`;
          return { title: base, filenameHint: `${base}.pdf` };
        }
      }

      if (host === 'openreview.net') {
        const id = u.searchParams.get('id') || u.searchParams.get('noteId') || '';
        if (id) {
          const base = `OpenReview-${id}`;
          return { title: base, filenameHint: `${base}.pdf` };
        }
      }

      if (host === 'nature.com' || host.endsWith('.nature.com')) {
        const pathname = (u.pathname || '').replace(/\/+$/, '');
        const slug = (pathname.split('/').pop() || '').replace(/\.pdf$/i, '');
        if (slug) {
          const base = `Nature-${slug}`;
          return { title: base, filenameHint: `${base}.pdf` };
        }
      }
    } catch {
      // ignore
    }
    return {};
  };

  const handleLoadFromUrl = async () => {
    const raw = urlToLoad.trim();
    if (!raw) return;
    if (isLoadingFromUrl) return;

    setIsLoadingFromUrl(true);
    const hint = guessTitleFromUrl(raw);

    if (activeSidebarItem === 'new-chat') {
      setUploadingCount(1);
      setUploadedCount(0);
      setCurrentUploadProgress(0);
      setCurrentUploadName(hint.filenameHint || raw);
    }

    try {
      let targetSessionId = currentSession?.id;

      if (!targetSessionId) {
        const session = await createSession(hint.title || undefined);
        targetSessionId = session.id;
      }

      const doc = await uploadDocumentFromUrl(targetSessionId, raw);

      // If this is effectively the first doc of a new/default session, set a nicer title
      try {
        const baseName = (doc?.original_name || '').replace(/\.pdf$/i, '');
        const cs = useLiteratureAssistantStore.getState().currentSession;
        const isSameSession = cs && cs.id === targetSessionId;
        const rawTitle = cs?.title ? cs.title.trim() : '';
        if (isSameSession && baseName && (!rawTitle || rawTitle === '新对话')) {
          await updateSessionTitle(targetSessionId, baseName);
        }
      } catch (e) {
        console.error('自动更新会话标题失败:', e);
      }

      if (activeSidebarItem === 'new-chat') {
        toast.success(`《${doc.original_name || 'PDF'}》上传成功，请选择一个阅读模式或自定义模式开始分析。`);
        setUploadedCount(1);
        if (selectedWelcomeTask) {
          setTimeout(() => {
            handleTaskClick(selectedWelcomeTask);
          }, 500);
        }
      } else {
        toast.success(`${doc.original_name || 'PDF'} 上传成功`);
      }

      setUrlToLoad('');
    } catch (error) {
      console.error('URL 导入失败:', error);
      const getServerErrorMessage = (err: unknown): string | null => {
        if (!err || typeof err !== 'object') return null;
        const maybe = err as {
          response?: { data?: { error?: unknown } };
          message?: unknown;
        };
        const serverError = maybe.response?.data?.error;
        if (typeof serverError === 'string' && serverError.trim()) return serverError.trim();
        if (typeof maybe.message === 'string' && maybe.message.trim()) return maybe.message.trim();
        return null;
      };

      const detail = getServerErrorMessage(error);
      toast.error(detail ? `URL 导入失败：${detail}` : 'URL 导入失败：仅支持 arXiv / OpenReview / Nature 链接，且需要可直接访问 PDF');
    } finally {
      setIsLoadingFromUrl(false);
      if (activeSidebarItem === 'new-chat') {
        setTimeout(() => {
          setUploadingCount(0);
          setUploadedCount(0);
          setCurrentUploadName('');
          setCurrentUploadProgress(0);
        }, 800);
      }
    }
  };

  // ...

  // Sidebar Redesign
  // ...


  const togglePinFolder = (folderId: string) => {
    setPinnedFolders((prev) => {
      const next = prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId];
      if (typeof window !== 'undefined') {
        localStorage.setItem('literature_pinned_folders', JSON.stringify(next));
      }
      return next;
    });
  };

  const handleRenameFolder = (id: string, currentName: string) => {
    setRenameFolderId(id);
    setRenameFolderValue(currentName);
    setShowRenameFolderDialog(true);
  };

  const confirmRenameFolder = async () => {
    if (!renameFolderId || !renameFolderValue.trim()) return;
    const oldId = renameFolderId;
    const newName = renameFolderValue.trim();

    if (oldId === newName) {
      setShowRenameFolderDialog(false);
      return;
    }
    if (['all', 'want-to-read', 'reading', 'completed', 'cns-favorites'].includes(newName)) {
      toast.error('该名称已被系统保留');
      return;
    }
    if (customFolders.includes(newName)) {
      toast.error('该分组名称已存在');
      return;
    }

    // 1. Update customFolders state
    setCustomFolders((prev) => prev.map((f) => (f === oldId ? newName : f)));

    // 2. Update sessions
    const affected = sessions.filter((s) => s.status === oldId);
    try {
      if (affected.length > 0) {
        await Promise.all(
          affected.map((s) =>
            literatureAssistantAPI.updateSession(s.id, { status: newName })
          )
        );
        await loadSessions();
      }
      toast.success(`重命名成功：${newName}`);
    } catch (e) {
      console.error(e);
      toast.error('重命名更新文献状态失败');
    }

    if (currentFolder === oldId) setCurrentFolder(newName);

    // Update pinned if needed
    if (pinnedFolders.includes(oldId)) {
      setPinnedFolders((prev) => {
        const next = prev.map((p) => (p === oldId ? newName : p));
        if (typeof window !== 'undefined') {
          localStorage.setItem('literature_pinned_folders', JSON.stringify(next));
        }
        return next;
      });
    }

    setShowRenameFolderDialog(false);
  };


  const handleCreateFolder = () => {
    setCreateFolderValue('');
    setSessionToMoveId(null);
    setShowCreateFolderDialog(true);
  };

  const confirmCreateFolder = () => {
    const trimmed = createFolderValue.trim();
    if (!trimmed) return;
    if (['all', 'want-to-read', 'reading', 'completed', 'cns-favorites'].includes(trimmed)) {
      toast.error('该名称已被系统保留，请使用其他名称');
      return;
    }
    setCustomFolders((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    );

    if (sessionToMoveId) {
        handleUpdateSessionStatus(sessionToMoveId, trimmed);
        setSessionToMoveId(null);
        toast.success(`已创建分组并移动文献：${trimmed}`);
    } else {
        toast.success(`已创建分组：${trimmed}`);
    }

    setShowCreateFolderDialog(false);
    setCurrentFolder(trimmed);
  };

  const handleDeleteFolder = (folderId: string) => {
    if (['all', 'want-to-read', 'reading', 'completed', 'cns-favorites'].includes(folderId)) {
      toast.error('系统默认分组不可删除');
      return;
    }
    const affected = sessions.filter((s) => s.status === folderId);
    if (affected.length === 0) {
      // 仅删除空分组
      setCustomFolders((prev) => prev.filter((id) => id !== folderId));
      if (currentFolder === folderId) setCurrentFolder('all');
      toast.success(`已删除分组：${folderId}`);
      return;
    }
    
    setDeleteFolderId(folderId);
    setShowDeleteFolderDialog(true);
  };

  const confirmDeleteFolder = async (deleteFiles: boolean) => {
    if (!deleteFolderId) return;
    const folderId = deleteFolderId;
    const affected = sessions.filter((s) => s.status === folderId);

    try {
      if (!deleteFiles) {
        // 保留文献并移动到 All Publications
        await Promise.all(
            affected.map((s) =>
            literatureAssistantAPI.updateSession(s.id, { status: undefined })
            )
        );
      } else {
        // 删除文献
        await Promise.all(affected.map((s) => literatureAssistantAPI.deleteSession(s.id)));
      }
      
      setCustomFolders((prev) => prev.filter((id) => id !== folderId));
      if (currentFolder === folderId) {
        setCurrentFolder('all');
      }
      await loadSessions();
      toast.success(`已删除分组：${folderId}（${!deleteFiles ? '文献已保留' : '文献已删除'}）`);
    } catch (error) {
      console.error('删除分组失败:', error);
      toast.error('删除分组失败');
    }
    setShowDeleteFolderDialog(false);
  };

  const handleOpenRenameSession = (session: any) => {
      setRenameSessionId(session.id);
      setRenameSessionValue(session.title || '');
      setShowRenameSessionDialog(true);
  };

  const confirmRenameSession = async () => {
      if (!renameSessionId) return;
      const val = renameSessionValue.trim();
      if (!val) return;
      
      try {
          await updateSessionTitle(renameSessionId, val);
          toast.success("标题已更新");
          setShowRenameSessionDialog(false);
      } catch (e) {
          console.error("重命名失败:", e);
          toast.error("重命名失败");
      }
  };

  const handleUpdateSessionStatus = async (sessionId: string, status: string | null) => {
    try {
      await literatureAssistantAPI.updateSession(sessionId, {
        status: status === null ? undefined : status
      });
      await loadSessions();
      if (currentSession?.id === sessionId) {
        await loadSession(sessionId);
      }
      toast.success('状态已更新');
    } catch (error) {
      console.error('更新状态失败:', error);
      toast.error('更新状态失败');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // 打开「CNS / Arxiv 收藏」中的文章：
  // 若已存在对应的文献助手会话，则直接切到 Reading；
  // 否则创建新会话并自动挂载 CNS 中的 PDF。
  const handleOpenCnsFavoriteArticle = async (article: any) => {
    try {
      const articleId = Number(article?.id);
      if (!Number.isFinite(articleId)) {
        toast.error('无法识别该收藏文章');
        return;
      }

      // 1. 先在现有会话中查找是否已经为该 CNS 文章创建过会话
      const existing = sessions.find((s) => {
        if (!s || !s.config) return false;
        try {
          const cfg =
            typeof s.config === 'string'
              ? JSON.parse(s.config || '{}')
              : (s.config as any);
          if (!cfg || cfg.source !== 'cns') return false;
          const id = Number((cfg as any).articleId);
          if (!Number.isFinite(id)) return false;
          const docCount =
            typeof s.documentCount === 'number'
              ? s.documentCount
              : (s.documents?.length || 0);
          return id === articleId && docCount > 0;
        } catch {
          return false;
        }
      });

      if (existing) {
        await handleOpenInReading(existing.id);
        return;
      }

      // 2. 若尚未创建会话，则需要 CNS 侧已经有 PDF
      const pdfPath = article?.pdf_path;
      if (!pdfPath) {
        toast.info('该文献尚未上传 PDF，请在 CNS 文献库中上传后再进行 AI 阅读');
        return;
      }
      const filename = String(pdfPath).split('/').pop();
      if (!filename) {
        toast.error('未找到 PDF 文件名');
        return;
      }

      // 3. 在文献助手中创建新会话，并写入来源信息（与 CNSLibrary 保持一致）
      const title =
        (article?.title || article?.title_zh || '文献详读').slice(0, 80);
      const session = await literatureAssistantAPI.createSession({
        title,
        config: {
          source: 'cns',
          articleId,
          journal: article?.journal || null,
          link: article?.link || null,
          doi: article?.doi || null,
          pdfFilename: filename
        }
      } as any);

      // 4. 从 CNS 获取 PDF 并挂载到新会话
      const resp = await fetch(`/api/cns/pdf/${encodeURIComponent(filename)}`);
      if (!resp.ok) {
        throw new Error(`PDF 获取失败: HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const file = new File([blob], filename, { type: 'application/pdf' });
      await literatureAssistantAPI.uploadDocument(session.id, file);

      // 5. 刷新列表并进入 Reading 视图
      await loadSessions();
      await handleOpenInReading(session.id);
      toast.success('已为该收藏文献创建文献助手会话');
    } catch (e: any) {
      console.error('打开 CNS 收藏文献失败:', e);
      toast.error(e?.message || '打开 CNS 收藏文献失败');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentSession) return;
    if (isSending) return;

    setChatError(null); // 清除之前的错误提示
    const message = inputMessage;
    setInputMessage('');
    setAutoScrollEnabled(true); // 发送后默认跟随到底部，用户向上滚动可随时取消

    try {
      console.log('发送消息:', message);
      // 直接对话模式，不使用 taskType
      await sendMessage(currentSession.id, message, undefined);
      console.log('消息发送完成');
    } catch (error) {
      console.error('发送消息失败:', error);
      const errorMsg = error instanceof Error ? error.message : '发送消息失败';
      setError(errorMsg);
      setChatError({ message: errorMsg, userText: message });
    }
  };

	  const handleTaskClick = async (taskType: string) => {
	    // 使用最新的 store 状态，避免在「上传后自动触发分析」等场景下闭包拿到旧 documents/currentSession
	    const latestState = useLiteratureAssistantStore.getState();
	    const latestSession = latestState.currentSession || currentSession;
	    const latestDocs = latestState.documents || documents;
	    const latestConfig = latestState.config || config;
	    const latestSummaryProvider = latestState.summaryProvider || summaryProvider;

	    if (!latestSession) {
	      toast.error('请先创建对话');
	      return;
	    }
	    
	    if (latestDocs.length === 0) {
	      toast.error('请先上传 PDF 文档');
	      return;
	    }
	    if (isSending) return;

	    // 图文报告需要多模态模型，检查当前模型是否支持
	    if (taskType === 'image_report') {
	      const currentProvider = latestSummaryProvider || latestConfig?.defaultProvider || '';
	      const detail = latestConfig?.providersDetail?.[currentProvider];
	      const isCurrentMultimodal = detail?.multimodal ?? false;
	      
	      if (!isCurrentMultimodal) {
	        // 弹出 Dialog 提示用户重新选择模型
        setPendingTaskType(taskType);
        setShowModelMismatchDialog(true);
	        return;
	      }
	    }

		    setAnalyzingSessionId(latestSession.id);
		    setAnalysisError(null);
		    setShowUploadArea(false); // 自动折叠上传区域
		    setActiveSidebarItem('reading');
		    // 新生成总结时默认回到最新版本
		    setSummaryVersionIndex(null);
		    setShowRightPanel(true);
	    setRightPanelTab('assistant');
	    if (latestDocs.length > 0) {
	      const latestDoc = latestDocs[latestDocs.length - 1];
	      setSelectedPDF(latestDoc.id);
	    }
	    try {
	      console.log('开始分析，任务类型:', taskType);
	      // 使用左侧 Blog 专用通道流式生成总结，不在右侧 Assistant 输出
		      await regenerateSummary(latestSession.id, taskType);
		      console.log('分析完成');
		      setShowChatInput(true); // 分析完成后显示输入框供追问
		    } catch (error) {
	      console.error('分析失败:', error);
	      const errorMsg = error instanceof Error ? error.message : '分析失败';
	      setError(errorMsg);
	      setAnalysisError({ message: errorMsg, taskType });
	    } finally {
	      setAnalyzingSessionId(prev => prev === latestSession.id ? null : prev);
	    }
	  };

  const handleRunCustomPrompt = async (prompt: string) => {
    if (!currentSession) {
      toast.error('请先创建对话');
      return;
    }

    if (documents.length === 0) {
      toast.error('请先上传 PDF 文档');
      return;
    }

    if (isSending) return;

	    setAnalyzingSessionId(currentSession.id);
	    setAnalysisError(null);
	    setShowUploadArea(false);
	    setActiveSidebarItem('reading');
	    // 自定义 Prompt 生成新总结时也回到最新版本
	    setSummaryVersionIndex(null);
	    setShowRightPanel(true);
    setRightPanelTab('assistant');
    if (documents.length > 0) {
      const latestDoc = documents[documents.length - 1];
      setSelectedPDF(latestDoc.id);
    }

    try {
      // 自定义 Prompt 也走 Blog 通道，确保流式总结
      await regenerateSummary(currentSession.id, 'custom', prompt);
      setShowChatInput(true);
    } catch (error) {
      console.error('分析失败:', error);
      const errorMsg = error instanceof Error ? error.message : '分析失败';
      setError(errorMsg);
      setAnalysisError({ message: errorMsg });
    } finally {
      setAnalyzingSessionId(prev => prev === currentSession.id ? null : prev);
    }
  };

  const handleOpenPdfInNewTab = async (sessionId: string) => {
    try {
      // 优先从全局 documents 中按 session_id 过滤，保证链接最新
      const fromStore = documents.filter((d) => d.session_id === sessionId);
      let target = fromStore[0];
      if (!target) {
        const session = sessions.find((s) => s.id === sessionId);
        const inlineDocs = session?.documents || [];
        target = inlineDocs[0];
      }
      if (!target) {
        toast.error('当前文献暂无可预览的 PDF');
        return;
      }
      
      try {
        const blob = await literatureAssistantAPI.getDocument(target.id);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        // Note: URL revocation is tricky for new tabs, relying on browser cleanup
      } catch (e) {
        console.error('获取 PDF 失败:', e);
        toast.error('无法打开 PDF');
      }
    } catch (e) {
      console.error('打开 PDF 失败:', e);
      toast.error('打开 PDF 失败');
    }
  };

  const handleDirectChat = () => {
    if (!currentSession) {
      toast.error('请先创建对话');
      return;
    }
    setShowChatInput(true);
    setSelectedTaskType(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 避免中文输入法选字时误触发送：组合键或非组合键都需排除 composition 状态
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSessionSize = (session: any) => {
    const bytes = typeof session.totalFileSize === 'number'
      ? session.totalFileSize
      : (session.documents || []).reduce((sum: number, d: any) => sum + (d.file_size || 0), 0);
    if (!bytes || bytes <= 0) return '0 B';
    return formatFileSize(bytes);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getDefaultReadingTaskType = (): string | null => {
    const taskMap = prompts?.tasks;
    if (!taskMap) return null;
    if (taskMap['deep_dive']) return 'deep_dive';
    if (taskMap['summary']) return 'summary';
    const keys = Object.keys(taskMap).filter((k) => k !== 'titleGeneration');
    return keys[0] || null;
  };

  // 控制标题显示长度（仅用于展示，不改变真实标题）
  const truncateTitle = (text: string, max = 10) => {
    try {
      const s = (text || '').trim();
      if (s.length <= max) return s;
      return s.slice(0, max) + '…';
    } catch {
      return text;
    }
  };

  // 监听会话删除后的空白状态：自动切换到最新会话或新建一个，避免卡在占位
  useEffect(() => {
    if (activeSidebarItem !== 'reading') return;
    if (!currentSession && sessions && sessions.length > 0) {
      loadSession(sessions[0].id).then(() => {
        const latestMessages = useLiteratureAssistantStore.getState().messages;
        setShowChatInput((latestMessages?.length || 0) > 0);
      });
    }
    // 不再自动新建会话：仅在用户点击“新建”或执行上传时按需创建
  }, [currentSession, sessions, loadSession, activeSidebarItem]);

  // 同步 PDF 预览与当前会话文档：当会话或文档变化时，确保预览不显示旧会话的文档
  useEffect(() => {
    if (!currentSession) {
      setSelectedPDF(null);
      setShowPDFViewer(false);
      return;
    }
    if (showPDFViewer) {
      const exists = documents.some(d => d.id === selectedPDF);
      if (!exists) {
        if (documents.length > 0) {
          setSelectedPDF(documents[0].id);
        } else {
          setSelectedPDF(null);
          setShowPDFViewer(false);
        }
      }
    } else {
      // 预览关闭时，避免保留上一个会话选择
      if (selectedPDF && !documents.some(d => d.id === selectedPDF)) {
        setSelectedPDF(documents.length > 0 ? documents[0].id : null);
      }
    }
  }, [currentSession?.id, documents, showPDFViewer]);

  // Sync Right Panel State
  useEffect(() => {
    if (showPDFViewer) setRightPanelTab('paper');
  }, [showPDFViewer]);
  
  useEffect(() => {
    if (showToolPanel) setRightPanelTab('assistant');
  }, [showToolPanel]);

  // 首次回答后自动 AI 命名（仅针对标题为“新对话”或空的会话且未命名过）
  useEffect(() => {
    const shouldAutoRename = async () => {
      if (!currentSession) return;
      if (isSending) return;
      // 标题为空或默认名
      const rawTitle = (currentSession.title || '').trim();
      const isDefaultTitle = rawTitle === '' || rawTitle === '新对话';
      if (!isDefaultTitle) return;
      // 至少有一条助手回复
      const hasAssistant = messages.some(m => m.role === 'assistant' && (m.content || '').trim().length > 0);
      if (!hasAssistant) return;
      // 避免重复
      if (autoRenamedSessionId === currentSession.id) return;
      try {
        await aiRenameCurrentSession();
        setAutoRenamedSessionId(currentSession.id);
      } catch (e) {
        // 静默失败，不影响主流程
      }
    };
    shouldAutoRename();
  }, [isSending, messages, currentSession, aiRenameCurrentSession, autoRenamedSessionId]);

  // 切换会话时重置自动命名标记（新会话允许再次自动命名）
  useEffect(() => {
    if (currentSession && autoRenamedSessionId !== currentSession.id) {
      // 不做强制重置，只在首次命名后记录；切会话时如果新会话未命名则会再次触发
    }
  }, [currentSession?.id]);

  // Load notes from session.config JSON
  useEffect(() => {
    if (!currentSession) {
      setNotes('');
      setNotesDirty(false);
      setNotesError(null);
      return;
    }
    const raw = currentSession.config;
    if (!raw) {
      setNotes('');
      setNotesDirty(false);
      setNotesError(null);
      return;
    }
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
      const value = typeof parsed.notes === 'string' ? parsed.notes : '';
      setNotes(value);
      setNotesDirty(false);
      setNotesError(null);
    } catch {
      // 如果解析失败，不阻塞主流程，仅清空本地笔记并提示一次
      setNotes('');
      setNotesDirty(false);
      setNotesError('无法解析现有笔记配置，将在保存时重置为新内容');
    }
  }, [currentSession?.id, currentSession?.config]);

  // Load and persist user-defined custom folders in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('literature_custom_folders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCustomFolders(
            parsed.filter(
              (v: unknown) => typeof v === 'string' && v.trim().length > 0
            )
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        'literature_custom_folders',
        JSON.stringify(customFolders)
      );
    } catch {
      // ignore
    }
  }, [customFolders]);

  const handleSaveNotes = async () => {
    if (!currentSession || !notesDirty) return;
    setNotesSaving(true);
    setNotesError(null);
    try {
      let cfg: any = {};
      const raw = currentSession.config;
      if (raw) {
        try {
          cfg = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
        } catch {
          cfg = {};
        }
      }
      cfg.notes = notes;
      await literatureAssistantAPI.updateSession(currentSession.id, { config: cfg });
      // 刷新会话与列表，保持前端状态一致
      await loadSession(currentSession.id);
      await loadSessions();
      setNotesDirty(false);
      toast.success('笔记已保存');
    } catch (error) {
      console.error('保存笔记失败:', error);
      const msg = error instanceof Error ? error.message : '保存笔记失败';
      setNotesError(msg);
      toast.error(msg);
    } finally {
      setNotesSaving(false);
    }
  };

  // 左侧任务中心：根据会话与流式状态推断任务进度（分析中 / 已完成 / 阅读中 等）
  const getSessionTaskStatus = (session: any) => {
    const streamingState = backgroundStreaming?.[`summary-${session.id}`];
    // 仅统计左侧 Summary（文献总结）流式任务，不包含右侧 Assistant 聊天
    const hasSummaryStreaming =
      !!streamingState &&
      (streamingState as any).kind === 'summary' &&
      streamingState.isFinal === false;
    const isCurrent = currentSession?.id === session.id;
    const docCount =
      typeof session.documentCount === 'number'
        ? session.documentCount
        : (session.documents?.length || 0);
    const blogMsgCount =
      typeof (session as any).blogMessageCount === 'number'
        ? (session as any).blogMessageCount
        : 0;

    if (hasSummaryStreaming || analyzingSessionId === session.id) {
      return {
        label: '分析中',
        pillClass: 'bg-teal-400/90'
      };
    }
    if (blogMsgCount > 0 || session.status === 'completed') {
      return {
        label: '已完成',
        pillClass: 'bg-emerald-400/90'
      };
    }
    if (session.status === 'reading' || (!session.status && docCount > 0)) {
      return {
        label: '阅读中',
        pillClass: 'bg-sky-400/90'
      };
    }
    if (session.status === 'want-to-read') {
      return {
        label: '待开始',
        pillClass: 'bg-slate-400/80'
      };
    }
    return {
      label: '草稿',
      pillClass: 'bg-slate-600/80'
    };
  };

  // Quick task list for the左侧任务中心弹窗：仅展示有文献的最近会话
  const taskSessions = sessions
    .filter((session) => {
      const docCount =
        typeof session.documentCount === 'number'
          ? session.documentCount
          : (session.documents?.length || 0);
      return docCount > 0;
    })
    .sort((a, b) => {
      const ta = (a.updated_at || a.created_at || 0) as number;
      const tb = (b.updated_at || b.created_at || 0) as number;
      return tb - ta;
    });

  const quickTaskSessions = taskSessions.slice(0, 10);
  const runningTaskCount = taskSessions.filter(
    (s) => getSessionTaskStatus(s).label === '分析中'
  ).length;

  // 打开任务中心时强制刷新最新会话列表，避免依赖旧缓存
  useEffect(() => {
    if (!taskCenterOpen) return;
    loadSessions().catch(() => {
      // 静默失败即可，弹窗仍可使用现有数据
    });
  }, [taskCenterOpen, loadSessions]);

  // 当重新进入存在后台流式的会话时，优先用本地 buffer 复原内容（无需等后端落库）
  useEffect(() => {
    if (!currentSession) return;
    const buf = backgroundStreaming?.[`summary-${currentSession.id}`];
    // 只对 Summary 任务的流式缓冲做复原；右侧 Assistant 聊天不计入任务中心/流式恢复
    if (!buf || (buf as any).kind !== 'summary') return;

    // 对于已经完成的 Summary，优先依赖后端落库的消息，不再在前端强行覆盖；
    // 这里只兜底更新「正在分析」提示状态，避免把 Summary 误当作 Assistant 对话显示出来。
    if (buf.isFinal) {
      setAnalyzingSessionId(prev => prev === currentSession.id ? null : prev);
      return;
    }

    // 当重新进入有流式缓冲的会话时，用本地 buffer 覆盖/补齐当前消息，
    // 避免必须等待后端落库或手动刷新。
    useLiteratureAssistantStore.setState((state) => {
      // 仅在当前会话下应用
      if (!state.currentSession || state.currentSession.id !== currentSession.id) return state;
      const exists = state.messages.some((m) => m.id === buf.id);
      const updatedMessages = exists
        ? state.messages.map((m) =>
            m.id === buf.id
              ? {
                  ...m,
                  content: buf.content,
                  // 保留已有 metadata；如不存在，则显式标记为 Summary 流式消息，
                  // 以便左右两侧的过滤逻辑能够正确识别并排除出 Assistant 对话。
                  metadata:
                    m.metadata ||
                    JSON.stringify({
                      streaming: !buf.isFinal,
                      taskType: (buf as any).taskType || 'summary'
                    })
                }
              : m
          )
        : [
            ...state.messages,
            {
              id: buf.id,
              session_id: currentSession.id,
              role: 'assistant',
              content: buf.content,
              metadata: JSON.stringify({
                streaming: !buf.isFinal,
                taskType: (buf as any).taskType || 'summary'
              }),
              created_at: Date.now()
            } as Message
          ];
      return {
        messages: updatedMessages
      };
    });
    if (!buf.isFinal) {
      setAutoScrollEnabled(true);
      // 如果当前会话存在未完成的流式任务，确保顶部「正在分析」提示与任务中心状态保持一致
      setAnalyzingSessionId(currentSession.id);
    } else {
      // 流式已结束但可能尚未触发本地 finally 块时，兜底关闭「正在分析」提示
      setAnalyzingSessionId(prev => prev === currentSession.id ? null : prev);
    }
  }, [currentSession?.id, backgroundStreaming]);

  // 当 session 处于 analyzing 状态时，自动轮询刷新
  useEffect(() => {
    if (!currentSession) return;
    if (currentSession.analysis_status !== 'analyzing') return;
    
    const pollInterval = setInterval(async () => {
      try {
        await loadSession(currentSession.id);
      } catch (err) {
        console.warn('[Polling] Failed to refresh session:', err);
      }
    }, 5000); // 每 5 秒轮询一次
    
    return () => clearInterval(pollInterval);
  }, [currentSession?.id, currentSession?.analysis_status, loadSession]);

  // Filter messages for the Assistant view
  const visibleMessages = React.useMemo(() => {
    return messages.filter((msg, index, allMessages) => {
      // 右侧 Assistant 仅展示「普通对话」：
      // - 所有非空 user 消息
      // - 元数据中没有 taskType / customPrompt 的 assistant 消息
      if (msg.role === 'user') {
        return msg.content && msg.content.trim().length > 0;
      }
      if (msg.role === 'assistant') {
        if (!msg.content || msg.content.trim().length === 0) return false;
        // 过滤掉用于左侧 Blog 的总结类消息
        try {
          const meta = msg.metadata ? JSON.parse(msg.metadata as any) : {};
          if (meta && (meta.taskType || meta.customPrompt)) {
            return false;
          }
        } catch {
          // 元数据解析失败时按普通对话处理
        }
        // 仅当前面存在触发它的 user 消消息时才显示
        for (let i = index - 1; i >= 0; i--) {
          if (allMessages[i].role === 'user') {
            return allMessages[i].content && allMessages[i].content.trim().length > 0;
          }
        }
        return false;
      }
      return false;
    });
  }, [messages]);

  const lastUserMessageId = React.useMemo(() => {
      const lastUser = [...visibleMessages].reverse().find(m => m.role === 'user');
      return lastUser ? lastUser.id : null;
  }, [visibleMessages]);

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback: Oops, unable to copy', err);
          throw new Error('Copy failed');
        }
        document.body.removeChild(textArea);
      }
      toast.success('已复制到剪贴板');
    } catch (err) {
      console.error('Copy failed', err);
      toast.error('复制失败');
    }
  };

  const handleCopy = (text: string) => {
      copyToClipboard(text);
  };

  const handleRewindAndSend = async (originalMsgId: string, newContent: string) => {
    if (!currentSession) return;
    const state = useLiteratureAssistantStore.getState();
    const allMessages = state.messages;
    const index = allMessages.findIndex(m => m.id === originalMsgId);
    
    if (index !== -1) {
        // Delete the original message and all subsequent messages
        const toDelete = allMessages.slice(index).map(m => m.id);
        // Execute deletions sequentially to ensure consistency
        for (const id of toDelete) {
            await state.deleteMessage(id);
        }
    }
    
    // Send the new message
    sendMessage(currentSession.id, newContent);
  };

  const handleResend = async (text: string, msgId: string) => {
      await handleRewindAndSend(msgId, text);
  };

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const handleEditStart = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleEditConfirm = async (oldMsgId: string) => {
    if (!editingContent.trim() || !currentSession) return;
    
    await handleRewindAndSend(oldMsgId, editingContent);
    
    setEditingMessageId(null);
    setEditingContent('');
  };

  return (
    <DashboardLayout hideSidebar={!showMainSidebar} fullScreen={true}>
      <div className="h-full w-full overflow-hidden bg-background relative font-sans flex">
        
        {/* 1. Navigation Rail (Leftmost) - Modern Dark Tech Style */}
        <div className="w-[68px] flex flex-col items-center py-6 bg-card dark:bg-[#0F172A] border-r border-border text-muted-foreground gap-6 z-20 shrink-0 shadow-sm transition-colors duration-300">
            <div className="flex flex-col gap-4 w-full items-center">
                <div 
                    className="h-10 w-10 rounded-xl flex items-center justify-center mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/applications')}
                    title="返回应用中心"
                >
                    <img src={logo} alt="Logo" className="h-8 w-8 object-contain" />
                </div>
                
                <Button 
                    variant="ghost"
                    size="icon" 
                    className={cn("rounded-xl h-10 w-10 transition-all duration-200", activeSidebarItem === 'new-chat' ? "bg-teal-600 text-white shadow-lg shadow-teal-900/20" : "hover:bg-accent hover:text-accent-foreground")}
                    onClick={handleCreateSession}
                    title="New Chat"
                >
                    <Plus className="h-5 w-5" />
                </Button>
                
                <Button 
                    variant="ghost"
                    size="icon" 
                    className={cn("rounded-xl h-10 w-10 transition-all duration-200", activeSidebarItem === 'library' ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground")}
                    onClick={() => setActiveSidebarItem('library')}
                    title="Library"
                >
                    <Library className="h-5 w-5" />
                </Button>

                <Button 
                    variant="ghost"
                    size="icon" 
                    className={cn("rounded-xl h-10 w-10 transition-all duration-200", activeSidebarItem === 'reading' ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground")}
                    onClick={async () => {
                      await maybeRestorePreviousSessionFromNewChatDraft();
                      setActiveSidebarItem('reading');
                    }}
                    title="Reading"
                >
                    <BookOpen className="h-5 w-5" />
                </Button>

                <Button 
                    variant="ghost"
                    size="icon" 
                    className={cn("rounded-xl h-10 w-10 transition-all duration-200", activeSidebarItem === 'community' ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20" : "hover:bg-accent hover:text-accent-foreground")}
                    onClick={async () => {
                      setActiveSidebarItem('community');
                      // 首次进入时加载分享设置
                      if (!communitySettings) {
                        await loadCommunitySettings();
                      }
                      // 加载公开文献列表
                      loadPublicSessions();
                    }}
                    title="大家看"
                >
                    <Users className="h-5 w-5" />
                </Button>

                <Button 
                    variant="ghost"
                    size="icon" 
                    className={cn("rounded-xl h-10 w-10 transition-all duration-200", activeSidebarItem === 'user-data' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "hover:bg-accent hover:text-accent-foreground")}
                    onClick={() => setActiveSidebarItem('user-data')}
                    title="用户数据"
                >
                    <BarChart3 className="h-5 w-5" />
                </Button>
            </div>
            
            <div className="mt-auto flex flex-col gap-4 w-full items-center">
              {/* Quick Task Center - 历史对话 / 阅读任务切换器 */}
              <Popover open={taskCenterOpen} onOpenChange={setTaskCenterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'relative h-10 w-10 rounded-xl hover:bg-accent hover:text-accent-foreground',
                      taskCenterOpen && 'bg-accent text-accent-foreground'
                    )}
                    title="阅读任务中心"
                  >
                    <Clock className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  className="w-80 p-3 bg-slate-950/95 border-slate-800 shadow-2xl rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Reading Tasks
                      </p>
                      <p className="text-xs text-slate-200">历史对话 · 阅读进度一览</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-900 text-[10px] font-semibold px-2 py-0.5 text-slate-300"
                    >
                      {taskSessions.length || 0} 个会话
                    </Badge>
                  </div>

                  {quickTaskSessions.length === 0 ? (
                    <div className="py-6 text-[11px] text-slate-400 text-center">
                      暂无历史阅读会话
                      <br />
                      上传 PDF 后，这里会显示每个阅读任务的进度。
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 max-h-80 overflow-y-auto pt-1 space-y-0.5">
                        {quickTaskSessions.map((session) => {
                          const status = getSessionTaskStatus(session as any);
                          return (
                            <button
                              key={session.id}
                              type="button"
                              className={cn(
                                'w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-slate-900/60',
                                currentSession?.id === session.id && 'bg-slate-900'
                              )}
                              onClick={async () => {
                                await handleOpenInReading(session.id);
                                setTaskCenterOpen(false);
                              }}
                            >
                              <span
                                className={cn(
                                  'inline-flex h-2 w-2 rounded-full flex-shrink-0',
                                  status.pillClass
                                )}
                              />
                              <span className="truncate text-slate-50">
                                {session.title || '未命名会话'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                          onClick={() => {
                            setActiveSidebarItem('library');
                            setTaskCenterOpen(false);
                          }}
                        >
                          查看全部文献
                        </Button>
                        <span className="text-[10px] text-slate-500">
                          点击任意任务即可快速切换阅读上下文
                        </span>
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl hover:bg-accent hover:text-accent-foreground"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </div>
        </div>

        {/* 2. Main Content Area (Switches based on activeSidebarItem) */}
        {activeSidebarItem === 'library' ? (
            <div className="flex-1 flex h-full overflow-hidden min-w-0 bg-muted/30 dark:bg-background">
                {/* Library Sidebar (Folders) - Structured & Clean */}
                <div className="w-64 shrink-0 border-r border-border bg-card dark:bg-[#0F172A] flex flex-col">
                    <div className="p-5 flex items-center justify-between">
                         <Button
                           variant="outline"
                           className="w-full justify-start text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground gap-2 rounded-lg h-10 text-sm font-medium transition-all"
                           onClick={handleCreateFolder}
                         >
                            <Plus className="h-4 w-4 text-teal-600 dark:text-teal-400" /> New Folder
                         </Button>
                    </div>
                    <ScrollArea className="flex-1 px-3">
                        <div className="mb-6">
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Library</div>
                            <div 
                                className={cn(
                                    "flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm font-medium mb-1",
                                    currentFolder === 'all' 
                                        ? "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300" 
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                                onClick={() => setCurrentFolder('all')}
                            >
                                <div className="flex items-center gap-3">
                                    <BookOpen className={cn("h-4 w-4", currentFolder === 'all' ? "text-teal-600" : "text-muted-foreground")} />
                                    <span>All Publications</span>
                                </div>
                                {/* 仅统计真正有文献的会话数量，保证与 Collections 中各分组总和一致 */}
                                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", currentFolder === 'all' ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40" : "bg-muted text-muted-foreground")}>{folderCounts.all}</span>
                            </div>
                        </div>

                        <div>
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Collections</div>
                            <div className="space-y-1">
                                {folders
                                  .filter((f) => f.id !== 'all')
                                  .sort((a, b) => {
                                    const aPinned = pinnedFolders.includes(a.id);
                                    const bPinned = pinnedFolders.includes(b.id);
                                    if (aPinned && !bPinned) return -1;
                                    if (!aPinned && bPinned) return 1;
                                    return 0;
                                  })
                                  .map((folder) => {
                                    const isPinned = pinnedFolders.includes(folder.id);
                                    const isCustom = customFolderIds.includes(folder.id);

                                    return (
                                      <div
                                        key={folder.id}
                                        className={cn(
                                          'group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm font-medium',
                                          currentFolder === folder.id
                                            ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                        )}
                                        onClick={() => setCurrentFolder(folder.id)}
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="relative shrink-0">
                                            <folder.icon
                                              className={cn(
                                                'h-4 w-4',
                                                currentFolder === folder.id
                                                  ? 'text-teal-600'
                                                  : 'text-muted-foreground'
                                              )}
                                            />
                                            {isPinned && (
                                              <div className="absolute -top-1 -right-1">
                                                <Pin className="h-2 w-2 text-teal-500 fill-teal-500" />
                                              </div>
                                            )}
                                          </div>
                                          <span className="truncate">{folder.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-muted-foreground/70">
                                            {folder.count}
                                          </span>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700 focus:opacity-100"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <MoreHorizontal className="h-3 w-3" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              align="end"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  togglePinFolder(folder.id);
                                                }}
                                              >
                                                {isPinned ? (
                                                  <>
                                                    <PinOff className="h-3.5 w-3.5 mr-2" />
                                                    Unpin
                                                  </>
                                                ) : (
                                                  <>
                                                    <Pin className="h-3.5 w-3.5 mr-2" />
                                                    Pin to top
                                                  </>
                                                )}
                                              </DropdownMenuItem>

                                              {isCustom && (
                                                <>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleRenameFolder(
                                                        folder.id,
                                                        folder.name
                                                      );
                                                    }}
                                                  >
                                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                                    Rename
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleDeleteFolder(folder.id);
                                                    }}
                                                    className="text-red-600 focus:text-red-600"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                    Delete
                                                  </DropdownMenuItem>
                                                </>
                                              )}
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </div>
                                    );
                                  })}
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                {/* Library Main Content (Grid/List) */}
                <div className="flex-1 flex flex-col relative min-w-0 bg-muted/5 dark:bg-background">
                    {/* Top Toolbar */}
                    <div className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-10">
                        <div className="flex items-center gap-4 flex-1 max-w-xl">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input 
                                    type="text" 
                                    placeholder="Search documents..." 
                                    value={librarySearch}
                                    onChange={(e) => setLibrarySearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-muted-foreground/50"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                             <Button
                               className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-5 shadow-sm shadow-teal-200 dark:shadow-none font-medium"
                               onClick={() => fileInputRef.current?.click()}
                             >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload PDF
                             </Button>
                             <div className="h-6 w-px bg-border mx-2" />
                             <div className="flex items-center bg-muted rounded-lg p-1">
                                 <Button variant={libraryViewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className={cn("h-8 w-8 p-0 rounded-md", libraryViewMode === 'list' && "bg-background shadow-sm")} onClick={() => setLibraryViewMode('list')}><Layout className="h-4 w-4" /></Button>
                                 <Button variant={libraryViewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className={cn("h-8 w-8 p-0 rounded-md", libraryViewMode === 'grid' && "bg-background shadow-sm")} onClick={() => setLibraryViewMode('grid')}><Grid className="h-4 w-4" /></Button>
                             </div>
                        </div>
                    </div>
                    
                    {/* File List Header */}
                    <div className="flex-1 min-h-0 overflow-auto">
                      <div className="h-full flex flex-col min-w-[720px]">
                        <div className="sticky top-0 z-10 mx-4 px-6 py-3 grid grid-cols-[minmax(200px,1fr)_140px_100px_140px] gap-4 items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/30">
                          <div>文献名称</div>
                          <div className="text-center whitespace-nowrap">添加日期</div>
                          <div className="text-center whitespace-nowrap">大小</div>
                          <div className="text-center whitespace-nowrap">分析状态</div>
                        </div>

                        <div className="flex-1 bg-muted/5 dark:bg-background">
                          <div className="flex flex-col py-2 gap-1 relative">
                            {/* 已有文献助手会话的行 */}
                            {sessions
                              .filter((session) => {
                                const docCount =
                                  typeof session.documentCount === 'number'
                                    ? session.documentCount
                                    : (session.documents?.length || 0);
                                return docCount > 0;
                              })
                              .filter((session) => {
                                if (!librarySearch.trim()) return true;
                                const title = (session.title || '').toLowerCase();
                                return title.includes(librarySearch.trim().toLowerCase());
                              })
                              .filter((session) => {
                                if (currentFolder === 'all') return true;
                                if (currentFolder === 'cns-favorites') {
                                  return isCnsFavoriteSession(session);
                                }
                                const status = session.status || 'active';
                                if (currentFolder === 'reading') {
                                  return status === 'reading' || status === 'active';
                                }
                                return status === currentFolder;
                              })
                              .map((session) => (
                                <div
                                  key={session.id}
                                  className={cn(
                                    "group grid grid-cols-[minmax(200px,1fr)_140px_100px_140px] gap-4 items-center px-6 py-3 cursor-pointer transition-all rounded-lg border border-transparent mx-4",
                                    selectedFileId === session.id
                                      ? "bg-white dark:bg-slate-800 border-teal-200 dark:border-teal-900 shadow-sm"
                                      : "hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
                                  )}
                                  onClick={() => handleOpenFile(session.id)}
                                >
                                  <div className="flex items-center gap-4">
                                    <button
                                      type="button"
                                      className={cn(
                                        "h-10 w-10 rounded-lg flex items-center justify-center transition-colors border flex-shrink-0",
                                        selectedFileId === session.id
                                          ? "bg-teal-50 border-teal-100 text-teal-600 dark:bg-teal-900/20 dark:border-teal-900"
                                          : "bg-white border-slate-200 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600 dark:bg-slate-900 dark:border-slate-700"
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenPdfInNewTab(session.id);
                                      }}
                                    >
                                      {(() => {
                                        const docCount =
                                          typeof session.documentCount === 'number'
                                            ? session.documentCount
                                            : (session.documents?.length || 0);
                                        if (docCount > 1) {
                                          return <FileStack className="h-5 w-5" />;
                                        }
                                        return <FileText className="h-5 w-5" />;
                                      })()}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <h3
                                        className={cn(
                                          "font-semibold text-sm mb-1 truncate",
                                          selectedFileId === session.id
                                            ? "text-teal-900 dark:text-teal-100"
                                            : "text-slate-900 dark:text-slate-100"
                                        )}
                                      >
                                        {session.title || "Untitled Document"}
                                      </h3>
                                    </div>
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium whitespace-nowrap text-center">
                                    {new Date(
                                      session.created_at || Date.now()
                                    ).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium whitespace-nowrap text-center">
                                    {formatSessionSize(session)}
                                  </div>
                                  <div className="flex items-center justify-center gap-3 whitespace-nowrap">
                                    {(() => {
                                      const s = session as any;
                                      const blogMsgCount =
                                        typeof s.blogMessageCount === "number"
                                          ? s.blogMessageCount
                                          : 0;
                                      const hasBlogSummary = blogMsgCount > 0;
                                      return (
                                        <span
                                          className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                                            hasBlogSummary
                                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                                          )}
                                        >
                                          {hasBlogSummary ? "已分析" : "未分析"}
                                        </span>
                                      );
                                    })()}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleOpenInReading(session.id)
                                          }
                                        >
                                          <BookOpen className="h-4 w-4 mr-2" />
                                          Open in Reading
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel>Move to</DropdownMenuLabel>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUpdateSessionStatus(
                                              session.id,
                                              "want-to-read"
                                            )
                                          }
                                        >
                                          <Folder className="h-4 w-4 mr-2" />
                                          Want to read
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUpdateSessionStatus(
                                              session.id,
                                              "reading"
                                            )
                                          }
                                        >
                                          <FolderOpen className="h-4 w-4 mr-2" />
                                          Reading
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUpdateSessionStatus(
                                              session.id,
                                              "completed"
                                            )
                                          }
                                        >
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Completed
                                        </DropdownMenuItem>
                                        {customFolderIds.length > 0 && (
                                          <>
                                            <DropdownMenuSeparator />
                                            {customFolderIds.map((id) => (
                                              <DropdownMenuItem
                                                key={id}
                                                onClick={() =>
                                                  handleUpdateSessionStatus(
                                                    session.id,
                                                    id
                                                  )
                                                }
                                              >
                                                <Folder className="h-4 w-4 mr-2" />
                                                {id}
                                              </DropdownMenuItem>
                                            ))}
                                          </>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleOpenRenameSession(session)}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleDeleteSession(session.id)
                                          }
                                          className="text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              ))}

                            {/* 仅在 CNS 收藏分组中：展示尚未创建文献助手会话的收藏文献 */}
                            {currentFolder === "cns-favorites" &&
                              cnsFavoriteArticles
                                .filter((article) => {
                                  // 已有文献助手会话的收藏，在上面已展示，这里只展示尚未创建的
                                  const id = Number(article?.id);
                                  if (!Number.isFinite(id)) return false;
                                  return !sessions.some((s) => {
                                    if (!s || !s.config) return false;
                                    try {
                                      const cfg =
                                        typeof s.config === "string"
                                          ? JSON.parse(s.config || "{}")
                                          : (s.config as any);
                                      if (!cfg || cfg.source !== "cns")
                                        return false;
                                      const sid = Number(
                                        (cfg as any).articleId
                                      );
                                      if (!Number.isFinite(sid)) return false;
                                      const docCount =
                                        typeof s.documentCount === "number"
                                          ? s.documentCount
                                          : (s.documents?.length || 0);
                                      return sid === id && docCount > 0;
                                    } catch {
                                      return false;
                                    }
                                  });
                                })
                                .filter((article) => {
                                  if (!librarySearch.trim()) return true;
                                  const title = String(
                                    article?.title ||
                                      article?.title_zh ||
                                      ""
                                  ).toLowerCase();
                                  return title.includes(
                                    librarySearch.trim().toLowerCase()
                                  );
                                })
                                .map((article) => (
                                  <div
                                    key={`cns-${article.id}`}
                                    className={cn(
                                      "group grid grid-cols-[minmax(200px,1fr)_140px_100px_140px] gap-4 items-center px-6 py-3 cursor-pointer transition-all rounded-lg border border-dashed mx-4",
                                      "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                    )}
                                    onClick={() =>
                                      handleOpenCnsFavoriteArticle(article)
                                    }
                                  >
                                    <div className="flex items-center gap-4">
                                      <div
                                        className={cn(
                                          "h-10 w-10 rounded-lg flex items-center justify-center border flex-shrink-0",
                                          "bg-white border-slate-200 text-slate-400 group-hover:border-teal-300 group-hover:text-teal-600 dark:bg-slate-900 dark:border-slate-700"
                                        )}
                                      >
                                        <FileText className="h-5 w-5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-sm mb-0.5 truncate text-slate-900 dark:text-slate-100">
                                          {article.title ||
                                            article.title_zh ||
                                            "Untitled Article"}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          {(article.journal || article.publisher || "").toString()}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium whitespace-nowrap text-center">
                                      {article.published_date
                                        ? String(
                                            article.published_date
                                          ).slice(0, 10)
                                        : "-"}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium whitespace-nowrap text-center">
                                      {article.pdf_path || article.pdf_url
                                        ? "CNS PDF"
                                        : "-"}
                                    </div>
                                    <div className="flex items-center justify-center gap-3 whitespace-nowrap">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                        未分析
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-[11px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/30"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenCnsFavoriteArticle(article);
                                        }}
                                      >
                                        开始阅读
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Floating Preview Overlay */}
                    <AnimatePresence>
                        {selectedFileId && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-40 flex items-stretch"
                          >
                            {/* 点击遮罩关闭预览 */}
                            <div
                              className={cn(
                                "transition-all duration-300",
                                isPreviewExpanded ? "w-16 flex-shrink-0" : "flex-1"
                              )}
                              onClick={() => setSelectedFileId(null)}
                            />
                            <motion.div
                                initial={{ x: '100%', opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: '100%', opacity: 0 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className={cn(
                                    "m-4 bg-white dark:bg-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col transition-all duration-300",
                                    isPreviewExpanded ? "flex-1" : "w-[520px] flex-shrink-0"
                                )}
                                style={{ maxHeight: 'calc(100% - 32px)' }}
                            >
                                <div className="h-14 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between px-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 border border-blue-100 dark:border-blue-900/50">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-semibold text-sm truncate text-slate-900 dark:text-white">
                                                {sessions.find(s => s.id === selectedFileId)?.title}
                                            </span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Preview Mode</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                                            onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                                            title={isPreviewExpanded ? "Collapse" : "Expand"}
                                        >
                                            {isPreviewExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                        </Button>
                                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                                        {currentSession?.id === selectedFileId && hasAssistantMessagesForCurrentSession ? (
                                          <Button 
                                            size="sm"
                                            className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 dark:shadow-none"
                                            onClick={async () => {
                                              if (!selectedFileId) return;
                                              await handleOpenInReading(selectedFileId);
                                            }}
                                          >
                                            <BookOpen className="h-3.5 w-3.5" />
                                            Open Full
                                          </Button>
                                        ) : (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                size="sm"
                                                className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 dark:shadow-none"
                                              >
                                                <Sparkles className="h-3.5 w-3.5" />
                                                选择分析模式
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-64">
                                              <DropdownMenuLabel>选择阅读 / 分析模式</DropdownMenuLabel>
                                              <DropdownMenuSeparator />
                                              {prompts?.tasks && Object.entries(prompts.tasks)
                                                .filter(([key]) => key !== 'titleGeneration')
                                                .map(([key, value]: any) => (
                                                  <DropdownMenuItem
                                                    key={key}
                                                    onClick={async () => {
                                                      if (!selectedFileId) return;
                                                      await handleOpenFile(selectedFileId);
                                                      await handleTaskClick(key);
                                                    }}
                                                  >
                                                    <Sparkles className="h-3 w-3 mr-2 text-teal-500" />
                                                    <span className="truncate">{value.name || key}</span>
                                                  </DropdownMenuItem>
                                                ))}
                                              {customPrompts.length > 0 && (
                                                <>
                                                  <DropdownMenuSeparator />
                                                  {customPrompts.map((cp) => (
                                                    <DropdownMenuItem
                                                      key={cp.id}
                                                      onClick={async () => {
                                                        if (!selectedFileId) return;
                                                        await handleOpenFile(selectedFileId);
                                                        await handleRunCustomPrompt(cp.prompt);
                                                      }}
                                                    >
                                                      <Zap className="h-3 w-3 mr-2 text-purple-500" />
                                                      <span className="truncate">{cp.name}</span>
                                                    </DropdownMenuItem>
                                                  ))}
                                                </>
                                              )}
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        )}
                                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors" onClick={() => setSelectedFileId(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="p-6">
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            {currentSession?.id === selectedFileId ? (
                                                messages.filter(m => m.role === 'assistant').map(msg => (
                                                    <div key={msg.id} className="mb-6">
                                                        <MemoMessageContent message={msg} documentId={documents[0]?.id} />
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                                                    <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                                        <Sparkles className="h-8 w-8 text-slate-300" />
                                                    </div>
                                                    <p className="font-medium">Click "Open Full" to load full conversation and analysis.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                            </motion.div>
                          )}
                    </AnimatePresence>
                </div>
            </div>
        ) : (activeSidebarItem as any) === 'user-data' ? (
            <UserDataPanel />
        ) : activeSidebarItem === 'community' ? (
          /* ============================================================================
           * 大家看（社区共享）视图 - Tab Layout
           * ============================================================================ */
          <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 font-sans">
            <Tabs value={communityTab} onValueChange={(v) => setCommunityTab(v as any)} className="flex flex-col h-full">
              {/* Header */}
              <div className="flex-none border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 pt-6 pb-0">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">社区中心</h2>
                    <p className="text-sm text-zinc-500 mt-1">发现优秀的文献分析，分享你的知识沉淀</p>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="relative w-64 group">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                        <input 
                          type="text" 
                          placeholder="搜索..." 
                          value={communitySearchQuery}
                          onChange={(e) => {
                            setCommunitySearchQuery(e.target.value);
                            loadPublicSessions(e.target.value);
                          }}
                          className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                     </div>
                     {communityTab === 'discover' && (
                       <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg ml-2">
                         <button
                           onClick={() => setCommunityViewMode('list')}
                           className={cn("p-1.5 rounded-md transition-all", communityViewMode === 'list' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600")}
                         >
                           <LayoutList className="h-4 w-4" />
                         </button>
                         <button
                           onClick={() => setCommunityViewMode('grid')}
                           className={cn("p-1.5 rounded-md transition-all", communityViewMode === 'grid' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600")}
                         >
                           <LayoutGrid className="h-4 w-4" />
                         </button>
                       </div>
                     )}
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadPublicSessions()}
                        disabled={isLoadingCommunity}
                        className="ml-2 h-9 px-3 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoadingCommunity && "animate-spin")} />
                        刷新
                      </Button>
                  </div>
                </div>

                <TabsList className="flex gap-8 bg-transparent p-0 border-b-0">
                  <TabsTrigger 
                    value="discover" 
                    className="relative h-9 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-zinc-500 shadow-none transition-none data-[state=active]:border-zinc-900 dark:data-[state=active]:border-zinc-100 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100"
                  >
                    发现广场
                  </TabsTrigger>
                  <TabsTrigger 
                    value="mine" 
                    className="relative h-9 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-zinc-500 shadow-none transition-none data-[state=active]:border-zinc-900 dark:data-[state=active]:border-zinc-100 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100"
                  >
                    我的分享
                    <Badge variant="secondary" className="ml-2 h-5 rounded-full px-1.5 text-[10px] font-normal bg-zinc-100 dark:bg-zinc-800 text-zinc-600 group-data-[state=active]:bg-zinc-900 group-data-[state=active]:text-zinc-100">
                      {sessions.filter(s => s.is_public === 1).length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden p-6">
                {/* Discover Tab */}
                <TabsContent value="discover" className="h-full m-0 outline-none data-[state=inactive]:hidden">
                   <ScrollArea className="h-full pr-4">
                     {communityViewMode === 'list' ? (
                        <div className="w-full flex justify-center">
                          <div className="w-full max-w-[1400px]">
                            <div className="border rounded-lg border-zinc-200 dark:border-zinc-800 overflow-hidden">
                              <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                 <div className="col-span-7">文献标题</div>
                                 <div className="col-span-2">分享者</div>
                                 <div className="col-span-2">热度 (浏览/收藏)</div>
                                 <div className="col-span-1 text-right">操作</div>
                              </div>
                              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                                {publicSessions.map((session) => (
                                  <div key={session.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                                     <div className="col-span-7 pr-4">
                                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate" title={session.title}>{session.title}</div>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                                           <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">PDF</span>
                                           <span>{new Date(session.created_at).toLocaleDateString()}</span>
                                        </div>
                                     </div>
                                     <div className="col-span-2 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-500">
                                          {session.user_id.slice(0, 1).toUpperCase()}
                                        </div>
                                        <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{session.user_id}</span>
                                     </div>
                                     <div className="col-span-2 flex items-center gap-4 text-xs text-zinc-500">
                                        <span className="flex items-center gap-1" title="浏览量"><Eye className="h-3.5 w-3.5"/> {session.view_count || 0}</span>
                                        <span className="flex items-center gap-1" title="被收藏"><Bookmark className="h-3.5 w-3.5"/> {session.copy_count || 0}</span>
                                     </div>
                                     <div className="col-span-1 flex justify-end gap-2">
                                        <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={async () => {
                                            try {
                                              literatureAssistantAPI.recordView(session.id);
                                              const details = await literatureAssistantAPI.getSession(session.id);
                                              setViewingPublicSession(details);
                                            } catch (e) {
                                              toast.error('加载详情失败');
                                            }
                                        }}>
                                          查看
                                        </Button>
                                     </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1400px] mx-auto">
                           {publicSessions.map((session) => (
                              <motion.div
                                layoutId={`session-${session.id}`}
                                key={session.id}
                                className="group flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
                                onClick={async () => {
                                  try {
                                    literatureAssistantAPI.recordView(session.id);
                                    const details = await literatureAssistantAPI.getSession(session.id);
                                    setViewingPublicSession(details);
                                  } catch (e) {
                                    toast.error('加载详情失败');
                                  }
                                }}
                              >
                                <div className="p-5 flex flex-col h-full">
                                  <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 font-serif font-bold text-xs border border-zinc-200 dark:border-zinc-700">
                                      PDF
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            const newSession = await copyPublicSession(session.id);
                                            toast.success('已保存到我的文库');
                                          } catch (e) {
                                            // error handled
                                          }
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>

                                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-[15px] leading-snug line-clamp-2 mb-2 min-h-[2.5em]">{session.title}</h3>
                                  <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between text-xs text-zinc-400">
                                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.user_id}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="flex items-center gap-1" title="浏览量"><Eye className="h-3 w-3" />{session.view_count || 0}</span>
                                      <span className="flex items-center gap-1" title="被收藏"><Bookmark className="h-3 w-3" />{session.copy_count || 0}</span>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                           ))}
                        </div>
                     )}
                   </ScrollArea>
                </TabsContent>

                {/* My Shares Tab */}
                <TabsContent value="mine" className="h-full m-0 outline-none data-[state=inactive]:hidden flex flex-col items-center">
                   <div className="w-full max-w-[1400px] h-full flex flex-col">
                   <div className="mb-6 flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <div className="flex items-center gap-4">
                         <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full">
                            {communitySettings?.shareEnabled ? <Unlock className="h-5 w-5 text-zinc-900 dark:text-zinc-100" /> : <Lock className="h-5 w-5 text-zinc-400" />}
                         </div>
                         <div>
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">自动公开新分析</div>
                            <div className="text-xs text-zinc-500">开启后，您的新对话将默认设为公开</div>
                         </div>
                      </div>
                      <div className={cn("w-11 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer", communitySettings?.shareEnabled ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700")} onClick={() => updateCommunitySettings(!communitySettings?.shareEnabled)}>
                          <div className={cn("w-4 h-4 bg-white rounded-full shadow transition-transform", communitySettings?.shareEnabled ? "translate-x-5" : "translate-x-0")} />
                      </div>
                   </div>

                   <ScrollArea className="flex-1 pb-20">
                      <div className="border rounded-lg border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
                        <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                           <div className="col-span-6">文献标题</div>
                           <div className="col-span-3">状态 (点击切换)</div>
                           <div className="col-span-3 text-right">操作</div>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                           {sessions.filter(s => (typeof s.messageCount === 'number' ? s.messageCount > 0 : (s.messages?.length || 0) > 0)).length === 0 ? (
                              <div className="py-12 text-center text-zinc-400 text-sm">暂无内容</div>
                           ) : sessions.filter(s => (typeof s.messageCount === 'number' ? s.messageCount > 0 : (s.messages?.length || 0) > 0)).map(session => {
                              const isPublic = session.is_public === 1;
                              return (
                                <div key={session.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                                   <div className="col-span-6">
                                      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{session.title}</div>
                                      <div className="text-xs text-zinc-400 mt-1">{new Date(session.created_at).toLocaleDateString()}</div>
                                   </div>
                                   <div className="col-span-3">
                                      <button 
                                        className={cn(
                                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                                          isPublic 
                                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30" 
                                            : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                        )}
                                        onClick={() => toggleSessionPublic(session.id, !isPublic)}
                                      >
                                        {isPublic ? <Eye className="h-3 w-3"/> : <EyeOff className="h-3 w-3"/>}
                                        {isPublic ? "已公开" : "私有"}
                                      </button>
                                   </div>
                                   <div className="col-span-3 flex justify-end gap-2">
                                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={async () => {
                                          try {
                                            const details = await literatureAssistantAPI.getSession(session.id);
                                            setViewingPublicSession(details);
                                          } catch (e) {
                                            toast.error('加载详情失败');
                                          }
                                      }}>
                                        预览
                                      </Button>
                                   </div>
                                </div>
                              );
                           })}
                        </div>
                      </div>
                   </ScrollArea>
                   </div>
                </TabsContent>
              </div>
            </Tabs>

            {/* 阅读器弹窗 (Reader Dialog) - 复用之前的逻辑 */}
            <Dialog open={!!viewingPublicSession} onOpenChange={(open) => !open && setViewingPublicSession(null)}>
              <DialogContent className="max-w-4xl w-full h-[92vh] p-0 gap-0 bg-white dark:bg-zinc-950 border-none shadow-2xl sm:rounded-xl overflow-hidden flex flex-col">
                {viewingPublicSession && (
                  <>
                    {/* Reader Header */}
                    <div className="h-14 px-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white/95 dark:bg-zinc-950/95 backdrop-blur z-10">
                      <div className="flex items-center gap-4 min-w-0">
                        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-md text-sm">
                          {viewingPublicSession.title}
                        </h2>
                        <span className="text-xs text-zinc-400 flex-shrink-0">
                           by {viewingPublicSession.user_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-4 flex-shrink-0">
                        {sessions.some(s => s.id === viewingPublicSession.id) ? (
                          <Button
                            size="sm"
                            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-full px-4 h-8 text-xs"
                            onClick={() => {
                              handleSelectSession(viewingPublicSession.id);
                              setActiveSidebarItem('reading');
                              setViewingPublicSession(null);
                            }}
                          >
                            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                            阅读模式
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full px-4 h-8 text-xs border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
                            onClick={async () => {
                              try {
                                const newSession = await copyPublicSession(viewingPublicSession.id);
                                toast.success('已保存到我的文库');
                                setViewingPublicSession(null);
                                if (window.confirm('是否立即打开？')) {
                                  await handleSelectSession(newSession.id);
                                  setActiveSidebarItem('reading');
                                }
                              } catch (e) {
                                // error handled
                              }
                            }}
                          >
                            <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                            保存
                          </Button>
                        )}
                        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingPublicSession(null)}
                          className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <X className="h-4 w-4 text-zinc-500" />
                        </Button>
                      </div>
                    </div>

                    {/* Reader Content */}
                    <ScrollArea className="flex-1 bg-white dark:bg-zinc-950">
                      <div className="max-w-3xl mx-auto py-12 px-8 min-h-full">
                         {viewingPublicSession.messages && viewingPublicSession.messages.length > 0 ? (
                            <div className="space-y-16">
                              {viewingPublicSession.messages
                                .filter((m: any) => {
                                  if (m.role !== 'assistant') return false;
                                  try {
                                    const meta = JSON.parse(m.metadata || '{}');
                                    return !!meta.taskType;
                                  } catch { return false; }
                                })
                                .map((msg: any, idx: number) => (
                                  <div key={idx} className="reader-content">
                                    {/* 使用 FigureAwareMarkdown 获得最佳渲染效果 */}
                                    <FigureAwareMarkdown 
                                      content={msg.content}
                                      documentId={viewingPublicSession.documents?.[0]?.id}
                                      className="prose-lg prose-zinc dark:prose-invert max-w-none"
                                      enableFigures={true}
                                    />
                                    {idx < viewingPublicSession.messages.length - 1 && (
                                      <div className="my-12 flex justify-center">
                                        <div className="w-12 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                                      </div>
                                    )}
                                  </div>
                                ))
                              }
                              
                              {viewingPublicSession.messages.filter((m: any) => m.role === 'assistant' && JSON.parse(m.metadata || '{}').taskType).length === 0 && (
                                <div className="text-center py-20">
                                  <p className="text-zinc-400 italic">暂无分析内容</p>
                                </div>
                              )}
                            </div>
                          ) : (
                             <div className="flex items-center justify-center py-32">
                                <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                             </div>
                          )}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        ) : (
        <ResizablePanelGroup direction="horizontal" className="flex-1 h-full min-w-0">

             {/* Left: Blog / Upload - Modern Tech Style */}
             <ResizablePanel defaultSize={60} minSize={10} className="flex flex-col bg-background relative font-sans">
                {/* Header */}
                <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur z-10">
                    <div className="flex items-center gap-4">
                        <h1 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                            <Sparkles className="h-4 w-4 text-teal-500" />
                            {activeSidebarItem === 'new-chat' ? 'Start New Chat' : 'Reading Mode'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeSidebarItem === 'new-chat' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1 text-slate-600 dark:text-slate-200"
                              >
                                <Sparkles className="h-4 w-4 text-teal-500" />
                                自定义阅读模式
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              <DropdownMenuLabel>我的自定义模式</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {customPrompts.length === 0 ? (
                                <DropdownMenuItem onClick={() => setShowCreateCustom(true)}>
                                  <Plus className="h-3 w-3 mr-2" />
                                  新增自定义模式
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  {customPrompts.map((cp) => (
                                    <DropdownMenuItem
                                      key={cp.id}
                                      onClick={() => handleRunCustomPrompt(cp.prompt)}
                                    >
                                      <Zap className="h-3 w-3 mr-2 text-purple-600" />
                                      <span className="truncate">{cp.name}</span>
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setShowCreateCustom(true)}>
                                    <Plus className="h-3 w-3 mr-2" />
                                    管理自定义模式
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {!isNewChatView && (
                          <Button 
                              variant="ghost" 
                              size="sm" 
                              className={cn("text-xs gap-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800", !showRightPanel && "text-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400")}
                              onClick={() => setShowRightPanel(!showRightPanel)}
                          >
                              {showRightPanel ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                              {showRightPanel ? 'Hide Tools' : 'Show Tools'}
                          </Button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">
                    {activeSidebarItem === 'new-chat' ? (
                        <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-[#0B1120]">
                             <div className="min-h-full w-full p-8 flex flex-col items-center justify-center">
                             <div className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Literature Assistant</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">上传一篇 PDF 文献，选择合适的阅读模式开始分析</p>
                                {/* 模型选择器 - 轻量紧凑 */}
                                <div className="mt-4 flex items-center justify-center gap-2">
                                  <span className="text-xs text-slate-400">AI Model:</span>
                                  <Popover open={summaryModelPopoverOpen} onOpenChange={setSummaryModelPopoverOpen}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5"
                                      >
                                        <Box className="h-3.5 w-3.5 text-teal-500" />
                                        {summaryProvider || config?.defaultProvider || 'Gemini-2.5-Pro'}
                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-1.5 max-h-[60vh] overflow-y-auto" align="center">
                                      <div className="text-[10px] text-slate-400 px-2 py-1 mb-1">选择分析模型</div>
                                      {config?.providers.map(p => {
                                        const detail = config.providersDetail?.[p];
                                        const isMultimodal = detail?.multimodal ?? false;
                                        const isEnabled = detail?.enabled !== false;
                                        const isSelected = (summaryProvider || config?.defaultProvider) === p;
                                        return (
                                          <button
                                            key={p}
                                            type="button"
                                            disabled={!isEnabled}
                                            onClick={() => {
                                              if (!isEnabled) return;
                                              setSummaryProvider(p);
                                              setSummaryModelPopoverOpen(false);
                                            }}
                                            className={cn(
                                              "w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 transition-colors",
                                              !isEnabled
                                                ? "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-500"
                                                : isSelected
                                                  ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                                                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                            )}
                                          >
                                            <span className="truncate">{p}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {isMultimodal && (
                                                <span className={cn(
                                                  "text-[9px] px-1 py-0.5 rounded",
                                                  !isEnabled
                                                    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                                                    : "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300"
                                                )}>
                                                  多模态
                                                </span>
                                              )}
                                              {isSelected && isEnabled && <CheckCircle2 className="h-3 w-3 text-teal-500" />}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </PopoverContent>
                                  </Popover>
                                </div>
                             </div>

                             {/* 默认阅读模式 + 自定义模板 */}
                             <div className="grid grid-cols-2 gap-4 mb-12 max-w-3xl w-full">
                              {[
                                { key: 'deep_dive', icon: Sparkles, text: "深入精读", desc: "对整篇论文进行系统性精读和分解", color: "text-slate-900 dark:text-white", bg: "bg-white dark:bg-[#1E293B]" },
                                { key: 'quick_summary', icon: Zap, text: "快速摘要", desc: "提炼核心结论与关键信息", color: "text-slate-900 dark:text-white", bg: "bg-white dark:bg-[#1E293B]" },
                                { key: 'multi_pdf', icon: FileStack, text: "多篇分析对比", desc: "同时比较多篇文献的设计、结果与结论", color: "text-slate-900 dark:text-white", bg: "bg-white dark:bg-[#1E293B]" },
                                { key: 'image_report', icon: ImageIcon, text: "图文报告", desc: "结合论文图表进行多模态分析（自动提取图片）", color: "text-slate-900 dark:text-white", bg: "bg-white dark:bg-[#1E293B]" },
                                // { key: 'critique', icon: BookOpen, text: "批判性评阅", desc: "识别研究局限与后续研究方向", color: "text-slate-900 dark:text-white", bg: "bg-white dark:bg-[#1E293B]" }
	                              ].map((item, i) => {
	                                    const isSelected = selectedWelcomeTask === item.key;
	                                    return (
	                                        <div 
	                                            key={item.key}
	                                            onClick={() => {
	                                                if (isSelected) {
	                                                  setSelectedWelcomeTask(null);
	                                                  return;
	                                                }
	                                                setSelectedWelcomeTask(item.key);
	                                                // 未上传 PDF 时，仅做“预选”，上传后会自动触发一次分析
	                                                if (documents.length > 0) {
	                                                  handleTaskClick(item.key);
	                                                }
	                                            }}
	                                            className={cn(
	                                                "flex items-start gap-4 p-5 rounded-xl border transition-all cursor-pointer select-none relative shadow-sm",
	                                                "bg-white dark:bg-[#1E293B] hover:border-teal-500 hover:shadow-md dark:hover:border-teal-500",
	                                                isSelected ? "border-teal-500 ring-1 ring-teal-500" : "border-slate-200 dark:border-slate-700"
                                            )}
                                        >
                                            <div className={cn("p-2.5 rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800")}>
                                                <item.icon className={cn("w-5 h-5 text-slate-700 dark:text-slate-200")} />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-sm text-slate-900 dark:text-white mb-1">{item.text}</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                                            </div>
                                            {isSelected && <div className="absolute top-4 right-4"><CheckCircle2 className="w-5 h-5 text-teal-500" /></div>}
                                        </div>
                                    );
                                })}
                                {customPrompts.length > 0 && customPrompts.map((cp) => (
                                  <div
                                    key={cp.id}
                                    onClick={() => handleRunCustomPrompt(cp.prompt)}
                                    className={cn(
                                      "flex items-start gap-4 p-5 rounded-xl border transition-all cursor-pointer select-none relative shadow-sm",
                                      "bg-white dark:bg-[#1E293B] hover:border-teal-500 hover:shadow-md dark:hover:border-teal-500",
                                      "border-slate-200 dark:border-slate-700"
                                    )}
                                  >
                                    <div className="p-2.5 rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800">
                                      <Zap className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                      <h3 className="font-medium text-sm text-slate-900 dark:text-white mb-1 text-sm">
                                        {cp.name}
                                      </h3>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                        使用你自定义的阅读模板快速启动分析
                                      </p>
                                    </div>
                                  </div>
                                ))}
                            </div>

                             <div 
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={cn(
                                    "w-full max-w-3xl border border-dashed rounded-xl p-12 transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col items-center text-center gap-6 shrink-0",
                                    isDragging 
                                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20" 
                                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                                )}
                            >
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                    <Upload className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                      上传 PDF 文献
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                                      将 PDF 拖拽到此处，或点击选择文件进行上传。
                                    </p>
                                </div>
                                {uploadingCount > 0 && (
                                  <div className="mt-6 w-full max-w-xl text-left text-xs text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center justify-between mb-1">
                                      <span>
                                        正在上传 {uploadedCount}/{uploadingCount} 个文件
                                      </span>
                                      {currentUploadName && (
                                        <span className="truncate max-w-[220px] text-right" title={currentUploadName}>
                                          {currentUploadName}
                                        </span>
                                      )}
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                      <div
                                        className="h-full bg-teal-500 dark:bg-teal-400 transition-all duration-200"
                                        style={{ width: `${Math.max(5, Math.min(100, currentUploadProgress || 0))}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
	                            </div>
                              <div className="mt-4 w-full max-w-3xl">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={urlToLoad}
                                    onChange={(e) => setUrlToLoad(e.target.value)}
                                    placeholder="输入 arXiv / OpenReview / Nature 链接, 点击 load 自动下载并上传"
                                    disabled={isLoadingFromUrl}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleLoadFromUrl();
                                      }
                                    }}
                                    className="h-10 rounded-lg"
                                  />
                                  <Button
                                    type="button"
                                    onClick={handleLoadFromUrl}
                                    disabled={isLoadingFromUrl || !urlToLoad.trim()}
                                    className="h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white"
                                  >
                                    {isLoadingFromUrl ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Download className="h-4 w-4 mr-2" />
                                    )}
                                    Load
                                  </Button>
                                </div>
                                {/* <div className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                                  支持：arXiv / OpenReview / Nature（自动解析并下载 PDF 后上传）
                                </div> */}
                              </div>
	                            {documents.length > 0 && (
	                              <div className="mt-3 w-full max-w-3xl text-center text-xs text-slate-500 dark:text-slate-400">
	                                提示：上传后选择上方 Prompt 开始阅读（深入精读 / 快速摘要 / 多篇对比 / 图文报告 / 自定义）。
	                              </div>
	                            )}
	                            {documents.length > 0 && (
	                              <div className="mt-8 w-full max-w-3xl">
	                                <div className="flex items-center justify-between mb-3">
	                                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    已上传文档
                                  </h3>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">
                                    {documents.length} 个 PDF
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                                      {documents.map((doc) => (
                                    <div
                                      key={doc.id}
                                          className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-3 py-2 text-sm cursor-pointer hover:border-teal-500 hover:shadow-sm transition-all"
                                          onClick={() => {
                                            setSelectedPDF(doc.id);
                                            setActiveSidebarItem('reading');
                                            setShowRightPanel(true);
                                            setRightPanelTab('paper');
                                          }}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                          <FileText className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="truncate text-slate-900 dark:text-slate-50">
                                            {doc.original_name}
                                          </div>
                                          <div className="text-xs text-slate-400 dark:text-slate-500">
                                            {formatFileSize(doc.file_size)}{doc.page_count ? ` · ${doc.page_count} 页` : ' · PDF'}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                          size="sm"
	                                          variant="ghost"
	                                          className="h-8 text-xs px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
	                                          onClick={async () => {
	                                            const docName = doc.original_name || 'PDF';
	                                            const existed = useLiteratureAssistantStore
	                                              .getState()
	                                              .documents.some((d) => d.id === doc.id);
	                                            await deleteDocument(doc.id);
	                                            const stillExists = useLiteratureAssistantStore
	                                              .getState()
	                                              .documents.some((d) => d.id === doc.id);
	                                            if (existed && !stillExists) {
	                                              toast.success(`已删除：${docName}`);
	                                            } else if (existed && stillExists) {
	                                              toast.error(`删除失败：${docName}`);
	                                            }
	                                            if (selectedPDF === doc.id) {
	                                              setSelectedPDF(null);
	                                            }
	                                          }}
	                                        >
	                                          删除
	                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
	                        </div>
	                        </div>
	                    ) : (
	                        <div className="h-full flex flex-col bg-white dark:bg-[#0B1120]">
                            {(preShowingAnalyzing || isAnalyzing) && documents.length > 0 && (
                              <div className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-50 via-cyan-50 to-purple-50 dark:from-blue-950/40 dark:via-cyan-950/40 dark:to-purple-950/40 border-b border-blue-200/60 dark:border-blue-800/60">
                                <div className="flex items-center gap-3 text-sm">
                                  <div className="relative">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                                    <div className="absolute inset-0 blur-md bg-blue-600/30 animate-pulse" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-blue-900 dark:text-blue-100">AI 正在分析当前 PDF…</div>
                                    <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">这可能需要几秒钟时间，请稍候。</div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <ScrollArea className="flex-1">
                            <div className="max-w-4xl mx-auto p-12 pb-20">
                                {/* Blog Content - Rendering the AI Analysis */}
                                {(() => {
                                  // 所有历史总结版本（按时间顺序）
                                  const blogMessages = messages.filter(m => {
                                    if (m.role !== 'assistant') return false;
                                    try {
                                      const meta = m.metadata ? JSON.parse(m.metadata as any) : {};
                                      // Exclude streaming placeholders from the "static" list to avoid duplication
                                      if (meta.streaming) return false;
                                      // 左侧 Blog 只展示总结文献 AI 的输出：有 taskType 或 customPrompt
                                      return !!meta.taskType || !!meta.customPrompt;
                                    } catch {
                                      return false;
                                    }
                                  });

                                  const streamingData = currentSession ? backgroundStreaming[`summary-${currentSession.id}`] : null;
                                  const isStreamingSummary = streamingData && streamingData.kind === 'summary' && !streamingData.isFinal;

                                  // 当前会话下的所有版本（历史 + 正在流式的最新版本）
                                  const versions: any[] = [...blogMessages];
                                  if (isStreamingSummary) {
                                    versions.push({
                                      // 使用与占位消息相同的 id，避免流式完成时 key 变化导致整块重挂载闪烁
                                      id: streamingData.id,
                                      role: 'assistant',
                                      content: streamingData.content,
                                      created_at: new Date().toISOString(),
                                      metadata: JSON.stringify({ taskType: streamingData.taskType })
                                    } as any);
                                  }

	                                  const totalVersions = versions.length;
	                                  if (totalVersions === 0) {
	                                    // 分析失败时显示错误提示与重试引导
	                                    if (analysisError) {
	                                      const canRetry = !!currentSession && documents.length > 0 && !isAnalyzing;
	                                      return (
	                                        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
	                                          <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6 border border-red-200 dark:border-red-900">
	                                            <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
	                                          </div>
	                                          <p className="font-semibold text-lg text-slate-800 dark:text-slate-100">
	                                            分析失败
	                                          </p>
	                                          <p className="mt-2 text-sm text-red-600/80 dark:text-red-400/70 max-w-md leading-relaxed">
	                                            {analysisError.message}
	                                          </p>
	                                          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
	                                            建议切换右上角的分析模型后重新生成，或稍后再试。
	                                          </p>
	                                          <div className="flex items-center gap-3 mt-6">
	                                            <Popover open={readingModelPopoverOpen} onOpenChange={setReadingModelPopoverOpen}>
	                                              <PopoverTrigger asChild>
	                                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
	                                                  <Box className="h-3.5 w-3.5 text-teal-500" />
	                                                  切换模型: {summaryProvider || config?.defaultProvider || '...'}
	                                                  <ChevronDown className="h-3 w-3 opacity-50" />
	                                                </Button>
	                                              </PopoverTrigger>
	                                              <PopoverContent className="w-56 p-1.5 max-h-[60vh] overflow-y-auto" align="center">
	                                                <div className="text-[10px] text-slate-400 px-2 py-1 mb-1">切换分析模型</div>
	                                                {config?.providers.map(p => {
	                                                  const detail = config.providersDetail?.[p];
	                                                  const isEnabled = detail?.enabled !== false;
	                                                  const isSelected = (summaryProvider || config?.defaultProvider) === p;
	                                                  return (
	                                                    <button
	                                                      key={p}
	                                                      type="button"
	                                                      disabled={!isEnabled}
	                                                      onClick={() => {
	                                                        if (!isEnabled) return;
	                                                        setSummaryProvider(p);
	                                                        setReadingModelPopoverOpen(false);
	                                                      }}
	                                                      className={cn(
	                                                        "w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 transition-colors",
	                                                        !isEnabled ? "opacity-40 cursor-not-allowed text-slate-400" : isSelected ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
	                                                      )}
	                                                    >
	                                                      <span className="truncate">{p}</span>
	                                                      {isSelected && isEnabled && <CheckCircle2 className="h-3 w-3 text-teal-500" />}
	                                                    </button>
	                                                  );
	                                                })}
	                                              </PopoverContent>
	                                            </Popover>
	                                            <Button
	                                              size="sm"
	                                              disabled={!canRetry}
	                                              className="h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
	                                              onClick={() => {
	                                                setAnalysisError(null);
	                                                setError(null);
	                                                useLiteratureAssistantStore.setState({ isSending: false });
	                                                if (analysisError.taskType) {
	                                                  handleTaskClick(analysisError.taskType);
	                                                }
	                                              }}
	                                            >
	                                              <RefreshCw className="h-3.5 w-3.5" />
	                                              重新生成
	                                            </Button>
	                                          </div>
	                                          <Button
	                                            variant="ghost"
	                                            size="sm"
	                                            className="mt-4 text-xs text-slate-400 hover:text-slate-600"
	                                            onClick={() => {
	                                              setAnalysisError(null);
	                                              setError(null);
	                                              // 防御性重置：确保 isSending 不会卡住后续操作
	                                              useLiteratureAssistantStore.setState({ isSending: false });
	                                            }}
	                                          >
	                                            关闭提示
	                                          </Button>
	                                        </div>
	                                      );
	                                    }

	                                    // 检查是否正在后台分析中
	                                    const isServerAnalyzing = currentSession?.analysis_status === 'analyzing';
	                                    
	                                    // 如果正在分析中，显示等待状态
	                                    if (isServerAnalyzing && documents.length > 0) {
	                                      return (
	                                        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
	                                          <div className="relative mb-6">
	                                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
	                                              <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
	                                            </div>
	                                            <div className="absolute inset-0 blur-xl bg-blue-400/20 animate-pulse" />
	                                          </div>
	                                          <p className="font-semibold text-lg text-slate-800 dark:text-slate-100">
	                                            AI 正在分析中...
	                                          </p>
	                                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">
	                                            您可以切换到其他会话继续工作，分析完成后会自动更新。
	                                          </p>
	                                          <Button
	                                            variant="outline"
	                                            size="sm"
	                                            className="mt-6 gap-2"
	                                            onClick={() => loadSession(currentSession.id)}
	                                          >
	                                            <RefreshCw className="h-4 w-4" />
	                                            刷新查看结果
	                                          </Button>
	                                        </div>
	                                      );
	                                    }
	                                    
	                                    const canStart = !!currentSession && documents.length > 0 && !isAnalyzing;
	                                    return (
	                                      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
	                                        <div className="h-16 w-16 rounded-2xl bg-teal-100 dark:bg-teal-900/20 flex items-center justify-center mb-4">
	                                          <Sparkles className="h-8 w-8 text-slate-300" />
	                                        </div>
	                                        <p className="font-medium text-slate-700 dark:text-slate-200">
	                                          还没有生成文献总结
	                                        </p>
	                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
	                                          选择一个阅读模式开始分析，或返回 Start 继续在欢迎页选择 Prompt。
	                                        </p>

	                                        {/* 模型选择器 */}
	                                        <div className="mt-4 flex items-center justify-center gap-2">
	                                          <span className="text-xs text-slate-400">AI Model:</span>
	                                          <Popover open={readingModelPopoverOpen} onOpenChange={setReadingModelPopoverOpen}>
	                                            <PopoverTrigger asChild>
	                                              <Button
	                                                variant="ghost"
	                                                size="sm"
	                                                className="h-7 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5"
	                                              >
	                                                <Box className="h-3.5 w-3.5 text-teal-500" />
	                                                {summaryProvider || config?.defaultProvider || 'Gemini-2.5-Pro'}
	                                                <ChevronDown className="h-3 w-3 opacity-50" />
	                                              </Button>
	                                            </PopoverTrigger>
	                                            <PopoverContent className="w-56 p-1.5 max-h-[60vh] overflow-y-auto" align="center">
	                                              <div className="text-[10px] text-slate-400 px-2 py-1 mb-1">切换分析模型</div>
	                                              {config?.providers.map(p => {
	                                                const detail = config.providersDetail?.[p];
	                                                const isMultimodal = detail?.multimodal ?? false;
	                                                const isEnabled = detail?.enabled !== false;
	                                                const isSelected = (summaryProvider || config?.defaultProvider) === p;
	                                                return (
	                                                  <button
	                                                    key={p}
	                                                    type="button"
	                                                    disabled={!isEnabled}
	                                                    onClick={() => {
	                                                      if (!isEnabled) return;
	                                                      setSummaryProvider(p);
	                                                      setReadingModelPopoverOpen(false);
	                                                    }}
	                                                    className={cn(
	                                                      "w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 transition-colors",
	                                                      !isEnabled ? "opacity-40 cursor-not-allowed text-slate-400" : isSelected ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
	                                                    )}
	                                                  >
	                                                    <span className="truncate">{p}</span>
	                                                    <div className="flex items-center gap-1 shrink-0">
	                                                      {isMultimodal && (
	                                                        <span className={cn(
	                                                          "text-[9px] px-1 py-0.5 rounded",
	                                                          !isEnabled ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500" : "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300"
	                                                        )}>多模态</span>
	                                                      )}
	                                                      {isSelected && isEnabled && <CheckCircle2 className="h-3 w-3 text-teal-500" />}
	                                                    </div>
	                                                  </button>
	                                                );
	                                              })}
	                                            </PopoverContent>
	                                          </Popover>
	                                        </div>

	                                        <div className="mt-6 w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
	                                          {[
	                                            { key: 'deep_dive', icon: Sparkles, text: '深入精读', desc: '系统性精读与分解' },
	                                            { key: 'quick_summary', icon: Zap, text: '快速摘要', desc: '提炼核心信息' },
	                                            { key: 'multi_pdf', icon: FileStack, text: '多篇对比', desc: '比较多篇文献' },
	                                            { key: 'image_report', icon: ImageIcon, text: '图文报告', desc: '结合图表多模态' }
	                                          ].map((item) => (
	                                            <button
	                                              key={item.key}
	                                              type="button"
	                                              disabled={!canStart}
	                                              onClick={() => handleTaskClick(item.key)}
	                                              className={cn(
	                                                'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all',
	                                                'bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-700',
	                                                canStart
	                                                  ? 'hover:border-teal-500 hover:shadow-sm cursor-pointer'
	                                                  : 'opacity-60 cursor-not-allowed'
	                                              )}
	                                            >
	                                              <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
	                                                <item.icon className="h-4.5 w-4.5 text-slate-700 dark:text-slate-200" />
	                                              </div>
	                                              <div className="min-w-0">
	                                                <div className="text-sm font-medium text-slate-900 dark:text-white">
	                                                  {item.text}
	                                                </div>
	                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
	                                                  {item.desc}
	                                                </div>
	                                              </div>
	                                            </button>
	                                          ))}
	                                        </div>

	                                        {customPrompts.length > 0 && (
	                                          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
	                                            {customPrompts.map((cp) => (
	                                              <Button
	                                                key={cp.id}
	                                                size="sm"
	                                                variant="outline"
	                                                disabled={!canStart}
	                                                className="h-8 text-xs gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/20"
	                                                onClick={() => handleRunCustomPrompt(cp.prompt)}
	                                              >
	                                                <Zap className="h-3.5 w-3.5" />
	                                                <span className="max-w-[140px] truncate">{cp.name}</span>
	                                              </Button>
	                                            ))}
	                                          </div>
	                                        )}

	                                        <Button
	                                          variant="ghost"
	                                          size="sm"
	                                          className="mt-6 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
	                                          onClick={() => setActiveSidebarItem('new-chat')}
	                                        >
	                                          返回 Start（选择 Prompt）
	                                        </Button>
	                                      </div>
	                                    );
	                                  }

                                  // 默认展示最新版本；用户可以通过左右切换查看历史版本
                                  const safeIndex =
                                    summaryVersionIndex == null
                                      ? totalVersions - 1
                                      : Math.min(Math.max(summaryVersionIndex, 0), totalVersions - 1);
                                  const activeMsg = versions[safeIndex];

                                  return (
                                    <div className="space-y-10">
                                        {/* 分析失败的内联错误横幅（已有历史版本时） */}
                                        {analysisError && (
                                          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-red-700 dark:text-red-400">新一次分析失败</p>
                                              <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-1 line-clamp-2">{analysisError.message}</p>
                                              <div className="flex items-center gap-2 mt-2.5">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-6 text-[11px] px-2 border-red-200 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                                                  onClick={() => {
                                                    setAnalysisError(null);
                                                    setError(null);
                                                    useLiteratureAssistantStore.setState({ isSending: false });
                                                    if (analysisError.taskType) {
                                                      handleTaskClick(analysisError.taskType);
                                                    }
                                                  }}
                                                  disabled={!currentSession || documents.length === 0 || isAnalyzing}
                                                >
                                                  <RefreshCw className="h-3 w-3 mr-1" />
                                                  重新生成
                                                </Button>
                                                <span className="text-[10px] text-red-500/60 dark:text-red-400/50">建议先切换模型再重试</span>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 text-[11px] px-1.5 text-red-400 hover:text-red-600 ml-auto"
                                                  onClick={() => {
                                                    setAnalysisError(null);
                                                    setError(null);
                                                    useLiteratureAssistantStore.setState({ isSending: false });
                                                  }}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        {[activeMsg].map((msg, idx) => (
                                            <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                                {/* Blog Post Header Style */}
                                                {idx === 0 && (
                                                  <div className="mb-10 pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                                                        <div className="flex items-center gap-3">
                                                          {isEditingTitle ? (
                                                            <Input
                                                              autoFocus
                                                              className="h-10 text-2xl font-bold border-slate-300 dark:border-slate-600 bg-transparent px-2"
                                                              value={editingTitleValue}
                                                              onChange={(e) => setEditingTitleValue(e.target.value)}
                                                              onBlur={async () => {
                                                                const trimmed = editingTitleValue.trim();
                                                                if (currentSession && trimmed && trimmed !== currentSession.title) {
                                                                  try {
                                                                    await updateSessionTitle(currentSession.id, trimmed);
                                                                  } catch (e) {
                                                                    console.error('更新标题失败:', e);
                                                                    toast.error('更新标题失败');
                                                                  }
                                                                }
                                                                setIsEditingTitle(false);
                                                              }}
                                                              onKeyDown={async (e) => {
                                                                if (e.key === 'Enter') {
                                                                  e.currentTarget.blur();
                                                                } else if (e.key === 'Escape') {
                                                                  setIsEditingTitle(false);
                                                                }
                                                              }}
                                                            />
                                                          ) : (
                                                            <h1
                                                              className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight cursor-text"
                                                              onClick={() => {
                                                                const title = currentSession?.title || '文献深度解读';
                                                                setEditingTitleValue(title);
                                                                setIsEditingTitle(true);
                                                              }}
                                                            >
                                                              {currentSession?.title || '文献深度解读'}
                                                            </h1>
                                                          )}
                                                          {!isEditingTitle && (
                                                            <Button
                                                              type="button"
                                                              size="icon"
                                                              variant="ghost"
                                                              className="h-8 w-8 text-slate-400 hover:text-slate-700"
                                                              onClick={() => {
                                                                const title = currentSession?.title || '文献深度解读';
                                                                setEditingTitleValue(title);
                                                                setIsEditingTitle(true);
                                                              }}
                                                            >
                                                              <Pencil className="h-4 w-4" />
                                                            </Button>
                                                          )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                                                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 min-w-0">
                                                            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatTime(msg.created_at)}</span>
                                                            <div className="flex items-center">
                                                              <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                  <Button variant="ghost" size="sm" className="h-6 gap-2 px-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 -ml-2">
                                                                    <FolderOpen className="h-4 w-4" />
                                                                    <span className="font-medium text-xs">
                                                                      {folders.find(f => f.id === currentSession?.status)?.name || 'All Publications'}
                                                                    </span>
                                                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                                                  </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="start" className="w-56" side="bottom">
                                                                    <DropdownMenuLabel>Move to Collection</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    {folders.filter(f => f.id !== 'all' && f.id !== 'cns-favorites').map(folder => (
                                                                        <DropdownMenuItem 
                                                                          key={folder.id} 
                                                                          onClick={() => currentSession && handleUpdateSessionStatus(currentSession.id, folder.id)}
                                                                        >
                                                                          <div className="flex items-center flex-1">
                                                                             <folder.icon className="h-4 w-4 mr-2 opacity-70" /> 
                                                                             <span>{folder.name}</span>
                                                                          </div>
                                                                          {currentSession?.status === folder.id && <CheckCircle2 className="h-4 w-4 ml-auto" />}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                    
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={() => {
                                                                        if (currentSession) {
                                                                            setCreateFolderValue('');
                                                                            setSessionToMoveId(currentSession.id);
                                                                            setShowCreateFolderDialog(true);
                                                                        }
                                                                    }}>
                                                                      <Plus className="h-4 w-4 mr-2" /> New Collection
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                              </DropdownMenu>
                                                            </div>
                                                          </div>
                                                          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                                                            {/* 历史版本切换 */}
                                                            {totalVersions > 1 && (
                                                              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                                <Button
                                                                  type="button"
                                                                  size="icon"
                                                                  variant="ghost"
                                                                  className="h-7 w-7"
                                                                  disabled={safeIndex <= 0}
                                                                  onClick={() => {
                                                                    setSummaryVersionIndex((prev) => {
                                                                      const current = prev == null ? totalVersions - 1 : prev;
                                                                      return Math.max(current - 1, 0);
                                                                    });
                                                                  }}
                                                                  title="查看上一版总结"
                                                                >
                                                                  <ChevronLeft className="h-3 w-3" />
                                                                </Button>
                                                                <span className="min-w-[90px] text-center">
                                                                  版本 {safeIndex + 1} / {totalVersions}
                                                                </span>
                                                                <Button
                                                                  type="button"
                                                                  size="icon"
                                                                  variant="ghost"
                                                                  className="h-7 w-7"
                                                                  disabled={safeIndex >= totalVersions - 1}
                                                                  onClick={() => {
                                                                    setSummaryVersionIndex((prev) => {
                                                                      const current = prev == null ? totalVersions - 1 : prev;
                                                                      return Math.min(current + 1, totalVersions - 1);
                                                                    });
                                                                  }}
                                                                  title="查看下一版总结"
                                                                >
                                                                  <ChevronRight className="h-3 w-3" />
                                                                </Button>
                                                              </div>
                                                            )}
                                                            {/* Reading Mode 模型选择器 - 紧凑内联 */}
                                                            <Popover open={readingModelPopoverOpen} onOpenChange={setReadingModelPopoverOpen}>
                                                              <PopoverTrigger asChild>
                                                                <Button
                                                                  type="button"
                                                                  size="sm"
                                                                  variant="ghost"
                                                                  className="h-8 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 gap-1"
                                                                >
                                                                  <Box className="h-3.5 w-3.5 text-teal-500" />
                                                                  <span className="max-w-[100px] truncate">{summaryProvider || config?.defaultProvider || 'Gemini-2.5-Pro'}</span>
                                                                  <ChevronDown className="h-3 w-3 opacity-50" />
                                                                </Button>
                                                              </PopoverTrigger>
                                                              <PopoverContent className="w-56 p-1.5 max-h-[60vh] overflow-y-auto" align="end">
                                                                <div className="text-[10px] text-slate-400 px-2 py-1 mb-1">切换分析模型</div>
                                                                {config?.providers.map(p => {
                                                                  const detail = config.providersDetail?.[p];
                                                                  const isMultimodal = detail?.multimodal ?? false;
                                                                  const isEnabled = detail?.enabled !== false;
                                                                  const isSelected = (summaryProvider || config?.defaultProvider) === p;
                                                                  return (
                                                                    <button
                                                                      key={p}
                                                                      type="button"
                                                                      disabled={!isEnabled}
                                                                      onClick={() => {
                                                                        if (!isEnabled) return;
                                                                        setSummaryProvider(p);
                                                                        setReadingModelPopoverOpen(false);
                                                                      }}
                                                                      className={cn(
                                                                        "w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 transition-colors",
                                                                        !isEnabled
                                                                          ? "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-500"
                                                                          : isSelected
                                                                            ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                                                                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                                                      )}
                                                                    >
                                                                      <span className="truncate">{p}</span>
                                                                      <div className="flex items-center gap-1 shrink-0">
                                                                        {isMultimodal && (
                                                                          <span className={cn(
                                                                            "text-[9px] px-1 py-0.5 rounded",
                                                                            !isEnabled
                                                                              ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                                                                              : "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300"
                                                                          )}>
                                                                            多模态
                                                                          </span>
                                                                        )}
                                                                        {isSelected && isEnabled && <CheckCircle2 className="h-3 w-3 text-teal-500" />}
                                                                      </div>
                                                                    </button>
                                                                  );
                                                                })}
                                                              </PopoverContent>
                                                            </Popover>
                                                            <Popover open={showSummaryPromptSwitcher} onOpenChange={setShowSummaryPromptSwitcher}>
                                                              <PopoverTrigger asChild>
                                                                <Button
                                                                  type="button"
                                                                  size="sm"
                                                                  variant="outline"
                                                                  className="h-8 text-xs flex items-center gap-1"
                                                                >
                                                                  重新生成总结
                                                                  <ChevronDown className="h-3 w-3" />
                                                                </Button>
                                                              </PopoverTrigger>
                                                              <PopoverContent align="end" className="w-64">
                                                                <div className="text-xs font-semibold text-slate-500 mb-2">选择总结提示词</div>
                                                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                                                  {prompts?.tasks && Object.entries(prompts.tasks)
                                                                    .filter(([key]) => key !== 'titleGeneration')
                                                                    .map(([key, value]: any) => (
                                                                      <button
                                                                        key={key}
                                                                        type="button"
                                                                        className={cn(
                                                                          'w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-slate-100 dark:hover:bg-slate-800',
                                                                          summaryTaskTypeForRegenerate === key && 'bg-teal-50 text-teal-700 dark:bg-teal-900/30'
                                                                        )}
                                                                        onClick={() => {
                                                                          const taskType = key || selectedWelcomeTask || getDefaultReadingTaskType();
                                                                          // 图文报告需要多模态模型，检查当前模型是否支持
                                                                          if (taskType === 'image_report') {
                                                                            const currentProvider = summaryProvider || config?.defaultProvider || '';
                                                                            const detail = config?.providersDetail?.[currentProvider];
                                                                            const isCurrentMultimodal = detail?.multimodal ?? false;
                                                                            if (!isCurrentMultimodal) {
                                                                              setShowSummaryPromptSwitcher(false);
                                                                              setPendingTaskType(taskType);
                                                                              setShowModelMismatchDialog(true);
                                                                              return;
                                                                            }
                                                                          }
                                                                          setSummaryTaskTypeForRegenerate(key);
                                                                          setShowSummaryPromptSwitcher(false);
                                                                          // 用户选择新模式重新生成时，版本索引重置为最新
                                                                          setSummaryVersionIndex(null);
                                                                          (async () => {
                                                                            if (!currentSession) {
                                                                              toast.error('请先创建对话');
                                                                              return;
                                                                            }
                                                                            if (documents.length === 0) {
                                                                              toast.error('请先上传 PDF 文档');
                                                                              return;
                                                                            }
                                                                            if (!taskType) {
                                                                              toast.error('尚未配置默认阅读模式');
                                                                              return;
                                                                            }
                                                                            try {
                                                                              setAnalyzingSessionId(currentSession.id);
                                                                              setAnalysisError(null);
                                                                              await regenerateSummary(currentSession.id, taskType);
                                                                              toast.success('已重新生成文献总结');
                                                                            } catch (e) {
                                                                              const msg = e instanceof Error ? e.message : '重新生成失败';
                                                                              setAnalysisError({ message: msg, taskType });
                                                                            } finally {
                                                                              setAnalyzingSessionId(prev => prev === currentSession.id ? null : prev);
                                                                            }
                                                                          })();
                                                                        }}
                                                                      >
                                                                        <div className="font-medium truncate">{value.name || key}</div>
                                                                        {value.description && (
                                                                          <div className="text-[11px] text-slate-400 truncate">
                                                                            {value.description}
                                                                          </div>
                                                                        )}
                                                                      </button>
                                                                    ))}
                                                                  {customPrompts.length > 0 && (
                                                                    <>
                                                                      <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 text-[11px] text-slate-400">
                                                                        或使用自定义总结模板
                                                                      </div>
                                                                      {customPrompts.map((cp) => (
                                                                        <button
                                                                          key={cp.id}
                                                                          type="button"
                                                                          className="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                                                          onClick={async () => {
                                                                            setShowSummaryPromptSwitcher(false);
                                                                            // 使用自定义模板重新生成总结时，默认展示最新版本
                                                                            setSummaryVersionIndex(null);
                                                                            if (!currentSession) {
                                                                              toast.error('请先创建对话');
                                                                              return;
                                                                            }
                                                                            if (documents.length === 0) {
                                                                              toast.error('请先上传 PDF 文档');
                                                                              return;
                                                                            }
                                                                            try {
                                                                              setAnalyzingSessionId(currentSession.id);
                                                                              setAnalysisError(null);
                                                                              await regenerateSummary(currentSession.id, 'custom', cp.prompt);
                                                                              toast.success('已重新生成文献总结');
                                                                            } catch (e) {
                                                                              const msg = e instanceof Error ? e.message : '重新生成失败';
                                                                              setAnalysisError({ message: msg });
                                                                            } finally {
                                                                              setAnalyzingSessionId(prev => prev === currentSession.id ? null : prev);
                                                                            }
                                                                          }}
                                                                        >
                                                                          <Zap className="h-3 w-3 text-purple-500" />
                                                                          <span className="truncate">{cp.name}</span>
                                                                        </button>
                                                                      ))}
                                                                    </>
                                                                  )}
                                                                  {!prompts?.tasks && customPrompts.length === 0 && (
                                                                    <div className="text-xs text-slate-400">暂无可用提示模板</div>
                                                                  )}
                                                                </div>
                                                              </PopoverContent>
                                                            </Popover>
                                                            {/* Download Dropdown */}
                                                            <DropdownMenu>
                                                              <DropdownMenuTrigger asChild>
                                                                <Button
                                                                  type="button"
                                                                  size="sm"
                                                                  variant="outline"
                                                                  className="h-8 text-xs flex items-center gap-1"
                                                                >
                                                                  <Download className="h-3.5 w-3.5" />
                                                                  下载
                                                                  <ChevronDown className="h-3 w-3" />
                                                                </Button>
                                                              </DropdownMenuTrigger>
                                                              <DropdownMenuContent align="end" className="w-56">
                                                                <DropdownMenuLabel>下载内容</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                {/* AI 回复下载 */}
                                                                <DropdownMenuLabel className="text-[10px] text-slate-400 font-normal">AI 报告</DropdownMenuLabel>
                                                                <DropdownMenuItem
                                                                  onClick={async () => {
                                                                    if (!msg?.id) return;
                                                                    try {
                                                                      await literatureAssistantAPI.downloadAiResponseMd(msg.id);
                                                                      toast.success('AI 报告已下载');
                                                                    } catch (e) {
                                                                      toast.error('下载失败: ' + (e instanceof Error ? e.message : '未知错误'));
                                                                    }
                                                                  }}
                                                                >
                                                                  <FileText className="h-4 w-4 mr-2" />
                                                                  下载 AI 报告
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                {/* 原始文献下载 */}
                                                                <DropdownMenuLabel className="text-[10px] text-slate-400 font-normal">原始文献</DropdownMenuLabel>
                                                                {documents.map((doc) => (
                                                                  <DropdownMenuItem
                                                                    key={doc.id}
                                                                    onClick={async () => {
                                                                      try {
                                                                        await literatureAssistantAPI.downloadOriginalPdf(doc.id, doc.original_name);
                                                                        toast.success('PDF 已下载');
                                                                      } catch (e) {
                                                                        toast.error('下载失败: ' + (e instanceof Error ? e.message : '未知错误'));
                                                                      }
                                                                    }}
                                                                  >
                                                                    <Download className="h-4 w-4 mr-2" />
                                                                    下载 PDF
                                                                  </DropdownMenuItem>
                                                                ))}
                                                                {/* MinerU 解析内容 - 仅当有已解析文档时显示 */}
                                                                {documents.some(d => d.parse_mode === 'image_aware') && (
                                                                  <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuLabel className="text-[10px] text-slate-400 font-normal">论文解析</DropdownMenuLabel>
                                                                    {documents.filter(d => d.parse_mode === 'image_aware').map((doc) => (
                                                                      <React.Fragment key={`mineru-${doc.id}`}>
                                                                        <DropdownMenuItem
                                                                          onClick={async () => {
                                                                            try {
                                                                              await literatureAssistantAPI.downloadMineruMarkdown(doc.id);
                                                                              toast.success('论文解析 Markdown 已下载');
                                                                            } catch (e) {
                                                                              toast.error('下载失败: ' + (e instanceof Error ? e.message : '未知错误'));
                                                                            }
                                                                          }}
                                                                        >
                                                                          <FileText className="h-4 w-4 mr-2" />
                                                                          <span className="truncate">下载论文解析 Markdown</span>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                          onClick={async () => {
                                                                            try {
                                                                              await literatureAssistantAPI.downloadMineruFolder(doc.id);
                                                                              toast.success('论文解析完整文件已下载');
                                                                            } catch (e) {
                                                                              toast.error('下载失败: ' + (e instanceof Error ? e.message : '未知错误'));
                                                                            }
                                                                          }}
                                                                        >
                                                                          <FolderOpen className="h-4 w-4 mr-2" />
                                                                          <span className="truncate">下载论文解析完整文件</span>
                                                                        </DropdownMenuItem>
                                                                      </React.Fragment>
                                                                    ))}
                                                                  </>
                                                                )}
                                                              </DropdownMenuContent>
                                                            </DropdownMenu>
                                                          </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <MemoMessageContent message={msg} documentId={documents[0]?.id} />
                                            </div>
                                        ))}
                                    </div>
                                  );
                                })()}
                            </div>
                            </ScrollArea>
                          </div>
                        )}
                </div>
             </ResizablePanel>

             {/* Right: Tools (Assistant, Paper, etc) - Modern Tech Style */}
             {!isNewChatView && showRightPanel && (
                <>
                  <ResizableHandle withHandle className="bg-slate-200 dark:bg-slate-800" />
                  <ResizablePanel defaultSize={40} minSize={25} className="bg-slate-50 dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 flex flex-col">
                     {/* Right Panel Header */}
                     <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-2 bg-white dark:bg-[#0F172A] min-w-0">
                         <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as any)} className="h-full w-full min-w-0">
                             <TabsList className="h-full bg-transparent p-0 gap-6 w-full justify-start px-4 overflow-x-auto overflow-y-hidden">
                                 <TabsTrigger value="assistant" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-400 bg-transparent px-1 font-medium text-slate-500 hover:text-slate-700">Assistant</TabsTrigger>
                                 <TabsTrigger value="paper" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-400 bg-transparent px-1 font-medium text-slate-500 hover:text-slate-700">Paper</TabsTrigger>
                                 <TabsTrigger value="notes" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-400 bg-transparent px-1 font-medium text-slate-500 hover:text-slate-700">My Notes</TabsTrigger>
                                 <TabsTrigger value="similar" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-400 bg-transparent px-1 font-medium text-slate-500 hover:text-slate-700">Similar</TabsTrigger>
                             </TabsList>
                         </Tabs>
                     </div>

                     {/* Right Panel Content */}
                     <div className="flex-1 min-h-0 overflow-hidden relative bg-slate-50 dark:bg-[#0F172A]">
                         {rightPanelTab === 'assistant' && (
                             <div className="flex flex-col h-full min-h-0">
                                 {/* Chat Messages (Assistant View) */}
                                <ScrollArea
                                  className="flex-1 min-h-0 p-4"
                                  viewportRef={viewportRef}
                                  onViewportScroll={handleViewportScroll}
                                >
                                     {messages.filter(m => m.role === 'user' && (m.content || '').trim() !== '').length === 0 ? (
                                         <div className="max-w-2xl mx-auto mt-10 px-4">
                                             <div className="flex justify-center mb-8">
                                                 <div className="h-16 w-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-600 border border-teal-100 dark:border-teal-900 shadow-sm">
                                                     <Sparkles className="h-8 w-8" />
                                                 </div>
                                             </div>
                                            
                                             <h3 className="text-center font-semibold text-slate-900 dark:text-white mb-8 text-lg">How can I help you with this paper?</h3>

                                             <div className="flex justify-center mb-4">
                                               <Button
                                                 variant="outline"
                                                 size="sm"
                                                 className="h-7 text-xs gap-1"
                                                 onClick={() => {
                                                   if (!selectedPDF && documents.length > 0) {
                                                     setSelectedPDF(documents[0].id);
                                                   }
                                                   setRightPanelTab('paper');
                                                 }}
                                               >
                                                 <FileText className="h-3 w-3" />
                                                 查看 PDF
                                               </Button>
                                             </div>

                                             <div className="grid grid-cols-1 gap-3">
                                                 {/* Card 1: Highlight & Ask */}
                                                 <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] hover:border-teal-500 hover:shadow-sm transition-all cursor-pointer group flex items-center gap-4">
                                                     <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                         <PenTool className="h-5 w-5" />
                                                     </div>
                                                     <div>
                                                         <h3 className="font-medium text-sm text-slate-900 dark:text-white">Highlight & Ask</h3>
                                                         <p className="text-xs text-slate-500 dark:text-slate-400">Select text in the PDF to ask specific questions</p>
                                                     </div>
                                                     <ArrowRight className="h-4 w-4 text-slate-300 ml-auto group-hover:text-teal-500 transition-colors" />
                                                 </div>

                                                 {/* Card 2: Add Context */}
                                                 <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] hover:border-teal-500 hover:shadow-sm transition-all cursor-pointer group flex items-center gap-4">
                                                     <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                         <FileStack className="h-5 w-5" />
                                                     </div>
                                                     <div>
                                                         <h3 className="font-medium text-sm text-slate-900 dark:text-white">Cross-Reference</h3>
                                                         <p className="text-xs text-slate-500 dark:text-slate-400">Compare findings with other papers in your library</p>
                                                     </div>
                                                     <ArrowRight className="h-4 w-4 text-slate-300 ml-auto group-hover:text-teal-500 transition-colors" />
                                                 </div>

                                                 {/* Card 3: Quick Prompts */}
                                                 <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] hover:border-teal-500 hover:shadow-sm transition-all cursor-pointer group flex items-center gap-4" onClick={() => setInputMessage("What are the key contributions of this paper?")}>
                                                     <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                         <Zap className="h-5 w-5" />
                                                     </div>
                                                     <div>
                                                         <h3 className="font-medium text-sm text-slate-900 dark:text-white">Key Contributions</h3>
                                                         <p className="text-xs text-slate-500 dark:text-slate-400">Summarize the main innovations</p>
                                                     </div>
                                                     <ArrowRight className="h-4 w-4 text-slate-300 ml-auto group-hover:text-teal-500 transition-colors" />
                                                 </div>
                                             </div>
                                             {/* Reading 模式下不再展示自定义 Prompt 设置，仅保留基础引导卡片 */}
                                            </div>
                                          
                                      ) : (
                                         <div className="space-y-6 pb-4">
                                             {visibleMessages.map(msg => (
                                                 <div key={msg.id} className={cn("flex gap-4 group relative", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                                                     <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-sm", msg.role === 'user' ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-teal-600 dark:bg-slate-800 dark:border-slate-700")}>
                                                         {msg.role === 'user' ? <span className="text-xs font-bold">U</span> : <Sparkles className="h-4 w-4" />}
                                                     </div>
                                                     <div className="relative max-w-[85%]">
                                                        {editingMessageId === msg.id ? (
                                                            <div className="bg-white dark:bg-slate-800 border border-teal-500 rounded-2xl p-3 shadow-md w-full min-w-[300px]">
                                                                <Textarea
                                                                    value={editingContent}
                                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                                    className="min-h-[80px] w-full resize-none border-none bg-transparent p-0 text-sm focus-visible:ring-0"
                                                                    autoFocus
                                                                />
                                                                <div className="flex justify-end gap-2 mt-2">
                                                                    <Button size="sm" variant="ghost" onClick={handleEditCancel} className="h-7 text-xs">取消</Button>
                                                                    <Button size="sm" onClick={() => handleEditConfirm(msg.id)} className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white">发送</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className={cn("text-sm leading-relaxed", msg.role === 'user' ? "bg-slate-800 text-white p-3.5 rounded-2xl rounded-tr-sm shadow-sm" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 p-4 rounded-2xl rounded-tl-sm shadow-sm")}>
                                                                    {msg.role === 'user' ? msg.content : <MemoMessageContent message={msg} documentId={documents[0]?.id} />}
                                                                </div>
                                                                {/* Action Bar: Positioned to the side to avoid overlap */}
                                                                <div className={cn(
                                                                    "absolute top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                                                                    msg.role === 'user' ? "-left-8 items-end" : "-right-8 items-start"
                                                                )}>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-sm" onClick={() => handleCopy(msg.content)} title="复制">
                                                                        <Copy className="h-3 w-3 text-slate-500" />
                                                                    </Button>
                                                                    {msg.role === 'user' && msg.id === lastUserMessageId && (
                                                                        <>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-sm" onClick={() => handleEditStart(msg)} title="修改">
                                                                                <Pencil className="h-3 w-3 text-slate-500" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-sm" onClick={() => handleResend(msg.content, msg.id)} title="重新发送">
                                                                                <RefreshCw className="h-3 w-3 text-slate-500" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                     </div>
                                                 </div>
                                             ))}
                                             {isSending && (
                                                 <div className="flex gap-4">
                                                     <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-teal-600 flex items-center justify-center shrink-0 mt-1 shadow-sm"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                                     <div className="text-sm text-slate-500 mt-2">AI 正在回复…</div>
                                                 </div>
                                             )}
                                             <div ref={messagesEndRef} />
                                         </div>
                                     )}
                                 </ScrollArea>

                                 {/* Chat Error Banner - 右侧 Assistant 对话错误提示 */}
                                 {chatError && (
                                   <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-900/50">
                                     <div className="flex items-start gap-2.5">
                                       <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                       <div className="flex-1 min-w-0">
                                         <p className="text-xs font-medium text-red-700 dark:text-red-400">对话失败</p>
                                         <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5 line-clamp-2">{chatError.message}</p>
                                         <div className="flex items-center gap-2 mt-2">
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             className="h-6 text-[11px] px-2 border-red-200 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                                             onClick={() => {
                                               setChatError(null);
                                               setError(null);
                                               useLiteratureAssistantStore.setState({ isSending: false });
                                               if (chatError.userText) {
                                                 setInputMessage(chatError.userText);
                                               }
                                             }}
                                           >
                                             <RefreshCw className="h-3 w-3 mr-1" />
                                             重新发送
                                           </Button>
                                           <span className="text-[10px] text-red-500/60 dark:text-red-400/50">或尝试切换下方模型后重试</span>
                                           <Button
                                             size="sm"
                                             variant="ghost"
                                             className="h-6 text-[11px] px-1.5 text-red-400 hover:text-red-600 ml-auto"
                                             onClick={() => {
                                               setChatError(null);
                                               setError(null);
                                               useLiteratureAssistantStore.setState({ isSending: false });
                                             }}
                                           >
                                             <X className="h-3 w-3" />
                                           </Button>
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                 )}

                                 {/* Chat Input - Modern Tech Style */}
                                 <div className="p-4 bg-white dark:bg-[#0F172A] border-t border-slate-200 dark:border-slate-800">
                                     <div className="relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
                                         <Textarea 
                                             value={inputMessage}
                                             onChange={e => setInputMessage(e.target.value)}
                                             onKeyDown={handleKeyDown}
                                             placeholder="Ask a question..."
                                             className="min-h-[48px] max-h-[120px] w-full resize-none border-none bg-transparent py-3 px-3 pr-12 text-sm focus-visible:ring-0 placeholder:text-slate-400"
                                         />
                                         <div className="absolute right-2 bottom-2 flex items-center gap-1">
                                             <Button 
                                                 size="icon" 
                                                 className={cn("h-8 w-8 rounded-lg transition-all shadow-sm", inputMessage.trim() ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-slate-200 text-slate-400 hover:bg-slate-300 dark:bg-slate-800")}
                                                 disabled={!inputMessage.trim() || isSending}
                                                 onClick={handleSendMessage}
                                             >
                                                 <ArrowRight className="h-4 w-4" />
                                             </Button>
                                         </div>
                                     </div>
                                     <div className="text-center mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <Sparkles className="h-3 w-3 text-teal-500" />
                                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide truncate">
                                           Powered by {assistantProvider || (config as any)?.assistantDefaultProvider || config?.defaultProvider || '加载中...'}
                                          </span>
                                        </div>
                                         <Select
                                           value={assistantProvider || (config as any)?.assistantDefaultProvider || config?.defaultProvider || ''}
                                           onValueChange={setAssistantProvider}
                                         >
                                            <SelectTrigger className="h-5 text-[10px] w-auto border-none bg-transparent p-0 text-slate-400 hover:text-slate-600 focus:ring-0 gap-1">
                                                <SelectValue placeholder="选择模型" />
                                            </SelectTrigger>
                                            <SelectContent>
                                               {config?.providers.map(p => {
                                                   const detail = config?.providersDetail?.[p];
                                                   const isEnabled = detail?.enabled !== false;
                                                   return (
                                                       <SelectItem 
                                                           key={p} 
                                                           value={p} 
                                                           className={cn("text-xs", !isEnabled && "opacity-50 cursor-not-allowed")}
                                                           disabled={!isEnabled}
                                                       >
                                                           {p}{!isEnabled && ' (不可用)'}
                                                       </SelectItem>
                                                   );
                                               })}
                                           </SelectContent>
                                         </Select>
                                     </div>
                                 </div>
                             </div>
                         )}

                         {rightPanelTab === 'paper' && (
                             <div className="h-full bg-slate-100 dark:bg-[#0B1120] flex flex-col">
                               {documents.length > 1 && (
                                 <div className="h-11 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white/80 dark:bg-[#0F172A]/80">
                                   <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">当前 PDF：</span>
                                   <div className="flex flex-wrap gap-1">
                                     {documents.map((doc) => (
                                       <button
                                         key={doc.id}
                                         type="button"
                                         className={cn(
                                           'px-2 py-1 rounded-full text-xs border transition-colors max-w-[140px] truncate',
                                           selectedPDF === doc.id
                                             ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-300'
                                             : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                                         )}
                                         onClick={() => setSelectedPDF(doc.id)}
                                       >
                                         {doc.original_name}
                                       </button>
                                     ))}
                                   </div>
                                 </div>
                               )}
                               <div className="flex-1">
                                 {selectedPDF ? (
                                   <PDFPreview documentId={selectedPDF} />
                                 ) : documents.length > 0 ? (
                                   <PDFPreview documentId={documents[0].id} />
                                 ) : (
                                   <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                                     <FileText className="h-10 w-10 opacity-50" />
                                     <span className="text-sm font-medium">No PDF Selected</span>
                                   </div>
                                 )}
                               </div>
                             </div>
                         )}

                         {rightPanelTab === 'notes' && (
                             <div className="h-full p-4 bg-slate-50 dark:bg-[#0F172A] flex flex-col">
                                 <Textarea
                                   placeholder="Take notes here..."
                                   className="flex-1 resize-none bg-transparent border-none focus-visible:ring-0 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                                   value={notes}
                                   onChange={(e) => {
                                     setNotes(e.target.value);
                                     setNotesDirty(true);
                                   }}
                                   onBlur={handleSaveNotes}
                                 />
                                 <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                                   <span>
                                     {notesSaving
                                       ? 'Saving...'
                                       : notesDirty
                                         ? '有未保存的修改（失焦时自动保存）'
                                         : '已保存'}
                                   </span>
                                   {notesError && (
                                     <span className="text-red-500 dark:text-red-400 truncate max-w-[60%]">
                                       {notesError}
                                     </span>
                                   )}
                                 </div>
                             </div>
                         )}
                     </div>
                  </ResizablePanel>
                </>
             )}

        </ResizablePanelGroup>
        )}
        
        {/* Global File Input */}
        <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={e => handleFileSelect(e.target.files)} />
        
        {/* Dialogs */}
        <Dialog
          open={showMultiUploadModeDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowMultiUploadModeDialog(false);
              setPendingLibraryFiles(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>检测到多份 PDF 文件</DialogTitle>
              <DialogDescription>
                你可以选择将它们作为多个独立文献，或作为一个包含多 PDF 的文献组上传到当前 Library 分组中。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-sm text-slate-600 dark:text-slate-200">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                已选择 {pendingLibraryFiles?.length || 0} 个 PDF 文件
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg border flex flex-col gap-0.5',
                    multiUploadMode === 'group'
                      ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                  onClick={() => setMultiUploadMode('group')}
                >
                  <span className="text-sm font-medium">作为一个文献组上传</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    创建一个文献条目，内部包含多份 PDF，适合同一课题的补充材料。
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg border flex flex-col gap-0.5',
                    multiUploadMode === 'separate'
                      ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                  onClick={() => setMultiUploadMode('separate')}
                >
                  <span className="text-sm font-medium">拆分为多个文献上传</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    为每个 PDF 创建一个独立文献条目，方便单独管理和阅读。
                  </span>
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowMultiUploadModeDialog(false);
                  setPendingLibraryFiles(null);
                }}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!pendingLibraryFiles || pendingLibraryFiles.length === 0) {
                    setShowMultiUploadModeDialog(false);
                    return;
                  }
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('literature_multi_upload_mode', multiUploadMode);
                  }
                  const files = pendingLibraryFiles;
                  setShowMultiUploadModeDialog(false);
                  setPendingLibraryFiles(null);

                  let statusForNew: string | null = null;
                  if (currentFolder !== 'all') {
                    if (currentFolder === 'reading') {
                      statusForNew = 'reading';
                    } else {
                      statusForNew = currentFolder;
                    }
                  }

                  try {
                    if (multiUploadMode === 'separate') {
                      let lastSessionId: string | null = null;
                      for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        if (file.type !== 'application/pdf') {
                          toast.error(`${file.name} 不是 PDF 文件`);
                          continue;
                        }
                        const baseName = file.name.replace(/\.[^/.]+$/, '');
                        const session = await createSession(baseName || undefined);
                        lastSessionId = session.id;
                        if (statusForNew) {
                          try {
                            await literatureAssistantAPI.updateSession(session.id, { status: statusForNew as string });
                          } catch (e) {
                            console.error('设置新会话状态失败:', e);
                          }
                        }
                        try {
                          await uploadDocument(session.id, file);
                          toast.success(`${file.name} 上传成功`);
                        } catch (error) {
                          console.error('上传失败:', error);
                          toast.error(`${file.name} 上传失败`);
                        }
                      }
                      await loadSessions();
                      if (lastSessionId) setSelectedFileId(lastSessionId);
                    } else {
                      // group 模式：单一会话下挂多个 PDF
                      const firstFile = files[0];
                      const baseName = firstFile.name.replace(/\.[^/.]+$/, '');
                      const session = await createSession(baseName || undefined);
                      if (statusForNew) {
                        try {
                          await literatureAssistantAPI.updateSession(session.id, { status: statusForNew as string });
                        } catch (e) {
                          console.error('设置新会话状态失败:', e);
                        }
                      }
                      for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        if (file.type !== 'application/pdf') {
                          toast.error(`${file.name} 不是 PDF 文件`);
                          continue;
                        }
                        try {
                          await uploadDocument(session.id, file);
                          toast.success(`${file.name} 上传成功`);
                        } catch (error) {
                          console.error('上传失败:', error);
                          toast.error(`${file.name} 上传失败`);
                        }
                      }
                      await loadSessions();
                      setSelectedFileId(session.id);
                    }
                  } catch (e) {
                    console.error('多文件上传失败:', e);
                    toast.error('多文件上传失败');
                  }
                }}
              >
                确认上传
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showCreateCustom} onOpenChange={setShowCreateCustom}>
          <DialogContent
            className={cn(
              "sm:max-w-lg transition-opacity duration-300",
              createDialogHovered ? "opacity-100" : "opacity-90"
            )}
            onPointerEnter={() => setCreateDialogHovered(true)}
            onPointerLeave={() => setCreateDialogHovered(false)}
            onFocusCapture={() => setCreateDialogHovered(true)}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                setCreateDialogHovered(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>新增自定义阅读模式</DialogTitle>
              <DialogDescription>
                为你的学科/领域创建专属的快速阅读模板。系统会自动注入当前会话下所有已解析 PDF 的正文内容。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-3">
                <div>
                  <div className="text-xs mb-1 text-slate-600 dark:text-slate-300">名称</div>
                  <Input
                    value={customPromptName}
                    onChange={(e) => setCustomPromptName(e.target.value)}
                    placeholder="如：生物学-方法总结"
                  />
                </div>
                <div>
                  <div className="text-xs mb-1 text-slate-600 dark:text-slate-300">Prompt 模板</div>
                  <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300 mb-2">
                    <div className="font-medium mb-1">固定上下文（不可编辑）</div>
                    <div>
                      当前模式会自动注入：
                      <span className="font-mono text-[10px]"> {"{content}"} </span>
                      ，代表本次会话下所有已成功解析的 PDF 文本内容。
                    </div>
                  </div>
                  <Textarea
                    value={customPromptText}
                    onChange={(e) => setCustomPromptText(e.target.value)}
                    placeholder={"在此编写你的模板，系统会将 {content} 替换为文献全文，你可以在合适的位置保留或移动它"}
                    className="min-h-[160px]"
                  />
                  <div className="text-[11px] mt-1 text-muted-foreground">
                    示例：请从数据、方法、结果、讨论四个维度总结，引用关键原文句子（可标注页码）。
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setCustomPromptName('');
                      setCustomPromptText('');
                      setShowCreateCustom(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 btn-gradient-primary"
                    onClick={async () => {
                      if (!customPromptName.trim() || !customPromptText.trim()) {
                        toast.error('请填写名称和模板');
                        return;
                      }
                      // 确保模板中至少包含一次 {content}，否则自动追加在末尾
                      let promptBody = customPromptText.trim();
                      if (!promptBody.includes('{content}')) {
                        promptBody = `${promptBody}\n\n请基于以下文献内容进行回答：\n{content}`;
                      }
                      try {
                        await addCustomPrompt(customPromptName.trim(), promptBody);
                        setCustomPromptName('');
                        setCustomPromptText('');
                        setShowCreateCustom(false);
                      } catch {
                        // 已在 store 内部 toast 错误
                        return;
                      }
                    }}
                  >
                    保存
                  </Button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  已有自定义模式
                </div>
                {customPrompts.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">
                    暂无自定义模式，你可以在上方创建一个。
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {customPrompts.map((cp) => (
                      <div
                        key={cp.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-white/60 dark:bg-slate-800/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium text-foreground truncate">
                            {cp.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-2"
                              onClick={async () => {
                                await handleRunCustomPrompt(cp.prompt);
                              }}
                            >
                              启动
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-2"
                              onClick={() => {
                                setCustomPromptName(cp.name);
                                setCustomPromptText(cp.prompt);
                              }}
                            >
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-2 text-red-600"
                              onClick={() => deleteCustomPrompt(cp.id)}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] text-muted-foreground">
                            展开查看 Prompt
                          </summary>
                          <pre className="mt-1 text-[11px] overflow-x-auto whitespace-pre-wrap">
{cp.prompt}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showPDFViewer && !!selectedPDF} onOpenChange={setShowPDFViewer}>
          <DialogContent className="max-w-5xl h-[80vh] p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="text-sm">
                PDF 预览
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 border-t border-slate-200 dark:border-slate-800">
              {selectedPDF && <PDFPreview documentId={selectedPDF} />}
            </div>
          </DialogContent>
        </Dialog>

        {/* 模型不兼容提示 Dialog */}
        <Dialog open={showModelMismatchDialog} onOpenChange={setShowModelMismatchDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                模型不兼容
              </DialogTitle>
              <DialogDescription className="pt-2 text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">图文报告</span> 需要支持多模态的模型才能处理图片内容。
                <br />
                当前选择的模型 <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{summaryProvider || config?.defaultProvider}</span> 不支持多模态。
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">可用的多模态模型：</div>
              <div className="flex flex-wrap gap-1.5">
                {config?.providers.filter(p => config.providersDetail?.[p]?.multimodal).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setSummaryProvider(p);
                      setShowModelMismatchDialog(false);
                      toast.success(`已切换为 ${p}，请重新选择图文报告`);
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowModelMismatchDialog(false);
                  setPendingTaskType(null);
                }}
              >
                取消
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Folder Dialog */}
        <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
          <DialogContent className="sm:max-w-[400px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50">
              <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Folder className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                <span>新建分组</span>
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 mt-1.5">
                创建一个新的文献分组，方便您归类管理文献。
              </DialogDescription>
            </DialogHeader>
            <div className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="folder-name" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    分组名称
                  </label>
                  <Input
                    id="folder-name"
                    placeholder="例如：Antibody Design"
                    value={createFolderValue}
                    onChange={(e) => setCreateFolderValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmCreateFolder()}
                    autoFocus
                    className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus-visible:ring-teal-500/20 focus-visible:border-teal-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                 <Button 
                    variant="outline" 
                    onClick={() => setShowCreateFolderDialog(false)}
                    className="h-9 px-4 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                 >
                    取消
                 </Button>
                 <Button 
                    onClick={confirmCreateFolder}
                    className="h-9 px-6 bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-500/20"
                 >
                    创建分组
                 </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename Folder Dialog */}
        <Dialog
          open={showRenameFolderDialog}
          onOpenChange={setShowRenameFolderDialog}
        >
          <DialogContent className="sm:max-w-[400px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50">
              <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Pencil className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                <span>重命名分组</span>
              </DialogTitle>
            </DialogHeader>
            <div className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    新名称
                  </label>
                  <Input
                    value={renameFolderValue}
                    onChange={(e) => setRenameFolderValue(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && confirmRenameFolder()
                    }
                    autoFocus
                    className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setShowRenameFolderDialog(false)}
                  className="h-9 px-4"
                >
                  取消
                </Button>
                <Button
                  onClick={confirmRenameFolder}
                  className="h-9 px-6 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  确认重命名
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Folder Dialog */}
        <Dialog open={showDeleteFolderDialog} onOpenChange={setShowDeleteFolderDialog}>
          <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50">
              <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Trash2 className="h-5 w-5 text-red-500" />
                <span>删除分组</span>
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 mt-1.5">
                您确定要删除分组 <span className="font-medium text-slate-900 dark:text-slate-200">“{deleteFolderId}”</span> 吗？
              </DialogDescription>
            </DialogHeader>
            <div className="p-6">
                <div className="flex items-start gap-3 p-3 mb-6 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                        该分组下包含 <span className="font-bold">{deleteFolderId && sessions.filter(s => s.status === deleteFolderId).length || 0}</span> 个文献。
                        请选择如何处理这些文献。
                    </div>
                </div>
                
                <div className="space-y-3">
                    <Button 
                        variant="default" 
                        className="w-full justify-start h-auto py-3 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 shadow-sm group"
                        onClick={() => confirmDeleteFolder(false)}
                    >
                        <Folder className="h-4 w-4 mr-3 text-slate-400 group-hover:text-teal-500" />
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="font-medium">保留文献</span>
                            <span className="text-xs text-slate-400 group-hover:text-slate-500">仅删除分组，文献移动到 All Publications</span>
                        </div>
                    </Button>
                    <Button 
                        variant="outline"
                         className="w-full justify-start h-auto py-3 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/10 text-slate-700 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 shadow-sm group"
                        onClick={() => confirmDeleteFolder(true)}
                    >
                        <Trash2 className="h-4 w-4 mr-3 text-slate-400 group-hover:text-red-500" />
                         <div className="flex flex-col items-start gap-0.5">
                            <span className="font-medium">彻底删除</span>
                            <span className="text-xs text-slate-400 group-hover:text-red-400/80">删除分组及其包含的所有文献</span>
                        </div>
                    </Button>
                </div>
                <div className="flex justify-center mt-6">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        onClick={() => setShowDeleteFolderDialog(false)}
                    >
                        取消操作
                    </Button>
                </div>
            </div>
          </DialogContent>
        </Dialog>

         {/* Rename Session Dialog */}
        <Dialog open={showRenameSessionDialog} onOpenChange={setShowRenameSessionDialog}>
          <DialogContent className="sm:max-w-[400px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50">
              <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Pencil className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                <span>重命名文献</span>
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 mt-1.5">
                为您的文献会话设置一个新的标题。
              </DialogDescription>
            </DialogHeader>
             <div className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="rename-session" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    会话标题
                  </label>
                  <Input
                    id="rename-session"
                    placeholder="请输入新的标题..."
                    value={renameSessionValue}
                    onChange={(e) => setRenameSessionValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmRenameSession()}
                    autoFocus
                    className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus-visible:ring-teal-500/20 focus-visible:border-teal-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                 <Button 
                    variant="outline" 
                    onClick={() => setShowRenameSessionDialog(false)}
                    className="h-9 px-4 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                 >
                    取消
                 </Button>
                 <Button 
                    onClick={confirmRenameSession}
                    className="h-9 px-6 bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-500/20"
                 >
                    确认修改
                 </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Session Dialog */}
        <Dialog open={showDeleteSessionDialog} onOpenChange={setShowDeleteSessionDialog}>
          <DialogContent className="sm:max-w-[400px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 bg-white dark:bg-slate-950">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-2">
                    <Trash2 className="h-6 w-6 text-red-600 dark:text-red-500" />
                </div>
              <DialogTitle className="text-center text-slate-800 dark:text-slate-100">确认删除文献？</DialogTitle>
              <DialogDescription className="text-center text-slate-500 dark:text-slate-400 mt-2">
                您确定要删除此文献会话吗？<br/>此操作将无法撤销，所有对话记录将被永久删除。
              </DialogDescription>
            </DialogHeader>
             <div className="p-6 pt-2 flex flex-col gap-3">
               <Button 
                variant="destructive" 
                onClick={confirmDeleteSession}
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
                >
                    确认删除
                </Button>
               <Button 
                variant="ghost" 
                onClick={() => setShowDeleteSessionDialog(false)}
                className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
               >
                再想想，取消
               </Button>
            </div>
          </DialogContent>
        </Dialog>

        
      </div>
    </DashboardLayout>
  );
};

// Message Content Component - Modern Tech Style
const MessageContent: React.FC<{ message: Message; documentId?: string; enableFigures?: boolean }> = ({ message, documentId, enableFigures }) => {
  const isUser = message.role === 'user';
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success('Code copied');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ inline, className, children, ...props }: {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const match = /language-(\w+)/.exec(className || '');
    let language = match ? match[1] : '';
    const code = String(children).replace(/\n$/, '');
    const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

    // Check if it's a mermaid diagram
    const isMermaidLike = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gitGraph|pie|mindmap|timeline)/.test(code.trim());
    if ((!inline && language === 'mermaid') || (!inline && !language && isMermaidLike)) {
      if (!language && isMermaidLike) language = 'mermaid';
      try {
        return <MermaidChart chart={code} />;
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        const errMsg = (error instanceof Error ? error.message : String(error)) || 'Unknown error';
        return (
          <div className="my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Mermaid Render Failed</div>
            <div className="text-xs text-red-500 dark:text-red-300 mb-2">Error: {errMsg}</div>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">Show raw code</summary>
              <pre className="text-xs text-slate-500 dark:text-slate-400 overflow-x-auto mt-2">
                <code>{code}</code>
              </pre>
            </details>
          </div>
        );
      }
    }

    if (!inline && language) {
      return (
        <div className="relative rounded-lg overflow-x-auto my-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm border-b border-slate-200 dark:border-slate-700">
            <span className="font-medium">{language}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
              onClick={() => handleCopyCode(code, codeId)}
            >
              {copiedCode === codeId ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <SyntaxHighlighter
            style={oneDark}
            language={language}
            PreTag="div"
            customStyle={{ margin: 0, padding: '1rem', fontSize: '13px', backgroundColor: '#0F172A' }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }

    return (
      <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-sm font-mono text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700" {...props}>
        {children}
      </code>
    );
  };

  return (
    <article className="w-full font-sans break-words">
      {/* User Message - Clean & Minimal */}
      {isUser ? (
        <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-5 rounded-full bg-slate-800 dark:bg-slate-700 flex items-center justify-center text-white">
                <span className="text-[10px] font-bold">U</span>
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">You</span>
          </div>
          <div className="text-base text-slate-900 dark:text-white leading-relaxed pl-7">
            {message.content}
          </div>
        </div>
      ) : (
        /* AI Response - Tech / Documentation Style with Figure Support */
        <FigureAwareMarkdown
          content={message.content}
          documentId={documentId}
          enableFigures={enableFigures}
          className="prose prose-slate dark:prose-invert max-w-none"
        />
      )}
    </article>
  );
};

// Memoized to avoid re-rendering entire messages list when typing
const MemoMessageContent = React.memo(MessageContent);

export default LiteratureAssistant;

// PDF Preview component: fetches with headers and renders via blob URL to ensure per-user access
const PDFPreview: React.FC<{ documentId: string }> = ({ documentId }) => {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    setError(null);
    setUrl(null);
    (async () => {
      try {
        const blob = await literatureAssistantAPI.getDocument(documentId);
        if (blob) {
          const newUrl = URL.createObjectURL(blob);
          revoked = newUrl;
          setUrl(newUrl);
        }
      } catch (e) {
        setError('加载 PDF 失败');
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [documentId]);

  if (error) return <div className="h-full flex items-center justify-center text-red-500 text-sm">{error}</div>;
  if (!url) return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">正在加载文档...</div>;

  return (
    <iframe
      src={url}
      className="w-full h-full border-none bg-white"
      title="PDF Preview"
    />
  );
};

const UserDataPanel = () => {
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    literatureAssistantAPI.getAdminStats()
      .then(setStats)
      .catch(e => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) return <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-950"><Loader2 className="animate-spin h-8 w-8 text-teal-600" /></div>;
  if (!stats) return <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 h-full">No data available</div>;

  return (
    <div className="flex-1 h-full overflow-auto bg-slate-50 dark:bg-slate-950 p-8 font-sans">
      <div className="max-w-[1600px] mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">User Data Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Comprehensive overview of system usage and user activity</p>
        
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard title="Total Users" value={stats.overview.totalUsers} icon={Users} />
          <StatsCard title="Active Users (30d)" value={stats.overview.activeUsers} icon={Activity} />
          <StatsCard title="Total Sessions" value={stats.overview.totalSessions} icon={MessageSquare} />
          <StatsCard title="Storage Used" value={formatFileSize(stats.overview.totalStorage)} icon={Database} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Activity Chart */}
          <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle>Activity Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.activityTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(d: string) => d.slice(5)} 
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Summary Stats / Distribution (Placeholder for now, maybe document types later) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle>System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total Messages</span>
                  <span className="font-bold">{stats.overview.totalMessages.toLocaleString()}</span>
                </div>
                <Progress value={100} className="h-2 bg-slate-100" indicatorClassName="bg-blue-500" />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total Documents</span>
                  <span className="font-bold">{stats.overview.totalDocuments.toLocaleString()}</span>
                </div>
                <Progress value={100} className="h-2 bg-slate-100" indicatorClassName="bg-purple-500" />
                
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                   <p className="text-xs text-slate-400 text-center">
                     System is running smoothly. All services operational.
                   </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Table */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <CardTitle>User Leaderboard (Top 50)</CardTitle>
              <Button variant="outline" size="sm">Export CSV</Button>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                 <tr>
                   <th className="px-6 py-4 font-semibold">User ID</th>
                   <th className="px-6 py-4 font-semibold">Sessions</th>
                   <th className="px-6 py-4 font-semibold">Messages</th>
                   <th className="px-6 py-4 font-semibold">Documents</th>
                   <th className="px-6 py-4 font-semibold text-right">Last Active</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                 {stats.userStats.map((user: AdminStats['userStats'][0]) => (
                   <tr key={user.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                     <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-3">
                       <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                         {user.user_id.slice(0, 1).toUpperCase()}
                       </div>
                       {user.user_id}
                     </td>
                     <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{user.session_count}</td>
                     <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{user.message_count}</td>
                     <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{user.document_count}</td>
                     <td className="px-6 py-4 text-slate-500 text-right">{new Date(user.last_active).toLocaleDateString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </Card>
      </div>
    </div>
  );
};

const StatsCard = ({ title, value, icon: Icon }: any) => (
  <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
    <CardContent className="p-6 flex items-center gap-4">
      <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl text-teal-600 dark:text-teal-400">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</h3>
      </div>
    </CardContent>
  </Card>
);
