import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CensorProvider } from './context/CensorContext'
import { PortfolioProvider } from './context/PortfolioContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Portfolio from './pages/Portfolio'
import Transactions from './pages/Transactions'
import StockDetail from './pages/StockDetail'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />
  return user ? <Navigate to="/" replace /> : children
}

function AppLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/"                element={<PrivateRoute><Portfolio /></PrivateRoute>} />
      <Route path="/transactions"    element={<PrivateRoute><Transactions /></PrivateRoute>} />
      <Route path="/stock/:ticker" element={<PrivateRoute><StockDetail /></PrivateRoute>} />
      <Route path="*"             element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <CensorProvider>
          <AuthProvider>
            <PortfolioProvider>
              <AppRoutes />
            </PortfolioProvider>
          </AuthProvider>
        </CensorProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
