import { useCurrency, CURRENCIES } from '../../context/CurrencyContext'

export default function SettingsModal() {
  const { currency, setCurrency, rate } = useCurrency()

  return (
    <div className="flex flex-col gap-6">
      {/* Currency */}
      <div>
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Display currency</p>
        <div className="flex flex-col gap-2">
          {Object.values(CURRENCIES).map(c => (
            <button
              key={c.code}
              onClick={() => setCurrency(c.code)}
              className={[
                'flex items-center justify-between px-4 py-3 rounded-xl border text-left',
                'transition-colors duration-150',
                currency === c.code
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-border hover:bg-bg-elevated',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl leading-none">{c.flag}</span>
                <div>
                  <p className={`text-sm font-semibold ${currency === c.code ? 'text-accent' : 'text-text'}`}>
                    {c.symbol} {c.code}
                  </p>
                  <p className="text-xs text-text-muted">{c.label}</p>
                </div>
              </div>
              {currency === c.code && (
                <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
              )}
            </button>
          ))}
        </div>
        {currency !== 'USD' && (
          <p className="text-xs text-text-muted mt-2 px-1">
            Live rate: 1 USD = {rate.toFixed(4)} {currency}
            <span className="ml-1 opacity-60">(refreshes hourly)</span>
          </p>
        )}
      </div>
    </div>
  )
}
