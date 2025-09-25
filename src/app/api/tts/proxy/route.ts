/**
 * TTS Audio Proxy Route
 *
 * This route acts as a proxy for Firebase Storage audio files,
 * solving CORS issues by serving the audio through our own domain.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import logger from '@/lib/monitoring/logger'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session?.uid) {
      console.log('[TTS Proxy] No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[TTS Proxy] Request from user:', session.uid)

    // Get the audio URL from query params
    const searchParams = request.nextUrl.searchParams
    const audioUrl = searchParams.get('url')

    if (!audioUrl) {
      console.log('[TTS Proxy] No audio URL provided')
      return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 })
    }

    console.log('[TTS Proxy] Proxying audio URL:', audioUrl)

    // Validate that it's a Firebase Storage URL
    if (!audioUrl.includes('firebasestorage.app') && !audioUrl.includes('storage.googleapis.com')) {
      console.log('[TTS Proxy] Invalid URL domain')
      return NextResponse.json({ error: 'Invalid audio URL' }, { status: 400 })
    }

    // Fetch the audio from Firebase Storage
    console.log('[TTS Proxy] Fetching from Firebase Storage...')
    const audioResponse = await fetch(audioUrl)

    if (!audioResponse.ok) {
      logger.error('[TTS Proxy] Failed to fetch audio:', {
        url: audioUrl,
        status: audioResponse.status,
        statusText: audioResponse.statusText
      })
      return NextResponse.json(
        { error: 'Failed to fetch audio' },
        { status: audioResponse.status }
      )
    }

    // Get the audio data
    const audioBuffer = await audioResponse.arrayBuffer()

    // Create response with proper headers
    const response = new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })

    return response

  } catch (error) {
    logger.error('[TTS Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy audio' },
      { status: 500 }
    )
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}