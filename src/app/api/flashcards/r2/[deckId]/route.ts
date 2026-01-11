import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function isValidR2Key(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false
  if (key.startsWith('/')) return false
  if (key.includes('..')) return false
  if (key.includes('\\')) return false
  return true
}

// GET - Download URLs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    // 1. Authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Premium check
    const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])
    const db = getAdminDb()

    let userDoc
    try {
      userDoc = await db.collection('users').doc(session.uid).get()
    } catch (error) {
      console.error('[download] Error fetching user document:', error)
      return NextResponse.json({ error: 'Failed to verify user status' }, { status: 500 })
    }

    const plan = userDoc.data()?.subscription?.plan

    if (!plan || !PREMIUM_PLANS.has(plan)) {
      return NextResponse.json({
        error: 'Premium subscription required for R2 downloads'
      }, { status: 403 })
    }

    // 3. Get deck metadata
    const { deckId } = await params

    let metadataDoc
    try {
      metadataDoc = await db.collection('userFlashcardDecks').doc(deckId).get()
    } catch (error) {
      console.error('[download] Error fetching deck metadata:', error)
      return NextResponse.json({ error: 'Failed to fetch deck metadata' }, { status: 500 })
    }

    if (!metadataDoc.exists || metadataDoc.data()?.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const metadata = metadataDoc.data()!
    const prefix = `users/${session.uid}/flashcards/${deckId}/`
    if (
      !metadata.r2?.cardsKey ||
      !metadata.r2?.manifestKey ||
      !metadata.r2?.mediaPrefix ||
      !isValidR2Key(metadata.r2.cardsKey, prefix) ||
      !isValidR2Key(metadata.r2.manifestKey, prefix) ||
      !isValidR2Key(metadata.r2.mediaPrefix, prefix)
    ) {
      return NextResponse.json({ error: 'Invalid R2 key prefix' }, { status: 400 })
    }

    // 4. Generate R2 download URLs
    let client, bucket
    try {
      const r2Config = getR2Config()
      client = r2Config.client
      bucket = r2Config.bucket
    } catch (error) {
      console.error('[download] Error getting R2 config:', error)
      return NextResponse.json({ error: 'Failed to configure R2 client' }, { status: 500 })
    }

    // Generate presigned download URLs (1 hour expiry)
    let cardsUrl, manifestUrl
    try {
      cardsUrl = await getSignedUrl(client, new GetObjectCommand({
        Bucket: bucket,
        Key: metadata.r2.cardsKey
      }), { expiresIn: 3600 })

      manifestUrl = await getSignedUrl(client, new GetObjectCommand({
        Bucket: bucket,
        Key: metadata.r2.manifestKey
      }), { expiresIn: 3600 })
    } catch (error) {
      console.error('[download] Error generating presigned URLs:', error)
      return NextResponse.json({ error: 'Failed to generate download URLs' }, { status: 500 })
    }

    // List media files
    let mediaFiles
    try {
      mediaFiles = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: metadata.r2.mediaPrefix
      }))
    } catch (error) {
      console.error('[download] Error listing media files:', error)
      return NextResponse.json({ error: 'Failed to list media files' }, { status: 500 })
    }

    // Generate presigned URLs for media files
    let mediaUrls
    try {
      mediaUrls = await Promise.all(
        (mediaFiles.Contents || []).map(async (file) => {
          const url = await getSignedUrl(client, new GetObjectCommand({
            Bucket: bucket,
            Key: file.Key!
          }), { expiresIn: 3600 })

          return {
            filename: file.Key!.split('/').pop()!,
            url,
            size: file.Size!
          }
        })
      )
    } catch (error) {
      console.error('[download] Error generating media URLs:', error)
      return NextResponse.json({ error: 'Failed to generate media download URLs' }, { status: 500 })
    }

    return NextResponse.json({
      metadata,
      downloadUrls: {
        cards: cardsUrl,
        manifest: manifestUrl,
        media: mediaUrls
      }
    })
  } catch (error) {
    console.error('[download] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove deck
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    // 1. Authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Premium check (deletion requires premium since it's an R2 operation)
    const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])
    const db = getAdminDb()

    let userDoc
    try {
      userDoc = await db.collection('users').doc(session.uid).get()
    } catch (error) {
      console.error('[delete] Error fetching user document:', error)
      return NextResponse.json({ error: 'Failed to verify user status' }, { status: 500 })
    }

    const plan = userDoc.data()?.subscription?.plan

    if (!plan || !PREMIUM_PLANS.has(plan)) {
      return NextResponse.json({
        error: 'Premium subscription required for R2 operations'
      }, { status: 403 })
    }

    // 3. Get deck metadata
    const { deckId } = await params

    let metadataDoc
    try {
      metadataDoc = await db.collection('userFlashcardDecks').doc(deckId).get()
    } catch (error) {
      console.error('[delete] Error fetching deck metadata:', error)
      return NextResponse.json({ error: 'Failed to fetch deck metadata' }, { status: 500 })
    }

    if (!metadataDoc.exists || metadataDoc.data()?.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const metadata = metadataDoc.data()!

    // 4. Get R2 client
    let client, bucket
    try {
      const r2Config = getR2Config()
      client = r2Config.client
      bucket = r2Config.bucket
    } catch (error) {
      console.error('[delete] Error getting R2 config:', error)
      return NextResponse.json({ error: 'Failed to configure R2 client' }, { status: 500 })
    }

    // 5. Delete all R2 objects
    let objects
    try {
      objects = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `users/${session.uid}/flashcards/${deckId}/`
      }))
    } catch (error) {
      console.error('[delete] Error listing R2 objects:', error)
      return NextResponse.json({ error: 'Failed to list R2 objects for deletion' }, { status: 500 })
    }

    if (objects.Contents && objects.Contents.length > 0) {
      try {
        await Promise.all(
          objects.Contents.map(obj =>
            client.send(new DeleteObjectCommand({
              Bucket: bucket,
              Key: obj.Key!
            }))
          )
        )
      } catch (error) {
        console.error('[delete] Error deleting R2 objects:', error)
        return NextResponse.json({ error: 'Failed to delete R2 objects' }, { status: 500 })
      }
    }

    // 6. Delete Firestore metadata
    try {
      await db.collection('userFlashcardDecks').doc(deckId).delete()
    } catch (error) {
      console.error('[delete] Error deleting Firestore metadata:', error)
      return NextResponse.json({ error: 'Failed to delete deck metadata' }, { status: 500 })
    }

    // 7. Update R2 usage
    try {
      await db.collection('r2Usage').doc(session.uid).set({
        totalBytes: FieldValue.increment(-metadata.totalBytes),
        lastUpdated: FieldValue.serverTimestamp()
      }, { merge: true })
    } catch (error) {
      console.error('[delete] Error updating R2 usage:', error)
      // Non-fatal - deck already deleted
    }

    return NextResponse.json({
      success: true,
      deletedFiles: objects.Contents?.length || 0
    })
  } catch (error) {
    console.error('[delete] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
