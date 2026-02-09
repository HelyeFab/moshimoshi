import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import {
  DECKMARKET_COLLECTION,
  VERSIONS_SUBCOLLECTION,
  DECKMARKET_R2_PREFIX,
  MAX_APKG_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  DECK_LIMITS,
} from '@/types/deckmarket'
import type { UploadVersionRequest, UploadVersionResponse } from '@/types/deckmarket'

const INVALID_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g

function sanitizeFilename(filename: string): string {
  const lastSegment = filename.replace(/\\/g, '/').split('/').pop() || ''
  const stripped = lastSegment.replace(/\.+/g, '.').replace(INVALID_FILENAME_CHARS, '')
  return stripped.replace(/^\.+/, '')
}

function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return (ALLOWED_EXTENSIONS as readonly string[]).some((ext) => lower.endsWith(ext))
}

/**
 * POST - Generate presigned upload URL and create a version doc
 */
export const POST = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const deckId = context.params?.deckId
    if (!deckId) {
      return NextResponse.json({ error: 'Deck ID is required' }, { status: 400 })
    }

    const body = (await request.json()) as UploadVersionRequest

    if (!body?.filename || typeof body.filename !== 'string') {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    if (!body?.fileSize || typeof body.fileSize !== 'number' || body.fileSize <= 0) {
      return NextResponse.json({ error: 'File size is required' }, { status: 400 })
    }

    if (body.fileSize > MAX_APKG_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 200MB)' }, { status: 400 })
    }

    if (
      body.versionLabel &&
      typeof body.versionLabel === 'string' &&
      body.versionLabel.length > DECK_LIMITS.VERSION_LABEL_MAX
    ) {
      return NextResponse.json(
        { error: `Version label must be ${DECK_LIMITS.VERSION_LABEL_MAX} characters or less` },
        { status: 400 }
      )
    }

    if (
      body.changelog &&
      typeof body.changelog === 'string' &&
      body.changelog.length > DECK_LIMITS.CHANGELOG_MAX
    ) {
      return NextResponse.json(
        { error: `Changelog must be ${DECK_LIMITS.CHANGELOG_MAX} characters or less` },
        { status: 400 }
      )
    }

    const deckDoc = await adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).get()
    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const safeFilename = sanitizeFilename(body.filename)

    if (!safeFilename || safeFilename.includes('..') || safeFilename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    if (!hasAllowedExtension(safeFilename)) {
      return NextResponse.json({ error: 'Only .apkg files are allowed' }, { status: 400 })
    }

    const versionId = uuidv4()
    const r2Key = `${DECKMARKET_R2_PREFIX}/${deckId}/${versionId}/${safeFilename}`

    const { client, bucket } = getR2Config()

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      ContentType: 'application/octet-stream',
    })

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 })

    await adminFirestore
      .collection(DECKMARKET_COLLECTION)
      .doc(deckId)
      .collection(VERSIONS_SUBCOLLECTION)
      .doc(versionId)
      .set({
        id: versionId,
        deckId,
        versionLabel: body.versionLabel || `v${Date.now()}`,
        changelog: body.changelog || '',
        apkgR2Key: r2Key,
        apkgFilename: safeFilename,
        sizeBytes: body.fileSize,
        sha256: null,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: context.user.uid,
      })

    await adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).update({
      latestVersionId: versionId,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      uploadUrl,
      versionId,
      r2Key,
      expiresIn: 900,
    } as UploadVersionResponse)
  } catch (error: any) {
    console.error('[API /admin/deckmarket/decks/[deckId]/upload] POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create upload URL' },
      { status: 500 }
    )
  }
})
