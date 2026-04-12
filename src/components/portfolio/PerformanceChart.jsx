import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, AreaSeries } from 'lightweight-charts'
import { GitCompareArrows } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { fetchHistory, pollInterval } from '../../lib/priceHistory'

const RANGES   = ['1D', '1W', '1M', '3M', '1Y', 'All']
const INTRADAY = ['1m', '5m', '1h']
const SOURCES  = ['Yahoo', 'Twelve Data']

function getMarketStatus() {
  const now   = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour:    'numeric',
    minute:  '2-digit',
    hour12:  false,
  }).formatToParts(now)
  const weekday   = parts.find(p => p.type === 'weekday')?.value ?? ''
  const hour      = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10)
  const minute    = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
  const totalMins = hour * 60 + minute
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'
  const isOpen    = !isWeekend && totalMins >= 9 * 60 + 30 && totalMins < 16 * 60
  return { isOpen, isWeekend }
}

function getColors(theme) {
  const dark = theme === 'dark'
  return {
    bg:         dark ? '#181b2a' : '#ffffff',
    grid:       dark ? '#272b3f' : '#e8eaf5',
    text:       dark ? '#8b91ab' : '#4b5068',
    border:     dark ? '#272b3f' : '#d5d8ee',
    line:       dark ? '#6c68f0' : '#5753e4',
    areaTop:    dark ? 'rgba(108,104,240,0.38)' : 'rgba(87,83,228,0.22)',
    areaBottom: 'rgba(0,0,0,0)',
    crosshair:  dark ? '#555d78' : '#9096b0',
    anchor:     dark ? 'rgba(108,104,240,0.5)' : 'rgba(87,83,228,0.4)',
  }
}

function fmtVal(v) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Fetches historical prices for every ticker in the portfolio and computes
 * the total portfolio market value at each trading day/interval.
 *
 * For each timestamp T in the combined price history:
 *   - Determine which tickers were held at T (and how many shares)
 *   - Look up each ticker's price at T
 *   - Sum shares × price across all open positions
 */
async function fetchPortfolioHistory(lots, range, intraday, source, twelveKey) {
  if (!lots.length) return []

  const tickers = [...new Set(lots.map(l => l.ticker))]

  // Fetch price history for all tickers in parallel; ignore failures gracefully
  const settled = await Promise.allSettled(
    tickers.map(t =>
      fetchHistory(source, t, range, intraday, twelveKey).then(pts => ({ ticker: t, pts }))
    )
  )
  const histories = settled
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(h => h.pts.length > 0)

  if (!histories.length) return []

  // Build portfolio state snapshots sorted by lot date (ascending)
  const sorted    = [...lots].sort((a, b) => new Date(a.executed_at) - new Date(b.executed_at))
  const firstTime = Math.floor(new Date(sorted[0].executed_at).getTime() / 1000)

  const snapshots = []   // [{ time, state: { ticker: shares } }]
  const cur       = {}   // mutable running state

  for (const lot of sorted) {
    const t = lot.ticker
    cur[t] = (cur[t] ?? 0) + (lot.type === 'buy' ? +lot.shares : -+lot.shares)
    if (cur[t] < 0) cur[t] = 0
    snapshots.push({ time: Math.floor(new Date(lot.executed_at).getTime() / 1000), state: { ...cur } })
  }

  // Binary search: last portfolio snapshot at or before ts
  function stateAt(ts) {
    let lo = 0, hi = snapshots.length - 1, s = null
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (snapshots[mid].time <= ts) { s = snapshots[mid].state; lo = mid + 1 }
      else hi = mid - 1
    }
    return s
  }

  // Per-ticker sorted price arrays for binary-search lookups
  const priceArrays = {}
  for (const { ticker, pts } of histories) {
    priceArrays[ticker] = [...pts].sort((a, b) => a.time - b.time)
  }

  // Binary search: last known price at or before ts
  function priceAt(ticker, ts) {
    const arr = priceArrays[ticker]
    if (!arr?.length) return null
    let lo = 0, hi = arr.length - 1, val = null
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid].time <= ts) { val = arr[mid].value; lo = mid + 1 }
      else hi = mid - 1
    }
    return val
  }

  // Union of all timestamps across all tickers, ascending
  const allTimes = [
    ...new Set(histories.flatMap(h => h.pts.map(p => p.time))),
  ].sort((a, b) => a - b)

  const output = []
  for (const ts of allTimes) {
    if (ts < firstTime) continue          // before the portfolio existed
    const state = stateAt(ts)
    if (!state) continue

    let total = 0, anyOpen = false
    for (const [t, shares] of Object.entries(state)) {
      if (shares <= 0) continue
      anyOpen = true
      const p = priceAt(t, ts)
      if (p != null) total += shares * p
    }
    if (anyOpen && total > 0) output.push({ time: ts, value: total })
  }

  return output
}

export default function PerformanceChart({ lots, prices = {}, ticker = null }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const seriesRef    = useRef(null)
  const { theme }    = useTheme()

  const [range, setRange]         = useState('1Y')
  const [intraday, setIntraday]   = useState('5m')
  const [sourceIdx, setSourceIdx] = useState(0)
  const [histData, setHistData]   = useState(null)
  const [fetching, setFetching]   = useState(false)
  const [fetchErr, setFetchErr]   = useState(null)
  const [tooltip, setTooltip]     = useState(null)       // { value, date, time }
  const [compareMode, setCompareMode] = useState(false)
  const [anchor, setAnchor]           = useState(null)   // { value, time, date }
  const [lockedEnd, setLockedEnd]     = useState(null)   // { value, time, date } — second clicked point
  const [anchorDot, setAnchorDot]     = useState(null)   // { x, y } px in chart container
  const [lockedDot, setLockedDot]     = useState(null)   // { x, y } px in chart container

  // Refs so chart callbacks always see latest state
  const compareModeRef = useRef(false)
  const anchorRef      = useRef(null)
  const lockedEndRef   = useRef(null)
  const is1DRef        = useRef(false)
  useEffect(() => { compareModeRef.current = compareMode }, [compareMode])
  useEffect(() => { anchorRef.current = anchor }, [anchor])
  useEffect(() => { lockedEndRef.current = lockedEnd }, [lockedEnd])
  useEffect(() => { is1DRef.current = range === '1D' }, [range])

  const source    = sourceIdx === 0 ? 'yahoo' : 'twelve'
  const twelveKey = import.meta.env.VITE_TWELVEDATA_API_KEY ?? null
  const is1D      = range === '1D'

  // Market status — computed once on mount (re-render on range change is fine)
  const marketStatus = useMemo(() => getMarketStatus(), [])

  // '1D' is only meaningful for individual ticker charts — reset to '1W' in portfolio mode
  useEffect(() => {
    if (!ticker && range === '1D') setRange('1W')
  }, [ticker, range])

  // Fetch: ticker mode → single-ticker price history
  //        portfolio mode → fetchPortfolioHistory for all held tickers
  const doFetch = useCallback(() => {
    if (!ticker) return
    setFetching(true); setFetchErr(null)
    fetchHistory(source, ticker, range, intraday, twelveKey)
      .then(pts => { setHistData(pts); setFetching(false) })
      .catch(err => { setFetchErr(err.message); setFetching(false) })
  }, [ticker, range, intraday, source, twelveKey])

  useEffect(() => {
    let cancelled = false
    setFetching(true); setFetchErr(null); setHistData(null)

    const promise = ticker
      ? fetchHistory(source, ticker, range, intraday, twelveKey)
      : fetchPortfolioHistory(lots, range, intraday, source, twelveKey)

    promise
      .then(pts  => { if (!cancelled) { setHistData(pts); setFetching(false) } })
      .catch(err => { if (!cancelled) { setFetchErr(err.message); setFetching(false) } })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, lots, range, intraday, source, twelveKey])

  // Polling for 1D intraday ticker view only
  useEffect(() => {
    const ms = pollInterval(range, intraday)
    if (!ms || !ticker) return
    const id = setInterval(doFetch, ms)
    return () => clearInterval(id)
  }, [range, intraday, ticker, doFetch])

  // In portfolio mode, append a live-price "now" point so the endpoint
  // reflects today's market value (historical data only goes to last close)
  const visiblePoints = useMemo(() => {
    const pts = histData ?? []
    if (!ticker && pts.length > 0) {
      const finalShares = {}
      for (const lot of [...lots].sort((a, b) => new Date(a.executed_at) - new Date(b.executed_at))) {
        finalShares[lot.ticker] = (finalShares[lot.ticker] ?? 0) +
          (lot.type === 'buy' ? +lot.shares : -+lot.shares)
      }
      let currentValue = 0, hasPrices = false
      for (const [t, shares] of Object.entries(finalShares)) {
        if (shares > 0 && prices[t] != null) { currentValue += shares * prices[t]; hasPrices = true }
      }
      if (hasPrices && currentValue > 0) {
        const nowTs  = Math.floor(Date.now() / 1000)
        const lastTs = pts[pts.length - 1]?.time ?? 0
        if (nowTs > lastTs) return [...pts, { time: nowTs, value: currentValue }]
      }
    }
    return pts
  }, [histData, ticker, lots, prices])

  const isEmpty = visiblePoints.length < 2

  // Clear anchor + dots when leaving compare mode
  useEffect(() => {
    if (!compareMode) {
      setAnchor(null)
      setLockedEnd(null)
      setAnchorDot(null)
      setLockedDot(null)
    }
  }, [compareMode])

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return
    const colors = getColors(theme)
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor:  colors.text,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize:   11,
      },
      grid:      { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      crosshair: {
        mode:     CrosshairMode.Magnet,
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.line },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.line },
      },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.1, bottom: 0.05 } },
      timeScale:       { borderColor: colors.border, timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale:  true,
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: colors.line, topColor: colors.areaTop,
      bottomColor: colors.areaBottom, lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })

    // Crosshair move — update tooltip; skip header delta when locked
    chart.subscribeCrosshairMove(param => {
      if (!param?.time || !param.seriesData?.size) {
        setTooltip(null)
        return
      }
      const val = param.seriesData.get(series)?.value
      if (val == null) { setTooltip(null); return }
      setTooltip({
        value: val,
        time:  param.time,
        date:  new Date(param.time * 1000).toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          ...(is1DRef.current ? { hour: 'numeric', minute: '2-digit' } : {}),
        }),
      })
    })

    // Click — 3-state cycle in compare mode
    chart.subscribeClick(param => {
      if (!compareModeRef.current) return

      // Off-chart click → reset everything
      if (!param?.time || !param.seriesData?.size) {
        setAnchor(null)
        setLockedEnd(null)
        setAnchorDot(null)
        setLockedDot(null)
        return
      }

      const val = param.seriesData.get(series)?.value
      if (val == null) return

      const currentAnchor  = anchorRef.current
      const currentLocked  = lockedEndRef.current

      // State 2 (locked) → reset on 3rd click
      if (currentAnchor && currentLocked) {
        setAnchor(null)
        setLockedEnd(null)
        setAnchorDot(null)
        setLockedDot(null)
        return
      }

      // State 1 (anchor set, not locked) → lock in second point
      if (currentAnchor && !currentLocked) {
        const y = series.priceToCoordinate(val) ?? param.point?.y
        setLockedDot({ x: param.point?.x ?? 0, y: y ?? 0 })
        setLockedEnd({
          value: val,
          time:  param.time,
          date:  new Date(param.time * 1000).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            ...(is1DRef.current ? { hour: 'numeric', minute: '2-digit' } : {}),
          }),
        })
        return
      }

      // State 0 (no anchor) → set anchor
      const y = series.priceToCoordinate(val) ?? param.point?.y
      setAnchorDot({ x: param.point?.x ?? 0, y: y ?? 0 })

      setAnchor({
        value: val,
        time:  param.time,
        date:  new Date(param.time * 1000).toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        }),
      })
    })

    chartRef.current  = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); chart.remove() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Theme changes
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return
    const c = getColors(theme)
    chartRef.current.applyOptions({
      layout:          { background: { color: c.bg }, textColor: c.text },
      grid:            { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale:       { borderColor: c.border },
      crosshair: {
        vertLine: { color: c.crosshair, labelBackgroundColor: c.line },
        horzLine: { color: c.crosshair, labelBackgroundColor: c.line },
      },
    })
    seriesRef.current.applyOptions({ lineColor: c.line, topColor: c.areaTop, bottomColor: c.areaBottom })
  }, [theme])

  // Data changes
  useEffect(() => {
    if (!seriesRef.current) return
    if (visiblePoints.length >= 2) {
      seriesRef.current.setData(visiblePoints)
      chartRef.current?.timeScale().fitContent()
    } else {
      seriesRef.current.setData([])
    }
  }, [visiblePoints])

  // Hover delta — null when locked (locked delta shown instead)
  const delta = useMemo(() => {
    if (lockedEnd) return null
    if (!anchor || !tooltip || tooltip.time === anchor.time) return null
    const diff = tooltip.value - anchor.value
    const pct  = (diff / anchor.value) * 100
    return { diff, pct, pos: diff >= 0 }
  }, [anchor, tooltip, lockedEnd])

  // Locked delta — computed once when second point is clicked
  const lockedDelta = useMemo(() => {
    if (!anchor || !lockedEnd) return null
    const diff = lockedEnd.value - anchor.value
    const pct  = (diff / anchor.value) * 100
    return { diff, pct, pos: diff >= 0 }
  }, [anchor, lockedEnd])

  // SVG path tracing the actual series line between the two locked points
  const compareRegionPath = useMemo(() => {
    if (!anchor || !lockedEnd || !chartRef.current || !seriesRef.current) return null
    const chart  = chartRef.current
    const series = seriesRef.current
    const minT   = Math.min(anchor.time, lockedEnd.time)
    const maxT   = Math.max(anchor.time, lockedEnd.time)
    const pts    = visiblePoints
      .filter(p => p.time >= minT && p.time <= maxT)
      .map(p => ({
        x: chart.timeScale().timeToCoordinate(p.time),
        y: series.priceToCoordinate(p.value),
      }))
      .filter(p => p.x != null && p.y != null)
    if (pts.length < 2) return null
    const firstX = pts[0].x
    const lastX  = pts[pts.length - 1].x
    const line   = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    return `${line} L${lastX.toFixed(1)},300 L${firstX.toFixed(1)},300 Z`
  }, [anchor, lockedEnd, visiblePoints])

  const pollSecs = pollInterval(range, intraday) ? pollInterval(range, intraday) / 1000 : null

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h2 className="text-sm font-semibold text-text shrink-0">
            {ticker ? `${ticker} Price` : 'Portfolio Value'}
          </h2>

          {/* Market closed badge */}
          {!marketStatus.isOpen && (
            <span className="flex items-center gap-1 text-xs text-text-muted bg-bg-elevated border border-border px-2 py-0.5 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-negative inline-block" />
              {marketStatus.isWeekend ? 'Market closed' : 'After hours'}
            </span>
          )}

          {/* Normal tooltip */}
          {!compareMode && tooltip && (
            <span className="text-sm tabular-nums">
              <span className="font-semibold text-text">{fmtVal(tooltip.value)}</span>
              <span className="text-text-muted ml-2 text-xs">{tooltip.date}</span>
            </span>
          )}

          {/* Compare mode tooltip */}
          {compareMode && (
            <span className="text-xs text-text-muted">
              {!anchor
                ? 'Click a point to set reference'
                : lockedEnd
                  ? (
                    // Locked state
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className="tabular-nums text-text-secondary">{fmtVal(anchor.value)}</span>
                      <span className="text-text-muted">→</span>
                      <span className="tabular-nums text-text font-semibold">{fmtVal(lockedEnd.value)}</span>
                      {lockedDelta && (
                        <span className={[
                          'font-semibold tabular-nums px-1.5 py-0.5 rounded',
                          lockedDelta.pos ? 'bg-positive-bg text-positive' : 'bg-negative-bg text-negative',
                        ].join(' ')}>
                          {lockedDelta.pos ? '+' : ''}{fmtVal(lockedDelta.diff)} ({lockedDelta.pos ? '+' : ''}{lockedDelta.pct.toFixed(2)}%)
                        </span>
                      )}
                      <span className="text-text-muted opacity-60">· click to reset</span>
                    </span>
                  )
                  : delta
                    ? (
                      // Hover delta (anchor set, not locked)
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="tabular-nums text-text-secondary">{fmtVal(anchor.value)}</span>
                        <span className="text-text-muted">→</span>
                        <span className="tabular-nums text-text font-semibold">{fmtVal(tooltip?.value ?? anchor.value)}</span>
                        <span className={[
                          'font-semibold tabular-nums px-1.5 py-0.5 rounded',
                          delta.pos ? 'bg-positive-bg text-positive' : 'bg-negative-bg text-negative',
                        ].join(' ')}>
                          {delta.pos ? '+' : ''}{fmtVal(delta.diff)} ({delta.pos ? '+' : ''}{delta.pct.toFixed(2)}%)
                        </span>
                      </span>
                    )
                    : <span className="tabular-nums text-text">ref: {fmtVal(anchor.value)} · {anchor.date}</span>
              }
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Compare toggle */}
          {!isEmpty && (
            <button
              onClick={() => setCompareMode(m => !m)}
              title={compareMode ? 'Exit compare mode' : 'Compare two points'}
              className={[
                'w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-150',
                compareMode
                  ? 'bg-accent-subtle text-accent'
                  : 'text-text-muted hover:text-text hover:bg-bg-elevated',
              ].join(' ')}
            >
              <GitCompareArrows size={14} />
            </button>
          )}

          {/* Intraday interval picker */}
          {ticker && is1D && (
            <div className="flex gap-0.5 bg-bg-elevated rounded-md p-0.5">
              {INTRADAY.map(iv => (
                <button key={iv} onClick={() => setIntraday(iv)}
                  className={[
                    'px-2 py-0.5 rounded text-xs font-medium transition-colors duration-150',
                    intraday === iv ? 'bg-accent-subtle text-accent' : 'text-text-muted hover:text-text',
                  ].join(' ')}>
                  {iv}
                </button>
              ))}
            </div>
          )}

          {/* Source toggle */}
          {ticker && !is1D && (
            <div className="flex gap-0.5 bg-bg-elevated rounded-md p-0.5">
              {SOURCES.map((s, i) => (
                <button key={s} onClick={() => setSourceIdx(i)}
                  className={[
                    'px-2 py-0.5 rounded text-xs font-medium transition-colors duration-150',
                    sourceIdx === i ? 'bg-accent-subtle text-accent' : 'text-text-muted hover:text-text',
                  ].join(' ')}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Range buttons */}
          <div className="flex gap-1">
            {(ticker ? RANGES : RANGES.filter(r => r !== '1D')).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={[
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150',
                  range === r ? 'bg-accent-subtle text-accent' : 'text-text-secondary hover:text-text hover:bg-bg-elevated',
                ].join(' ')}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Polling badge */}
      {ticker && is1D && pollSecs && (
        <p className="text-xs text-text-muted -mt-1">
          15-min delayed · refreshing every {pollSecs}s
        </p>
      )}

      {/* Chart */}
      <div className={[
        'relative rounded-xl overflow-hidden transition-shadow duration-150',
        compareMode ? 'ring-1 ring-accent/30' : '',
      ].join(' ')} style={{ height: 220 }}>
        <div ref={containerRef} className={`w-full h-full ${compareMode ? 'cursor-crosshair' : ''}`} />

        {/* SVG region tracing the actual series line between locked points */}
        {compareMode && compareRegionPath && (
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%"
               style={{ zIndex: 5, overflow: 'visible' }}>
            <defs>
              <linearGradient id="cmpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lockedDelta?.pos ? '#34d399' : '#f87171'} stopOpacity="0.3" />
                <stop offset="40%"  stopColor={lockedDelta?.pos ? '#34d399' : '#f87171'} stopOpacity="0.08" />
                <stop offset="100%" stopColor={lockedDelta?.pos ? '#34d399' : '#f87171'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={compareRegionPath} fill="url(#cmpGrad)" />
          </svg>
        )}

        {/* Anchor vertical line */}
        {compareMode && anchorDot && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none border-l border-dashed border-accent/60"
            style={{ left: anchorDot.x, zIndex: 6 }}
          />
        )}

        {/* Locked end vertical line */}
        {compareMode && lockedDot && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none border-l border-dashed border-accent/60"
            style={{ left: lockedDot.x, zIndex: 6 }}
          />
        )}

        {/* Anchor dot */}
        {compareMode && anchorDot && (
          <div
            className="absolute pointer-events-none w-2.5 h-2.5 rounded-full bg-accent border-2 border-white/80"
            style={{ left: anchorDot.x - 5, top: anchorDot.y - 5, zIndex: 10 }}
          />
        )}

        {/* Locked end dot */}
        {compareMode && lockedDot && (
          <div
            className="absolute pointer-events-none w-2.5 h-2.5 rounded-full bg-accent border-2 border-white/80"
            style={{ left: lockedDot.x - 5, top: lockedDot.y - 5, zIndex: 10 }}
          />
        )}

        {fetching && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated/60 rounded-xl backdrop-blur-sm">
            <div className="w-5 h-5 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        )}
        {!fetching && fetchErr && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated rounded-xl">
            <p className="text-xs text-negative text-center px-4">{fetchErr}</p>
          </div>
        )}
        {!fetching && !fetchErr && isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated rounded-xl">
            <p className="text-sm text-text-muted">
              {!ticker && !lots.length ? 'Add buy lots to see performance' : 'No data in selected range'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
