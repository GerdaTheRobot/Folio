import { useState } from 'react'
import { Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { deleteLot, lotTotal, fmtDate, fmt } from '../../lib/lots'
import Modal from '../ui/Modal'
import LotForm from './LotForm'
import { useCensor } from '../../context/CensorContext'

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ChevronUp size={12} className="text-text-muted opacity-40" />
  return sort.dir === 'asc'
    ? <ChevronUp size={12} className="text-accent" />
    : <ChevronDown size={12} className="text-accent" />
}

function Th({ label, field, sort, onSort, className = '' }) {
  const alignEnd = className.includes('text-right')
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide
                  cursor-pointer select-none hover:text-text-secondary transition-colors duration-150 ${className}`}
    >
      <span className={`flex items-center gap-1 ${alignEnd ? 'justify-end' : ''}`}>
        {label}
        <SortIcon field={field} sort={sort} />
      </span>
    </th>
  )
}

export default function LotsTable({ lots, onChanged }) {
  const [sort, setSort]           = useState({ field: 'executed_at', dir: 'desc' })
  const [editLot, setEditLot]     = useState(null)
  const [deleteId, setDeleteId]   = useState(null)
  const [deleting, setDeleting]   = useState(false)
  const { mask }                  = useCensor()

  function handleSort(field) {
    setSort(s => ({ field, dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc' }))
  }

  const sorted = [...lots].sort((a, b) => {
    let av = a[sort.field], bv = b[sort.field]
    if (sort.field === 'executed_at') { av = new Date(av); bv = new Date(bv) }
    else if (['shares', 'price', 'fees'].includes(sort.field)) { av = Number(av); bv = Number(bv) }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1
    if (av > bv) return sort.dir === 'asc' ?  1 : -1
    return 0
  })

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteLot(deleteId)
      setDeleteId(null)
      onChanged()
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
    }
  }

  if (lots.length === 0) return null

  return (
    <>
      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border" style={{ background: 'var(--bg-elevated)' }}>
              <Th label="Date"    field="executed_at" sort={sort} onSort={handleSort} />
              <Th label="Type"    field="type"        sort={sort} onSort={handleSort} />
              <Th label="Ticker"  field="ticker"      sort={sort} onSort={handleSort} />
              <Th label="Shares"  field="shares"      sort={sort} onSort={handleSort} className="text-right" />
              <Th label="Price"   field="price"       sort={sort} onSort={handleSort} className="text-right" />
              <Th label="Fees"    field="fees"        sort={sort} onSort={handleSort} className="text-right" />
              <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wide">
                Total
              </th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((lot, i) => {
              const total = lotTotal(lot)
              const isBuy = lot.type === 'buy'
              return (
                <tr
                  key={lot.id}
                  className={[
                    'border-b border-border-subtle transition-colors duration-100',
                    'hover:bg-bg-elevated group',
                    i % 2 === 0 ? '' : 'bg-bg/50',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {fmtDate(lot.executed_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={[
                      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold',
                      isBuy
                        ? 'bg-positive-bg text-positive'
                        : 'bg-negative-bg text-negative',
                    ].join(' ')}>
                      {isBuy ? 'Buy' : 'Sell'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/stock/${lot.ticker}`}
                      className="font-mono font-semibold text-text hover:text-accent transition-colors duration-150">
                      {lot.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-text tabular-nums">
                    {mask(Number(lot.shares).toLocaleString('en-US', { maximumFractionDigits: 6 }))}
                  </td>
                  <td className="px-4 py-3 text-right text-text tabular-nums">{mask(fmt(lot.price))}</td>
                  <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                    {Number(lot.fees) > 0 ? mask(fmt(lot.fees)) : <span className="text-text-muted">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isBuy ? 'text-negative' : 'text-positive'}`}>
                    {mask(`${isBuy ? '-' : '+'}${fmt(Math.abs(total))}`)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => setEditLot(lot)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted
                                   hover:text-text hover:bg-bg transition-colors duration-150"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(lot.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted
                                   hover:text-negative hover:bg-negative-bg transition-colors duration-150"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      <Modal
        open={Boolean(editLot)}
        onClose={() => setEditLot(null)}
        title="Edit lot"
      >
        {editLot && (
          <LotForm
            initial={editLot}
            onSuccess={() => { setEditLot(null); onChanged() }}
            onCancel={() => setEditLot(null)}
          />
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Delete lot"
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary">
            This lot will be permanently deleted and your P&amp;L will be recalculated. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteId(null)}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary
                         hover:text-text hover:bg-bg-elevated transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-lg bg-negative hover:opacity-90 text-white text-sm font-semibold
                         transition-all duration-150 active:scale-[0.98] disabled:opacity-60
                         flex items-center justify-center gap-2"
            >
              {deleting && (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
