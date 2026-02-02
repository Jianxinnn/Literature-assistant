import { loginWithGoogle } from '../services/auth'
import { Button } from '../components/ui/button'
import { FileText, Sparkles, MessageSquare, Share2 } from 'lucide-react'

export default function Login() {
  return (
    <div className="min-h-screen flex">
      {/* 左侧 - 功能介绍 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 flex-col justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Literature Assistant</h1>
          <p className="text-blue-100">AI 驱动的科学文献分析助手</p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">PDF 智能解析</h3>
              <p className="text-blue-100 text-sm">支持文本提取和图文识别，完整保留论文中的图表</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">多模型 AI 分析</h3>
              <p className="text-blue-100 text-sm">支持 Gemini、GPT、DeepSeek 等多种 AI 模型</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">会话式问答</h3>
              <p className="text-blue-100 text-sm">针对文献内容进行深入对话和追问</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">社区分享</h3>
              <p className="text-blue-100 text-sm">分享你的文献分析，学习他人的精彩解读</p>
            </div>
          </div>
        </div>

        <p className="text-blue-200 text-sm">
          Powered by AI
        </p>
      </div>

      {/* 右侧 - 登录 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              欢迎使用
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              使用 Google 账号登录，开始你的文献分析之旅
            </p>
          </div>

          <Button
            onClick={loginWithGoogle}
            className="w-full h-12 text-base flex items-center justify-center gap-3"
            variant="outline"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            使用 Google 账号登录
          </Button>

          <p className="text-center text-sm text-gray-500">
            登录即表示你同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </div>
  )
}
