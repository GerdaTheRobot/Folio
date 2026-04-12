import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { BarChart2, Sun, Moon, LogOut, User, ChevronDown, Eye, EyeOff, Search, X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useCensor } from '../../context/CensorContext'
import { searchSymbols } from '../../lib/finnhub'

const NAV_LINKS = [
  { label: 'Portfolio',     path: '/' },
  { label: 'Transactions',  path: '/transactions' },
]

function TickerSearch() {
  const navigate                        = useNavigate()
  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState([])
  const [open, setOpen]                 = useState(false)
  const [loading, setLoading]           = useState(false)
  const [focused, setFocused]           = useState(false)
  const [activeIndex, setActiveIndex]   = useState(-1)
  const inputRef                        = useRef(null)
  const containerRef                    = useRef(null)
  const debounceRef                     = useRef(null)
  const itemRefs                        = useRef([])

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Reset active index when results change
  useEffect(() => { setActiveIndex(-1) }, [results])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchSymbols(val.trim())
        setResults(res)
        setOpen(res.length > 0)
      } catch { setResults([]) }
      finally  { setLoading(false) }
    }, 280)
  }

  function handleSelect(symbol) {
    setQuery('')
    setResults([])
    setOpen(false)
    setActiveIndex(-1)
    inputRef.current?.blur()
    navigate(`/stock/${symbol}`)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      inputRef.current?.blur()
      return
    }
    if (!open || !results.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => {
        const next = Math.min(i + 1, results.length - 1)
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => {
        if (i <= 0) { inputRef.current?.focus(); return -1 }
        const prev = i - 1
        itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' })
        return prev
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIndex >= 0 ? activeIndex : 0
      if (results[idx]) handleSelect(results[idx].symbol)
    }
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors duration-150 w-56',
        focused ? 'border-accent bg-bg-card' : 'border-border bg-bg-elevated',
      ].join(' ')}>
        <Search size={14} className="text-text-muted shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { setFocused(true); if (results.length) setOpen(true) }}
          onBlur={() => setFocused(false)}
          placeholder="Search any stock…"
          className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none min-w-0"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="text-text-muted hover:text-text transition-colors duration-150">
            <X size={13} />
          </button>
        )}
        {loading && (
          <div className="w-3.5 h-3.5 rounded-full border-2 border-border border-t-accent animate-spin shrink-0" />
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 mt-1.5 w-72 rounded-xl border border-border py-1 z-50 overflow-hidden"
          style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)' }}
        >
          {results.map((r, i) => (
            <button
              key={r.symbol}
              ref={el => { itemRefs.current[i] = el }}
              onMouseDown={() => handleSelect(r.symbol)}
              onMouseEnter={() => setActiveIndex(i)}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 transition-colors duration-100 text-left',
                activeIndex === i ? 'bg-bg-elevated' : 'hover:bg-bg-elevated',
              ].join(' ')}
            >
              <span className="font-mono font-semibold text-sm text-text w-16 shrink-0">{r.symbol}</span>
              <span className="text-xs text-text-secondary truncate">{r.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { theme, toggleTheme }                     = useTheme()
  const { user, signOut }                          = useAuth()
  const { censored, toggle: toggleCensor }         = useCensor()
  const navigate                                   = useNavigate()
  const location                                   = useLocation()
  const [menuOpen, setMenuOpen]                    = useState(false)
  const menuRef                                    = useRef(null)

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Account'
  const initials    = displayName.slice(0, 2).toUpperCase()

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    try { await signOut(); navigate('/login') }
    catch (e) { console.error(e) }
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-border"
      style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Main row */}
        <div className="flex items-center h-16 gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center
                          transition-transform duration-200 group-hover:scale-105">
            <BarChart2 size={16} className="text-accent-fg" />
          </div>
          <span className="font-semibold text-base tracking-tight text-text">Folio</span>
        </Link>

        {/* Nav links — desktop only */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ label, path }) => {
            const active = location.pathname === path
            return (
              <Link key={path} to={path}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150',
                  active ? 'bg-accent-subtle text-accent' : 'text-text-secondary hover:text-text hover:bg-bg-elevated',
                ].join(' ')}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Search — centred */}
        <div className="flex-1 flex justify-center">
          <TickerSearch />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Censor toggle */}
          <button
            onClick={toggleCensor}
            aria-label={censored ? 'Show amounts' : 'Hide amounts'}
            title={censored ? 'Show amounts' : 'Hide amounts'}
            className={[
              'w-9 h-9 flex items-center justify-center rounded-lg transition-colors duration-150',
              censored
                ? 'text-accent bg-accent-subtle hover:bg-accent-subtle/80'
                : 'text-text-secondary hover:text-text hover:bg-bg-elevated',
            ].join(' ')}
          >
            {censored ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary
                       hover:text-text hover:bg-bg-elevated transition-colors duration-150"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg
                         hover:bg-bg-elevated transition-colors duration-150 group"
            >
              <div className="w-7 h-7 rounded-full bg-accent-subtle border border-border
                              flex items-center justify-center text-accent text-xs font-semibold">
                {initials}
              </div>
              <span className="hidden sm:block text-sm text-text-secondary group-hover:text-text
                               transition-colors duration-150 max-w-[120px] truncate">
                {displayName}
              </span>
              <ChevronDown
                size={14}
                className={`text-text-muted transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border py-1 z-50"
                style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)' }}
              >
                <div className="px-3 py-2 border-b border-border-subtle mb-1">
                  <p className="text-xs text-text-muted">Signed in as</p>
                  <p className="text-sm text-text font-medium truncate">{user?.email}</p>
                </div>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary
                                   hover:text-text hover:bg-bg-elevated transition-colors duration-150">
                  <User size={15} />
                  Account
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-negative
                             hover:bg-negative-bg transition-colors duration-150"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
        </div>{/* end main row */}

        {/* Mobile nav row — visible only on small screens */}
        <nav className="flex sm:hidden items-center gap-1 pb-2">
          {NAV_LINKS.map(({ label, path }) => {
            const active = location.pathname === path
            return (
              <Link key={path} to={path}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150',
                  active ? 'bg-accent-subtle text-accent' : 'text-text-secondary hover:text-text hover:bg-bg-elevated',
                ].join(' ')}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
