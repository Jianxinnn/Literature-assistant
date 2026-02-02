import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from './services/auth'
import LiteratureAssistant from './pages/LiteratureAssistant'
import Login from './pages/Login'

function App() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={isAuthenticated ? <LiteratureAssistant /> : <Navigate to="/login" replace />}
        />
      </Routes>
      <Toaster position="top-center" richColors />
    </>
  )
}

export default App
