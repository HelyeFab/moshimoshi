import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db, initAdmin } from '@/lib/firebase/admin'

// Initialize Firebase Admin
initAdmin()

/**
 * POST /api/admin/books/generate-audio
 * Generate or regenerate TTS audio for an existing book
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    // Verify admin status
    const userDoc = await db.collection('users').doc(session.uid).get()
    const isAdmin = userDoc.data()?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { bookId, force = false } = body

    if (!bookId) {
      return NextResponse.json({ error: 'Missing required field: bookId' }, { status: 400 })
    }

    console.log(`\n🔊 [BookAudio] Starting audio generation for book: ${bookId}`)
    console.log(`   - Force regenerate: ${force}`)

    // Fetch the book from Firestore (check both collections)
    let bookDoc = await db.collection('books').doc(bookId).get()
    let collection = 'books'

    if (!bookDoc.exists) {
      bookDoc = await db.collection('book_drafts').doc(bookId).get()
      collection = 'book_drafts'
    }

    if (!bookDoc.exists) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    const bookData = bookDoc.data()!

    // Check if audio already exists (unless force=true)
    if (bookData.audioUrl && !force) {
      console.log(`⚠️ [BookAudio] Book already has audio, skipping (use force=true to regenerate)`)
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Book already has audio',
        audioUrl: bookData.audioUrl,
      })
    }

    // Check if book has content
    if (!bookData.content) {
      return NextResponse.json({ error: 'Book has no content to generate audio from' }, { status: 400 })
    }

    console.log(`🔊 [BookAudio] Book content length: ${bookData.content.length} characters`)

    // Call TTS synthesize endpoint
    const ttsResponse = await fetch(`${request.nextUrl.origin}/api/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: bookData.content,
        language: 'ja',
        speed: 1.0,
      }),
    })

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text().catch(() => 'Unknown error')
      console.error(`❌ [BookAudio] TTS generation failed: ${ttsResponse.status}`)
      console.error(`   - Error: ${errorText.substring(0, 200)}`)

      // Update book with error status
      await db.collection(collection).doc(bookId).update({
        'metadata.audioStatus': 'failed',
        'metadata.audioError': `TTS failed: ${ttsResponse.status}`,
      })

      return NextResponse.json({
        success: false,
        error: `TTS generation failed: ${ttsResponse.status}`,
        details: errorText.substring(0, 200),
      }, { status: 500 })
    }

    const ttsResult = await ttsResponse.json()
    const audioUrl = ttsResult.data?.audioUrl || ttsResult.audioUrl
    const provider = ttsResult.data?.provider || ttsResult.provider || 'unknown'
    const cached = ttsResult.data?.cached || ttsResult.cached || false

    if (!audioUrl) {
      console.error('❌ [BookAudio] TTS returned OK but no audioUrl')

      await db.collection(collection).doc(bookId).update({
        'metadata.audioStatus': 'failed',
        'metadata.audioError': 'No audioUrl in TTS response',
      })

      return NextResponse.json({
        success: false,
        error: 'No audioUrl in TTS response',
      }, { status: 500 })
    }

    console.log(`✅ [BookAudio] Audio generated successfully`)
    console.log(`   - Provider: ${provider}`)
    console.log(`   - Cached: ${cached}`)
    console.log(`   - URL: ${audioUrl.substring(0, 80)}...`)

    // Update book with audio URL
    await db.collection(collection).doc(bookId).update({
      audioUrl: audioUrl,
      'metadata.audioCached': true,
      'metadata.audioGeneratedAt': new Date(),
      'metadata.audioStatus': 'success',
      'metadata.audioProvider': provider,
    })

    return NextResponse.json({
      success: true,
      bookId,
      audioUrl,
      provider,
      cached,
      message: 'Audio generated successfully',
    })

  } catch (error) {
    console.error('❌ [BookAudio] Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate audio',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
