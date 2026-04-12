function escapeCell(val) {
  const s = String(val ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

export function exportLotsAsCsv(lots, portfolioName = 'portfolio') {
  const header = ['date', 'ticker', 'type', 'shares', 'price', 'fees', 'notes']
  const rows = lots.map(lot => [
    lot.executed_at.slice(0, 10),
    lot.ticker,
    lot.type,
    lot.shares,
    lot.price,
    lot.fees ?? 0,
    lot.notes ?? '',
  ])
  const csv = [header, ...rows].map(r => r.map(escapeCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `folio-${portfolioName}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
