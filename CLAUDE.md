# Folio — Stock Portfolio Tracker

## Project Overview
A polished personal stock portfolio tracker called **Folio**. Users log buy/sell lots, track live P&L, view price charts, and manage multiple portfolios. Built with React + Vite + Supabase + Tailwind v4.

---

## Tech Stack
| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite, Tailwind CSS v4 |
| Auth + DB | Supabase (Postgres + RLS + Auth) |
| Price data (live) | Finnhub REST `/quote` (current + prev close) + WebSocket (trades) |
| Price data (history) | Yahoo Finance (via Vite proxy `/yahoo-finance`) + Twelve Data (toggle) |
| Charts | lightweight-charts v5 (`createChart`, `AreaSeries`) |
| Routing | React Router v6 |

---

## Database Schema

### `portfolios`
```sql
id         uuid PK
user_id    uuid FK → auth.users
name       text  (default 'My Portfolio')
created_at timestamptz
```
RLS: all operations scoped to `auth.uid() = user_id`.

### `lots`
```sql
id           uuid PK
user_id      uuid FK → auth.users
portfolio_id uuid FK → portfolios (NOT NULL)
ticker       text
type         text  ('buy' | 'sell')
shares       numeric
price        numeric
fees         numeric
executed_at  timestamptz
notes        text nullable
```
RLS: scoped by `user_id`.

---

## Completed Features

1. **Auth** — Login / Register with Supabase email auth, protected routes.
2. **Lots CRUD** — Add, edit, delete buy/sell transactions. Cost basis calculated via average-cost method.
3. **Multiple Portfolios** — Create, rename, delete portfolios. Active portfolio persisted in `localStorage`. Switcher shown on Dashboard and Portfolio pages.
4. **Live Prices** — Finnhub WebSocket for real-time price updates; `/quote` for current price + `pc` (previous close).
5. **P&L Calculations** — Per-ticker: unrealized P&L, daily P&L, % gains. Portfolio totals: market value, realized P&L, unrealized P&L.
6. **All-time / Today toggle** — Dashboard and StockDetail show both all-time unrealized P&L and today's daily P&L with a pill toggle.
7. **Percentage badges** — Colored `±X.XX%` badge on P&L stat cards.
8. **Previously Owned** — Sold-out positions show in a collapsible "Previously Owned" section (Archive icon) on the Portfolio page with realized P&L and last sell date.
9. **Stock Detail Page** — `/stock/:ticker` shows live price, daily change, stat cards (Market Value, Unrealized P&L, Realized P&L, Avg Cost), full price history chart, lot history table, and "Add lot" modal pre-filled with the ticker.
10. **Ticker Search** — Debounced Finnhub symbol search in the Navbar (desktop only), navigates to `/stock/:ticker`.
11. **Price History Charts** — `PerformanceChart` component supports:
    - Portfolio value over time (cost basis line)
    - Per-ticker price history via Yahoo Finance (proxy) or Twelve Data
    - Ranges: 1D, 1W, 1M, 3M, 1Y, All
    - 1D intraday with 1m / 5m / 1h intervals; polling at 30s / 60s / 300s
    - Source toggle: Yahoo / Twelve Data
12. **Compare Mode** — Toggle on charts; click sets an anchor (dashed horizontal price line at reference price); moving cursor paints a green/red CSS overlay between anchor and cursor time; header shows delta and %.
13. **Censor Mode** — Eye/EyeOff button in Navbar hides all dollar amounts (shows `••••••`), percentages still visible. Persisted in `localStorage`.
14. **Dark / Light theme** — Smooth CSS variable transitions. Toggle in Navbar.

---

## Key Architecture Notes

### Context Providers (in order, outermost first)
```
ThemeProvider → CensorProvider → AuthProvider → PortfolioProvider → AppRoutes
```

### Important Hooks
- `useLots()` — reads `activeId` from `PortfolioContext`, fetches lots scoped to that portfolio, derives stats via `calcPortfolioStats()`, fetches live prices.
- `usePrices(tickers)` — Finnhub WebSocket + polling for current prices and previous closes (`prevCloses`).
- `usePortfolio()` — active portfolio state, switch/add/rename/delete.

### Yahoo Finance CORS
Dev server proxies `/yahoo-finance` → `https://query1.finance.yahoo.com`. Defined in `vite.config.js`. **Production deployment will need a real backend proxy.**

### lightweight-charts v5 Gotchas
- `chart.addSeries(AreaSeries, options)` can only be called **once** per chart — adding a second series crashes. Colored compare regions are implemented as a CSS `<div>` overlay using `chart.timeScale().timeToCoordinate()` for pixel positioning.
- `series.setMarkers()` was removed in v5 — do not use.
- `crosshairMarkerVisible` is not a valid series option in v5.
- Stale closures in `subscribeClick` / `subscribeCrosshairMove`: use refs synced via `useEffect` (e.g. `compareModeRef`, `anchorRef`, `is1DRef`).

### Form Validation
`LotForm` uses no `required` / `min` HTML attributes — all validation is done in the `handleSubmit` handler with a themed error banner. This prevents the browser's native validation tooltip.

---

## Remaining / Future Features

### High Priority
- [ ] **Watchlist** — Global (not per-portfolio) watchlist of tickers. Deferred; keep in mind when adding new views.
- [ ] **Settings / Customisable Views** — Per-page section visibility toggles. Deferred; all sections default to visible for now.

### Nice to Have
- [ ] Production-safe price history proxy (backend or serverless function) — current Yahoo proxy only works in Vite dev server.
- [ ] Multiple lots on the same day edge case handling in cost basis chart.
- [ ] Mobile ticker search (currently hidden on small screens).
- [ ] Account/settings page (currently a no-op button in the user dropdown).

---

## File Map (key files)
```
src/
  App.jsx                          — routes + provider tree
  context/
    ThemeContext.jsx
    CensorContext.jsx
    AuthContext.jsx
    PortfolioContext.jsx            — active portfolio, CRUD
  hooks/
    useLots.js                     — lots fetch + stats + prices
    usePrices.js                   — Finnhub live prices + prevCloses
  lib/
    supabase.js
    lots.js                        — CRUD + calcPortfolioStats()
    portfolios.js                  — portfolio CRUD
    finnhub.js                     — quote, search, WebSocket
    priceHistory.js                — Yahoo + Twelve Data fetch
  pages/
    Dashboard.jsx                  — overview + portfolio chart
    Portfolio.jsx                  — transaction history + previously owned
    StockDetail.jsx                — /stock/:ticker
    Login.jsx / Register.jsx
  components/
    layout/Navbar.jsx              — search, censor toggle, theme toggle, user menu
    portfolio/
      PerformanceChart.jsx         — chart with compare mode
      LotsTable.jsx                — sortable transaction table
      LotForm.jsx                  — add/edit lot modal form
      PortfolioSelector.jsx        — portfolio switcher dropdown
    ui/Modal.jsx
```
