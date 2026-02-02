import { useEffect, useState, useRef, useCallback } from 'react'
import { useLiteratureAssistantStore } from '@/stores/literature-assistant-store'
import { useAuth } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Upload,
  FileText,
  Send,
  Loader2,
  Trash2,
  MessageSquare,
  BookOpen,
  Sparkles,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { formatBytes, formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function LiteratureAssistant() {
  const { user, logout } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [chatInput, setChatInput] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const {
    sessions,
    currentSession,
    messages,
    documents,
    config,
    prompts,
    isLoadingSessions,
    isLoadingMessages,
    isSending,
    isUploading,
    uploadProgress,
    summaryProvider,
    assistantProvider,
    selectedTaskType,
    initialize,
    loadSession,
    createSession,
    deleteSession,
    uploadDocument,
    sendMessage,
    regenerateSummary,
    setSummaryProvider,
    setAssistantProvider,
    setSelectedTaskType,
  } = useLiteratureAssistantStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCreateSession = async () => {
    try {
      await createSession('新文献分析')
    } catch (error) {
      toast.error('创建会话失败')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentSession) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('仅支持 PDF 文件')
      return
    }

    try {
      await uploadDocument(currentSession.id, file)
      toast.success('文件上传成功')
    } catch (error) {
      toast.error('上传失败')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentSession || isSending) return

    const message = chatInput
    setChatInput('')

    try {
      await sendMessage(currentSession.id, message)
    } catch (error) {
      toast.error('发送失败')
    }
  }

  const handleRunAnalysis = async (taskType: string) => {
    if (!currentSession || documents.length === 0) {
      toast.error('请先上传文献')
      return
    }

    try {
      await regenerateSummary(currentSession.id, taskType)
    } catch (error) {
      toast.error('分析失败')
    }
  }

  const taskTypes = prompts?.tasks || {}

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          'flex flex-col border-r bg-muted/30 transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-72'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {!sidebarCollapsed && (
            <h1 className="font-semibold text-lg">Literature Assistant</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* New Session Button */}
        <div className="p-4">
          <Button
            onClick={handleCreateSession}
            className="w-full"
            variant={sidebarCollapsed ? 'ghost' : 'default'}
          >
            <Plus className="h-4 w-4" />
            {!sidebarCollapsed && <span className="ml-2">新建分析</span>}
          </Button>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors',
                    currentSession?.id === session.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => loadSession(session.id)}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 truncate text-sm">
                        {session.title || '未命名'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSession(session.id)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* User Info */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.displayName || user?.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <>
            {/* Session Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold">{currentSession.title || '未命名分析'}</h2>
                <Badge variant="secondary">
                  {documents.length} 篇文献
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={assistantProvider} onValueChange={setAssistantProvider}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {config?.providers.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel - Documents & Analysis */}
              <div className="w-1/3 border-r flex flex-col">
                {/* Upload Area */}
                <div className="p-4 border-b">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="outline"
                    className="w-full h-24 flex flex-col gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>{uploadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6" />
                        <span>上传 PDF 文献</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Documents List */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <Card key={doc.id} className="p-3">
                        <div className="flex items-start gap-2">
                          <FileText className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.original_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(doc.file_size)}
                              {doc.page_count && ` · ${doc.page_count} 页`}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                {/* Analysis Tasks */}
                <div className="p-4 border-t">
                  <h3 className="text-sm font-medium mb-3">分析任务</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(taskTypes).map(([key, task]) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleRunAnalysis(key)}
                        disabled={isSending || documents.length === 0}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {(task as any).name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Panel - Chat */}
              <div className="flex-1 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>上传文献并选择分析任务开始</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex',
                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] rounded-lg px-4 py-2',
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            )}
                          >
                            {msg.role === 'assistant' ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm, remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <p>{msg.content}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Chat Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="输入问题，针对文献进行提问..."
                      className="resize-none"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isSending}
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold mb-2">欢迎使用 Literature Assistant</h2>
              <p className="text-muted-foreground mb-4">
                选择一个已有分析或创建新的分析开始
              </p>
              <Button onClick={handleCreateSession}>
                <Plus className="h-4 w-4 mr-2" />
                新建分析
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">默认分析模型</label>
              <Select value={summaryProvider} onValueChange={setSummaryProvider}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config?.providers.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">对话模型</label>
              <Select value={assistantProvider} onValueChange={setAssistantProvider}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config?.providers.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
