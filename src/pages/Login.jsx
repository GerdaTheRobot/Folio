import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart2, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { getEmailByUsername } from '../lib/supabase'

export default function Login() {
  const { signIn }             = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate               = useNavigate()

  const [identifier, setIdentifier] = useState('')   // email or username
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let email = identifier.trim()

      // If no @ sign, treat as username and resolve to email
      if (!email.includes('@')) {
        const resolved = await getEmailByUsername(email)
        if (!resolved) {
          setError('No account found with that username.')
          setLoading(false)
          return
        }
        email = resolved
      }

      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <BarChart2 size={14} className="text-accent-fg" />
          </div>
          <span className="font-semibold text-sm text-text">Folio</span>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary
                     hover:text-text hover:bg-bg-elevated transition-colors duration-150"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      {/* Center card */}
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 pt-6 pb-12 sm:py-12">
        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-text tracking-tight mb-1">
              Welcome back
            </h1>
            <p className="text-sm text-text-secondary">
              Sign in to your Folio account
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl border border-border p-6"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Error */}
              {error && (
                <div className="rounded-lg px-3.5 py-3 text-sm text-negative bg-negative-bg border border-negative/20">
                  {error}
                </div>
              )}

              {/* Email or username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Email or username
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="you@example.com or @username"
                  className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5
                             text-sm text-text placeholder:text-text-muted outline-none
                             focus:border-accent focus:ring-2 focus:ring-accent/20
                             transition-colors duration-150"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs text-accent hover:text-accent-hover transition-colors duration-150"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5 pr-10
                               text-sm text-text placeholder:text-text-muted outline-none
                               focus:border-accent focus:ring-2 focus:ring-accent/20
                               transition-colors duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted
                               hover:text-text-secondary transition-colors duration-150"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-accent-fg
                           bg-accent hover:bg-accent-hover active:scale-[0.98]
                           transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          {/* Footer link */}
          <p className="text-center text-sm text-text-secondary mt-5">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-accent hover:text-accent-hover font-medium transition-colors duration-150"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
