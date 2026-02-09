import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import os from 'os'
import { promises as fs } from 'fs'
import { execFile } from 'child_process'
import {
  DECKMARKET_COLLECTION,
  VERSIONS_SUBCOLLECTION,
  DECKMARKET_R2_PREFIX,
  MAX_APKG_SIZE_BYTES,
  DECK_LIMITS,
} from '@/types/deckmarket'

export const runtime = 'nodejs'

const CSV_EXTENSION = '.csv'
const INVALID_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g

function sanitizeFilename(filename: string): string {
  const lastSegment = filename.replace(/\\/g, '/').split('/').pop() || ''
  const stripped = lastSegment.replace(/\.+/g, '.').replace(INVALID_FILENAME_CHARS, '')
  return stripped.replace(/^\.+/, '')
}

function execFileAsync(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        console.error('[DeckMarket CSV] Conversion failed:', stderr || stdout)
        const err = new Error(stderr || stdout || error.message)
        reject(err)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

/**
 * POST - Import CSV and convert to .apkg server-side
 */
export const POST = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  let tempDir: string | null = null

  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const deckId = context.params?.deckId
    if (!deckId) {
      return NextResponse.json({ error: 'Deck ID is required' }, { status: 400 })
    }

    const deckRef = adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId)
    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const versionLabel = (formData.get('versionLabel') as string | null) || ''
    const changelog = (formData.get('changelog') as string | null) || ''

    if (versionLabel && versionLabel.length > DECK_LIMITS.VERSION_LABEL_MAX) {
      return NextResponse.json(
        { error: `Version label must be ${DECK_LIMITS.VERSION_LABEL_MAX} characters or less` },
        { status: 400 }
      )
    }

    if (changelog && changelog.length > DECK_LIMITS.CHANGELOG_MAX) {
      return NextResponse.json(
        { error: `Changelog must be ${DECK_LIMITS.CHANGELOG_MAX} characters or less` },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(CSV_EXTENSION)) {
      return NextResponse.json({ error: 'Only .csv files are allowed' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    if (file.size > MAX_APKG_SIZE_BYTES) {
      return NextResponse.json({ error: 'CSV file too large' }, { status: 400 })
    }

    const deckTitle = (deckDoc.data()?.title as string) || deckId

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deckmarket-'))
    const csvPath = path.join(tempDir, 'import.csv')
    const apkgPath = path.join(tempDir, 'output.apkg')

    const csvBuffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(csvPath, csvBuffer)

    const safeCsvFilename = sanitizeFilename(file.name)
    if (!safeCsvFilename || safeCsvFilename.includes('..') || safeCsvFilename.includes('/')) {
      return NextResponse.json({ error: 'Invalid CSV filename' }, { status: 400 })
    }

    const csvFilename = safeCsvFilename.toLowerCase().endsWith(CSV_EXTENSION)
      ? safeCsvFilename
      : `${deckId}.csv`

    const scriptPath = path.join(process.cwd(), 'scripts', 'deckmarket', 'csv_to_apkg.py')
    const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python')
    let pythonCmd = 'python3'
    try {
      await fs.access(venvPython)
      pythonCmd = venvPython
    } catch {
      // fallback to system python3
    }

    await execFileAsync(pythonCmd, [
      scriptPath,
      '--input',
      csvPath,
      '--output',
      apkgPath,
      '--deck-name',
      deckTitle,
      '--deck-id',
      deckId,
    ])

    const apkgBuffer = await fs.readFile(apkgPath)
    const versionId = uuidv4()
    const safeFilename = `${deckId}.apkg`
    const r2Key = `${DECKMARKET_R2_PREFIX}/${deckId}/${versionId}/${safeFilename}`
    const csvR2Key = `${DECKMARKET_R2_PREFIX}/${deckId}/${versionId}/${csvFilename}`

    const { client, bucket } = getR2Config()
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: csvR2Key,
        Body: csvBuffer,
        ContentType: 'text/csv',
      })
    )
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        Body: apkgBuffer,
        ContentType: 'application/octet-stream',
      })
    )

    await deckRef
      .collection(VERSIONS_SUBCOLLECTION)
      .doc(versionId)
      .set({
        id: versionId,
        deckId,
        versionLabel: versionLabel || `v${Date.now()}`,
        changelog,
        apkgR2Key: r2Key,
        apkgFilename: safeFilename,
        sizeBytes: apkgBuffer.length,
        csvR2Key,
        csvFilename,
        csvSizeBytes: csvBuffer.length,
        sha256: null,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: context.user.uid,
      })

    await deckRef.update({
      latestVersionId: versionId,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      versionId,
      r2Key,
    })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/decks/[deckId]/import-csv] POST Error:', error)
    const rawMessage = error?.message || ''
    if (rawMessage.includes('genanki') || rawMessage.includes('No module named')) {
      return NextResponse.json(
        {
          error:
            'CSV import requires genanki. Install it in a venv: python3 -m venv .venv && .venv/bin/pip install genanki',
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to import CSV' },
      { status: 500 }
    )
  } finally {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.error('[DeckMarket CSV] Cleanup failed:', cleanupError)
      }
    }
  }
})
