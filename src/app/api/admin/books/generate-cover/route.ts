import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db, initAdmin } from '@/lib/firebase/admin'
import { ImageProcessor } from '@/lib/ai/processors/ImageProcessor'
import { getStorage } from 'firebase-admin/storage'

// Initialize Firebase Admin
initAdmin()

/**
 * POST /api/admin/books/generate-cover
 * Generate a cover image for an existing book using DALL-E 3
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
    const { bookId, bookName, titleJa, category } = body

    // Validate input
    if (!bookId || !bookName) {
      return NextResponse.json(
        { error: 'Missing required fields: bookId and bookName' },
        { status: 400 }
      )
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured for AI cover generation' },
        { status: 500 }
      )
    }

    console.log(`🎨 Generating AI cover for existing book: ${bookName} (${bookId})`)

    // Create image processor
    const imageProcessor = new ImageProcessor({
      model: 'dall-e-3',
      config: {
        timeout: 60000,
        maxRetries: 2,
      },
      userId: session.uid,
    })

    // Build a descriptive prompt for the book cover
    const coverPrompt = `Create a beautiful, professional book cover illustration for a Japanese language learning book.

Book title: "${bookName}"${titleJa ? ` (${titleJa})` : ''}
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
      throw new Error('No image URL returned from DALL-E')
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
          userId: session.uid,
        },
      },
    })

    // Make the file publicly accessible
    await file.makePublic()

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${firebaseStorage.bucket().name}/${fileName}`

    console.log(`✅ Cover uploaded to Firebase: ${publicUrl}`)

    // Update both books and book_drafts collections
    const updateData = {
      coverImageUrl: publicUrl,
      'metadata.coverGenerated': true,
      'metadata.coverGeneratedAt': new Date().toISOString(),
    }

    // Try to update the published book
    const bookRef = db.collection('books').doc(bookId)
    const bookDoc = await bookRef.get()
    if (bookDoc.exists) {
      await bookRef.update(updateData)
      console.log(`✅ Updated published book with new cover`)
    }

    // Also try to update the draft
    const draftRef = db.collection('book_drafts').doc(bookId)
    const draftDoc = await draftRef.get()
    if (draftDoc.exists) {
      await draftRef.update(updateData)
      console.log(`✅ Updated book draft with new cover`)
    }

    return NextResponse.json({
      success: true,
      coverImageUrl: publicUrl,
      message: 'Cover generated and saved successfully',
    })
  } catch (error) {
    console.error('❌ Error generating book cover:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate book cover',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
