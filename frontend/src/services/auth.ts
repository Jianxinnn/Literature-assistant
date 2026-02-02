import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

export interface User {
  id: string
  email: string
  displayName: string
  profilePicture?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

// 创建 axios 实例
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// 添加请求拦截器，自动添加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 处理 OAuth 回调
export function handleAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')

  if (token) {
    localStorage.setItem('auth_token', token)
    // 清理 URL
    window.history.replaceState({}, '', '/')
    return true
  }
  return false
}

// 获取当前用户
export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await api.get('/auth/me')
    return response.data.user
  } catch {
    return null
  }
}

// 登出
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    localStorage.removeItem('auth_token')
    window.location.href = '/login'
  }
}

// Google 登录
export function loginWithGoogle(): void {
  window.location.href = '/api/auth/google'
}

// Auth Hook
export function useAuth(): AuthState & { login: () => void; logout: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    // 检查 OAuth 回调
    handleAuthCallback()

    // 验证用户
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setState({ user: null, isAuthenticated: false, isLoading: false })
        return
      }

      try {
        const user = await getCurrentUser()
        setState({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        })
      } catch {
        localStorage.removeItem('auth_token')
        setState({ user: null, isAuthenticated: false, isLoading: false })
      }
    }

    checkAuth()
  }, [])

  const login = useCallback(() => {
    loginWithGoogle()
  }, [])

  const handleLogout = useCallback(async () => {
    await logout()
    setState({ user: null, isAuthenticated: false, isLoading: false })
  }, [])

  return {
    ...state,
    login,
    logout: handleLogout,
  }
}

export { api }
