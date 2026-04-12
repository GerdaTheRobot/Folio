import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$',  label: 'US Dollar',          flag: '🇺🇸' },
  ILS: { code: 'ILS', symbol: '₪',  label: 'Israeli New Shekel',  flag: '🇮🇱' },
}

const FALLBACK_RATES = { USD: 1, ILS: 3.7 }
const CACHE_TTL_MS   = 60 * 60 * 1000  // 1 hour

const CurrencyContext = createContext()
export const useCurrency = () => useContext(CurrencyContext)

function formatAmount(usdAmount, currencyCode, rate, decimals = 2) {
  if (usdAmount == null || isNaN(usdAmount)) return '—'
  const converted = usdAmount * rate
  const { symbol } = CURRENCIES[currencyCode]
  return symbol + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(converted)
}

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(
    () => localStorage.getItem('currency') || 'USD'
  )
  const [rate, setRate] = useState(1)

  useEffect(() => {
    if (currency === 'USD') { setRate(1); return }

    // Try localStorage cache
    try {
      const cached = JSON.parse(localStorage.getItem(`rate_${currency}`) || 'null')
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        setRate(cached.value); return
      }
    } catch (_) {}

    // Fetch live rate
    fetch(`https://open.er-api.com/v6/latest/USD`)
      .then(r => r.json())
      .then(d => {
        const value = d.rates?.[currency]
        if (value) {
          setRate(value)
          localStorage.setItem(`rate_${currency}`, JSON.stringify({ value, ts: Date.now() }))
        }
      })
      .catch(() => setRate(FALLBACK_RATES[currency] ?? 1))
  }, [currency])

  const setCurrency = useCallback((code) => {
    setCurrencyState(code)
    localStorage.setItem('currency', code)
  }, [])

  const fmt = useCallback(
    (usdAmount, decimals = 2) => formatAmount(usdAmount, currency, rate, decimals),
    [currency, rate]
  )

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, fmt, symbol: CURRENCIES[currency].symbol }}>
      {children}
    </CurrencyContext.Provider>
  )
}
