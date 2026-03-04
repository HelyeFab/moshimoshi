#!/usr/bin/env node

/**
 * Backfill DeckMarket `hasNativeAudio` metadata for Kuchiguse 500 decks.
 *
 * Usage:
 *   node scripts/deckmarket/backfill-kuchiguse-native-audio.js --dry-run
 *   node scripts/deckmarket/backfill-kuchiguse-native-audio.js
 *   node scripts/deckmarket/backfill-kuchiguse-native-audio.js --value=false
 *   node scripts/deckmarket/backfill-kuchiguse-native-audio.js --ids=kuchiguse500-t1-survival-core,kuchiguse500-t2-daily-life
 */

const path = require('path')
const admin = require('firebase-admin')

const DEFAULT_IDS = [
  'kuchiguse500-t1-survival-core',
  'kuchiguse500-t2-daily-life',
  'kuchiguse500-t3-social-situational',
  'kuchiguse500-t4-fluency-builders',
  'kuchiguse500-t5-nuance-range',
]

function parseArgs(argv) {
  const args = new Set(argv)
  const dryRun = args.has('--dry-run')

  const valueArg = argv.find((arg) => arg.startsWith('--value='))
  const valueRaw = valueArg ? valueArg.split('=')[1] : 'true'
  if (valueRaw !== 'true' && valueRaw !== 'false') {
    throw new Error('--value must be true or false')
  }
  const value = valueRaw === 'true'

  const idsArg = argv.find((arg) => arg.startsWith('--ids='))
  const ids = idsArg
    ? idsArg
        .split('=')[1]
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : DEFAULT_IDS

  if (ids.length === 0) {
    throw new Error('No deck IDs provided')
  }

  return { dryRun, value, ids }
}

function initFirestore() {
  const serviceAccountPath = path.join(process.cwd(), 'moshimoshi-service-account.json')
  const serviceAccount = require(serviceAccountPath)

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
  }

  return admin.firestore()
}

async function main() {
  const { dryRun, value, ids } = parseArgs(process.argv.slice(2))
  const db = initFirestore()
  const collection = db.collection('deckmarket_decks')

  console.log(
    `[backfill-kuchiguse-native-audio] starting (${dryRun ? 'dry-run' : 'live'}) value=${value}`
  )
  console.log(`[backfill-kuchiguse-native-audio] ids=${ids.join(', ')}`)

  let updated = 0
  let unchanged = 0
  let missing = 0

  for (const deckId of ids) {
    const ref = collection.doc(deckId)
    const snap = await ref.get()

    if (!snap.exists) {
      missing += 1
      console.log(`- ${deckId}: missing`)
      continue
    }

    const currentValue = snap.get('hasNativeAudio')
    if (currentValue === value) {
      unchanged += 1
      console.log(`- ${deckId}: unchanged (hasNativeAudio=${currentValue})`)
      continue
    }

    updated += 1
    if (dryRun) {
      console.log(`- ${deckId}: would set hasNativeAudio=${value} (current=${currentValue})`)
      continue
    }

    await ref.set(
      {
        hasNativeAudio: value,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    console.log(`- ${deckId}: set hasNativeAudio=${value}`)
  }

  console.log('[backfill-kuchiguse-native-audio] done')
  console.log(
    `[backfill-kuchiguse-native-audio] updated=${updated} unchanged=${unchanged} missing=${missing}`
  )
}

main().catch((error) => {
  console.error('[backfill-kuchiguse-native-audio] failed:', error.message)
  process.exitCode = 1
})

