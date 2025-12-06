/**
 * Backfill NHK articles from Railway MySQL to Firebase Firestore
 *
 * Usage: node scripts/backfill-nhk-from-mysql.js
 */

const mysql = require('mysql2/promise')
const admin = require('firebase-admin')
const crypto = require('crypto')

// MySQL connection (Railway)
const MYSQL_URL =
  'mysql://root:MKCixlltjXujzRRSdwqtVQqLfLOHFOMk@shortline.proxy.rlwy.net:46705/railway'

// Initialize Firebase
const serviceAccount = require('../moshimoshi-service-account.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})
const db = admin.firestore()

/**
 * Generate consistent ID from news_id
 */
function generateArticleId(newsId) {
  return crypto.createHash('md5').update(newsId).digest('hex')
}

/**
 * Strip HTML tags but preserve text
 */
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1') // Keep kanji, remove furigana
    .replace(/<[^>]+>/g, '') // Remove all other HTML tags
    .replace(/\n+/g, '\n') // Normalize newlines
    .trim()
}

/**
 * Map MySQL record to Firebase schema
 */
function mapToFirebaseSchema(record) {
  const id = generateArticleId(record.news_id)

  return {
    id,
    // Core content
    title: record.title || '',
    titleWithFurigana: record.title_with_ruby || '',
    content: record.body_without_html || stripHtml(record.body),
    contentWithFurigana: record.body || '',
    summary: record.outline || '',
    summaryWithFurigana: record.outline_with_ruby || '',

    // URLs
    url: record.url || '',
    imageUrl: record.image_url || '',
    nhkAudioUrl: record.m3u8url || '', // NHK original audio (Priority 1)

    // Metadata
    source: 'NHK Easy',
    category: 'news',
    difficulty: 'N5',
    publishDate: record.published_at_utc ? new Date(record.published_at_utc) : new Date(),

    // Audio status - no TTS needed since we have NHK audio
    audioStatus: record.m3u8url ? 'generated' : 'pending',

    // Tracking
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    mysqlId: record.id, // Reference to MySQL record
    newsId: record.news_id, // Original NHK news ID

    // Metadata object for frontend
    metadata: {
      wordCount: (record.body_without_html || '').length,
      readingTime: Math.ceil((record.body_without_html || '').length / 400), // ~400 chars/min for Japanese
      hasFurigana: true,
    },
  }
}

/**
 * Main backfill function
 */
async function backfill() {
  console.log('=== NHK MySQL → Firebase Backfill ===\n')

  // Connect to MySQL
  console.log('Connecting to MySQL...')
  const connection = await mysql.createConnection(MYSQL_URL)
  console.log('Connected!\n')

  // Get all articles from MySQL
  console.log('Fetching articles from MySQL...')
  const [articles] = await connection.query('SELECT * FROM news ORDER BY published_at_utc DESC')
  console.log(`Found ${articles.length} articles in MySQL\n`)

  // Get existing articles in Firebase
  console.log('Checking existing articles in Firebase...')
  const existingSnapshot = await db.collection('news_articles').get()
  const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id))
  console.log(`Found ${existingIds.size} existing articles in Firebase\n`)

  // Process articles
  let added = 0
  let skipped = 0
  let errors = 0

  const batch = db.batch()
  const BATCH_SIZE = 500 // Firestore batch limit
  let batchCount = 0

  for (const article of articles) {
    const mapped = mapToFirebaseSchema(article)

    if (existingIds.has(mapped.id)) {
      skipped++
      continue
    }

    try {
      const docRef = db.collection('news_articles').doc(mapped.id)
      batch.set(docRef, mapped)
      batchCount++
      added++

      console.log(`+ Added: ${mapped.title.substring(0, 40)}...`)

      // Commit batch if reaching limit
      if (batchCount >= BATCH_SIZE) {
        console.log(`\nCommitting batch of ${batchCount} articles...`)
        await batch.commit()
        batchCount = 0
      }
    } catch (error) {
      console.error(`! Error processing ${article.news_id}:`, error.message)
      errors++
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    console.log(`\nCommitting final batch of ${batchCount} articles...`)
    await batch.commit()
  }

  // Close MySQL connection
  await connection.end()

  // Summary
  console.log('\n=== Backfill Complete ===')
  console.log(`Added:   ${added}`)
  console.log(`Skipped: ${skipped} (already exist)`)
  console.log(`Errors:  ${errors}`)
  console.log(`Total in Firebase: ${existingIds.size + added}`)
}

// Run
backfill()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\nFatal error:', error)
    process.exit(1)
  })
