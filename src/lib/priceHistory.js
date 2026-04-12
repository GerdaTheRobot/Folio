/**
 * Price history providers.
 * Each returns: Promise<Array<{ time: number (unix seconds), value: number }>>
 *
 * Supported ranges: '1D' | '1W' | '1M' | '3M' | '1Y' | 'All'
 * For '1D', pass an intraday interval: '1m' | '5m' | '1h'
 */

// Daily / multi-day ranges
const DAILY_PARAMS = {
  '1W':  { range: '5d',  interval: '1d'  },
  '1M':  { range: '1mo', interval: '1d'  },
  '3M':  { range: '3mo', interval: '1d'  },
  '1Y':  { range: '1y',  interval: '1d'  },
  'All': { range: '5y',  interval: '1wk' },
}

// Intraday intervals for 1D view
const INTRADAY_PARAMS = {
  '1m': { range: '1d', interval: '1m'  },
  '5m': { range: '1d', interval: '5m'  },
  '1h': { range: '1d', interval: '60m' },
}

// ── Yahoo Finance (unofficial, no key required) ───────────────────────────────

export async function fetchHistoryYahoo(ticker, rangeLabel = '1Y', intradayInterval = '5m') {
  const p = rangeLabel === '1D'
    ? (INTRADAY_PARAMS[intradayInterval] ?? INTRADAY_PARAMS['5m'])
    : (DAILY_PARAMS[rangeLabel] ?? DAILY_PARAMS['1Y'])

  // In dev, Vite proxies /yahoo-finance → Yahoo directly.
  // In production (Vercel), /api/yahoo is the serverless function.
  const url = import.meta.env.PROD
    ? `/api/yahoo?ticker=${encodeURIComponent(ticker)}&interval=${p.interval}&range=${p.range}`
    : `/yahoo-finance/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${p.interval}&range=${p.range}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo Finance: ${res.status} for ${ticker}`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Yahoo Finance: no data for ${ticker}`)

  const timestamps = result.timestamp ?? []
  const closes     = result.indicators?.quote?.[0]?.close ?? []

  const points = []
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i]
    const v = closes[i]
    if (t != null && v != null) points.push({ time: t, value: v })
  }
  return points
}

// ── Twelve Data (official, free tier: 800 req/day) ────────────────────────────

const TWELVE_DAILY_MAP = {
  '1W':  { outputsize: 5,    interval: '1day'  },
  '1M':  { outputsize: 30,   interval: '1day'  },
  '3M':  { outputsize: 90,   interval: '1day'  },
  '1Y':  { outputsize: 252,  interval: '1day'  },
  'All': { outputsize: 5000, interval: '1week' },
}

const TWELVE_INTRADAY_MAP = {
  '1m': { outputsize: 390, interval: '1min'  },
  '5m': { outputsize: 78,  interval: '5min'  },
  '1h': { outputsize: 7,   interval: '1h'    },
}

export async function fetchHistoryTwelve(ticker, rangeLabel = '1Y', intradayInterval = '5m', apiKey) {
  if (!apiKey) throw new Error('Twelve Data API key required')

  const { outputsize, interval } = rangeLabel === '1D'
    ? (TWELVE_INTRADAY_MAP[intradayInterval] ?? TWELVE_INTRADAY_MAP['5m'])
    : (TWELVE_DAILY_MAP[rangeLabel] ?? TWELVE_DAILY_MAP['1Y'])

  const url =
    `https://api.twelvedata.com/time_series` +
    `?symbol=${encodeURIComponent(ticker)}&interval=${interval}` +
    `&outputsize=${outputsize}&apikey=${apiKey}&format=JSON`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Twelve Data: ${res.status} for ${ticker}`)

  const json = await res.json()
  if (json.status === 'error') throw new Error(`Twelve Data: ${json.message}`)

  const values = json.values ?? []
  return values
    .map(v => ({
      time:  Math.floor(new Date(v.datetime).getTime() / 1000),
      value: parseFloat(v.close),
    }))
    .filter(p => !isNaN(p.value))
    .reverse()
}

// ── Unified fetch ─────────────────────────────────────────────────────────────

/**
 * @param {'yahoo'|'twelve'} source
 * @param {string}           ticker
 * @param {string}           rangeLabel         '1D' | '1W' | '1M' | '3M' | '1Y' | 'All'
 * @param {string}           [intradayInterval] '1m' | '5m' | '1h' (only used when rangeLabel='1D')
 * @param {string}           [apiKey]           required for 'twelve'
 */
export async function fetchHistory(source, ticker, rangeLabel, intradayInterval = '5m', apiKey) {
  if (source === 'twelve') return fetchHistoryTwelve(ticker, rangeLabel, intradayInterval, apiKey)
  return fetchHistoryYahoo(ticker, rangeLabel, intradayInterval)
}

/** Polling interval in ms for a given range/intraday combo */
export function pollInterval(rangeLabel, intradayInterval) {
  if (rangeLabel !== '1D') return null   // no polling for daily+ views
  return { '1m': 30_000, '5m': 60_000, '1h': 300_000 }[intradayInterval] ?? 60_000
}
