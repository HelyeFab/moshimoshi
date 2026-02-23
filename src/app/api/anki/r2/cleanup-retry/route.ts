import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { adminDb } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { buildDeckPrefix } from '@/lib/r2/r2-keys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CleanupJob = {
  userId: string
  deckId: string
  prefix?: string
  status?: string
  retryable?: boolean
  attemptCount?: number
}

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

function parseBool(value: string | null | undefined): boolean {
  return value === '1' || value === 'true'
}

function parsePositiveInt(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.floor(parsed)
}

async function retryOneJob(job: CleanupJob, dryRun: boolean) {
  if (!adminDb) throw new Error('Firebase Admin DB not initialized')
  const { client, bucket } = getR2Config()

  const prefix = job.prefix || buildDeckPrefix(job.userId, job.deckId)
  const now = Date.now()
  const metadataRef = adminDb.collection('anki_r2_backups').doc(job.deckId)
  const tombstoneRef = adminDb
    .collection('users')
    .doc(job.userId)
    .collection('deletedAnkiDecks')
    .doc(job.deckId)
  const cleanupJobRef = adminDb
    .collection('users')
    .doc(job.userId)
    .collection('ankiBackupCleanupJobs')
    .doc(job.deckId)

  if (!dryRun) {
    await metadataRef.delete().catch(() => {})
    await tombstoneRef.set(
      {
        deletedAt: now,
        updatedAt: now,
        source: 'cleanup_retry_cron',
      },
      { merge: true }
    )
  }

  let r2FilesFound = 0
  let deletedCount = 0
  let errors: Array<Record<string, unknown>> = []
  let r2Error: string | null = null

  try {
    const listResponse = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      })
    )

    const objects = listResponse.Contents || []
    r2FilesFound = objects.length

    if (!dryRun && objects.length > 0) {
      const deleteResponse = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects.map(obj => ({ Key: obj.Key! })),
            Quiet: false,
          },
        })
      )
      deletedCount = deleteResponse.Deleted?.length || 0
      errors = (deleteResponse.Errors || []) as Array<Record<string, unknown>>
    }
  } catch (error: any) {
    r2Error = error?.message || 'R2 retry failed'
  }

  const status = r2Error || errors.length > 0 ? 'partial' : 'complete'

  if (!dryRun) {
    if (status === 'complete') {
      await cleanupJobRef.delete().catch(() => {})
    } else {
      await cleanupJobRef.set(
        {
          deckId: job.deckId,
          userId: job.userId,
          prefix,
          status: 'partial',
          retryable: true,
          metadataDeleted: true,
          tombstoneWritten: true,
          r2FilesFound,
          deletedCount,
          r2Errors: errors,
          r2Error,
          attemptCount: (typeof job.attemptCount === 'number' ? job.attemptCount : 0) + 1,
          lastAttemptAt: now,
          updatedAt: now,
          source: 'cleanup_retry_cron',
        },
        { merge: true }
      )
    }
  }

  return {
    userId: job.userId,
    deckId: job.deckId,
    prefix,
    status,
    r2FilesFound,
    deletedCount,
    r2ErrorsCount: errors.length,
    r2Error,
  }
}

async function runCleanupRetryJob(options: {
  dryRun: boolean
  maxJobs?: number
  userId?: string
  deckId?: string
}) {
  if (!adminDb) throw new Error('Firebase Admin DB not initialized')

  let jobs: CleanupJob[] = []
  if (options.userId && options.deckId) {
    const doc = await adminDb
      .collection('users')
      .doc(options.userId)
      .collection('ankiBackupCleanupJobs')
      .doc(options.deckId)
      .get()
    if (doc.exists) {
      jobs = [{ deckId: doc.id, ...(doc.data() as any) }]
    }
  } else if (options.userId) {
    const snapshot = await adminDb
      .collection('users')
      .doc(options.userId)
      .collection('ankiBackupCleanupJobs')
      .where('status', '==', 'partial')
      .get()
    jobs = snapshot.docs.map(doc => ({ deckId: doc.id, ...(doc.data() as any) }))
  } else {
    const snapshot = await adminDb.collectionGroup('ankiBackupCleanupJobs').where('status', '==', 'partial').get()
    jobs = snapshot.docs.map(doc => ({ deckId: doc.id, ...(doc.data() as any) }))
  }

  jobs = jobs.filter(job => job.retryable !== false && typeof job.userId === 'string')
  if (options.maxJobs) {
    jobs = jobs.slice(0, options.maxJobs)
  }

  const results = []
  for (const job of jobs) {
    results.push(await retryOneJob(job, options.dryRun))
  }

  return {
    scanned: jobs.length,
    processed: results.length,
    completed: results.filter(r => r.status === 'complete').length,
    partial: results.filter(r => r.status === 'partial').length,
    results,
  }
}

function parseRequestOptions(request: NextRequest, body?: any) {
  const url = new URL(request.url)
  const dryRun = body?.dryRun === true || parseBool(url.searchParams.get('dryRun'))
  const maxJobs = typeof body?.maxJobs === 'number' ? body.maxJobs : parsePositiveInt(url.searchParams.get('maxJobs'))
  const userId = typeof body?.userId === 'string' ? body.userId : url.searchParams.get('userId') || undefined
  const deckId = typeof body?.deckId === 'string' ? body.deckId : url.searchParams.get('deckId') || undefined
  return { dryRun, maxJobs, userId, deckId }
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const options = parseRequestOptions(request)
    const result = await runCleanupRetryJob(options)
    return NextResponse.json({ success: true, ...options, result })
  } catch (error) {
    console.error('[Anki R2 Cleanup Retry] GET failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const options = parseRequestOptions(request, body)
    const result = await runCleanupRetryJob(options)
    return NextResponse.json({ success: true, ...options, result })
  } catch (error) {
    console.error('[Anki R2 Cleanup Retry] POST failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

