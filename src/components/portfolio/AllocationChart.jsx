import { useState, useMemo, useRef } from 'react'
import { useCensor } from '../../context/CensorContext'
import { useCurrency } from '../../context/CurrencyContext'

const PALETTE = [
  '#6c68f0', // accent purple (matches line chart)
  '#34d399', // emerald
  '#f59e0b', // amber
  '#60a5fa', // blue
  '#f87171', // red
  '#a78bfa', // violet
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#e879f9', // fuchsia
  '#facc15', // yellow
]


/**
 * Returns the SVG path for a donut arc slice.
 * Angles are in degrees, 0 = top (12 o'clock), clockwise.
 * A small inset gap (GAP_DEG/2) is applied to each edge for visual separation.
 */
const GAP = 1.5 // degrees of gap between slices

function slicePath(cx, cy, outerR, innerR, startDeg, endDeg) {
  // Apply gap
  const s = startDeg + GAP / 2
  const e = endDeg   - GAP / 2
  if (e <= s) return '' // slice too small to render

  const rad = (d) => (d - 90) * Math.PI / 180
  const large = (e - s) > 180 ? 1 : 0

  const cos = Math.cos, sin = Math.sin
  const x1o = cx + outerR * cos(rad(s)), y1o = cy + outerR * sin(rad(s))
  const x2o = cx + outerR * cos(rad(e)), y2o = cy + outerR * sin(rad(e))
  const x1i = cx + innerR * cos(rad(e)), y1i = cy + innerR * sin(rad(e))
  const x2i = cx + innerR * cos(rad(s)), y2i = cy + innerR * sin(rad(s))

  return [
    `M ${x1o} ${y1o}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${x2i} ${y2i}`,
    'Z',
  ].join(' ')
}

function useAllocations(lots, prices) {
  return useMemo(() => {
    if (!lots.length) return []

    // Build final share counts from all lots
    const shares = {}
    for (const lot of [...lots].sort((a, b) => new Date(a.executed_at) - new Date(b.executed_at))) {
      const t = lot.ticker
      shares[t] = (shares[t] ?? 0) + (lot.type === 'buy' ? +lot.shares : -+lot.shares)
    }

    // Only include open positions with a known live price
    const positions = Object.entries(shares)
      .filter(([t, s]) => s > 0 && prices[t] != null)
      .map(([ticker, s]) => ({ ticker, value: s * prices[ticker] }))
      .sort((a, b) => b.value - a.value) // largest first

    if (!positions.length) return []

    const total = positions.reduce((sum, p) => sum + p.value, 0)

    let angle = 0
    return positions.map((p, i) => {
      const sweep = (p.value / total) * 360
      const start = angle
      angle += sweep
      return {
        ticker: p.ticker,
        value:  p.value,
        total,
        pct:      (p.value / total) * 100,
        startDeg: start,
        endDeg:   angle,
        color:    PALETTE[i % PALETTE.length],
      }
    })
  }, [lots, prices])
}

/**
 * Given a mouse event on the SVG, return the ticker of the slice under the cursor.
 * Uses angle + radial distance from center — completely gap-agnostic so hover
 * never flickers when crossing the visual gaps between slices.
 */
function sliceAtPoint(e, svgRef, slices, cx, cy, outerR, innerR) {
  const svg = svgRef.current
  if (!svg) return null
  const rect  = svg.getBoundingClientRect()
  const x     = (e.clientX - rect.left) * (180 / rect.width)  - cx
  const y     = (e.clientY - rect.top)  * (180 / rect.height) - cy
  const dist  = Math.sqrt(x * x + y * y)
  if (dist < innerR || dist > outerR) return null   // outside the ring

  // Angle in degrees: 0 = top (12 o'clock), increases clockwise
  let angle = Math.atan2(y, x) * (180 / Math.PI) + 90
  if (angle < 0) angle += 360

  return slices.find(s => angle >= s.startDeg && angle < s.endDeg)?.ticker ?? null
}

export default function AllocationChart({ lots, prices }) {
  const { censored } = useCensor()
  const { fmt }      = useCurrency()
  const [hovered, setHovered] = useState(null)
  const svgRef                = useRef(null)
  const slices                = useAllocations(lots, prices)
  const hoveredSlice          = hovered ? slices.find(s => s.ticker === hovered) ?? null : null

  if (!slices.length) return null

  const cx = 90, cy = 90, outerR = 84, innerR = 52
  const single = slices.length === 1

  function handleSvgMove(e) {
    setHovered(sliceAtPoint(e, svgRef, slices, cx, cy, outerR, innerR))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-text">Allocation</h3>
        <span className="text-xs text-text-muted">{slices.length} position{slices.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">

        {/* ── Donut ── */}
        <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
          <svg
            ref={svgRef}
            width="180" height="180" viewBox="0 0 180 180"
            style={{ overflow: 'visible', cursor: 'default' }}
            onMouseMove={handleSvgMove}
            onMouseLeave={() => setHovered(null)}
          >
            {single ? (
              <>
                <circle cx={cx} cy={cy} r={outerR} fill={slices[0].color} />
                <circle cx={cx} cy={cy} r={innerR} fill="var(--bg-card)" />
              </>
            ) : (
              slices.map(s => {
                const d = slicePath(cx, cy, outerR, innerR, s.startDeg, s.endDeg)
                if (!d) return null
                return (
                  <path
                    key={s.ticker}
                    d={d}
                    fill={s.color}
                    opacity={hovered === null || hovered === s.ticker ? 1 : 0.25}
                    style={{
                      filter:     hovered === s.ticker ? 'brightness(1.15)' : 'none',
                      transition: 'opacity 120ms, filter 120ms',
                    }}
                  />
                )
              })
            )}
          </svg>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            {hoveredSlice ? (
              <>
                <span className="text-xs font-semibold font-mono text-text">{hoveredSlice.ticker}</span>
                <span className="text-lg font-bold text-text leading-tight">
                  {hoveredSlice.pct.toFixed(1)}%
                </span>
                <span className="text-xs text-text-muted mt-0.5">
                  {censored ? '••••••' : fmt(hoveredSlice.value)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-text-muted">Total</span>
                <span className="text-sm font-semibold text-text">
                  {censored ? '••••••' : fmt(slices[0].total)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-col gap-1 flex-1 w-full min-w-0">
          {slices.map(s => (
            <div
              key={s.ticker}
              className={[
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors duration-100 cursor-default',
                hovered === s.ticker ? 'bg-bg-elevated' : 'hover:bg-bg-elevated/50',
              ].join(' ')}
              onMouseEnter={() => setHovered(s.ticker)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Color swatch */}
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />

              {/* Ticker */}
              <span className="text-xs font-mono font-semibold text-text w-12 shrink-0">{s.ticker}</span>

              {/* Bar */}
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${s.pct}%`,
                    background: s.color,
                    opacity: 0.75,
                    transition: 'width 400ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
              </div>

              {/* Pct */}
              <span className="text-xs tabular-nums text-text-secondary w-9 text-right shrink-0">
                {s.pct.toFixed(1)}%
              </span>

              {/* Value */}
              <span className="text-xs tabular-nums text-text-muted text-right shrink-0 w-20">
                {censored ? '••••••' : fmt(s.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
