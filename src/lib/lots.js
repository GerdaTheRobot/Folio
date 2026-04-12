import { supabase } from './supabase'

// ── CRUD ──────────────────────────────────────────────────────────

export async function getLots(portfolioId) {
  let query = supabase
    .from('lots')
    .select('*')
    .order('executed_at', { ascending: false })
  if (portfolioId) query = query.eq('portfolio_id', portfolioId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function addLot(lot, portfolioId) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('lots')
    .insert({ ...lot, user_id: user.id, portfolio_id: portfolioId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLot(id, updates) {
  const { data, error } = await supabase
    .from('lots')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLot(id) {
  const { error } = await supabase.from('lots').delete().eq('id', id)
  if (error) throw error
}

// ── CALCULATIONS ──────────────────────────────────────────────────

/**
 * Given an array of lots, returns per-ticker holdings and portfolio totals.
 *
 * Holdings per ticker:
 *   avgCost        – weighted average cost per share (buys only)
 *   shares         – net shares held (buys - sells)
 *   costBasis      – current holding cost (shares * avgCost)
 *   realizedPL     – profit/loss from completed sells
 *   currentValue   – shares * currentPrice (if price provided)
 *   unrealizedPL   – currentValue - costBasis (if price provided)
 *   totalPL        – realizedPL + unrealizedPL
 *
 * Portfolio totals:
 *   totalCostBasis   – sum of all current holding cost bases
 *   totalRealizedPL  – sum of all realized P&L
 *   totalUnrealizedPL– sum of unrealized P&L (requires prices)
 *   totalValue       – sum of current market values (requires prices)
 *   totalPL          – total profit/loss
 *   positionCount    – number of tickers with shares > 0
 *
 * @param {object} prices  Optional map of { ticker: currentPrice }
 */
export function calcPortfolioStats(lots = [], prices = {}, prevCloses = {}) {
  const byTicker = {}

  for (const lot of lots) {
    if (!byTicker[lot.ticker]) byTicker[lot.ticker] = { buys: [], sells: [] }
    byTicker[lot.ticker][lot.type === 'buy' ? 'buys' : 'sells'].push(lot)
  }

  const holdings = {}
  const previousHoldings = {}
  let totalCostBasis    = 0
  let totalRealizedPL   = 0
  let totalUnrealizedPL = 0
  let totalDailyPL      = 0
  let totalValue        = 0
  let hasDailyPL        = false

  for (const [ticker, { buys, sells }] of Object.entries(byTicker)) {
    const totalBuyShares = buys.reduce((s, l) => s + Number(l.shares), 0)
    const totalBuyCost   = buys.reduce((s, l) => s + Number(l.shares) * Number(l.price) + Number(l.fees), 0)
    const avgCost        = totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0

    const totalSellShares   = sells.reduce((s, l) => s + Number(l.shares), 0)
    const totalSellProceeds = sells.reduce((s, l) => s + Number(l.shares) * Number(l.price) - Number(l.fees), 0)
    const realizedPL        = totalSellProceeds - totalSellShares * avgCost

    const holdingShares = totalBuyShares - totalSellShares
    const costBasis     = holdingShares * avgCost

    totalRealizedPL += realizedPL

    if (holdingShares > 0) {
      totalCostBasis += costBasis

      const currentPrice = prices[ticker] ?? null
      const prevClose    = prevCloses[ticker] ?? null
      const currentValue = currentPrice !== null ? holdingShares * currentPrice : null
      const unrealizedPL = currentValue  !== null ? currentValue - costBasis    : null
      const dailyPL      = (currentPrice !== null && prevClose !== null)
        ? holdingShares * (currentPrice - prevClose) : null
      const dailyPct     = (currentPrice !== null && prevClose !== null && prevClose !== 0)
        ? (currentPrice - prevClose) / prevClose * 100 : null
      const unrealizedPct = (unrealizedPL !== null && costBasis !== 0)
        ? unrealizedPL / costBasis * 100 : null
      const totalPL = unrealizedPL !== null ? realizedPL + unrealizedPL : null

      if (currentValue !== null) totalValue        += currentValue
      if (unrealizedPL !== null) totalUnrealizedPL += unrealizedPL
      if (dailyPL      !== null) { totalDailyPL    += dailyPL; hasDailyPL = true }

      holdings[ticker] = {
        shares: holdingShares, avgCost, costBasis, realizedPL,
        currentPrice, currentValue, unrealizedPL, unrealizedPct,
        dailyPL, dailyPct, totalPL,
      }
    } else {
      // Previously owned — no current position but has realized P&L history
      previousHoldings[ticker] = {
        shares: 0, avgCost, realizedPL,
        lastSellDate: sells.length
          ? sells.reduce((latest, l) =>
              l.executed_at > latest ? l.executed_at : latest,
              sells[0].executed_at)
          : null,
      }
    }
  }

  const hasPrices = Object.keys(prices).length > 0
  const totalPL   = hasPrices ? totalRealizedPL + totalUnrealizedPL : null

  // Portfolio-level daily % = totalDailyPL / (totalValue - totalDailyPL)
  const prevTotalValue   = hasDailyPL ? (totalValue - totalDailyPL) : null
  const totalDailyPct    = (hasDailyPL && prevTotalValue && prevTotalValue !== 0)
    ? totalDailyPL / prevTotalValue * 100 : null
  const totalUnrealizedPct = (hasPrices && totalCostBasis !== 0)
    ? totalUnrealizedPL / totalCostBasis * 100 : null

  return {
    holdings,
    previousHoldings,
    totalCostBasis,
    totalRealizedPL,
    totalUnrealizedPL:  hasPrices  ? totalUnrealizedPL  : null,
    totalUnrealizedPct: hasPrices  ? totalUnrealizedPct : null,
    totalDailyPL:       hasDailyPL ? totalDailyPL       : null,
    totalDailyPct:      hasDailyPL ? totalDailyPct      : null,
    totalValue:         hasPrices  ? totalValue          : null,
    totalPL,
    positionCount: Object.keys(holdings).length,
  }
}

/** Cost of a single lot (buy: +fees, sell: -fees) */
export function lotTotal(lot) {
  const base = Number(lot.shares) * Number(lot.price)
  return lot.type === 'buy' ? base + Number(lot.fees) : base - Number(lot.fees)
}

/** Format a number as USD */
export function fmt(value, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Format a date string as e.g. "Apr 10, 2025" */
export function fmtDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
