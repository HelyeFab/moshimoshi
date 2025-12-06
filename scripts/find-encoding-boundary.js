const mysql = require('mysql2/promise')

;(async () => {
  const c = await mysql.createConnection({
    uri: 'mysql://root:MKCixlltjXujzRRSdwqtVQqLfLOHFOMk@shortline.proxy.rlwy.net:46705/railway',
    charset: 'utf8mb4',
  })

  const [r] = await c.query(
    'SELECT news_id, published_at_utc, SUBSTRING(body_without_html, 1, 50) as body_start FROM news ORDER BY published_at_utc DESC'
  )

  let lastGood = null
  let goodCount = 0
  let badCount = 0

  for (const a of r) {
    // Check for garbled characters (ã, ä, å are common in mojibake)
    const isGood = !/[äãåç]/.test(a.body_start) && /[\u3040-\u30ff\u4e00-\u9fff]/.test(a.body_start)

    if (isGood) {
      goodCount++
      if (!lastGood) lastGood = a.published_at_utc
    } else {
      badCount++
      if (lastGood) {
        console.log('=== Encoding boundary found ===')
        console.log('Last corrupted:', a.published_at_utc, '-', a.news_id)
        console.log('First good:', lastGood)
        console.log('\nGood articles:', goodCount)
        console.log('Corrupted articles:', badCount)
        break
      }
    }
  }

  if (!lastGood) {
    console.log('All articles corrupted or all good')
    console.log('Good:', goodCount, 'Bad:', badCount)
  }

  await c.end()
})().catch(e => console.error(e))
