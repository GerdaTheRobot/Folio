const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Fetches a Yahoo Finance crumb + cookie pair.
 * Yahoo Finance requires these for authenticated chart requests.
 */
async function getYahooCrumb() {
  // Step 1: hit the consent/cookie endpoint to get a session cookie
  const cookieRes = await fetch('https://fc.yahoo.com', {
    redirect: 'follow',
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  })
  const rawCookie = cookieRes.headers.get('set-cookie') ?? ''
  // Grab just the first key=value from the cookie string
  const cookie = rawCookie.split(',').map(c => c.trim().split(';')[0]).filter(Boolean).join('; ')

  // Step 2: fetch the crumb using that cookie
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': UA,
      'Accept':     'text/plain, */*',
      'Cookie':     cookie,
    },
  })
  const crumb = crumbRes.ok ? (await crumbRes.text()).trim() : ''

  return { cookie, crumb }
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
    if (crumb && crumb !== 'null') params.set('crumb', crumb)

    const qs        = params.toString()
    const targetUrl = `https://query1.finance.yahoo.com/${pathStr}${qs ? '?' + qs : ''}`

    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent':      UA,
        'Accept':          'application/json, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer':         'https://finance.yahoo.com/',
        'Cookie':          cookie,
        'Origin':          'https://finance.yahoo.com',
      },
    })

    if (!upstream.ok) {
      // Fallback: retry with query2 instead of query1
      const fallbackUrl = targetUrl.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com')
      const fallback = await fetch(fallbackUrl, {
        headers: {
          'User-Agent':      UA,
          'Accept':          'application/json, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer':         'https://finance.yahoo.com/',
          'Cookie':          cookie,
        },
      })
      const data = await fallback.json()
      res.status(fallback.status).json(data)
      return
    }

    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
