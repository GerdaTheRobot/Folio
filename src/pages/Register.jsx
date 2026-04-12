import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart2, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Register() {
  const { signUp }             = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate               = useNavigate()

  const [fullName, setFullName]   = useState('')
  const [username, setUsername]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [showCf, setShowCf]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!username.trim()) return setError('Username is required.')
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return setError('Username must be 3–20 characters: letters, numbers, underscores only.')
    }
    if (password.length < 8) {
      return setError('Password must be at least 8 characters.')
    }
    if (password !== confirm) {
      return setError('Passwords do not match.')
    }

    setLoading(true)
    try {
      await signUp(email, password, fullName, username)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Could not create account.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-bg">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <BarChart2 size={14} className="text-accent-fg" />
            </div>
            <span className="font-semibold text-sm text-text">Folio</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm text-center">
            <div className="w-14 h-14 rounded-full bg-positive-bg flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">Check your email</h2>
            <p className="text-sm text-text-secondary mb-6">
              We sent a confirmation link to <span className="text-text font-medium">{email}</span>.
              Click it to activate your account.
            </p>
            <Link
              to="/login"
              className="text-sm text-accent hover:text-accent-hover font-medium transition-colors duration-150"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
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
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-text tracking-tight mb-1">
              Create your account
            </h1>
            <p className="text-sm text-text-secondary">
              Start tracking your portfolio with Folio
            </p>
          </div>

          <div
            className="rounded-2xl border border-border p-6"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {error && (
                <div className="rounded-lg px-3.5 py-3 text-sm text-negative bg-negative-bg border border-negative/20">
                  {error}
                </div>
              )}

              {/* Full name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5
                             text-sm text-text placeholder:text-text-muted outline-none
                             focus:border-accent focus:ring-2 focus:ring-accent/20
                             transition-colors duration-150"
                />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm select-none">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    autoComplete="username"
                    maxLength={20}
                    placeholder="yourname"
                    className="w-full rounded-lg border border-border bg-bg-elevated pl-7 pr-3.5 py-2.5
                               text-sm text-text placeholder:text-text-muted outline-none
                               focus:border-accent focus:ring-2 focus:ring-accent/20
                               transition-colors duration-150"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5
                             text-sm text-text placeholder:text-text-muted outline-none
                             focus:border-accent focus:ring-2 focus:ring-accent/20
                             transition-colors duration-150"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
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

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showCf ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5 pr-10
                               text-sm text-text placeholder:text-text-muted outline-none
                               focus:border-accent focus:ring-2 focus:ring-accent/20
                               transition-colors duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCf(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted
                               hover:text-text-secondary transition-colors duration-150"
                  >
                    {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
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
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-text-secondary mt-5">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-accent hover:text-accent-hover font-medium transition-colors duration-150"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
