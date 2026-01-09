import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db, storage, initAdmin } from '@/lib/firebase/admin'
import { bookSummaryProcessor } from '@/lib/ai/processors/BookSummaryProcessor'
import { ImageProcessor } from '@/lib/ai/processors/ImageProcessor'
import { Book, BookDraft } from '@/types/book'
import { JLPTLevel } from '@/types/ai-story'
import { getStorage } from 'firebase-admin/storage'
import type { DocumentReference } from 'firebase-admin/firestore'
import { precomputeWordExplanations } from '@/lib/ai/precompute/wordPrecompute'
import { preGenerateBookSentences } from '@/lib/ai/utils/sentencePreGenerator'
import OpenAI from 'openai'

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
    const { draftId: existingDraftId, bookName, author, jlptLevel, additionalContext, coverImageUrl, generateCover } = body

    // Validate input
    if (!bookName || !jlptLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: bookName and jlptLevel' },
        { status: 400 }
      )
    }

    // Use existing draft if provided, otherwise create new one
    let draftRef: DocumentReference
    let draftId: string

    if (existingDraftId) {
      // Use existing draft (created by init-draft endpoint)
      draftRef = db.collection('book_drafts').doc(existingDraftId)
      draftId = existingDraftId

      // Update draft to generating status
      await draftRef.update({
        status: 'generating',
        'metadata.generationStep': 'content',
        'metadata.progress': 10,
      })

      console.log(`📋 [BookGeneration] Using existing draft: ${draftId}`)
    } else {
      // Create new draft document (backward compatibility)
      draftRef = db.collection('book_drafts').doc()
      draftId = draftRef.id

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
      console.log(`📋 [BookGeneration] Created new draft: ${draftId}`)
    }

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

    // Validate translation - generate separately if AI omits it (following story pattern)
    let translation = result.data.translation
    if (!translation && result.data.content) {
      console.warn('[BookGeneration] Translation missing from AI response, generating separately...')
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
        })

        const translationResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                "You are a Japanese-English translator. Translate the following Japanese narrative to natural, fluent English. Preserve the story's flow, emotion, and paragraph structure. Return ONLY the English translation, nothing else.",
            },
            { role: 'user', content: result.data.content },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        })

        translation = translationResponse.choices[0]?.message?.content?.trim() || ''
        console.log(`[BookGeneration] Fallback translation generated (${translation.length} chars)`)
      } catch (translationError) {
        console.error('[BookGeneration] Translation fallback failed:', translationError)
        // Continue without translation - will use AI fallback at read time
      }
    } else if (translation) {
      console.log(`[BookGeneration] Translation from AI response (${translation.length} chars)`)
    }

    // Update draft with generated content
    const draftUpdate: any = {
      title: result.data.title,
      titleJa: result.data.titleJa,
      content: result.data.content,
      translation: translation || null,
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
    console.log(`\n🔊 [BookAudio] Starting TTS audio generation for book: ${draftId}`)
    console.log(`🔊 [BookAudio] Content length: ${result.data.content.length} characters`)

    // Update progress to audio step
    await draftRef.update({
      'metadata.generationStep': 'audio',
      'metadata.progress': 72,
    })

    try {
      // Call the correct TTS synthesize endpoint
      const ttsResponse = await fetch(`${request.nextUrl.origin}/api/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: result.data.content,
          language: 'ja',
          speed: 1.0,
        }),
      })

      if (ttsResponse.ok) {
        const ttsResult = await ttsResponse.json()

        // The synthesize endpoint returns { success, data: { audioUrl, cached, provider } }
        const audioUrl = ttsResult.data?.audioUrl || ttsResult.audioUrl
        const provider = ttsResult.data?.provider || ttsResult.provider || 'unknown'
        const cached = ttsResult.data?.cached || ttsResult.cached || false

        if (audioUrl) {
          console.log(`✅ [BookAudio] Audio generated successfully`)
          console.log(`   - Provider: ${provider}`)
          console.log(`   - Cached: ${cached}`)
          console.log(`   - URL: ${audioUrl.substring(0, 80)}...`)

          // Store audio URL in draft
          await draftRef.update({
            audioUrl: audioUrl,
            'metadata.audioCached': true,
            'metadata.audioGeneratedAt': new Date(),
            'metadata.audioStatus': 'success',
            'metadata.audioProvider': provider,
            'metadata.progress': 78,
          })
        } else {
          console.warn('⚠️ [BookAudio] TTS returned OK but no audioUrl in response')
          await draftRef.update({
            'metadata.audioStatus': 'failed',
            'metadata.audioError': 'No audioUrl in response',
            'metadata.progress': 78,
          })
        }
      } else {
        // TTS call failed
        const errorText = await ttsResponse.text().catch(() => 'Unknown error')
        console.error(`❌ [BookAudio] TTS generation failed with status ${ttsResponse.status}`)
        console.error(`   - Error: ${errorText.substring(0, 200)}`)

        await draftRef.update({
          'metadata.audioStatus': 'failed',
          'metadata.audioError': `TTS failed: ${ttsResponse.status} - ${errorText.substring(0, 100)}`,
          'metadata.progress': 78,
        })
      }
    } catch (audioError) {
      console.error('❌ [BookAudio] Exception during audio generation:', audioError)

      await draftRef.update({
        'metadata.audioStatus': 'failed',
        'metadata.audioError': audioError instanceof Error ? audioError.message : 'Unknown error',
        'metadata.progress': 78,
      })
      // Continue without audio - can be generated later via backfill
    }

    // Step 4: Generate word explanations (pre-cache for instant lookups)
    console.log(`\n🔤 [BookGeneration] Starting word explanation pre-generation...`)

    try {
      await draftRef.update({
        'metadata.generationStep': 'words',
        'metadata.progress': 80,
        'metadata.wordProgress': { current: 0, total: 1000 },
      })

      // Use modern precompute system with increased limit (1000 words)
      const wordResult = await precomputeWordExplanations({
        contentId: draftId,
        contentType: 'book',
        text: result.data.content,
        limit: 1000, // Increased from 50 to 1000
        jlptLevel: jlptLevel as JLPTLevel,
        // Progress callback - maintains UI compatibility
        onProgress: async (current, total, word, status) => {
          // Calculate progress: 80% + (current/total * 15%) = up to 95%
          const stepProgress = 80 + Math.round((current / total) * 15)

          try {
            await draftRef.update({
              'metadata.progress': stepProgress,
              'metadata.wordProgress': { current, total, currentWord: word, lastStatus: status },
            })
          } catch (updateError) {
            console.warn(`[BookGeneration] Failed to update word progress: ${current}/${total}`)
          }
        }
      })

      await draftRef.update({
        'metadata.wordExplanationsCached': true,
        'metadata.wordExplanationsCount': wordResult.total,
        'metadata.wordExplanationsGeneratedAt': new Date().toISOString(),
        'metadata.progress': 95,
        'metadata.wordProgress': null,
      })

      console.log(`✅ [BookGeneration] Word explanations complete:`, {
        total: wordResult.total,
        generated: wordResult.generated,
        cached: wordResult.cached,
        skipped: wordResult.skipped,
      })
    } catch (wordError) {
      console.error('❌ [BookGeneration] Error generating word explanations:', wordError)
      await draftRef.update({ 'metadata.wordProgress': null })
    }

    // Step 5: Generate sentence-level audio and translations (pre-cache)
    console.log(`\n📝 [BookGeneration] Starting sentence-level pre-generation...`)

    try {
      await draftRef.update({
        'metadata.generationStep': 'sentences',
        'metadata.progress': 96,
      })

      const baseUrl = request.nextUrl.origin

      await preGenerateBookSentences(
        draftId,
        result.data.content,
        baseUrl,
        async (current, total) => {
          // Calculate progress: 96% + (current/total * 3%) = up to 99%
          const stepProgress = 96 + Math.round((current / total) * 3)
          try {
            await draftRef.update({
              'metadata.progress': stepProgress,
              'metadata.sentenceProgress': { current, total },
            })
          } catch (updateError) {
            // Non-critical
          }
        }
      )

      await draftRef.update({
        'metadata.sentencesCached': true,
        'metadata.sentenceProgress': null,
      })

      console.log(`✅ [BookGeneration] Sentence pre-generation complete`)
    } catch (sentenceError) {
      console.error('❌ [BookGeneration] Error generating sentences:', sentenceError)
      // Continue without sentences - can be generated on-demand
      console.log('⚠️ [BookGeneration] Continuing without pre-cached sentences')

      await draftRef.update({
        'metadata.sentenceProgress': null,
      })
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
