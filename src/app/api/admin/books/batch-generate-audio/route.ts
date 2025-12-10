import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db, initAdmin } from '@/lib/firebase/admin'

// Initialize Firebase Admin
initAdmin()

interface BatchResult {
  bookId: string
  bookName: string
  success: boolean
  audioUrl?: string
  error?: string
  skipped?: boolean
}

/**
 * POST /api/admin/books/batch-generate-audio
 * Generate TTS audio for multiple books
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
    const { bookIds, all = false, force = false } = body

    console.log(`\n🔊 [BatchBookAudio] Starting batch audio generation`)
    console.log(`   - Book IDs provided: ${bookIds?.length || 0}`)
    console.log(`   - Process all without audio: ${all}`)
    console.log(`   - Force regenerate: ${force}`)

    // Get books to process
    let booksToProcess: { id: string; data: any; collection: string }[] = []

    if (all) {
      // Get all books without audioUrl
      const booksSnapshot = await db.collection('books').get()
      const draftsSnapshot = await db.collection('book_drafts').get()

      booksSnapshot.docs.forEach(doc => {
        const data = doc.data()
        if (!data.audioUrl || force) {
          booksToProcess.push({ id: doc.id, data, collection: 'books' })
        }
      })

      draftsSnapshot.docs.forEach(doc => {
        const data = doc.data()
        if (data.status === 'published' && (!data.audioUrl || force)) {
          // Only process published drafts that don't already have audio
          if (!booksToProcess.some(b => b.id === doc.id)) {
            booksToProcess.push({ id: doc.id, data, collection: 'book_drafts' })
          }
        }
      })

      console.log(`📚 [BatchBookAudio] Found ${booksToProcess.length} books without audio`)
    } else if (bookIds && Array.isArray(bookIds)) {
      // Process specific book IDs
      for (const bookId of bookIds) {
        let doc = await db.collection('books').doc(bookId).get()
        let collection = 'books'

        if (!doc.exists) {
          doc = await db.collection('book_drafts').doc(bookId).get()
          collection = 'book_drafts'
        }

        if (doc.exists) {
          const data = doc.data()!
          if (!data.audioUrl || force) {
            booksToProcess.push({ id: doc.id, data, collection })
          } else {
            console.log(`⚠️ [BatchBookAudio] Book ${bookId} already has audio, skipping`)
          }
        } else {
          console.warn(`⚠️ [BatchBookAudio] Book ${bookId} not found`)
        }
      }
    } else {
      return NextResponse.json({
        error: 'Must provide either bookIds array or all=true',
      }, { status: 400 })
    }

    if (booksToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No books need audio generation',
        results: [],
        summary: { total: 0, success: 0, failed: 0, skipped: 0 },
      })
    }

    console.log(`🚀 [BatchBookAudio] Processing ${booksToProcess.length} books...`)

    // Process books sequentially to avoid rate limiting
    const results: BatchResult[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (let i = 0; i < booksToProcess.length; i++) {
      const book = booksToProcess[i]
      const progress = `[${i + 1}/${booksToProcess.length}]`

      console.log(`\n${progress} Processing: ${book.data.bookName || book.data.title || book.id}`)

      // Check if book has content
      if (!book.data.content) {
        console.warn(`   ⚠️ No content, skipping`)
        results.push({
          bookId: book.id,
          bookName: book.data.bookName || book.data.title || 'Unknown',
          success: false,
          skipped: true,
          error: 'No content',
        })
        skippedCount++
        continue
      }

      try {
        // Call TTS synthesize endpoint
        const ttsResponse = await fetch(`${request.nextUrl.origin}/api/tts/synthesize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: book.data.content,
            language: 'ja',
            speed: 1.0,
          }),
        })

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text().catch(() => 'Unknown error')
          console.error(`   ❌ TTS failed: ${ttsResponse.status}`)

          await db.collection(book.collection).doc(book.id).update({
            'metadata.audioStatus': 'failed',
            'metadata.audioError': `TTS failed: ${ttsResponse.status}`,
          })

          results.push({
            bookId: book.id,
            bookName: book.data.bookName || book.data.title || 'Unknown',
            success: false,
            error: `TTS failed: ${ttsResponse.status}`,
          })
          failedCount++
          continue
        }

        const ttsResult = await ttsResponse.json()
        const audioUrl = ttsResult.data?.audioUrl || ttsResult.audioUrl
        const provider = ttsResult.data?.provider || ttsResult.provider || 'unknown'

        if (!audioUrl) {
          console.error(`   ❌ No audioUrl in response`)

          await db.collection(book.collection).doc(book.id).update({
            'metadata.audioStatus': 'failed',
            'metadata.audioError': 'No audioUrl in response',
          })

          results.push({
            bookId: book.id,
            bookName: book.data.bookName || book.data.title || 'Unknown',
            success: false,
            error: 'No audioUrl in response',
          })
          failedCount++
          continue
        }

        console.log(`   ✅ Audio generated (${provider})`)

        // Update book with audio URL
        await db.collection(book.collection).doc(book.id).update({
          audioUrl: audioUrl,
          'metadata.audioCached': true,
          'metadata.audioGeneratedAt': new Date(),
          'metadata.audioStatus': 'success',
          'metadata.audioProvider': provider,
        })

        results.push({
          bookId: book.id,
          bookName: book.data.bookName || book.data.title || 'Unknown',
          success: true,
          audioUrl,
        })
        successCount++

        // Small delay between requests to avoid overwhelming TTS service
        if (i < booksToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.error(`   ❌ Exception:`, error)

        await db.collection(book.collection).doc(book.id).update({
          'metadata.audioStatus': 'failed',
          'metadata.audioError': error instanceof Error ? error.message : 'Unknown error',
        })

        results.push({
          bookId: book.id,
          bookName: book.data.bookName || book.data.title || 'Unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        failedCount++
      }
    }

    console.log(`\n🎉 [BatchBookAudio] Batch complete!`)
    console.log(`   - Success: ${successCount}`)
    console.log(`   - Failed: ${failedCount}`)
    console.log(`   - Skipped: ${skippedCount}`)

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: booksToProcess.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
      },
    })

  } catch (error) {
    console.error('❌ [BatchBookAudio] Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process batch',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
