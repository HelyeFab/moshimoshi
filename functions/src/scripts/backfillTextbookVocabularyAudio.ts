/**
 * Backfill TTS Audio for Textbook Vocabulary
 *
 * Pre-generates TTS audio for all textbook vocabulary items and caches them
 * in Firebase Storage to eliminate on-demand synthesis delays.
 *
 * Usage:
 *   npm run backfill:vocab:dry                          # Preview what will be done
 *   npm run backfill:vocab                              # Backfill all textbooks
 *   npm run backfill:vocab -- --textbook genki-1        # Backfill specific textbook
 *   npm run backfill:vocab -- --batch-size 50           # Custom batch size
 *   npm run backfill:vocab -- --start-from 10           # Resume from batch 10
 */

import * as admin from 'firebase-admin'
import * as fs from 'fs'
import * as path from 'path'

// Parse command line arguments first
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const specificTextbookArg = args.find(arg => arg === '--textbook')
const specificTextbook = specificTextbookArg
  ? args[args.indexOf('--textbook') + 1]
  : null
const batchSizeArg = args.find(arg => arg === '--batch-size')
const batchSize = batchSizeArg ? parseInt(args[args.indexOf('--batch-size') + 1]) : 100
const startFromArg = args.find(arg => arg === '--start-from')
const startFromBatch = startFromArg ? parseInt(args[args.indexOf('--start-from') + 1]) : 0

// Initialize Firebase Admin (only if not dry run)
if (!isDryRun) {
  if (!admin.apps.length) {
    try {
      const serviceAccountPath = path.join(__dirname, '../../../../../moshimoshi-service-account.json')
      const serviceAccount = require(serviceAccountPath)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      console.log('✅ Firebase Admin initialized successfully')
    } catch (error) {
      console.error(
        '⚠️  Warning: Could not initialize Firebase Admin. Run with --dry-run to preview without Firebase.'
      )
      console.error(error)
    }
  }
}

interface VocabularyItem {
  id: string
  japanese: string
  reading: string
  meaning: string
  jlptLevel?: string
  partOfSpeech?: string[]
  examples?: Array<{
    japanese?: string
    reading?: string
    english?: string
  }>
  tags?: string[]
  lesson?: number
  chapter?: number
  textbook?: string
}

interface TextbookInfo {
  title: string
  cardCount: number
}

interface BackfillResult {
  textbook: string
  totalItems: number
  uniqueTexts: number
  batches: number
  success: number
  cached: number
  failed: number
  skipped?: boolean
  dryRun?: boolean
  error?: string
}

interface BatchSynthesisResponse {
  success: boolean
  data?: {
    results: Array<{
      id: string
      text: string
      audioUrl?: string
      cached?: boolean
      error?: string
    }>
    stats: {
      total: number
      successful: number
      failed: number
      cached: number
    }
  }
  error?: {
    code: string
    message: string
  }
}

const TEXTBOOKS_PATH = path.join(__dirname, '../../../../../src/data/textbooks')
const TTS_API_URL = 'http://localhost:3000/api/tts/batch'
const DEFAULT_VOICE = '23' // VOICEVOX default
const DEFAULT_SPEED = 0.85

/**
 * Load textbook index to get list of available textbooks
 */
function loadTextbookIndex(): Record<string, TextbookInfo> {
  const indexPath = path.join(TEXTBOOKS_PATH, 'index.json')
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

  return {
    ...indexData.textbooks,
    ...indexData.vocabularySources,
  }
}

/**
 * Load vocabulary data for a specific textbook
 */
function loadTextbookVocabulary(textbookId: string): VocabularyItem[] {
  const vocabPath = path.join(TEXTBOOKS_PATH, textbookId, 'all.json')

  if (!fs.existsSync(vocabPath)) {
    throw new Error(`Vocabulary file not found for textbook: ${textbookId}`)
  }

  return JSON.parse(fs.readFileSync(vocabPath, 'utf-8'))
}

/**
 * Extract unique texts that need TTS synthesis from vocabulary item
 */
function extractTextsToSynthesize(item: VocabularyItem): Set<string> {
  const texts = new Set<string>()

  // Always include japanese text
  if (item.japanese && item.japanese.trim().length > 0) {
    texts.add(item.japanese.trim())
  }

  // Include reading if different from japanese
  if (
    item.reading &&
    item.reading.trim().length > 0 &&
    item.reading.trim() !== item.japanese.trim()
  ) {
    texts.add(item.reading.trim())
  }

  // Include example sentences
  if (item.examples && Array.isArray(item.examples)) {
    item.examples.forEach(example => {
      if (
        example.japanese &&
        example.japanese.trim().length > 0 &&
        // Filter out trivial examples (like "1", "2", single characters)
        example.japanese.trim().length > 1
      ) {
        texts.add(example.japanese.trim())
      }
    })
  }

  return texts
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Call TTS batch API to synthesize audio
 */
async function batchSynthesizeTexts(
  texts: string[],
  batchIndex: number
): Promise<BatchSynthesisResponse> {
  const items = texts.map((text, idx) => ({
    id: `batch-${batchIndex}-${idx}`,
    text,
    options: {
      voice: DEFAULT_VOICE,
      speed: DEFAULT_SPEED,
    },
  }))

  try {
    const response = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        sequential: true, // Process sequentially to avoid overwhelming the API
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    return data as BatchSynthesisResponse
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'API_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}

/**
 * Backfill audio for a single textbook
 */
async function backfillTextbookAudio(
  textbookId: string,
  textbookInfo: TextbookInfo
): Promise<BackfillResult> {
  console.log(`\n📚 ${textbookInfo.title} (${textbookId})`)
  console.log(`   Total vocabulary items: ${textbookInfo.cardCount}`)

  const result: BackfillResult = {
    textbook: textbookId,
    totalItems: 0,
    uniqueTexts: 0,
    batches: 0,
    success: 0,
    cached: 0,
    failed: 0,
  }

  try {
    // Load vocabulary
    const vocabulary = loadTextbookVocabulary(textbookId)
    result.totalItems = vocabulary.length

    // Extract all unique texts
    const allTexts = new Set<string>()
    vocabulary.forEach(item => {
      const texts = extractTextsToSynthesize(item)
      texts.forEach(text => allTexts.add(text))
    })

    result.uniqueTexts = allTexts.size
    console.log(`   Unique texts to synthesize: ${result.uniqueTexts}`)

    if (result.uniqueTexts === 0) {
      console.log('   ⚠️  No texts to synthesize - SKIPPING')
      result.skipped = true
      return result
    }

    if (isDryRun) {
      const estimatedBatches = Math.ceil(result.uniqueTexts / batchSize)
      const estimatedMinutes = Math.ceil((estimatedBatches * 2) / 60) // 2s per batch
      console.log(`   [DRY RUN] Would process ${estimatedBatches} batches`)
      console.log(`   [DRY RUN] Estimated time: ~${estimatedMinutes} minutes`)
      result.dryRun = true
      return result
    }

    // Split into batches
    const textsArray = Array.from(allTexts)
    const batches = chunkArray(textsArray, batchSize)
    result.batches = batches.length

    console.log(`   Processing ${result.batches} batches (batch size: ${batchSize})`)

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      // Skip batches before start-from index
      if (i < startFromBatch) {
        console.log(`   ⏭️  Skipping batch ${i + 1}/${batches.length} (start-from: ${startFromBatch})`)
        continue
      }

      const batch = batches[i]
      const batchNum = i + 1

      console.log(`   🔄 Processing batch ${batchNum}/${batches.length} (${batch.length} texts)...`)

      const batchResult = await batchSynthesizeTexts(batch, i)

      if (batchResult.success && batchResult.data) {
        const stats = batchResult.data.stats
        result.success += stats.successful
        result.cached += stats.cached
        result.failed += stats.failed

        const newlySynthesized = stats.successful - stats.cached
        console.log(
          `      ✅ Success: ${stats.successful} (${newlySynthesized} new, ${stats.cached} cached)`
        )

        if (stats.failed > 0) {
          console.log(`      ⚠️  Failed: ${stats.failed}`)
        }
      } else {
        result.failed += batch.length
        console.log(`      ❌ Batch failed: ${batchResult.error?.message}`)
      }

      // Delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await sleep(2000) // 2 seconds
      }
    }

    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
    console.error(`   ❌ ERROR: ${result.error}`)
    return result
  }
}

/**
 * Main backfill function
 */
async function backfillAllTextbooks() {
  console.log('\n🚀 Textbook Vocabulary Audio Backfill Script\n')
  console.log('Mode:', isDryRun ? '🔍 DRY RUN (preview only)' : '✍️  LIVE (will generate audio)')
  console.log(`Batch size: ${batchSize}`)

  if (startFromBatch > 0) {
    console.log(`Resume from batch: ${startFromBatch}`)
  }

  if (specificTextbook) {
    console.log(`Target: ${specificTextbook} only\n`)
  } else {
    console.log('Target: All textbooks\n')
  }

  console.log('─'.repeat(70))

  // Load textbook index
  const textbooks = loadTextbookIndex()
  const textbookIds = specificTextbook
    ? [specificTextbook]
    : Object.keys(textbooks).sort((a, b) => {
        // Sort by card count (smallest first for testing)
        return textbooks[a].cardCount - textbooks[b].cardCount
      })

  if (textbookIds.length === 0) {
    console.log('\n❌ No textbooks found')
    process.exit(0)
  }

  console.log(`\nFound ${textbookIds.length} textbook(s) to process\n`)

  const results: BackfillResult[] = []
  let totalTexts = 0
  let totalSuccess = 0
  let totalCached = 0
  let totalFailed = 0

  // Process each textbook
  for (const textbookId of textbookIds) {
    const textbookInfo = textbooks[textbookId]

    if (!textbookInfo) {
      console.log(`\n⚠️  Textbook ${textbookId} not found in index - SKIPPING`)
      continue
    }

    const result = await backfillTextbookAudio(textbookId, textbookInfo)
    results.push(result)

    if (!result.skipped && !result.dryRun) {
      totalTexts += result.uniqueTexts
      totalSuccess += result.success
      totalCached += result.cached
      totalFailed += result.failed
    }

    // Small delay between textbooks
    if (!isDryRun && !result.skipped && textbookIds.indexOf(textbookId) < textbookIds.length - 1) {
      await sleep(1000)
    }
  }

  // Print summary
  console.log('\n' + '─'.repeat(70))
  console.log('\n📊 BACKFILL SUMMARY\n')
  console.log(`Total textbooks processed: ${results.length}`)
  console.log(`  ✓ Skipped: ${results.filter(r => r.skipped).length}`)

  if (isDryRun) {
    const totalTextsPreview = results.reduce((sum, r) => sum + r.uniqueTexts, 0)
    console.log(`\n  🔍 Would synthesize ${totalTextsPreview} unique texts`)

    results
      .filter(r => !r.skipped)
      .forEach(r => {
        console.log(`     - ${r.textbook}: ${r.uniqueTexts} texts`)
      })
  } else {
    const newlySynthesized = totalSuccess - totalCached
    console.log(`\n  📝 Total unique texts: ${totalTexts}`)
    console.log(`  ✅ Successfully synthesized: ${totalSuccess}`)
    console.log(`     - New: ${newlySynthesized}`)
    console.log(`     - Cached: ${totalCached}`)
    console.log(`  ❌ Failed: ${totalFailed}`)
  }

  if (results.some(r => r.error)) {
    console.log('\n❌ Failed textbooks:')
    results
      .filter(r => r.error)
      .forEach(r => {
        console.log(`  - ${r.textbook}: ${r.error}`)
      })
  }

  if (isDryRun) {
    console.log('\n💡 To actually generate audio, run without --dry-run flag:')
    console.log('   npm run backfill:vocab')
  } else if (totalSuccess > 0) {
    console.log('\n✨ Audio successfully backfilled!')
    console.log('\nYou can verify by:')
    console.log('  - Checking Firestore tts_cache collection')
    console.log('  - Checking Firebase Storage tts/ folder')
    console.log('  - Testing audio playback in Browse mode')
  }

  console.log('\n')
  process.exit(0)
}

// Run the backfill
backfillAllTextbooks().catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
