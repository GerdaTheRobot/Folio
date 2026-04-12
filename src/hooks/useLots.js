import { useState, useEffect, useCallback } from 'react'
import { getLots, calcPortfolioStats } from '../lib/lots'
import { usePrices } from './usePrices'
import { usePortfolio } from '../context/PortfolioContext'

export function useLots() {
  const { activeId } = usePortfolio()
  const [lots, setLots]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const refresh = useCallback(async () => {
    if (!activeId) { setLots([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await getLots(activeId)
      setLots(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [activeId])

  useEffect(() => { refresh() }, [refresh])

  // Derive the unique tickers currently held (net shares > 0)
  const rawStats      = calcPortfolioStats(lots)
  const heldTickers   = Object.keys(rawStats.holdings)

  // Live prices from Finnhub
  const { prices, prevCloses, loading: pricesLoading } = usePrices(heldTickers)

  // Recalculate with prices + prev closes
  const stats = calcPortfolioStats(lots, prices, prevCloses)

  return { lots, stats, prices, prevCloses, loading, pricesLoading, error, refresh }
}
