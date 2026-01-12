/**
 * Sync word explanation status for comics and stories.
 *
 * Updates parent docs to reflect word explanation completeness based on
 * the corresponding *_word_explanations collection.
 *
 * Usage:
 *   npm run sync:word-status -- --dry-run
 *   npm run sync:word-status -- --comics
 *   npm run sync:word-status -- --stories
 */

import * as admin from 'firebase-admin'

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
      const serviceAccount = require('../../../moshimoshi-service-account.json')
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    } catch (error) {
      const projectId =
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT
      console.warn('[SyncWordStatus] No service account file found, using application default credentials')
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        ...(projectId ? { projectId } : {}),
      })
    }
  }
}

const db = admin.firestore()
const { FieldValue } = admin.firestore

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const targetComics = args.includes('--comics') || (!args.includes('--comics') && !args.includes('--stories'))
const targetStories = args.includes('--stories') || (!args.includes('--comics') && !args.includes('--stories'))

function getWordCount(data: admin.firestore.DocumentData | undefined): number {
  if (!data) return 0
  if (typeof data.wordCount === 'number') return data.wordCount
  if (Array.isArray(data.words)) return data.words.length
  if (typeof data.total === 'number') return data.total
  return 0
}

async function commitBatch(batch: admin.firestore.WriteBatch, pending: number) {
  if (pending === 0) return
  await batch.commit()
}

async function syncComics() {
  console.log('\n🧹 Syncing comic word explanation status...')
  const snapshot = await db.collection('comics').get()

  let batch = db.batch()
  let pending = 0
  let total = 0
  let updated = 0
  let missing = 0
  let skipped = 0

  for (const doc of snapshot.docs) {
    total += 1
    const data = doc.data()
    if (data.status === 'draft') {
      skipped += 1
      continue
    }

    const wordDoc = await db.collection('comic_word_explanations').doc(doc.id).get()
    if (!wordDoc.exists) {
      missing += 1
      continue
    }

    const wordCount = getWordCount(wordDoc.data())
    const needsUpdate =
      data.wordExplanationsStatus !== 'complete' ||
      data.wordExplanationsCount !== wordCount ||
      !data.wordExplanationsCompletedAt

    if (!needsUpdate) {
      skipped += 1
      continue
    }

    updated += 1
    if (!isDryRun) {
      batch.update(doc.ref, {
        wordExplanationsStatus: 'complete',
        wordExplanationsCount: wordCount,
        wordExplanationsCompletedAt: FieldValue.serverTimestamp(),
        wordExplanationsFailedAt: FieldValue.delete(),
        wordExplanationsError: FieldValue.delete(),
      })
      pending += 1
    }

    if (pending >= 400) {
      await commitBatch(batch, pending)
      batch = db.batch()
      pending = 0
    }
  }

  if (!isDryRun) {
    await commitBatch(batch, pending)
  }

  console.log('[Comics] Total:', total)
  console.log('[Comics] Updated:', updated)
  console.log('[Comics] Missing explanations:', missing)
  console.log('[Comics] Skipped:', skipped)
}

async function syncStories() {
  console.log('\n🧹 Syncing story word explanation status...')
  const snapshot = await db.collection('stories').get()

  let batch = db.batch()
  let pending = 0
  let total = 0
  let updated = 0
  let missing = 0
  let skipped = 0

  for (const doc of snapshot.docs) {
    total += 1
    const data = doc.data()
    if (data.status === 'draft') {
      skipped += 1
      continue
    }

    const wordDoc = await db.collection('story_word_explanations').doc(doc.id).get()
    if (!wordDoc.exists) {
      missing += 1
      continue
    }

    const wordCount = getWordCount(wordDoc.data())
    const needsUpdate =
      data.wordExplanationsStatus !== 'complete' ||
      data.wordExplanationsCount !== wordCount ||
      !data.wordExplanationsCompletedAt

    if (!needsUpdate) {
      skipped += 1
      continue
    }

    updated += 1
    if (!isDryRun) {
      batch.update(doc.ref, {
        wordExplanationsStatus: 'complete',
        wordExplanationsCount: wordCount,
        wordExplanationsCompletedAt: FieldValue.serverTimestamp(),
        wordExplanationsFailedAt: FieldValue.delete(),
        wordExplanationsError: FieldValue.delete(),
      })
      pending += 1
    }

    if (pending >= 400) {
      await commitBatch(batch, pending)
      batch = db.batch()
      pending = 0
    }
  }

  if (!isDryRun) {
    await commitBatch(batch, pending)
  }

  console.log('[Stories] Total:', total)
  console.log('[Stories] Updated:', updated)
  console.log('[Stories] Missing explanations:', missing)
  console.log('[Stories] Skipped:', skipped)
}

async function run() {
  console.log('\n🚀 Word Explanation Status Sync\n')
  console.log('Mode:', isDryRun ? '🔍 DRY RUN' : '✍️  LIVE')
  console.log('Targets:', [
    targetComics ? 'comics' : null,
    targetStories ? 'stories' : null,
  ].filter(Boolean).join(', '))

  if (targetComics) {
    await syncComics()
  }

  if (targetStories) {
    await syncStories()
  }

  console.log('\n✅ Sync complete\n')
}

run().catch(error => {
  console.error('\n💥 Sync failed:', error)
  process.exit(1)
})
