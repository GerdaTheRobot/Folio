import { useState, useRef, useEffect } from 'react'
import { addLot, updateLot } from '../../lib/lots'
import { usePortfolio } from '../../context/PortfolioContext'
import { searchSymbols } from '../../lib/finnhub'
import { X } from 'lucide-react'

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY = {
  type:        'buy',
  ticker:      '',
  shares:      '',
  price:       '',
  fees:        '',
  executed_at: today(),
  notes:       '',
}

export default function LotForm({ initial = null, onSuccess, onCancel }) {
  const { activeId } = usePortfolio()
  const isEdit = Boolean(initial)

  const [form, setForm]     = useState(isEdit ? {
    ...initial,
    executed_at: initial.executed_at?.slice(0, 10) ?? today(),
    fees:        initial.fees ?? '',
    notes:       initial.notes ?? '',
  } : EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Ticker autocomplete state
  const [tickerQuery, setTickerQuery]       = useState(isEdit ? initial.ticker : '')
  const [tickerResults, setTickerResults]   = useState([])
  const [tickerOpen, setTickerOpen]         = useState(false)
  const [tickerLoading, setTickerLoading]   = useState(false)
  const [tickerConfirmed, setTickerConfirmed] = useState(isEdit) // edit mode: already valid
  const [activeIndex, setActiveIndex]       = useState(-1)

  const debounceRef    = useRef(null)
  const tickerInputRef = useRef(null)
  const tickerContRef  = useRef(null)
  const itemRefs       = useRef([])

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (tickerContRef.current && !tickerContRef.current.contains(e.target)) {
        setTickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Reset active index when results change
  useEffect(() => { setActiveIndex(-1) }, [tickerResults])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleTickerChange(e) {
    const val = e.target.value.toUpperCase()
    setTickerQuery(val)
    setTickerConfirmed(false)
    set('ticker', '')
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setTickerResults([]); setTickerOpen(false); return }
    setTickerLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchSymbols(val.trim())
        setTickerResults(res)
        setTickerOpen(res.length > 0)
      } catch { setTickerResults([]) }
      finally  { setTickerLoading(false) }
    }, 280)
  }

  function selectTicker(symbol, description) {
    setTickerQuery(symbol)
    set('ticker', symbol)
    setTickerConfirmed(true)
    setTickerResults([])
    setTickerOpen(false)
    setActiveIndex(-1)
  }

  function clearTicker() {
    setTickerQuery('')
    set('ticker', '')
    setTickerConfirmed(false)
    setTickerResults([])
    setTickerOpen(false)
    tickerInputRef.current?.focus()
  }

  function handleTickerKeyDown(e) {
    if (e.key === 'Escape') { setTickerOpen(false); setActiveIndex(-1); return }
    if (!tickerOpen || !tickerResults.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => {
        const next = Math.min(i + 1, tickerResults.length - 1)
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => {
        if (i <= 0) return -1
        const prev = i - 1
        itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' })
        return prev
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIndex >= 0 ? activeIndex : 0
      if (tickerResults[idx]) selectTicker(tickerResults[idx].symbol, tickerResults[idx].description)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const shares = Number(form.shares)
    const price  = Number(form.price)
    const fees   = Number(form.fees) || 0

    if (!tickerConfirmed && !isEdit) return setError('Please select a valid ticker from the search results.')
    if (isNaN(shares) || shares <= 0) return setError('Shares must be a positive number.')
    if (isNaN(price)  || price  <= 0) return setError('Price must be a positive number.')
    if (fees < 0)                     return setError('Fees cannot be negative.')

    setLoading(true)
    try {
      const payload = {
        type:        form.type,
        ticker:      (isEdit ? form.ticker : form.ticker).trim().toUpperCase(),
        shares,
        price,
        fees,
        executed_at: new Date(form.executed_at).toISOString(),
        notes:       form.notes.trim() || null,
      }
      if (isEdit) {
        await updateLot(initial.id, payload)
      } else {
        await addLot(payload, activeId)
      }
      onSuccess()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {error && (
        <div className="rounded-lg px-3.5 py-3 text-sm text-negative bg-negative-bg border border-negative/20">
          {error}
        </div>
      )}

      {/* Buy / Sell toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Transaction type
        </label>
        <div className="flex rounded-lg border border-border overflow-hidden bg-bg-elevated p-0.5 gap-0.5">
          {['buy', 'sell'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              className={[
                'flex-1 py-2 rounded-md text-sm font-semibold capitalize transition-all duration-150',
                form.type === t
                  ? t === 'buy'
                    ? 'bg-positive text-white shadow-sm'
                    : 'bg-negative text-white shadow-sm'
                  : 'text-text-secondary hover:text-text',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Ticker + Date row */}
      <div className="grid grid-cols-2 gap-3">

        {/* Ticker field — autocomplete when adding, read-only when editing */}
        <div className="flex flex-col gap-1.5" ref={tickerContRef}>
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Ticker
          </label>

          {isEdit ? (
            <input
              type="text"
              value={form.ticker}
              disabled
              className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5
                         text-sm text-text-muted outline-none font-mono opacity-70 cursor-not-allowed"
            />
          ) : (
            <div className="relative">
              <div className={[
                'flex items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-colors duration-150',
                tickerConfirmed
                  ? 'border-accent bg-bg-elevated ring-2 ring-accent/20'
                  : 'border-border bg-bg-elevated focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20',
              ].join(' ')}>
                <input
                  ref={tickerInputRef}
                  type="text"
                  value={tickerQuery}
                  onChange={handleTickerChange}
                  onKeyDown={handleTickerKeyDown}
                  onFocus={() => { if (tickerResults.length) setTickerOpen(true) }}
                  placeholder="AAPL"
                  autoComplete="off"
                  maxLength={10}
                  className="flex-1 min-w-0 bg-transparent text-sm text-text placeholder:text-text-muted
                             outline-none font-mono"
                />
                {tickerLoading && (
                  <div className="w-3 h-3 rounded-full border-2 border-border border-t-accent animate-spin shrink-0" />
                )}
                {tickerConfirmed && (
                  <button type="button" onClick={clearTicker}
                    className="text-text-muted hover:text-text transition-colors duration-150 shrink-0">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {tickerOpen && tickerResults.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border py-1 z-50 overflow-y-auto"
                  style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)', maxHeight: 200 }}
                >
                  {tickerResults.map((r, i) => (
                    <button
                      key={r.symbol}
                      type="button"
                      ref={el => { itemRefs.current[i] = el }}
                      onMouseDown={() => selectTicker(r.symbol, r.description)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={[
                        'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-100',
                        activeIndex === i ? 'bg-bg-elevated' : 'hover:bg-bg-elevated',
                      ].join(' ')}
                    >
                      <span className="font-mono font-semibold text-sm text-text w-14 shrink-0">{r.symbol}</span>
                      <span className="text-xs text-text-secondary truncate">{r.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Date
          </label>
          <input
            type="date"
            value={form.executed_at}
            onChange={e => set('executed_at', e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5
                       text-sm text-text outline-none
                       focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors duration-150"
          />
        </div>
      </div>

      {/* Shares + Price row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Shares
          </label>
          <input
            type="number"
            value={form.shares}
            onChange={e => set('shares', e.target.value)}
            step="any"
            placeholder="10"
            className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5
                       text-sm text-text placeholder:text-text-muted outline-none
                       focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors duration-150"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Price per share
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
            <input
              type="number"
              value={form.price}
              onChange={e => set('price', e.target.value)}
              step="any"
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-bg-elevated pl-7 pr-3.5 py-2.5
                         text-sm text-text placeholder:text-text-muted outline-none
                         focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors duration-150"
            />
          </div>
        </div>
      </div>

      {/* Fees */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Fees <span className="normal-case text-text-muted">(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
          <input
            type="number"
            value={form.fees}
            onChange={e => set('fees', e.target.value)}
            min="0"
            step="any"
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-bg-elevated pl-7 pr-3.5 py-2.5
                       text-sm text-text placeholder:text-text-muted outline-none
                       focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors duration-150"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Notes <span className="normal-case text-text-muted">(optional)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={2}
          placeholder="e.g. Earnings play"
          className="w-full rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5
                     text-sm text-text placeholder:text-text-muted outline-none resize-none
                     focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors duration-150"
        />
      </div>

      {/* Total preview */}
      {form.shares && form.price && (
        <div className="rounded-lg bg-bg-elevated border border-border px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            {form.type === 'buy' ? 'Total cost' : 'Total proceeds'}
          </span>
          <span className="text-sm font-semibold text-text">
            ${(
              form.type === 'buy'
                ? Number(form.shares) * Number(form.price) + (Number(form.fees) || 0)
                : Number(form.shares) * Number(form.price) - (Number(form.fees) || 0)
            ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary
                     hover:text-text hover:bg-bg-elevated transition-colors duration-150"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold
                     transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          )}
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Add lot'}
        </button>
      </div>
    </form>
  )
}
