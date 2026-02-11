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
  DECKMARKET_NOTES_COLLECTION,
  NOTES_VERSIONS_SUBCOLLECTION,
  DECKMARKET_NOTES_R2_PREFIX,
  MAX_MD_SIZE_BYTES,
  ALLOWED_MD_EXTENSIONS,
  DECK_LIMITS,
} from '@/types/deckmarket'

export const runtime = 'nodejs'

const INVALID_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g

function sanitizeFilename(filename: string): string {
  const lastSegment = filename.replace(/\\/g, '/').split('/').pop() || ''
  const stripped = lastSegment.replace(/\.+/g, '.').replace(INVALID_FILENAME_CHARS, '')
  return stripped.replace(/^\.+/, '')
}

function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return (ALLOWED_MD_EXTENSIONS as readonly string[]).some((ext) => lower.endsWith(ext))
}

function execFileAsync(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        console.error('[DeckMarket Notes] Conversion failed:', stderr || stdout)
        const err = new Error(stderr || stdout || error.message)
        reject(err)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

export const POST = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  let tempDir: string | null = null

  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const noteId = context.params?.noteId
    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    const noteRef = adminFirestore.collection(DECKMARKET_NOTES_COLLECTION).doc(noteId)
    const noteDoc = await noteRef.get()

    if (!noteDoc.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
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
      return NextResponse.json({ error: 'Markdown file is required' }, { status: 400 })
    }

    if (!hasAllowedExtension(file.name)) {
      return NextResponse.json({ error: 'Only .md files are allowed' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Markdown file is empty' }, { status: 400 })
    }

    if (file.size > MAX_MD_SIZE_BYTES) {
      return NextResponse.json({ error: 'Markdown file too large' }, { status: 400 })
    }

    const safeMdFilename = sanitizeFilename(file.name)
    if (!safeMdFilename || safeMdFilename.includes('..') || safeMdFilename.includes('/')) {
      return NextResponse.json({ error: 'Invalid markdown filename' }, { status: 400 })
    }

    const mdFilename = safeMdFilename.toLowerCase().endsWith('.md')
      ? safeMdFilename
      : `${noteId}.md`
    const pdfFilename = mdFilename.replace(/\.md$/i, '.pdf')

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deckmarket-notes-'))
    const mdPath = path.join(tempDir, 'input.md')
    const pdfPath = path.join(tempDir, 'output.pdf')

    const mdBuffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(mdPath, mdBuffer)

    const scriptPath = path.join(process.cwd(), 'scripts', 'deckmarket', 'md_to_pdf.py')
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
      mdPath,
      '--output',
      pdfPath,
    ])

    const pdfBuffer = await fs.readFile(pdfPath)
    const versionId = uuidv4()
    const mdR2Key = `${DECKMARKET_NOTES_R2_PREFIX}/${noteId}/${versionId}/${mdFilename}`
    const pdfR2Key = `${DECKMARKET_NOTES_R2_PREFIX}/${noteId}/${versionId}/${pdfFilename}`

    const { client, bucket } = getR2Config()
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: mdR2Key,
        Body: mdBuffer,
        ContentType: 'text/markdown',
      })
    )
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: pdfR2Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    )

    await noteRef
      .collection(NOTES_VERSIONS_SUBCOLLECTION)
      .doc(versionId)
      .set({
        id: versionId,
        noteId,
        versionLabel: versionLabel || `v${Date.now()}`,
        changelog,
        pdfR2Key,
        pdfFilename,
        pdfSizeBytes: pdfBuffer.length,
        mdR2Key,
        mdFilename,
        mdSizeBytes: mdBuffer.length,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: context.user.uid,
      })

    await noteRef.update({
      latestVersionId: versionId,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      versionId,
      pdfR2Key,
    })
  } catch (error: any) {
    console.error('[API /admin/deckmarket/notes/[noteId]/upload] POST Error:', error)
    const rawMessage = error?.message || ''
    if (rawMessage.includes('markdown') || rawMessage.includes('weasyprint')) {
      return NextResponse.json(
        {
          error:
            'Markdown to PDF requires markdown and weasyprint. Install it in a venv: python3 -m venv .venv && .venv/bin/pip install markdown weasyprint',
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to convert markdown' },
      { status: 500 }
    )
  } finally {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.error('[DeckMarket Notes] Cleanup failed:', cleanupError)
      }
    }
  }
})
