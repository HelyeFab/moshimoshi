import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db, storage, initAdmin } from '@/lib/firebase/admin'
import { bookSummaryProcessor } from '@/lib/ai/processors/BookSummaryProcessor'
import { ImageProcessor } from '@/lib/ai/processors/ImageProcessor'
import { Book, BookDraft } from '@/types/book'
import { JLPTLevel } from '@/types/ai-story'
import { getStorage } from 'firebase-admin/storage'

// Initialize Firebase Admin
initAdmin()

/**
 * Generate a book cover using DALL-E 3 and upload to Firebase Storage
 */
async function generateBookCover(
  bookName: string,
  titleJa: string,
  category: string | undefined,
  bookId: string,
  userId: string
): Promise<string | null> {
  try {
    console.log(`🎨 Generating AI cover for: ${bookName}`)

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_API_KEY) {
      console.warn('⚠️ OpenAI API key not configured, skipping cover generation')
      return null
    }

    // Create image processor
    const imageProcessor = new ImageProcessor({
      model: 'dall-e-3',
      config: {
        timeout: 60000,
        maxRetries: 2,
      },
      userId,
    })

    // Build a descriptive prompt for the book cover
    const coverPrompt = `Create a beautiful, professional book cover illustration for a Japanese language learning book.

Book title: "${bookName}" (${titleJa})
Genre: ${category || 'general literature'}

Style requirements:
- Modern, minimalist book cover design
- Elegant and sophisticated aesthetics
- Subtle Japanese cultural elements (cherry blossoms, mountains, or abstract patterns)
- Clean typography-friendly composition (leave space for title at top)
- Soft, warm color palette appropriate for the genre
- No text or letters - just the visual design
- Portrait orientation (book cover aspect ratio)
- Safe for all ages, professional appearance`

    // Generate the image
    const result = await imageProcessor.process({
      prompt: coverPrompt,
      size: '1024x1792', // Portrait for book covers
      quality: 'standard',
      style: 'vivid',
    })

    if (!result.data?.imageUrl) {
      console.warn('⚠️ No image URL returned from DALL-E')
      return null
    }

    console.log(`✅ Cover image generated, uploading to Firebase Storage...`)

    // Fetch the image from OpenAI's temporary URL
    const imageResponse = await fetch(result.data.imageUrl)
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch generated image')
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Upload to Firebase Storage
    const firebaseStorage = getStorage()
    const fileName = `books/covers/${bookId}-cover-${Date.now()}.png`
    const file = firebaseStorage.bucket().file(fileName)

    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          originalPrompt: coverPrompt,
          generatedBy: 'dall-e-3',
          generatedAt: new Date().toISOString(),
          bookId,
          userId,
        },
      },
    })

    // Make the file publicly accessible
    await file.makePublic()

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${firebaseStorage.bucket().name}/${fileName}`

    console.log(`✅ Cover uploaded to Firebase: ${publicUrl}`)
    return publicUrl
  } catch (error) {
    console.error('❌ Error generating book cover:', error)
    return null
  }
}

/**
 * POST /api/admin/books/generate
 * Generate a condensed book summary using AI
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
    const { bookName, author, jlptLevel, additionalContext, coverImageUrl, generateCover } = body

    // Validate input
    if (!bookName || !jlptLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: bookName and jlptLevel' },
        { status: 400 }
      )
    }

    // Create draft document
    const draftRef = db.collection('book_drafts').doc()
    const draftId = draftRef.id

    const draft: BookDraft = {
      id: draftId,
      bookName,
      author,
      jlptLevel: jlptLevel as JLPTLevel,
      status: 'generating',
      createdAt: new Date().toISOString(),
      createdBy: session.uid,
      metadata: {
        generationStep: 'content',
        progress: 10,
      },
    }

    await draftRef.set(draft)

    // Step 1: Generate book summary content
    console.log(`📚 Generating book summary for: ${bookName}`)

    const bookRequest = {
      bookName,
      author,
      jlptLevel: jlptLevel as JLPTLevel,
      additionalContext,
    }

    const result = await bookSummaryProcessor.process(bookRequest, {
      model: 'gpt-4o-mini',
      userId: session.uid,
      config: {
        timeout: 120000, // 2 minutes
        maxRetries: 2,
        temperature: 0.7,
      },
    })

    console.log('📖 BookSummaryProcessor result:', {
      hasData: !!result.data,
      title: result.data?.title,
      titleJa: result.data?.titleJa,
      contentLength: result.data?.content?.length,
      summaryLength: result.data?.summary?.length,
      category: result.data?.category,
      author: result.data?.author || 'Not provided by AI',
      authorSource: result.data?.author && !author ? 'AI-generated' : 'User-provided',
    })

    if (!result.data) {
      throw new Error('Failed to generate book summary')
    }

    if (
      !result.data.title ||
      !result.data.titleJa ||
      !result.data.content ||
      !result.data.summary
    ) {
      console.error('❌ BookSummaryProcessor returned incomplete data:', result.data)
      throw new Error('AI generated incomplete book summary. Please try again.')
    }

    // Update draft with generated content
    const draftUpdate: any = {
      title: result.data.title,
      titleJa: result.data.titleJa,
      content: result.data.content,
      summary: result.data.summary,
      'metadata.generationStep': 'cover',
      'metadata.progress': 50,
    }

    // Add optional fields only if they exist
    if (result.data.category) draftUpdate.category = result.data.category
    if (coverImageUrl) draftUpdate.coverImageUrl = coverImageUrl
    // Use AI-provided author if user didn't specify one
    if (result.data.author && !author) {
      draftUpdate.author = result.data.author
      console.log(`✍️ AI provided author: ${result.data.author}`)
    } else if (author) {
      draftUpdate.author = author
      console.log(`✍️ Using user-provided author: ${author}`)
    }

    await draftRef.update(draftUpdate)

    // Step 2: Generate AI cover image if requested (and no cover was uploaded)
    let finalCoverUrl = coverImageUrl
    if (generateCover && !coverImageUrl) {
      console.log(`🎨 Generating AI cover for: ${bookName}`)
      await draftRef.update({
        'metadata.generationStep': 'cover',
        'metadata.progress': 60,
      })

      try {
        const generatedCoverUrl = await generateBookCover(
          bookName,
          result.data.titleJa,
          result.data.category,
          draftId,
          session.uid
        )

        if (generatedCoverUrl) {
          finalCoverUrl = generatedCoverUrl
          await draftRef.update({
            coverImageUrl: generatedCoverUrl,
            'metadata.coverGenerated': true,
            'metadata.progress': 70,
          })
          console.log(`✅ AI cover generated and saved`)
        } else {
          console.warn('⚠️ AI cover generation returned null, continuing without cover')
        }
      } catch (coverError) {
        console.error('❌ Error generating AI cover:', coverError)
        // Continue without cover - not critical
      }
    }

    // Step 3: Generate TTS audio (pre-cache)
    console.log(`🔊 Pre-generating TTS audio for book: ${draftId}`)

    try {
      const ttsResponse = await fetch(`${request.nextUrl.origin}/api/tts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: result.data.content,
          language: 'ja',
          cacheKey: `book_${draftId}`,
        }),
      })

      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json()

        // Upload audio to Firebase Storage
        if (ttsData.audioUrl) {
          const audioPath = `books/${draftId}/audio.mp3`

          // Store audio URL in draft
          await draftRef.update({
            audioUrl: ttsData.audioUrl,
            'metadata.audioCached': true,
            'metadata.audioGeneratedAt': new Date(),
          })
        }
      } else {
        console.warn('TTS generation failed, continuing without audio')
      }
    } catch (audioError) {
      console.error('Error generating audio:', audioError)
      // Continue without audio - can be generated later
    }

    // Update progress
    await draftRef.update({
      'metadata.generationStep': 'complete',
      'metadata.progress': 100,
      status: 'draft',
    })

    // Get final draft
    const finalDraft = await draftRef.get()

    return NextResponse.json({
      success: true,
      draftId,
      data: {
        id: finalDraft.id,
        ...finalDraft.data(),
      },
    })
  } catch (error) {
    console.error('Error generating book:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate book',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
