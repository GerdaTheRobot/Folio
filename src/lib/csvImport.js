// ── CSV parser (handles quoted fields with commas) ────────────────
function parseCsvLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function parseCsv(text) {
  return text.split('\n').filter(l => l.trim()).map(parseCsvLine)
}

// ── IBKR Activity Statement parser ───────────────────────────────
// Expects the default CSV export from IBKR's Activity Statement.
// Trades section rows look like:
//   Trades,Data,Order,Stocks,USD,AAPL,"2024-01-15, 10:30:00",100,185.5,...,-1.05,...
export function parseIBKR(text) {
  const rows = parseCsv(text)
  const lots = []

  for (const row of rows) {
    if (row[0] !== 'Trades' || row[1] !== 'Data') continue
    if (row[3] !== 'Stocks') continue // skip options, forex, etc.

    const ticker   = row[5]?.trim().toUpperCase()
    const dateStr  = row[6]?.trim()   // "2024-01-15, 10:30:00"
    const quantity = parseFloat(row[7])
    const price    = parseFloat(row[8])
    const fees     = Math.abs(parseFloat(row[11] || '0'))

    if (!ticker || isNaN(quantity) || isNaN(price) || quantity === 0) continue

    // Date: take only the date part before the comma
    const datePart = dateStr.split(',')[0].trim()
    const date = new Date(datePart + 'T12:00:00Z')
    if (isNaN(date.getTime())) continue

    lots.push({
      ticker,
      type:        quantity > 0 ? 'buy' : 'sell',
      shares:      Math.abs(quantity),
      price:       Math.abs(price),
      fees:        isNaN(fees) ? 0 : fees,
      notes:       null,
      executed_at: date.toISOString(),
    })
  }

  return lots
}

// ── Folio native CSV parser ───────────────────────────────────────
// Expected header: date,ticker,type,shares,price,fees,notes
export function parseFolioCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('File appears empty.')

  const header    = rows[0].map(h => h.toLowerCase())
  const idx       = h => header.indexOf(h)
  const dateIdx   = idx('date'),   tickerIdx = idx('ticker')
  const typeIdx   = idx('type'),   sharesIdx = idx('shares')
  const priceIdx  = idx('price'),  feesIdx   = idx('fees')
  const notesIdx  = idx('notes')

  if ([dateIdx, tickerIdx, typeIdx, sharesIdx, priceIdx].some(i => i === -1))
    throw new Error('Missing required columns: date, ticker, type, shares, price.')

  const lots = []
  for (const row of rows.slice(1)) {
    const ticker = row[tickerIdx]?.toUpperCase()
    const type   = row[typeIdx]?.toLowerCase()
    const shares = parseFloat(row[sharesIdx])
    const price  = parseFloat(row[priceIdx])
    const fees   = feesIdx  !== -1 ? parseFloat(row[feesIdx]  || '0') : 0
    const notes  = notesIdx !== -1 ? row[notesIdx] || null : null
    const date   = new Date(row[dateIdx]?.trim() + 'T12:00:00Z')

    if (!ticker || !['buy', 'sell'].includes(type) || isNaN(shares) || isNaN(price)) continue
    if (isNaN(date.getTime())) continue

    lots.push({
      ticker, type, shares, price,
      fees:        isNaN(fees) ? 0 : fees,
      notes,
      executed_at: date.toISOString(),
    })
  }

  return lots
}

// ── Auto-detect format ────────────────────────────────────────────
export function detectFormat(text) {
  if (/Trades,Header|Trades,Data/.test(text)) return 'ibkr'
  const lower = text.toLowerCase()
  if (lower.includes('ticker') && lower.includes('shares') && lower.includes('price')) return 'folio'
  return 'unknown'
}
