import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side handwriting verification using Google Vision.
 * Expects { imageDataUrl: string } where imageDataUrl is a PNG data URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { imageDataUrl } = body || {}

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return NextResponse.json({ success: false, error: 'imageDataUrl required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_VISION_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'VISION_API_KEY_MISSING' }, { status: 500 })
    }

    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')

    const visionResp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: {
                languageHints: ['ja'],
              },
            },
          ],
        }),
      }
    )

    if (!visionResp.ok) {
      const details = await visionResp.text()
      return NextResponse.json(
        { success: false, error: 'VISION_REQUEST_FAILED', details },
        { status: 502 }
      )
    }

    const json = await visionResp.json()
    const annotation = json?.responses?.[0]?.fullTextAnnotation
    const text: string = annotation?.text || ''
    const candidates =
      text
        ?.replace(/\s+/g, '')
        ?.split('')
        ?.filter(Boolean) || []

    return NextResponse.json({
      success: true,
      candidates,
      rawText: text,
    })
  } catch (err) {
    console.error('[DrawingRecognition] unexpected error', err)
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
