import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, DollarSign, Layers, ArrowLeft } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import PerformanceChart from '../components/portfolio/PerformanceChart'
import LotsTable from '../components/portfolio/LotsTable'
import Modal from '../components/ui/Modal'
import LotForm from '../components/portfolio/LotForm'
import { useLots } from '../hooks/useLots'
import { fmt, fmtDate } from '../lib/lots'
import { useCensor } from '../context/CensorContext'

function StatCard({ label, value, sub, icon: Icon, positive, negative, pct }) {
  const color = positive ? 'text-positive' : negative ? 'text-negative' : 'text-text'
  const { mask, censored } = useCensor()
  return (
    <div className="rounded-2xl border border-border p-5"
         style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center">
          <Icon size={15} className="text-accent" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
        {pct != null && (
          <span className={[
            'mb-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums',
            pct > 0 ? 'bg-positive-bg text-positive' : pct < 0 ? 'bg-negative-bg text-negative' : 'bg-bg-elevated text-text-secondary',
          ].join(' ')}>
            {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
          </span>
        )}
      </div>
      {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

export default function StockDetail() {
  const { ticker }                              = useParams()
  const { lots, stats, prices, prevCloses, loading, refresh } = useLots()
  const { mask }                                = useCensor()
  const [modalOpen, setModalOpen]               = useState(false)
  const [plMode, setPlMode]                     = useState('alltime')

  const symbol   = ticker.toUpperCase()
  const holding  = stats.holdings[symbol] ?? null
  const prevHold = stats.previousHoldings?.[symbol] ?? null
  const tickerLots = useMemo(() => lots.filter(l => l.ticker === symbol), [lots, symbol])

  const currentPrice = prices[symbol] ?? null
  const prevClose    = prevCloses[symbol] ?? null
  const dailyChange  = (currentPrice && prevClose) ? currentPrice - prevClose : null
  const dailyChangePct = (dailyChange && prevClose) ? dailyChange / prevClose * 100 : null

  const showDaily   = plMode === 'today'
  const urPL        = showDaily ? holding?.dailyPL        : holding?.unrealizedPL
  const urPct       = showDaily ? holding?.dailyPct       : holding?.unrealizedPct

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/transactions"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border
                         text-text-secondary hover:text-text hover:bg-bg-elevated transition-colors duration-150"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-text font-mono">{symbol}</h1>
                {currentPrice && (
                  <span className="text-lg font-semibold text-text tabular-nums">
                    {mask(fmt(currentPrice))}
                  </span>
                )}
                {dailyChange != null && (
                  <span className={`text-sm font-semibold tabular-nums ${dailyChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {dailyChange >= 0 ? '+' : ''}{mask(fmt(dailyChange))}
                    {dailyChangePct != null && ` (${dailyChangePct >= 0 ? '+' : ''}${dailyChangePct.toFixed(2)}%)`}
                  </span>
                )}
              </div>
              <p className="text-sm text-text-secondary mt-0.5">
                {holding ? `${mask(String(holding.shares))} shares held` : prevHold ? 'Position closed' : 'Not in portfolio'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover
                       text-accent-fg text-sm font-semibold transition-colors duration-150 active:scale-95"
          >
            + Add lot
          </button>
        </div>

        {/* Stat cards — only if we have a position */}
        {holding && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              label="Market Value"
              value={mask(holding.currentValue != null ? fmt(holding.currentValue) : fmt(holding.costBasis))}
              sub={holding.currentValue != null ? 'Live value' : 'Cost basis'}
              icon={DollarSign}
            />
            <StatCard
              label="Unrealized P&L"
              value={urPL != null ? mask(`${urPL >= 0 ? '+' : ''}${fmt(urPL)}`) : '—'}
              sub={
                <div className="flex gap-0.5 mt-1 bg-bg-elevated rounded px-0.5 py-0.5 w-fit">
                  {['alltime', 'today'].map(m => (
                    <button key={m} onClick={() => setPlMode(m)}
                      className={[
                        'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors duration-150',
                        plMode === m ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted hover:text-text',
                      ].join(' ')}
                    >{m === 'alltime' ? 'All time' : 'Today'}</button>
                  ))}
                </div>
              }
              icon={!urPL || urPL >= 0 ? TrendingUp : TrendingDown}
              positive={urPL > 0}
              negative={urPL < 0}
              pct={urPct}
            />
            <StatCard
              label="Avg Cost"
              value={mask(fmt(holding.avgCost))}
              sub={`${mask(String(holding.shares))} shares`}
              icon={Layers}
            />
            <StatCard
              label="Realized P&L"
              value={mask(`${holding.realizedPL >= 0 ? '+' : ''}${fmt(holding.realizedPL)}`)}
              sub="From completed sells"
              icon={holding.realizedPL >= 0 ? TrendingUp : TrendingDown}
              positive={holding.realizedPL > 0}
              negative={holding.realizedPL < 0}
            />
          </div>
        )}

        {/* Previously owned summary */}
        {!holding && prevHold && (
          <div className="rounded-2xl border border-border p-5"
               style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm text-text-muted mb-1">Position closed</p>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-text-muted">Avg Cost</p>
                <p className="text-lg font-semibold text-text tabular-nums">{mask(fmt(prevHold.avgCost))}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Realized P&L</p>
                <p className={`text-lg font-semibold tabular-nums ${prevHold.realizedPL >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {mask(`${prevHold.realizedPL >= 0 ? '+' : ''}${fmt(prevHold.realizedPL)}`)}
                </p>
              </div>
              {prevHold.lastSellDate && (
                <div>
                  <p className="text-xs text-text-muted">Last sold</p>
                  <p className="text-sm text-text">{fmtDate(prevHold.lastSellDate)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price chart */}
        <div className="rounded-2xl border border-border p-5"
             style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
          <PerformanceChart lots={tickerLots} prices={prices} ticker={symbol} />
        </div>

        {/* Lot history */}
        {tickerLots.length > 0 && (
          <div className="rounded-2xl border border-border overflow-hidden"
               style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text">
                Lot history
                <span className="ml-2 text-xs font-normal text-text-muted">
                  {tickerLots.length} {tickerLots.length === 1 ? 'lot' : 'lots'}
                </span>
              </h2>
            </div>
            <LotsTable lots={tickerLots} onChanged={refresh} />
          </div>
        )}

        {tickerLots.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-text-muted">No lots recorded for {symbol} yet.</p>
            <button onClick={() => setModalOpen(true)}
              className="mt-3 text-xs text-accent hover:text-accent-hover font-medium transition-colors duration-150">
              Add first lot
            </button>
          </div>
        )}
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Add lot — ${symbol}`}>
        <LotForm
          initial={{ ticker: symbol }}
          onSuccess={() => { setModalOpen(false); refresh() }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
