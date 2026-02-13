#!/usr/bin/env node
/**
 * Cleanup helper for reminder-summary system campaigns in `email_campaigns`.
 *
 * Default mode is dry-run.
 *
 * Usage:
 *   node scripts/cleanup-reminder-summary-campaigns.mjs
 *   node scripts/cleanup-reminder-summary-campaigns.mjs --apply
 *   node scripts/cleanup-reminder-summary-campaigns.mjs --apply --older-than-days=7
 *   node scripts/cleanup-reminder-summary-campaigns.mjs --apply --max-delete=2000
 *
 * Env:
 *   GOOGLE_APPLICATION_CREDENTIALS (optional)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function parseArgs() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const olderThanArg = args.find((arg) => arg.startsWith('--older-than-days='))
  const maxDeleteArg = args.find((arg) => arg.startsWith('--max-delete='))

  const olderThanDays = olderThanArg ? Math.max(0, Number.parseInt(olderThanArg.split('=')[1], 10) || 0) : null
  const maxDelete = maxDeleteArg ? Math.max(1, Number.parseInt(maxDeleteArg.split('=')[1], 10) || 0) : 10000

  return { apply, olderThanDays, maxDelete }
}

function initFirebase() {
  if (getApps().length > 0) return getFirestore()

  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || join(__dirname, '..', 'moshimoshi-service-account.json')

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({ credential: cert(serviceAccount) })
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message)
    process.exit(1)
  }

  return getFirestore()
}

function isReminderSummaryCampaign(docId, data) {
  if (typeof docId === 'string' && docId.startsWith('reminder_summary_')) return true
  if (data?.createdBy === 'system:reminder-summary-job') return true
  if (data?.metadata?.type === 'reminder_summary_daily') return true
  return false
}

function isOlderThanCutoff(createdAt, olderThanDays) {
  if (olderThanDays === null) return true
  if (!createdAt || typeof createdAt.toDate !== 'function') return false
  const createdMs = createdAt.toDate().getTime()
  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  return createdMs < cutoffMs
}

async function run() {
  const { apply, olderThanDays, maxDelete } = parseArgs()
  const db = initFirebase()

  let scanned = 0
  let matched = 0
  let deleted = 0
  const idsToDelete = []
  const batchSize = 500

  let cursor = null
  while (true) {
    let query = db.collection('email_campaigns').orderBy('createdAt', 'desc').limit(batchSize)
    if (cursor) {
      query = query.startAfter(cursor)
    }

    const snap = await query.get()
    if (snap.empty) break

    for (const doc of snap.docs) {
      scanned += 1
      const data = doc.data()

      if (!isReminderSummaryCampaign(doc.id, data)) continue
      if (!isOlderThanCutoff(data.createdAt, olderThanDays)) continue

      matched += 1
      if (idsToDelete.length < maxDelete) {
        idsToDelete.push(doc.id)
      }
    }

    cursor = snap.docs[snap.docs.length - 1]
    if (snap.size < batchSize) break
    if (idsToDelete.length >= maxDelete) break
  }

  console.log('Reminder summary cleanup scan complete.')
  console.log(`Scanned docs: ${scanned}`)
  console.log(`Matched docs: ${matched}`)
  console.log(`Selected for delete (capped): ${idsToDelete.length}`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  if (olderThanDays !== null) {
    console.log(`Filter: older than ${olderThanDays} days`)
  }

  if (idsToDelete.length > 0) {
    console.log('Sample ids:', idsToDelete.slice(0, 10))
  }

  if (!apply || idsToDelete.length === 0) return

  let batch = db.batch()
  let inBatch = 0
  for (const id of idsToDelete) {
    const ref = db.collection('email_campaigns').doc(id)
    batch.delete(ref)
    inBatch += 1

    if (inBatch >= 400) {
      await batch.commit()
      deleted += inBatch
      batch = db.batch()
      inBatch = 0
    }
  }

  if (inBatch > 0) {
    await batch.commit()
    deleted += inBatch
  }

  console.log(`Deleted docs: ${deleted}`)
  console.log(`Completed at: ${Timestamp.now().toDate().toISOString()}`)
}

run().catch((error) => {
  console.error('Cleanup failed:', error)
  process.exit(1)
})

