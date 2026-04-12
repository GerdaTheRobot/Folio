export default async function handler(req, res) {
  const segments = req.query.path
  const pathStr  = Array.isArray(segments) ? segments.join('/') : (segments ?? '')

  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(req.query)) {
    if (key !== 'path') params.append(key, val)
  }

  const qs        = params.toString()
  const targetUrl = `https://query1.finance.yahoo.com/${pathStr}${qs ? '?' + qs : ''}`

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':     'application/json',
      },
    })
    const data = await upstream.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
