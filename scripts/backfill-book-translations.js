/**
 * Backfill translations for existing books that don't have them
 * Usage: node scripts/backfill-book-translations.js
 *
 * Options:
 *   --dry-run    Show what would be done without making changes
 *   --limit=N    Process at most N books (default: all)
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const admin = require('firebase-admin')
const OpenAI = require('openai')

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity

// Initialize Firebase
const serviceAccount = require('../moshimoshi-service-account.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
})

async function translateContent(content) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          "You are a Japanese-English translator. Translate the following Japanese narrative to natural, fluent English. Preserve the story's flow, emotion, and paragraph structure. Return ONLY the English translation, nothing else.",
      },
      { role: 'user', content },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  })
  return response.choices[0]?.message?.content?.trim() || ''
}

async function backfillTranslations() {
  console.log('🚀 Book Translation Backfill\n')
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`)
  console.log(`   Limit: ${limit === Infinity ? 'none' : limit}\n`)

  // Get all published books without translations
  const booksSnapshot = await db.collection('books').where('status', '==', 'published').get()

  const booksToUpdate = booksSnapshot.docs.filter((doc) => {
    const data = doc.data()
    return data.content && !data.translation
  })

  const booksToProcess = booksToUpdate.slice(0, limit)

  console.log(`📚 Found ${booksToUpdate.length} books needing translation`)
  console.log(`📖 Processing ${booksToProcess.length} books\n`)

  if (booksToProcess.length === 0) {
    console.log('✨ No books need translation backfill!')
    return
  }

  let success = 0
  let failed = 0

  for (const doc of booksToProcess) {
    const book = doc.data()
    const title = book.titleJa || book.title || 'Unknown'
    console.log(`📖 ${title} (${doc.id})`)
    console.log(`   Content: ${book.content?.length || 0} chars`)

    if (dryRun) {
      console.log(`   ⏸️  Would translate (dry run)\n`)
      success++
      continue
    }

    try {
      const translation = await translateContent(book.content)

      if (translation) {
        await doc.ref.update({
          translation,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log(`   ✅ Done (${translation.length} chars)\n`)
        success++
      } else {
        console.log(`   ⚠️  Empty translation returned\n`)
        failed++
      }

      // Rate limiting - wait 1 second between API calls
      await new Promise((r) => setTimeout(r, 1000))
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`)
      failed++
    }
  }

  console.log('\n=== Backfill Complete ===')
  console.log(`Success: ${success}`)
  console.log(`Failed: ${failed}`)

  if (dryRun) {
    console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.')
  }
}

backfillTranslations().catch(console.error)
