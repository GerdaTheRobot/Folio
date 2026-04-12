import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Plus, Pencil, Trash2, X } from 'lucide-react'
import { usePortfolio } from '../../context/PortfolioContext'

export default function PortfolioSelector() {
  const { portfolios, active, activeId, switchPortfolio, addPortfolio, renameActive, deleteActive } = usePortfolio()

  const [open, setOpen]           = useState(false)
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName]   = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState('')

  const containerRef = useRef(null)
  const newInputRef  = useRef(null)
  const editInputRef = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setCreating(false)
        setEditingId(null)
        setDeletingId(null)
        setError('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (creating) newInputRef.current?.focus()
  }, [creating])

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    setError('')
    try {
      await addPortfolio(newName)
      setNewName('')
      setCreating(false)
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRename(e) {
    e.preventDefault()
    if (!editName.trim()) return
    setBusy(true)
    setError('')
    try {
      await renameActive(editingId, editName)
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    setBusy(true)
    setError('')
    try {
      await deleteActive(id)
      setDeletingId(null)
      setOpen(false)
    } catch (err) {
      setError(err.message)
      setDeletingId(null)
    } finally {
      setBusy(false)
    }
  }

  if (!active) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setCreating(false); setEditingId(null); setError('') }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border
                   bg-bg-elevated hover:bg-bg-card hover:border-accent/40
                   transition-colors duration-150 group"
      >
        <span className="text-sm font-semibold text-text max-w-[160px] truncate">{active.name}</span>
        <ChevronDown
          size={14}
          className={`text-text-muted transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-border py-1 z-50 overflow-hidden"
          style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)' }}
        >
          {/* Portfolio list */}
          {portfolios.map(p => (
            <div key={p.id} className="group/item relative">
              {editingId === p.id ? (
                <form onSubmit={handleRename} className="flex items-center gap-1 px-3 py-2">
                  <input
                    ref={editInputRef}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 rounded-md border border-accent bg-bg-elevated px-2 py-1
                               text-sm text-text outline-none focus:ring-1 focus:ring-accent/30"
                    maxLength={40}
                    disabled={busy}
                  />
                  <button type="submit" disabled={busy || !editName.trim()}
                    className="w-6 h-6 flex items-center justify-center rounded text-positive
                               hover:bg-positive-bg transition-colors duration-150 disabled:opacity-40">
                    <Check size={13} />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}
                    className="w-6 h-6 flex items-center justify-center rounded text-text-muted
                               hover:bg-bg-elevated transition-colors duration-150">
                    <X size={13} />
                  </button>
                </form>
              ) : deletingId === p.id ? (
                <div className="px-3 py-2 flex flex-col gap-2">
                  <p className="text-xs text-text-secondary">Delete "{p.name}"? This removes all its lots.</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => setDeletingId(null)}
                      className="flex-1 py-1 rounded-md border border-border text-xs text-text-secondary
                                 hover:bg-bg-elevated transition-colors duration-150">
                      Cancel
                    </button>
                    <button onClick={() => handleDelete(p.id)} disabled={busy}
                      className="flex-1 py-1 rounded-md bg-negative text-white text-xs font-semibold
                                 hover:opacity-90 transition-all duration-150 disabled:opacity-60">
                      {busy ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { switchPortfolio(p.id); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2.5
                             hover:bg-bg-elevated transition-colors duration-100 text-left"
                >
                  <Check size={14} className={p.id === activeId ? 'text-accent shrink-0' : 'text-transparent shrink-0'} />
                  <span className="flex-1 text-sm text-text truncate">{p.name}</span>
                  {/* Action buttons — visible on hover */}
                  <span className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150">
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); setEditingId(p.id); setEditName(p.name) }}
                      className="w-6 h-6 flex items-center justify-center rounded text-text-muted
                                 hover:text-text hover:bg-bg transition-colors duration-150"
                    >
                      <Pencil size={12} />
                    </span>
                    {portfolios.length > 1 && (
                      <span
                        role="button"
                        onClick={e => { e.stopPropagation(); setDeletingId(p.id) }}
                        className="w-6 h-6 flex items-center justify-center rounded text-text-muted
                                   hover:text-negative hover:bg-negative-bg transition-colors duration-150"
                      >
                        <Trash2 size={12} />
                      </span>
                    )}
                  </span>
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-border-subtle mt-1 pt-1">
            {creating ? (
              <form onSubmit={handleCreate} className="flex items-center gap-1 px-3 py-2">
                <input
                  ref={newInputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Portfolio name"
                  maxLength={40}
                  disabled={busy}
                  className="flex-1 rounded-md border border-accent bg-bg-elevated px-2 py-1
                             text-sm text-text placeholder:text-text-muted outline-none
                             focus:ring-1 focus:ring-accent/30"
                />
                <button type="submit" disabled={busy || !newName.trim()}
                  className="w-6 h-6 flex items-center justify-center rounded text-positive
                             hover:bg-positive-bg transition-colors duration-150 disabled:opacity-40">
                  <Check size={13} />
                </button>
                <button type="button" onClick={() => { setCreating(false); setNewName('') }}
                  className="w-6 h-6 flex items-center justify-center rounded text-text-muted
                             hover:bg-bg-elevated transition-colors duration-150">
                  <X size={13} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => { setCreating(true); setEditingId(null) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-secondary
                           hover:text-text hover:bg-bg-elevated transition-colors duration-100"
              >
                <Plus size={14} className="shrink-0" />
                New portfolio
              </button>
            )}
            {error && (
              <p className="px-3 pb-2 text-xs text-negative">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
