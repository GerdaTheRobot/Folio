const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Fetches a Yahoo Finance crumb + cookie pair.
 * Yahoo Finance requires these for authenticated chart requests from server IPs.
 */
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

async function fetchChart(pathStr, params, cookie, crumb) {
  if (crumb && crumb !== 'null') params.set('crumb', crumb)
  const qs  = params.toString()

  // Try query1 first, fall back to query2
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    const url = `https://${host}/${pathStr}${qs ? '?' + qs : ''}`
    const res = await fetch(url, {
      headers: {
        'User-Agent':      UA,
        'Accept':          'application/json, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         'https://finance.yahoo.com/',
        'Origin':          'https://finance.yahoo.com',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    })
    if (res.ok) return res
    // Only try fallback on 4xx from query1
    if (res.status < 500) continue
    break
  }

  // Last resort: v7 CSV download (doesn't require crumb)
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const segments = req.query.path
  const pathStr  = Array.isArray(segments) ? segments.join('/') : (segments ?? '')

  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(req.query)) {
    if (key !== 'path') params.append(key, val)
  }

  try {
    const { cookie, crumb } = await getYahooCrumb()
    const upstream = await fetchChart(pathStr, params, cookie, crumb)

    if (!upstream) {
      res.status(502).json({ error: 'Yahoo Finance unavailable — all endpoints failed' })
      return
    }

    // Forward status + body
    const text = await upstream.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack })
  }
}
