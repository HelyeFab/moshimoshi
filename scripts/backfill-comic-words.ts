/**
 * Backfill Word Explanations for Existing Comic Episodes
 *
 * Usage:
 *   npx tsx scripts/backfill-comic-words.ts --dry-run      # Preview
 *   npx tsx scripts/backfill-comic-words.ts                # Execute
 *   npx tsx scripts/backfill-comic-words.ts --episode 13   # Specific episode
 */

// Load service account and set env vars BEFORE any imports
const serviceAccount = require('../moshimoshi-service-account.json')
process.env.FIREBASE_ADMIN_PROJECT_ID = serviceAccount.project_id
process.env.GOOGLE_CLOUD_PROJECT = serviceAccount.project_id

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { precomputeWordExplanations } from '../src/lib/ai/precompute/wordPrecompute'

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  })
}

const db = getFirestore()

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const specificEpisodeArg = args.find((arg, idx, arr) => arg === '--episode' && arr[idx + 1])
const specificEpisode = specificEpisodeArg ? parseInt(args[args.indexOf('--episode') + 1]) : null

interface ComicPanel {
  dialogues?: Array<{ textJa?: string }>
  narration?: { textJa?: string }
}

interface ComicData {
  title: string
  episodeNumber: number
  jlptLevel?: string
  panels?: ComicPanel[]
}

interface BackfillResult {
  skipped?: boolean
  dryRun?: boolean
  success?: boolean
  failed?: boolean
  episodeNumber: number
  textLength?: number
  total?: number
  generated?: number
  cached?: number
  error?: string
  reason?: string
}

function extractComicText(comicData: ComicData): string {
  if (!comicData.panels || !Array.isArray(comicData.panels)) {
    return ''
  }

  const text = comicData.panels
    .map(panel => {
      const dialogueText = panel.dialogues?.map(d => d.textJa || '').join(' ') || ''
      const narrationText = panel.narration?.textJa || ''
      return `${dialogueText} ${narrationText}`.trim()
    })
    .filter(text => text.length > 0)
    .join('\n')

  return text
}

async function checkWordExplanationsExist(episodeId: string): Promise<boolean> {
  const wordDoc = await db.collection('word_explanations').doc(episodeId).get()
  return wordDoc.exists
}

async function generateWordExplanationsForEpisode(
  comic: ComicData,
  episodeNumber: number
): Promise<BackfillResult> {
  const episodeId = `moshi-goes-to-japan-ep${String(episodeNumber).padStart(3, '0')}`

  console.log(`\n📝 Episode ${episodeNumber}: ${comic.title}`)

  // Check if already exists
  const alreadyExists = await checkWordExplanationsExist(episodeId)
  if (alreadyExists) {
    console.log('  ✓ Word explanations already exist - SKIPPING')
    return { skipped: true, episodeNumber }
  }

  // Extract text from comic
  const comicText = extractComicText(comic)
  if (!comicText || comicText.trim().length === 0) {
    console.log('  ⚠️  No text found in comic panels - SKIPPING')
    return { skipped: true, episodeNumber, reason: 'no text' }
  }

  const textPreview = comicText.substring(0, 100) + (comicText.length > 100 ? '...' : '')
  console.log(`  Text extracted: ${textPreview}`)
  console.log(`  Total text length: ${comicText.length} characters`)
  console.log(`  JLPT Level: ${comic.jlptLevel || 'N5'}`)

  if (isDryRun) {
    console.log('  [DRY RUN] Would generate word explanations')
    return { dryRun: true, episodeNumber, textLength: comicText.length }
  }

  // Generate word explanations
  try {
    console.log('  🔄 Generating word explanations...')

    const result = await precomputeWordExplanations({
      contentId: episodeId,
      contentType: 'comic',
      text: comicText,
      limit: 1000,
      jlptLevel: (comic.jlptLevel || 'N5') as any,
    })

    console.log(`  ✅ SUCCESS! Generated ${result.total} word explanations`)
    console.log(`     - New: ${result.generated}`)
    console.log(`     - Cached: ${result.cached}`)

    return {
      success: true,
      episodeNumber,
      total: result.total,
      generated: result.generated,
      cached: result.cached,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`  ❌ FAILED: ${errorMessage}`)
    return {
      failed: true,
      episodeNumber,
      error: errorMessage,
    }
  }
}

async function backfillComicWordExplanations() {
  console.log('\n🚀 Comic Word Explanations Backfill Script\n')
  console.log('Mode:', isDryRun ? '🔍 DRY RUN (preview only)' : '✍️  LIVE (will generate explanations)')

  if (specificEpisode) {
    console.log(`Target: Episode ${specificEpisode} only\n`)
  } else {
    console.log('Target: All published episodes\n')
  }

  console.log('─'.repeat(60))

  // Fetch all published comic episodes
  let query = db.collection('comics').orderBy('episodeNumber', 'asc')

  if (specificEpisode) {
    query = query.where('episodeNumber', '==', specificEpisode)
  }

  const comicsSnapshot = await query.get()

  if (comicsSnapshot.empty) {
    console.log('\n❌ No comic episodes found')
    process.exit(0)
  }

  console.log(`\nFound ${comicsSnapshot.size} comic episode(s)\n`)

  const results = {
    total: 0,
    skipped: 0,
    dryRun: 0,
    success: 0,
    failed: 0,
    details: [] as BackfillResult[],
  }

  // Process each episode
  for (const doc of comicsSnapshot.docs) {
    results.total++
    const comic = doc.data() as ComicData
    const episodeNumber = comic.episodeNumber

    const result = await generateWordExplanationsForEpisode(comic, episodeNumber)
    results.details.push(result)

    if (result.skipped) results.skipped++
    else if (result.dryRun) results.dryRun++
    else if (result.success) results.success++
    else if (result.failed) results.failed++

    // Small delay between episodes to avoid rate limits
    if (!isDryRun && !result.skipped) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  // Print summary
  console.log('\n' + '─'.repeat(60))
  console.log('\n📊 BACKFILL SUMMARY\n')
  console.log(`Total episodes processed: ${results.total}`)
  console.log(`  ✓ Skipped (already exists): ${results.skipped}`)

  if (isDryRun) {
    console.log(`  🔍 Would generate: ${results.dryRun}`)
  } else {
    console.log(`  ✅ Successfully generated: ${results.success}`)
    console.log(`  ❌ Failed: ${results.failed}`)
  }

  if (results.failed > 0) {
    console.log('\n❌ Failed episodes:')
    results.details
      .filter(r => r.failed)
      .forEach(r => {
        console.log(`  - Episode ${r.episodeNumber}: ${r.error}`)
      })
  }

  if (isDryRun && results.dryRun > 0) {
    console.log('\n💡 To actually generate word explanations, run without --dry-run flag:')
    console.log('   npx tsx scripts/backfill-comic-words.ts')
  } else if (results.success > 0) {
    console.log('\n✨ Word explanations successfully backfilled!')
    console.log('\nYou can verify by checking the word_explanations collection in Firestore.')
  }

  console.log('\n')
  process.exit(0)
}

// Run the backfill
backfillComicWordExplanations().catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
