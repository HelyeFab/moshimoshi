/**
 * Backfill Word Explanations for Existing Books
 *
 * Generates comprehensive word explanations for published books
 * that don't already have them in the book_word_explanations collection.
 *
 * Usage:
 *   npm run backfill:books -- --dry-run        # Preview what will be done
 *   npm run backfill:books                     # Actually generate word explanations
 *   npm run backfill:books -- --book book_123  # Backfill specific book only
 */

import * as admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'
import Module from 'module'

// Ensure @/* path aliases resolve when running compiled JS from functions/
const nodeModule = Module as any
const originalResolve = nodeModule._resolveFilename
nodeModule._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    const repoRoot = path.resolve(process.cwd(), '..')
    const compiledPath = path.join(repoRoot, 'functions', 'lib', 'src', request.slice(2))
    const sourcePath = path.join(repoRoot, 'src', request.slice(2))
    const target = fs.existsSync(`${compiledPath}.js`) ? compiledPath : sourcePath
    return originalResolve.call(this, target, parent, isMain, options)
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH
  if (serviceAccountPath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(serviceAccountPath)
    process.env.FIREBASE_ADMIN_PROJECT_ID =
      process.env.FIREBASE_ADMIN_PROJECT_ID || serviceAccount.project_id
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL || serviceAccount.client_email
    process.env.FIREBASE_ADMIN_PRIVATE_KEY =
      process.env.FIREBASE_ADMIN_PRIVATE_KEY || serviceAccount.private_key

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require('../../../moshimoshi-service-account.json')
      process.env.FIREBASE_ADMIN_PROJECT_ID =
        process.env.FIREBASE_ADMIN_PROJECT_ID || serviceAccount.project_id
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL =
        process.env.FIREBASE_ADMIN_CLIENT_EMAIL || serviceAccount.client_email
      process.env.FIREBASE_ADMIN_PRIVATE_KEY =
        process.env.FIREBASE_ADMIN_PRIVATE_KEY || serviceAccount.private_key

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    } catch (error) {
      const projectId =
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT
      console.warn('[BackfillBooks] No service account file found, falling back to application default credentials')
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        ...(projectId ? { projectId } : {}),
      })
    }
  }
}

const db = admin.firestore()

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const bookArgIndex = args.indexOf('--book')
const specificBookId = bookArgIndex !== -1 ? args[bookArgIndex + 1] : null
const minCountArgIndex = args.indexOf('--min-count')
const minCount = minCountArgIndex !== -1 ? parseInt(args[minCountArgIndex + 1], 10) : null

interface BookData {
  title?: string
  content?: string
  jlptLevel?: string
  status?: string
  createdAt?: admin.firestore.Timestamp
  publishedAt?: admin.firestore.Timestamp
}

interface BackfillResult {
  skipped?: boolean
  dryRun?: boolean
  success?: boolean
  failed?: boolean
  bookId: string
  title?: string
  textLength?: number
  total?: number
  generated?: number
  cached?: number
  error?: string
  reason?: string
}

async function checkWordExplanationsExist(bookId: string): Promise<boolean> {
  const wordDoc = await db.collection('book_word_explanations').doc(bookId).get()
  if (!wordDoc.exists) return false
  if (minCount === null || Number.isNaN(minCount)) return true

  const wordCount = wordDoc.data()?.wordCount
  if (typeof wordCount !== 'number') return false

  return wordCount >= minCount
}

function getBookSortDate(book: BookData): number {
  const publishedAt = book.publishedAt?.toDate?.().getTime()
  if (publishedAt) return publishedAt
  const createdAt = book.createdAt?.toDate?.().getTime()
  return createdAt || 0
}

async function generateWordExplanationsForBook(
  bookId: string,
  book: BookData
): Promise<BackfillResult> {
  const title = book.title || bookId

  console.log(`\n📚 Book ${bookId}: ${title}`)

  // Check if already exists
  const alreadyExists = await checkWordExplanationsExist(bookId)
  if (alreadyExists) {
    console.log('  ✓ Word explanations already exist - SKIPPING')
    return { skipped: true, bookId, title }
  }

  const content = book.content || ''
  if (!content || content.trim().length === 0) {
    console.log('  ⚠️  No content found in book - SKIPPING')
    return { skipped: true, bookId, title, reason: 'no content' }
  }

  const textPreview = content.substring(0, 100) + (content.length > 100 ? '...' : '')
  console.log(`  Text extracted: ${textPreview}`)
  console.log(`  Total text length: ${content.length} characters`)
  console.log(`  JLPT Level: ${book.jlptLevel || 'N5'}`)

  if (isDryRun) {
    console.log('  [DRY RUN] Would generate word explanations')
    return { dryRun: true, bookId, title, textLength: content.length }
  }

  try {
    console.log('  🔄 Generating word explanations...')
    const { precomputeWordExplanations } = await import('../../../src/lib/ai/precompute/wordPrecompute')
    const result = await precomputeWordExplanations({
      contentId: bookId,
      contentType: 'book',
      text: content,
      limit: 1000,
      jlptLevel: (book.jlptLevel || 'N5') as any,
    })

    console.log(`  ✅ SUCCESS! Generated ${result.total} word explanations`)
    console.log(`     - New: ${result.generated}`)
    console.log(`     - Cached: ${result.cached}`)

    return {
      success: true,
      bookId,
      title,
      total: result.total,
      generated: result.generated,
      cached: result.cached,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`  ❌ FAILED: ${errorMessage}`)
    return {
      failed: true,
      bookId,
      title,
      error: errorMessage,
    }
  }
}

async function backfillBookWordExplanations() {
  console.log('\n🚀 Book Word Explanations Backfill Script\n')
  console.log('Mode:', isDryRun ? '🔍 DRY RUN (preview only)' : '✍️  LIVE (will generate explanations)')

  if (specificBookId) {
    console.log(`Target: Book ${specificBookId} only\n`)
  } else {
    console.log('Target: All published books\n')
  }

  console.log('─'.repeat(60))

  const results = {
    total: 0,
    skipped: 0,
    dryRun: 0,
    success: 0,
    failed: 0,
    details: [] as BackfillResult[],
  }

  if (specificBookId) {
    const bookDoc = await db.collection('books').doc(specificBookId).get()

    if (!bookDoc.exists) {
      console.log(`\n❌ Book not found: ${specificBookId}`)
      process.exit(1)
    }

    const book = bookDoc.data() as BookData
    const result = await generateWordExplanationsForBook(bookDoc.id, book)
    results.details.push(result)
    results.total = 1
    if (result.skipped) results.skipped++
    else if (result.dryRun) results.dryRun++
    else if (result.success) results.success++
    else if (result.failed) results.failed++
  } else {
    const booksSnapshot = await db.collection('books').get()

    if (booksSnapshot.empty) {
      console.log('\n❌ No books found')
      process.exit(0)
    }

    const books = booksSnapshot.docs
      .map(doc => ({ id: doc.id, data: doc.data() as BookData }))
      .filter(({ data }) => data.status === 'published')
      .sort((a, b) => getBookSortDate(a.data) - getBookSortDate(b.data))

    if (books.length === 0) {
      console.log('\n❌ No published books found')
      process.exit(0)
    }

    console.log(`\nFound ${books.length} published book(s)\n`)

    for (const book of books) {
      results.total++
      const result = await generateWordExplanationsForBook(book.id, book.data)
      results.details.push(result)

      if (result.skipped) results.skipped++
      else if (result.dryRun) results.dryRun++
      else if (result.success) results.success++
      else if (result.failed) results.failed++

      // Small delay between books to avoid rate limits
      if (!isDryRun && !result.skipped) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log('\n📊 BACKFILL SUMMARY\n')
  console.log(`Total books processed: ${results.total}`)
  console.log(`  ✓ Skipped (already exists): ${results.skipped}`)

  if (isDryRun) {
    console.log(`  🔍 Would generate: ${results.dryRun}`)
  } else {
    console.log(`  ✅ Successfully generated: ${results.success}`)
    console.log(`  ❌ Failed: ${results.failed}`)
  }

  if (results.failed > 0) {
    console.log('\n❌ Failed books:')
    results.details
      .filter(r => r.failed)
      .forEach(r => {
        console.log(`  - ${r.bookId} (${r.title || 'Untitled'}): ${r.error}`)
      })
  }

  console.log('\n✨ Book word explanations backfill complete!')
}

backfillBookWordExplanations().catch(error => {
  console.error('\n❌ Backfill script failed:', error)
  process.exit(1)
})
