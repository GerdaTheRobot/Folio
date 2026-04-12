import { useState, useRef } from 'react'
import { Upload, FileText, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { parseIBKR, parseFolioCsv, detectFormat } from '../../lib/csvImport'
import { fmtDate, fmt } from '../../lib/lots'

const BROKERS = [
  {
    id:   'ibkr',
    name: 'Interactive Brokers',
    hint: 'Export via Reports → Activity → Trades section (CSV)',
  },
  {
    id:   'folio',
    name: 'Folio CSV',
    hint: 'Re-import a previously exported Folio file',
  },
]

// ── Step 1: broker selection ──────────────────────────────────────
function BrokerStep({ onSelect }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-secondary mb-1">Choose the source of your CSV file:</p>
      {BROKERS.map(b => (
        <button
          key={b.id}
          onClick={() => onSelect(b.id)}
          className="flex items-center justify-between p-4 rounded-xl border border-border
                     hover:border-accent/50 hover:bg-bg-elevated text-left
                     transition-colors duration-150 group"
        >
          <div>
            <p className="text-sm font-semibold text-text group-hover:text-accent transition-colors">{b.name}</p>
            <p className="text-xs text-text-muted mt-0.5">{b.hint}</p>
          </div>
          <ChevronRight size={16} className="text-text-muted shrink-0 ml-3" />
        </button>
      ))}
    </div>
  )
}

// ── Step 2: file drop / pick ──────────────────────────────────────
function FileStep({ broker, onParsed, onError }) {
  const inputRef  = useRef()
  const [dragging, setDragging] = useState(false)

  function parse(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target.result
        const fmt  = detectFormat(text)

        let lots
        if (broker === 'ibkr') {
          if (fmt !== 'ibkr') throw new Error('This doesn\'t look like an IBKR Activity Statement. Make sure you exported the full CSV (not Flex Query).')
          lots = parseIBKR(text)
        } else {
          lots = parseFolioCsv(text)
        }

        if (lots.length === 0) throw new Error('No valid trade rows found in this file.')
        onParsed(lots)
      } catch (err) {
        onError(err.message)
      }
    }
    reader.readAsText(file)
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    parse(e.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current.click()}
        className={[
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed',
          'p-10 cursor-pointer transition-colors duration-150',
          dragging
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent/50 hover:bg-bg-elevated',
        ].join(' ')}
      >
        <div className="w-12 h-12 rounded-xl bg-accent-subtle flex items-center justify-center">
          <Upload size={20} className="text-accent" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text">Drop your CSV file here</p>
          <p className="text-xs text-text-muted mt-0.5">or click to browse</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => parse(e.target.files[0])}
        />
      </div>
    </div>
  )
}

// ── Step 3: preview + confirm ─────────────────────────────────────
const MODES = [
  { id: 'add',     label: 'Add to existing',  desc: 'Merge with current transactions — great for combining multiple brokers.' },
  { id: 'replace', label: 'Replace all',       desc: 'Delete all current transactions and import fresh. Cannot be undone.' },
]

function PreviewStep({ lots, portfolioId, onSuccess, onError }) {
  const [loading, setLoading] = useState(false)
  const [mode,    setMode]    = useState('add')

  async function handleImport() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (mode === 'replace') {
        const { error: delErr } = await supabase
          .from('lots')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('user_id', user.id)
        if (delErr) throw delErr
      }

      const rows = lots.map(l => ({
        ticker:       l.ticker,
        type:         l.type,
        shares:       l.shares,
        price:        l.price,
        fees:         l.fees,
        notes:        l.notes,
        executed_at:  l.executed_at,
        user_id:      user.id,
        portfolio_id: portfolioId,
      }))
      const { error } = await supabase.from('lots').insert(rows)
      if (error) throw error
      onSuccess(lots.length)
    } catch (err) {
      onError(err.message)
      setLoading(false)
    }
  }

  const preview = lots.slice(0, 8)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-positive/10 border border-positive/20">
        <FileText size={14} className="text-positive shrink-0" />
        <p className="text-xs text-positive font-medium">
          {lots.length} transaction{lots.length !== 1 ? 's' : ''} detected
        </p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={[
              'flex flex-col gap-1 p-3 rounded-xl border text-left transition-colors duration-150',
              mode === m.id
                ? m.id === 'replace'
                  ? 'border-negative/50 bg-negative/5'
                  : 'border-accent/50 bg-accent/5'
                : 'border-border hover:bg-bg-elevated',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <div className={[
                'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                mode === m.id
                  ? m.id === 'replace' ? 'border-negative' : 'border-accent'
                  : 'border-border',
              ].join(' ')}>
                {mode === m.id && (
                  <div className={`w-1.5 h-1.5 rounded-full ${m.id === 'replace' ? 'bg-negative' : 'bg-accent'}`} />
                )}
              </div>
              <span className={`text-xs font-semibold ${mode === m.id ? (m.id === 'replace' ? 'text-negative' : 'text-accent') : 'text-text'}`}>
                {m.label}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-snug pl-5">{m.desc}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }} className="border-b border-border">
              {['Date', 'Ticker', 'Type', 'Shares', 'Price', 'Fees'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-text-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((lot, i) => (
              <tr key={i} className="border-b border-border-subtle last:border-0">
                <td className="px-3 py-2 text-text-secondary">{fmtDate(lot.executed_at)}</td>
                <td className="px-3 py-2 font-mono font-semibold text-text">{lot.ticker}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    lot.type === 'buy' ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
                  }`}>{lot.type}</span>
                </td>
                <td className="px-3 py-2 tabular-nums text-text-secondary">{lot.shares}</td>
                <td className="px-3 py-2 tabular-nums text-text-secondary">{fmt(lot.price)}</td>
                <td className="px-3 py-2 tabular-nums text-text-muted">{fmt(lot.fees)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lots.length > 8 && (
          <p className="px-3 py-2 text-xs text-text-muted border-t border-border" style={{ background: 'var(--bg-elevated)' }}>
            + {lots.length - 8} more rows
          </p>
        )}
      </div>

      <button
        onClick={handleImport}
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg
                   text-sm font-semibold transition-all duration-150 active:scale-[0.98]
                   disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
        {loading ? 'Importing…' : mode === 'replace'
          ? `Replace & import ${lots.length} transaction${lots.length !== 1 ? 's' : ''}`
          : `Add ${lots.length} transaction${lots.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

// ── Root modal content ────────────────────────────────────────────
export default function ImportModal({ portfolioId, onSuccess }) {
  const [broker,  setBroker]  = useState(null)
  const [lots,    setLots]    = useState(null)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(0)

  function handleParsed(parsed) { setError(''); setLots(parsed) }
  function handleError(msg)     { setError(msg); setLots(null) }
  function handleSuccess(n)     { setDone(n); onSuccess() }

  if (done > 0) return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <CheckCircle2 size={40} className="text-positive" />
      <p className="text-base font-semibold text-text">Import complete!</p>
      <p className="text-sm text-text-secondary">{done} transaction{done !== 1 ? 's' : ''} added to your portfolio.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-negative/10 border border-negative/20">
          <AlertCircle size={14} className="text-negative shrink-0 mt-0.5" />
          <p className="text-xs text-negative">{error}</p>
        </div>
      )}

      {/* Breadcrumb */}
      {broker && (
        <div className="flex items-center gap-1 text-xs text-text-muted">
          <button onClick={() => { setBroker(null); setLots(null); setError('') }}
                  className="hover:text-accent transition-colors">Source</button>
          <ChevronRight size={12} />
          <span className={lots ? 'hover:text-accent cursor-pointer transition-colors' : 'text-text'}
                onClick={lots ? () => { setLots(null); setError('') } : undefined}>
            {BROKERS.find(b => b.id === broker)?.name}
          </span>
          {lots && <><ChevronRight size={12} /><span className="text-text">Preview</span></>}
        </div>
      )}

      {/* Steps */}
      {!broker && <BrokerStep onSelect={setBroker} />}
      {broker && !lots && <FileStep broker={broker} onParsed={handleParsed} onError={handleError} />}
      {broker && lots  && (
        <PreviewStep lots={lots} portfolioId={portfolioId} onSuccess={handleSuccess} onError={handleError} />
      )}
    </div>
  )
}
