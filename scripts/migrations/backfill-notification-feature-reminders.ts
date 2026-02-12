/**
 * Backfill feature reminder toggles for notification preferences.
 *
 * Usage:
 *   npx tsx scripts/migrations/backfill-notification-feature-reminders.ts
 *   npx tsx scripts/migrations/backfill-notification-feature-reminders.ts --dry-run
 *   npx tsx scripts/migrations/backfill-notification-feature-reminders.ts --limit=500
 */

import * as admin from 'firebase-admin'

const FEATURE_REMINDER_KEYS = [
  'kana',
  'kanji_mastery',
  'flashcards_srs',
  'news',
  'stories',
  'library',
  'vocabulary'
] as const

type FeatureReminderKey = typeof FEATURE_REMINDER_KEYS[number]

const DEFAULT_FEATURE_REMINDERS: Record<FeatureReminderKey, boolean> = {
  kana: true,
  kanji_mastery: true,
  flashcards_srs: true,
  news: true,
  stories: true,
  library: true,
  vocabulary: true
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require('../../moshimoshi-service-account.json')
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })
  } catch {
    console.warn('No service account file found, falling back to application default credentials')
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    })
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find((arg) => arg.startsWith('--limit='))
  const limit = limitArg ? Math.max(1, Number.parseInt(limitArg.split('=')[1], 10) || 0) : null
  return { dryRun, limit }
}

function normalizeFeatureMap(features: unknown): Record<FeatureReminderKey, boolean> {
  const normalized = { ...DEFAULT_FEATURE_REMINDERS }
  if (!features || typeof features !== 'object') return normalized

  for (const key of FEATURE_REMINDER_KEYS) {
    if (key in (features as Record<string, unknown>)) {
      normalized[key] = !!(features as Record<string, unknown>)[key]
    }
  }
  return normalized
}

function buildFeatureReminders(docData: FirebaseFirestore.DocumentData) {
  const currentFeatureReminders = docData?.feature_reminders || {}

  return {
    enabled: currentFeatureReminders.enabled ?? true,
    features: normalizeFeatureMap(currentFeatureReminders.features)
  }
}

function needsMigration(docData: FirebaseFirestore.DocumentData): boolean {
  if (!docData) return true
  const featureReminders = docData?.feature_reminders
  if (!featureReminders) return true
  if (typeof featureReminders.enabled !== 'boolean') return true
  if (!featureReminders.features || typeof featureReminders.features !== 'object') return true
  return FEATURE_REMINDER_KEYS.some((key) => !(key in featureReminders.features))
}

async function run() {
  const { dryRun, limit } = parseArgs()
  initFirebaseAdmin()

  const db = admin.firestore()
  const usersSnapshot = await db.collection('users').get()
  const userIds = usersSnapshot.docs.map((doc) => doc.id)
  const targetUserIds = limit ? userIds.slice(0, limit) : userIds

  const prefsSnapshot = await db.collection('notifications_preferences').get()
  const prefsByUserId = new Map<string, FirebaseFirestore.DocumentData>(
    prefsSnapshot.docs.map((doc) => [doc.id, doc.data()])
  )

  console.log('Starting notifications_preferences feature_reminders backfill')
  console.log(`Users scanned: ${targetUserIds.length}${limit ? ` (limit=${limit})` : ''}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE WRITE'}`)

  let updated = 0
  let skipped = 0

  const batchSize = 400
  let batch = db.batch()
  let inBatch = 0

  for (const userId of targetUserIds) {
    const data = prefsByUserId.get(userId)
    if (!needsMigration(data)) {
      skipped += 1
      continue
    }

    const featureReminders = buildFeatureReminders(data)
    updated += 1

    if (!dryRun) {
      const ref = db.collection('notifications_preferences').doc(userId)
      batch.set(ref, {
        userId,
        feature_reminders: featureReminders,
        created_at: data?.created_at || admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      inBatch += 1

      if (inBatch >= batchSize) {
        await batch.commit()
        batch = db.batch()
        inBatch = 0
      }
    }
  }

  if (!dryRun && inBatch > 0) {
    await batch.commit()
  }

  console.log(`Backfill complete. Updated: ${updated}, Skipped: ${skipped}`)
}

run().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})
