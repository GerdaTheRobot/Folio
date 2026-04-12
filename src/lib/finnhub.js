const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY
const BASE    = 'https://finnhub.io/api/v1'

// ── REST ──────────────────────────────────────────────────────────

/** Search for symbols by query. Returns array of { symbol, description, type } */
export async function searchSymbols(query) {
  if (!query) return []
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&token=${API_KEY}`)
  if (!res.ok) throw new Error(`Finnhub search error: ${res.status}`)
  const data = await res.json()
  // Filter to US common stocks only, limit results
  return (data.result ?? [])
    .filter(r => r.type === 'Common Stock' && !r.symbol.includes('.'))
    .slice(0, 8)
}

/** Fetch the latest quote for a ticker. Returns { c, h, l, o, pc, t } */
export async function fetchQuote(ticker) {
  const res = await fetch(`${BASE}/quote?symbol=${ticker}&token=${API_KEY}`)
  if (!res.ok) throw new Error(`Finnhub quote error: ${res.status}`)
  return res.json()
}

/**
 * Fetch OHLCV candles for a ticker.
 * @param {string} ticker
 * @param {'D'|'W'|'M'} resolution
 * @param {number} from  Unix timestamp (seconds)
 * @param {number} to    Unix timestamp (seconds)
 */
export async function fetchCandles(ticker, resolution, from, to) {
  const url = `${BASE}/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${from}&to=${to}&token=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub candles error: ${res.status}`)
  const data = await res.json()
  if (data.s !== 'ok') return []

  // Zip into array of { time, open, high, low, close, volume }
  return data.t.map((t, i) => ({
    time:   t,          // Unix seconds
    open:   data.o[i],
    high:   data.h[i],
    low:    data.l[i],
    close:  data.c[i],
    volume: data.v[i],
  }))
}

// ── WEBSOCKET ─────────────────────────────────────────────────────

/**
 * Opens a Finnhub WebSocket and subscribes to the given tickers.
 * Calls onQuote({ ticker, price, timestamp }) on each trade event.
 * Returns a cleanup function.
 */
export function subscribeQuotes(tickers, onQuote) {
  if (!tickers.length) return () => {}

  const ws = new WebSocket(`wss://ws.finnhub.io?token=${API_KEY}`)

  ws.addEventListener('open', () => {
    tickers.forEach(ticker => {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }))
    })
  })

  ws.addEventListener('message', e => {
    const msg = JSON.parse(e.data)
    if (msg.type !== 'trade' || !msg.data?.length) return
    // Take the last trade for each symbol in the batch
    const bySymbol = {}
    for (const trade of msg.data) {
      bySymbol[trade.s] = trade
    }
    for (const [ticker, trade] of Object.entries(bySymbol)) {
      onQuote({ ticker, price: trade.p, timestamp: trade.t })
    }
  })

  ws.addEventListener('error', e => console.warn('[Finnhub WS] error', e))

  return () => {
    tickers.forEach(ticker => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbol: ticker }))
      }
    })
    ws.close()
  }
}
