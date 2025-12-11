import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'buffer'
import { KokoroProvider } from '@/lib/tts/providers/kokoro'
import { EdgeTTSProvider } from '@/lib/tts/providers/edge-tts'

// Lightweight TTS endpoint for playground usage.
// No Firestore/Storage writes; returns data URL.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const text = (body?.text || '').toString()
    const voice = (body?.voice || '23').toString()
    const speed = Math.max(0.5, Math.min(1.5, Number(body?.speed) || 0.85))
    const pitch = Number.isFinite(body?.pitch) ? Number(body.pitch) : -5

    if (!text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text too long (max 5000 chars)' }, { status: 400 })
    }

    let providerUsed: 'kokoro' | 'edge-tts' = 'kokoro'
    let audioBuffer: ArrayBuffer

    try {
      const kokoro = new KokoroProvider()
      const result = await kokoro.synthesize(text, { voice, speed, pitch })
      audioBuffer = result.audioContent
    } catch (err) {
      console.warn('[TTS demo] Kokoro failed, falling back to Edge:', err)
      providerUsed = 'edge-tts'
      const edge = new EdgeTTSProvider()
      const result = await edge.synthesize(text, { voice, speed, pitch })
      audioBuffer = result.audioContent
    }

    const base64 = Buffer.from(audioBuffer).toString('base64')
    const audioUrl = `data:audio/mpeg;base64,${base64}`

    return NextResponse.json({
      data: {
        audioUrl,
        provider: providerUsed,
        cached: false,
        duration: undefined,
        cacheKey: 'demo',
      },
    })
  } catch (error: any) {
    console.error('[TTS demo] error:', error)
    return NextResponse.json(
      { error: error?.message || 'TTS demo failed' },
      { status: 500 }
    )
  }
}
