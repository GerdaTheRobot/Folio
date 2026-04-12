const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const log = {}

  try {
    // 1. Cookie fetch
    const t1 = Date.now()
    const cookieRes = await fetch('https://fc.yahoo.com', {
      redirect: 'follow',
      headers: { 'User-Agent': UA },
    })
    const rawCookie = cookieRes.headers.get('set-cookie') ?? ''
    const cookie = rawCookie.split(',').map(c => c.trim().split(';')[0]).filter(Boolean).join('; ')
    log.cookieStep = { status: cookieRes.status, cookieLength: cookie.length, ms: Date.now() - t1 }

    // 2. Crumb fetch
    const t2 = Date.now()
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': cookie },
    })
    const crumb = crumbRes.ok ? (await crumbRes.text()).trim() : 'FAILED'
    log.crumbStep = { status: crumbRes.status, crumb, ms: Date.now() - t2 }

    // 3. Actual chart request
    const t3 = Date.now()
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d&crumb=${encodeURIComponent(crumb)}`
    const chartRes = await fetch(chartUrl, {
      headers: {
        'User-Agent':      UA,
        'Accept':          'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         'https://finance.yahoo.com/',
        'Cookie':          cookie,
      },
    })
    const chartText = await chartRes.text()
    log.chartStep = {
      status: chartRes.status,
      ok: chartRes.ok,
      bodyPreview: chartText.slice(0, 300),
      ms: Date.now() - t3,
    }
  } catch (err) {
    log.error = err.message
  }

  res.status(200).json(log)
}
