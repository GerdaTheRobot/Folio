import { useState, useEffect, useRef } from 'react'
import { fetchQuote, subscribeQuotes } from '../lib/finnhub'

/**
 * Returns:
 *   prices      { NVDA: 183.91 }   – current price (live via WS)
 *   prevCloses  { NVDA: 181.00 }   – previous close (from initial REST fetch)
 *   loading     bool
 */
export function usePrices(tickers) {
  const [prices, setPrices]         = useState({})
  const [prevCloses, setPrevCloses] = useState({})
  const [loading, setLoading]       = useState(false)
  const tickersKey                  = tickers.slice().sort().join(',')

  useEffect(() => {
    if (!tickers.length) { setPrices({}); setPrevCloses({}); return }

    setLoading(true)
    Promise.all(
      tickers.map(async ticker => {
        try {
          const q = await fetchQuote(ticker)
          return [ticker, { c: q.c, pc: q.pc }]
        } catch {
          return [ticker, null]
        }
      })
    ).then(results => {
      const p = {}, pc = {}
      for (const [ticker, val] of results) {
        if (val) { p[ticker] = val.c; pc[ticker] = val.pc }
      }
      setPrices(p)
      setPrevCloses(pc)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey])

  useEffect(() => {
    if (!tickers.length) return
    const cleanup = subscribeQuotes(tickers, ({ ticker, price }) => {
      setPrices(p => ({ ...p, [ticker]: price }))
    })
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey])

  return { prices, prevCloses, loading }
}
