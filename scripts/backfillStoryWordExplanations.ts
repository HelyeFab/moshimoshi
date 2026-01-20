/**
 * Backfill Word Explanations for Existing Stories
 *
 * Generates comprehensive word explanations for published stories
 * that don't already have them in the story_word_explanations collection.
 *
 * Usage:
 *   npm run backfill:stories -- --dry-run         # Preview what will be done
 *   npm run backfill:stories                      # Actually generate word explanations
 *   npm run backfill:stories -- --story story_123 # Backfill a specific story
 *   npm run backfill:stories -- --force           # Regenerate even if doc exists
 *   npm run backfill:stories -- --start-after story_123 # Resume after a story id
 *   npm run backfill:stories -- --limit 5         # Process only N stories
 */

import * as admin from 'firebase-admin'

// Load local env for scripts (project id + keys)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')
// Resolve from repo root even if running inside /scripts
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
if (process.env.FIREBASE_ADMIN_PROJECT_ID) {
  process.env.GCLOUD_PROJECT ||= process.env.FIREBASE_ADMIN_PROJECT_ID
  process.env.GOOGLE_CLOUD_PROJECT ||= process.env.FIREBASE_ADMIN_PROJECT_ID
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH
  if (serviceAccountPath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(serviceAccountPath)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require('../moshimoshi-service-account.json')
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    } catch (error) {
      const projectId =
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT
      console.warn('[BackfillStories] No service account file found, falling back to application default credentials')
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
const isForce = args.includes('--force')
const storyArgIndex = args.indexOf('--story')
const specificStoryId = storyArgIndex !== -1 ? args[storyArgIndex + 1] : null
const startAfterIndex = args.indexOf('--start-after')
const startAfterStoryId = startAfterIndex !== -1 ? args[startAfterIndex + 1] : null
const limitIndex = args.indexOf('--limit')
const limitCount = limitIndex !== -1 ? parseInt(args[limitIndex + 1] || '0', 10) : 2

interface StoryPage {
  text?: string
  textJa?: string
}

interface StoryData {
  title?: string
  jlptLevel?: string
  status?: string
  pages?: StoryPage[]
  publishedAt?: admin.firestore.Timestamp
  createdAt?: admin.firestore.Timestamp
}

interface BackfillResult {
  skipped?: boolean
  dryRun?: boolean
  success?: boolean
  failed?: boolean
  forced?: boolean
  storyId: string
  title?: string
  textLength?: number
  total?: number
  generated?: number
  cached?: number
  error?: string
  reason?: string
}

function extractStoryText(storyData: StoryData): string {
  if (!storyData.pages || !Array.isArray(storyData.pages)) {
    return ''
  }

  return storyData.pages
    .map(page => page.text || page.textJa || '')
    .filter(text => text.length > 0)
    .join('\n')
}

async function checkWordExplanationsExist(storyId: string): Promise<boolean> {
  const wordDoc = await db.collection('story_word_explanations').doc(storyId).get()
  return wordDoc.exists
}

async function generateWordExplanationsForStory(
  storyId: string,
  story: StoryData
): Promise<BackfillResult> {
  const title = story.title || storyId

  console.log(`\n📘 Story ${storyId}: ${title}`)

  // Check if already exists
  const alreadyExists = await checkWordExplanationsExist(storyId)
  if (alreadyExists) {
    if (!isForce) {
      console.log('  ✓ Word explanations already exist - SKIPPING')
      return { skipped: true, storyId, title }
    }
    console.log('  ⚠️  Word explanations exist - FORCE REGENERATE')
    if (!isDryRun) {
      await db.collection('story_word_explanations').doc(storyId).delete()
    }
  }

  // Extract text from story pages
  const storyText = extractStoryText(story)
  if (!storyText || storyText.trim().length === 0) {
    console.log('  ⚠️  No text found in story pages - SKIPPING')
    return { skipped: true, storyId, title, reason: 'no text' }
  }

  const textPreview = storyText.substring(0, 100) + (storyText.length > 100 ? '...' : '')
  console.log(`  Text extracted: ${textPreview}`)
  console.log(`  Total text length: ${storyText.length} characters`)
  const jlptLevel = (story.jlptLevel || 'N4') as 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  const isBeginner = jlptLevel === 'N5' || jlptLevel === 'N4'
  const topWordLimitMap: Record<'N3' | 'N2' | 'N1', number> = {
    N3: 150,
    N2: 120,
    N1: 100,
  }
  const limit = isBeginner ? undefined : topWordLimitMap[jlptLevel as 'N3' | 'N2' | 'N1'] ?? 100
  console.log(`  JLPT Level: ${jlptLevel} (${isBeginner ? 'all filtered words' : `top ${limit}`})`)

  if (isDryRun) {
    console.log('  [DRY RUN] Would generate word explanations')
    return { dryRun: true, forced: alreadyExists && isForce, storyId, title, textLength: storyText.length }
  }

  // Generate word explanations
  try {
    console.log('  🔄 Generating word explanations...')

    const { generateStoryWordExplanations } = await import('../functions/src/utils/storyWordExplanationPreGenerator')
    const result = await generateStoryWordExplanations(
      storyId,
      storyText,
      limit,
      isBeginner ? { includeParticles: true, minLength: 1 } : undefined
    )

    console.log(`  ✅ SUCCESS! Generated ${result.wordCount} word explanations`)

    await db.collection('stories').doc(storyId).update({
      wordExplanationsStatus: 'complete',
      wordExplanationsCount: result.wordCount,
      wordExplanationsCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      wordExplanationsFailedAt: admin.firestore.FieldValue.delete(),
      wordExplanationsError: admin.firestore.FieldValue.delete(),
    })

    return {
      success: true,
      forced: alreadyExists && isForce,
      storyId,
      title,
      total: result.wordCount,
      generated: result.wordCount,
      cached: 0,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`  ❌ FAILED: ${errorMessage}`)
    return {
      failed: true,
      storyId,
      title,
      error: errorMessage,
    }
  }
}

function getStorySortDate(story: StoryData): number {
  const publishedAt = story.publishedAt?.toDate?.().getTime()
  if (publishedAt) return publishedAt
  const createdAt = story.createdAt?.toDate?.().getTime()
  return createdAt || 0
}

async function backfillStoryWordExplanations() {
  console.log('\n🚀 Story Word Explanations Backfill Script\n')
  console.log('Mode:', isDryRun ? '🔍 DRY RUN (preview only)' : '✍️  LIVE (will generate explanations)')
  console.log('Force:', isForce ? '✅ enabled' : '❌ disabled')

  if (specificStoryId) {
    console.log(`Target: Story ${specificStoryId} only\n`)
  } else {
    console.log('Target: All published stories\n')
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

  if (specificStoryId) {
    const storyDoc = await db.collection('stories').doc(specificStoryId).get()

    if (!storyDoc.exists) {
      console.log(`\n❌ Story not found: ${specificStoryId}`)
      process.exit(1)
    }

    const story = storyDoc.data() as StoryData
    const result = await generateWordExplanationsForStory(storyDoc.id, story)
    results.details.push(result)
    results.total = 1
    if (result.skipped) results.skipped++
    else if (result.dryRun) results.dryRun++
    else if (result.success) results.success++
    else if (result.failed) results.failed++
  } else {
    const storiesSnapshot = await db.collection('stories').get()

    if (storiesSnapshot.empty) {
      console.log('\n❌ No stories found')
      process.exit(0)
    }

    const stories = storiesSnapshot.docs
      .map(doc => ({ id: doc.id, data: doc.data() as StoryData }))
      .filter(({ data }) => data.status === 'published')
      .sort((a, b) => getStorySortDate(a.data) - getStorySortDate(b.data))

    if (stories.length === 0) {
      console.log('\n❌ No published stories found')
      process.exit(0)
    }

    console.log(`\nFound ${stories.length} published story(ies)\n`)

    let skipping = !!startAfterStoryId
    let processedCount = 0

    for (const story of stories) {
      if (skipping) {
        if (story.id === startAfterStoryId) {
          skipping = false
        }
        continue
      }

      if (limitCount > 0 && processedCount >= limitCount) {
        console.log(`\nReached limit (${limitCount}) - stopping early.`)
        break
      }

      results.total++
      const result = await generateWordExplanationsForStory(story.id, story.data)
      results.details.push(result)

      if (result.skipped) results.skipped++
      else if (result.dryRun) results.dryRun++
      else if (result.success) results.success++
      else if (result.failed) results.failed++

      processedCount++

      // Small delay between stories to avoid rate limits
      if (!isDryRun && !result.skipped) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  // Print summary
  console.log('\n' + '─'.repeat(60))
  console.log('\n📊 BACKFILL SUMMARY\n')
  console.log(`Total stories processed: ${results.total}`)
  console.log(`  ✓ Skipped (already exists): ${results.skipped}`)

  if (isDryRun) {
    console.log(`  🔍 Would generate: ${results.dryRun}`)
  } else {
    console.log(`  ✅ Successfully generated: ${results.success}`)
    console.log(`  ❌ Failed: ${results.failed}`)
  }

  if (results.failed > 0) {
    console.log('\n❌ Failed stories:')
    results.details
      .filter(r => r.failed)
      .forEach(r => {
        console.log(`  - ${r.storyId} (${r.title || 'Untitled'}): ${r.error}`)
      })
  }

  console.log('\n✨ Story word explanations backfill complete!')
}

backfillStoryWordExplanations().catch(error => {
  console.error('\n❌ Backfill script failed:', error)
  process.exit(1)
})
