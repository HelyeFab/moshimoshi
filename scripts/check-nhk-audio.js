const mysql = require('mysql2/promise')
const https = require('https')

async function checkUrl(url) {
  return new Promise(resolve => {
    const req = https.get(url, { method: 'HEAD', timeout: 5000 }, res => {
      resolve(res.statusCode)
    })
    req.on('error', () => resolve(0))
    req.on('timeout', () => {
      req.destroy()
      resolve(0)
    })
  })
}

;(async () => {
  const c = await mysql.createConnection(
    'mysql://root:MKCixlltjXujzRRSdwqtVQqLfLOHFOMk@shortline.proxy.rlwy.net:46705/railway'
  )
  const [articles] = await c.query(
    'SELECT news_id, m3u8url, published_at_utc FROM news WHERE m3u8url IS NOT NULL ORDER BY published_at_utc DESC LIMIT 20'
  )

  console.log('Checking latest 20 NHK audio URLs...\n')
  let working = 0,
    dead = 0

  for (const a of articles) {
    const status = await checkUrl(a.m3u8url)
    const date = new Date(a.published_at_utc).toISOString().split('T')[0]
    const ok = status === 200
    console.log(ok ? '✓' : '✗', date, a.news_id, status || 'timeout')
    if (ok) working++
    else dead++
  }

  console.log('\nWorking:', working, '| Dead:', dead)
  await c.end()
})()
