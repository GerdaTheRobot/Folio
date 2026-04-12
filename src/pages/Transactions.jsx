import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, BarChart2, RefreshCw, ChevronDown, Archive, Upload, Download } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Modal from '../components/ui/Modal'
import LotForm from '../components/portfolio/LotForm'
import LotsTable from '../components/portfolio/LotsTable'
import ImportModal from '../components/portfolio/ImportModal'
import { useLots } from '../hooks/useLots'
import { usePortfolio } from '../context/PortfolioContext'
import { fmt, fmtDate } from '../lib/lots'
import { useCensor } from '../context/CensorContext'
import { exportLotsAsCsv } from '../lib/csvExport'
import PortfolioSelector from '../components/portfolio/PortfolioSelector'

function StatCard({ label, value, sub, valueColor }) {
  return (
    <div
      className="rounded-2xl border border-border p-5"
      style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
    >
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight ${valueColor || 'text-text'}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent-subtle flex items-center justify-center mb-4">
        <BarChart2 size={24} className="text-accent" />
      </div>
      <h3 className="text-base font-semibold text-text mb-1">No lots yet</h3>
      <p className="text-sm text-text-secondary max-w-xs mb-5">
        Add your first buy or sell transaction to start tracking your positions.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover
                   text-accent-fg text-sm font-semibold transition-colors duration-150 active:scale-95"
      >
        <Plus size={15} />
        Add first lot
      </button>
    </div>
  )
}

function PreviouslyOwned({ previousHoldings, mask }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(previousHoldings)
  if (!entries.length) return null

  return (
    <div
      className="rounded-2xl border border-border overflow-hidden"
      style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg-elevated
                   transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <Archive size={15} className="text-text-muted" />
          <span className="text-sm font-semibold text-text">Previously Owned</span>
          <span className="text-xs text-text-muted font-normal">
            {entries.length} {entries.length === 1 ? 'ticker' : 'tickers'}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border" style={{ background: 'var(--bg-elevated)' }}>
                {['Ticker', 'Avg Cost', 'Realized P&L', 'Last Sold'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(([ticker, h]) => {
                const pos = h.realizedPL > 0, neg = h.realizedPL < 0
                return (
                  <tr key={ticker} className="border-b border-border-subtle hover:bg-bg-elevated transition-colors duration-100">
                    <td className="px-4 py-3">
                      <Link to={`/stock/${ticker}`} className="font-mono font-semibold text-text hover:text-accent transition-colors duration-150">{ticker}</Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-secondary">{mask(fmt(h.avgCost))}</td>
                    <td className={`px-4 py-3 tabular-nums font-semibold ${pos ? 'text-positive' : neg ? 'text-negative' : 'text-text'}`}>
                      {mask(`${h.realizedPL >= 0 ? '+' : ''}${fmt(h.realizedPL)}`)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {h.lastSellDate ? fmtDate(h.lastSellDate) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Transactions() {
  const { lots, stats, loading, error, refresh } = useLots()
  const { activeId, active } = usePortfolio()
  const { mask } = useCensor()
  const [modalOpen,  setModalOpen]  = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const plColor = stats.totalRealizedPL > 0
    ? 'text-positive'
    : stats.totalRealizedPL < 0
      ? 'text-negative'
      : 'text-text'

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-text tracking-tight">Transactions</h1>
            <PortfolioSelector />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary
                         hover:text-text hover:bg-bg-elevated border border-border
                         transition-colors duration-150"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => exportLotsAsCsv(lots, active?.name)}
              disabled={lots.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border
                         text-text-secondary hover:text-text hover:bg-bg-elevated
                         text-sm font-medium transition-colors duration-150 active:scale-95
                         disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export CSV"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border
                         text-text-secondary hover:text-text hover:bg-bg-elevated
                         text-sm font-medium transition-colors duration-150 active:scale-95"
              title="Import CSV"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover
                         text-accent-fg text-sm font-semibold transition-colors duration-150 active:scale-95"
            >
              <Plus size={15} />
              Add lot
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Cost Basis"
            value={mask(fmt(stats.totalCostBasis))}
            sub="Current holdings"
          />
          <StatCard
            label="Open Positions"
            value={stats.positionCount}
            sub={stats.positionCount === 1 ? 'ticker held' : 'tickers held'}
          />
          <StatCard
            label="Realized P&L"
            value={mask(`${stats.totalRealizedPL >= 0 ? '+' : ''}${fmt(stats.totalRealizedPL)}`)}
            sub="From completed sells"
            valueColor={plColor}
          />
        </div>

        {/* Lots table */}
        <div
          className="rounded-2xl border border-border overflow-hidden"
          style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text">
              Transaction history
              {lots.length > 0 && (
                <span className="ml-2 text-xs font-normal text-text-muted">
                  {lots.length} {lots.length === 1 ? 'lot' : 'lots'}
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full border-2 border-border border-t-accent animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-negative">{error}</p>
            </div>
          ) : lots.length === 0 ? (
            <EmptyState onAdd={() => setModalOpen(true)} />
          ) : (
            <LotsTable lots={lots} onChanged={refresh} />
          )}
        </div>

        {/* Previously owned */}
        {!loading && (
          <PreviouslyOwned
            previousHoldings={stats.previousHoldings ?? {}}
            mask={mask}
          />
        )}
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

      {/* Import modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import transactions"
        maxWidth="max-w-xl"
      >
        <ImportModal
          portfolioId={activeId}
          onSuccess={() => { setImportOpen(false); refresh() }}
        />
      </Modal>
    </div>
  )
}
