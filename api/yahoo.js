const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function getYahooCrumb() {
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    })
    const rawCookie = cookieRes.headers.get('set-cookie') ?? ''
    const cookie = rawCookie.split(',').map(c => c.trim().split(';')[0]).filter(Boolean).join('; ')

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Accept': 'text/plain, */*', 'Cookie': cookie },
    })
    const crumb = crumbRes.ok ? (await crumbRes.text()).trim() : ''
    return { cookie, crumb }
  } catch {
    return { cookie: '', crumb: '' }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const { ticker, interval, range } = req.query
  if (!ticker) { res.status(400).json({ error: 'ticker required' }); return }

  try {
    const { cookie, crumb } = await getYahooCrumb()

    const params = new URLSearchParams({ interval, range })
    if (crumb && crumb !== 'null') params.set('crumb', crumb)

    const browserHeaders = {
      'User-Agent':      UA,
      'Accept':          'application/json, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer':         'https://finance.yahoo.com/',
      'Origin':          'https://finance.yahoo.com',
      ...(cookie ? { 'Cookie': cookie } : {}),
    }

    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?${params}`
      const upstream = await fetch(url, { headers: browserHeaders })
      if (upstream.ok) {
        const data = await upstream.json()
        res.status(200).json(data)
        return
      }
    }

    res.status(502).json({ error: 'Yahoo Finance unavailable' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
