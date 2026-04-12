import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Layers, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Modal from '../components/ui/Modal'
import LotForm from '../components/portfolio/LotForm'
import PerformanceChart from '../components/portfolio/PerformanceChart'
import AllocationChart from '../components/portfolio/AllocationChart'
import { useLots } from '../hooks/useLots'
import { fmtDate, lotTotal } from '../lib/lots'
import { useCurrency } from '../context/CurrencyContext'
import { useAuth } from '../context/AuthContext'
import { useCensor } from '../context/CensorContext'
import PortfolioSelector from '../components/portfolio/PortfolioSelector'

function PctBadge({ pct }) {
  if (pct == null) return null
  const pos = pct > 0, neg = pct < 0
  return (
    <span className={[
      'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums',
      pos ? 'bg-positive-bg text-positive' : neg ? 'bg-negative-bg text-negative' : 'bg-bg-elevated text-text-secondary',
    ].join(' ')}>
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function StatCard({ label, value, sub, icon: Icon, positive, negative, pct, toggle }) {
  const valueColor = positive ? 'text-positive' : negative ? 'text-negative' : 'text-text'
  const { censored } = useCensor()
  const { fmt } = useCurrency()
  return (
    <div
      className="rounded-2xl border border-border p-5 hover:border-accent/30
                 transition-colors duration-200"
      style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide min-w-0 mr-2 leading-tight">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
          <Icon size={15} className="text-accent" />
        </div>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <p className={`text-xl sm:text-2xl font-semibold tracking-tight tabular-nums min-w-0 ${valueColor} ${censored ? 'tracking-widest' : ''}`}>
          {value}
        </p>
        <div className="mb-0.5 shrink-0"><PctBadge pct={pct} /></div>
      </div>
      {toggle && <div className="mt-1.5 w-fit">{toggle}</div>}
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function RecentLotRow({ lot }) {
  const isBuy  = lot.type === 'buy'
  const total  = lotTotal(lot)
  const { mask } = useCensor()
  const { fmt }  = useCurrency()
  return (
    <div className="flex items-center justify-between py-3 border-b border-border-subtle last:border-0">
      <div className="flex items-center gap-3">
        <span className={[
          'w-12 text-center inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold',
          isBuy ? 'bg-positive-bg text-positive' : 'bg-negative-bg text-negative',
        ].join(' ')}>
          {isBuy ? 'Buy' : 'Sell'}
        </span>
        <div>
          <Link to={`/stock/${lot.ticker}`} className="text-sm font-semibold text-text font-mono hover:text-accent transition-colors duration-150">{lot.ticker}</Link>
          <p className="text-xs text-text-muted">{fmtDate(lot.executed_at)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-text tabular-nums">{mask(fmt(total))}</p>
        <p className="text-xs text-text-muted tabular-nums">
          {mask(Number(lot.shares).toLocaleString('en-US', { maximumFractionDigits: 6 }))} shares @ {mask(fmt(lot.price))}
        </p>
      </div>
    </div>
  )
}

export default function Portfolio() {
  const { user }                                        = useAuth()
  const { lots, stats, prices, loading, pricesLoading, refresh } = useLots()
  const { mask }                                        = useCensor()
  const { fmt }                                         = useCurrency()
  const [modalOpen, setModalOpen]                       = useState(false)
  const [chartTicker, setChartTicker]                   = useState(null)
  const [plMode, setPlMode]                             = useState('alltime') // 'alltime' | 'today'

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'
  const heldTickers = Object.keys(stats.holdings)
  const recentLots  = lots.slice(0, 9)

  const hasValue   = stats.totalValue !== null
  const totalPL    = stats.totalPL
  const plPositive = totalPL > 0
  const plNegative = totalPL < 0

  const showDaily   = plMode === 'today'
  const urPL        = showDaily ? stats.totalDailyPL      : stats.totalUnrealizedPL
  const urPct       = showDaily ? stats.totalDailyPct     : stats.totalUnrealizedPct
  const urAvailable = urPL !== null

  function PlToggle() {
    return (
      <div className="flex gap-0.5 bg-bg-elevated rounded px-0.5 py-0.5">
        {['alltime', 'today'].map(m => (
          <button
            key={m}
            onClick={e => { e.stopPropagation(); setPlMode(m) }}
            className={[
              'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors duration-150',
              plMode === m ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted hover:text-text',
            ].join(' ')}
          >
            {m === 'alltime' ? 'All' : 'Today'}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-text tracking-tight">
              Hey, {displayName}
            </h1>
            <PortfolioSelector />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover
                       text-accent-fg text-sm font-semibold transition-colors duration-150 active:scale-95"
          >
            <Plus size={15} />
            Add lot
          </button>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0,1,2].map(i => (
              <div key={i} className="rounded-2xl border border-border p-5 h-28 animate-pulse"
                   style={{ background: 'var(--bg-card)' }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Market Value"
              value={mask(hasValue ? fmt(stats.totalValue) : fmt(stats.totalCostBasis))}
              sub={hasValue ? 'Live portfolio value' : 'Cost basis (no price data)'}
              icon={DollarSign}
            />
            <StatCard
              label="Unrealized P&L"
              value={urAvailable ? mask(`${urPL >= 0 ? '+' : ''}${fmt(urPL)}`) : '—'}
              sub={showDaily ? 'Since last close' : 'Open positions'}
              icon={!urAvailable || urPL >= 0 ? TrendingUp : TrendingDown}
              positive={urAvailable && urPL > 0}
              negative={urAvailable && urPL < 0}
              pct={urPct}
              toggle={<PlToggle />}
            />
            <StatCard
              label="Open Positions"
              value={stats.positionCount}
              sub={stats.positionCount === 1 ? 'ticker held' : 'tickers held'}
              icon={Layers}
            />
            <StatCard
              label="Realized P&L"
              value={mask(`${stats.totalRealizedPL >= 0 ? '+' : ''}${fmt(stats.totalRealizedPL)}`)}
              sub="From completed sells"
              icon={stats.totalRealizedPL >= 0 ? TrendingUp : TrendingDown}
              positive={stats.totalRealizedPL > 0}
              negative={stats.totalRealizedPL < 0}
            />
          </div>
        )}

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Performance chart */}
          <div
            className="lg:col-span-3 rounded-2xl border border-border p-5 flex flex-col gap-3"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
          >
            {/* Ticker selector */}
            {!loading && heldTickers.length > 0 && (
              <div className="flex gap-1 overflow-x-auto pb-0.5 -mb-0.5" style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setChartTicker(null)}
                  className={[
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 shrink-0',
                    chartTicker === null
                      ? 'bg-accent-subtle text-accent'
                      : 'text-text-secondary hover:text-text hover:bg-bg-elevated',
                  ].join(' ')}
                >
                  Portfolio
                </button>
                {heldTickers.map(t => (
                  <button
                    key={t}
                    onClick={() => setChartTicker(t)}
                    className={[
                      'px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors duration-150 shrink-0',
                      chartTicker === t
                        ? 'bg-accent-subtle text-accent'
                        : 'text-text-secondary hover:text-text hover:bg-bg-elevated',
                    ].join(' ')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <PerformanceChart lots={lots} prices={prices} ticker={chartTicker} />

            {/* Allocation chart — always visible regardless of ticker tab */}
            {!loading && lots.length > 0 && (
              <>
                <div className="border-t border-border/60 my-1" />
                <AllocationChart lots={lots} prices={prices} />
              </>
            )}
          </div>

          {/* Recent activity */}
          <div
            className="lg:col-span-2 rounded-2xl border border-border p-5 flex flex-col gap-1 min-h-0 overflow-hidden"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-text">Recent activity</h2>
              <Link
                to="/transactions"
                className="text-xs text-accent hover:text-accent-hover font-medium transition-colors duration-150"
              >
                View all
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-border border-t-accent animate-spin" />
              </div>
            ) : recentLots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-text-muted">No transactions yet</p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-3 text-xs text-accent hover:text-accent-hover font-medium transition-colors duration-150"
                >
                  Add your first lot
                </button>
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-y-auto -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                {recentLots.map(lot => <RecentLotRow key={lot.id} lot={lot} />)}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add lot modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add lot"
      >
        <LotForm
          onSuccess={() => { setModalOpen(false); refresh() }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
