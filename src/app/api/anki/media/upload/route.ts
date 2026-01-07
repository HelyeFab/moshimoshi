import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminStorage, adminDb } from '@/lib/firebase/admin'
import { getStorageDecision } from '@/lib/api/storage-helper'

/**
 * Server-side media upload endpoint for Anki media files
 *
 * Follows the same pattern as other premium features:
 * - Validates premium status server-side
 * - Uses Admin SDK to upload (bypasses Storage rule complexity)
 * - Returns download URL to client
 *
 * Why server-side?
 * - Storage rules with firestore.get() are unreliable for client uploads
 * - Consistent with ALL other premium features (flashcards, achievements, etc.)
 * - Server has full access to subscription data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check premium status (same pattern as all other features)
    const decision = await getStorageDecision(session)
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        error: 'Premium subscription required',
        isPremium: false
      }, { status: 403 })
    }

    if (!adminStorage) {
      return NextResponse.json({ error: 'Storage not available' }, { status: 500 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const userId = formData.get('userId') as string
    const deckId = formData.get('deckId') as string
    const filename = formData.get('filename') as string
    const file = formData.get('file') as Blob

    // Validate inputs
    if (!userId || !deckId || !filename || !file) {
      return NextResponse.json({
        error: 'Missing required fields: userId, deckId, filename, file'
      }, { status: 400 })
    }

    // Verify ownership (user can only upload their own media)
    if (userId !== session.uid) {
      return NextResponse.json({
        error: 'Unauthorized: Cannot upload media for other users'
      }, { status: 403 })
    }

    // Validate file size (50MB per file)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 50MB)`
      }, { status: 413 })
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(filename)

    // Construct storage path
    const storagePath = `anki-media/${userId}/${deckId}/${sanitizedFilename}`

    // Convert Blob to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Firebase Storage via Admin SDK
    const bucket = adminStorage.bucket()
    const fileRef = bucket.file(storagePath)

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000', // 1 year (immutable media)
        metadata: {
          userId,
          deckId,
          originalFilename: filename,
          uploadedAt: new Date().toISOString()
        }
      }
    })

    // Get public download URL
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2500' // Far future date for permanent public access
    })

    // Create Firestore metadata entry for quota tracking
    // Path: users/{userId}/ankiDecks/{deckId}/media/{filename}
    if (adminDb) {
      try {
        await adminDb
          .collection('users').doc(userId)
          .collection('ankiDecks').doc(deckId)
          .collection('media').doc(sanitizedFilename)
          .set({
            filename: sanitizedFilename,
            originalFilename: filename,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
            userId,
            deckId,
            firebaseUrl: url,
            storagePath,
            uploadedAt: new Date(),
            syncStatus: 'synced'
          })

        console.log(`[Media Upload API] ✓ Created metadata for: ${sanitizedFilename}`)
      } catch (metadataError: any) {
        console.error(`[Media Upload API] Failed to create metadata:`, metadataError)
        // Don't fail the upload if metadata creation fails
      }
    }

    console.log(`[Media Upload API] ✓ Uploaded: ${sanitizedFilename} (${file.size} bytes)`)

    return NextResponse.json({
      success: true,
      downloadURL: url,
      storagePath,
      size: file.size
    })

  } catch (error: any) {
    console.error('[Media Upload API] Error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Sanitize filename to prevent path traversal and invalid characters
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and traversal patterns
  let sanitized = filename.replace(/\.\./g, '').replace(/[/\\]/g, '-')

  // Remove invalid characters for Firebase Storage
  sanitized = sanitized.replace(/[#[\]*?]/g, '')

  // Remove Windows reserved characters
  sanitized = sanitized.replace(/[<>:"|]/g, '')

  // Remove leading/trailing whitespace and dots
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '')

  if (!sanitized) {
    throw new Error('Invalid filename: empty after sanitization')
  }

  return sanitized
}
