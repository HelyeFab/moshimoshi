#!/usr/bin/env node

/**
 * Retry partial Anki R2 cleanup jobs (manual repair tool).
 *
 * Usage:
 *   node scripts/retry-anki-r2-cleanup.js <email-or-uid>
 *   node scripts/retry-anki-r2-cleanup.js <email-or-uid> <deckId>
 *   node scripts/retry-anki-r2-cleanup.js <email-or-uid> --dry-run
 */

const path = require('path')
const admin = require('firebase-admin')
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3')

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../moshimoshi-service-account.json')
const serviceAccount = require(SERVICE_ACCOUNT_PATH)

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing env var: ${name}`)
  }
  return value
}

function isEmail(value) {
  return typeof value === 'string' && value.includes('@')
}

function buildDeckPrefix(userId, deckId) {
  return `users/${userId}/decks/${deckId}/`
}

function makeR2Client() {
  return {
    client: new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint: requireEnv('R2_ENDPOINT'),
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
    bucket: requireEnv('R2_BUCKET'),
  }
}

async function resolveUser(auth, input) {
  if (!input) {
    throw new Error('Usage: node scripts/retry-anki-r2-cleanup.js <email-or-uid> [deckId] [--dry-run]')
  }
  if (isEmail(input)) {
    const user = await auth.getUserByEmail(input)
    return { uid: user.uid, email: user.email || input }
  }
  const user = await auth.getUser(input)
  return { uid: user.uid, email: user.email || null }
}

async function retryCleanupJob({ db, r2, uid, deckId, dryRun }) {
  const now = Date.now()
  const jobRef = db.collection('users').doc(uid).collection('ankiBackupCleanupJobs').doc(deckId)
  const jobSnap = await jobRef.get()
  if (!jobSnap.exists) {
    return { deckId, status: 'missing_job' }
  }

  const job = jobSnap.data() || {}
  const prefix = typeof job.prefix === 'string' ? job.prefix : buildDeckPrefix(uid, deckId)

  const metadataRef = db.collection('anki_r2_backups').doc(deckId)
  const tombstoneRef = db.collection('users').doc(uid).collection('deletedAnkiDecks').doc(deckId)

  // Reassert consistency invariants (idempotent)
  if (!dryRun) {
    await metadataRef.delete().catch(() => {})
    await tombstoneRef.set(
      {
        deletedAt: job.deletedAt || now,
        updatedAt: now,
        source: 'manual_retry',
      },
      { merge: true }
    )
  }

  let r2FilesFound = 0
  let deletedCount = 0
  let r2Errors = []
  let r2Error = null

  try {
    const listRes = await r2.client.send(new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: prefix }))
    const objects = listRes.Contents || []
    r2FilesFound = objects.length

    if (!dryRun && objects.length > 0) {
      const delRes = await r2.client.send(
        new DeleteObjectsCommand({
          Bucket: r2.bucket,
          Delete: {
            Objects: objects.map(obj => ({ Key: obj.Key })),
            Quiet: false,
          },
        })
      )
      deletedCount = delRes.Deleted?.length || 0
      r2Errors = delRes.Errors || []
    }
  } catch (err) {
    r2Error = err?.message || String(err)
  }

  const status = r2Error || r2Errors.length > 0 ? 'partial' : 'complete'

  if (!dryRun) {
    if (status === 'complete') {
      await jobRef.delete().catch(() => {})
    } else {
      await jobRef.set(
        {
          deckId,
          userId: uid,
          prefix,
          status: 'partial',
          retryable: true,
          metadataDeleted: true,
          tombstoneWritten: true,
          r2FilesFound,
          deletedCount,
          r2Errors,
          r2Error,
          attemptCount: (typeof job.attemptCount === 'number' ? job.attemptCount : 0) + 1,
          lastAttemptAt: now,
          updatedAt: now,
          source: 'manual_retry',
        },
        { merge: true }
      )
    }
  }

  return {
    deckId,
    prefix,
    status,
    r2FilesFound,
    deletedCount,
    r2ErrorsCount: r2Errors.length,
    r2Error,
    dryRun,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filtered = args.filter(a => a !== '--dry-run')
  const userArg = filtered[0]
  const deckArg = filtered[1]

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
  }

  const db = admin.firestore()
  const auth = admin.auth()
  const r2 = makeR2Client()

  try {
    const user = await resolveUser(auth, userArg)
    console.log('🛠️  Anki R2 Cleanup Retry')
    console.log('━'.repeat(60))
    console.log(`UID:   ${user.uid}`)
    if (user.email) console.log(`Email: ${user.email}`)
    console.log(`Mode:  ${dryRun ? 'DRY RUN' : 'LIVE'}`)
    if (deckArg) console.log(`Deck:  ${deckArg}`)
    console.log('━'.repeat(60))

    let deckIds = []
    if (deckArg) {
      deckIds = [deckArg]
    } else {
      const jobsSnap = await db
        .collection('users')
        .doc(user.uid)
        .collection('ankiBackupCleanupJobs')
        .get()
      deckIds = jobsSnap.docs
        .filter(doc => (doc.data()?.retryable !== false) && (doc.data()?.status || 'partial') === 'partial')
        .map(doc => doc.id)
    }

    if (deckIds.length === 0) {
      console.log('No retryable partial cleanup jobs found.')
      return
    }

    const results = []
    for (const deckId of deckIds) {
      const result = await retryCleanupJob({ db, r2, uid: user.uid, deckId, dryRun })
      results.push(result)
      console.log(
        `• ${deckId}: ${result.status} | files=${result.r2FilesFound} deleted=${result.deletedCount} r2Errors=${result.r2ErrorsCount}` +
          (result.r2Error ? ` | r2Error=${result.r2Error}` : '')
      )
    }

    const complete = results.filter(r => r.status === 'complete').length
    const partial = results.filter(r => r.status === 'partial').length
    const missing = results.filter(r => r.status === 'missing_job').length

    console.log('\nSummary')
    console.log('─'.repeat(60))
    console.log(`Processed: ${results.length}`)
    console.log(`Complete:  ${complete}`)
    console.log(`Partial:   ${partial}`)
    console.log(`Missing:   ${missing}`)
  } finally {
    await admin.app().delete().catch(() => {})
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message || error)
  process.exit(1)
})
