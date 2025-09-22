import { NextRequest, NextResponse } from 'next/server'

const WANIKANI_API_BASE = 'https://api.wanikani.com/v2'
const WANIKANI_TOKEN = process.env.WANIKANI_API_TOKEN || process.env.NEXT_PUBLIC_WANIKANI_API_TOKEN || ''

export async function GET(request: NextRequest) {
  try {
    // Check if API token is available
    if (!WANIKANI_TOKEN) {
      console.error('[WaniKani Proxy] No API token configured')
      return NextResponse.json(
        { error: 'WaniKani API token not configured' },
        { status: 503 }
      )
    }

    // Get the endpoint from query params
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint') || 'subjects'

    // Remove the endpoint param and build the query string for WaniKani
    const wanikaniParams = new URLSearchParams()
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        wanikaniParams.append(key, value)
      }
    })

    const queryString = wanikaniParams.toString()

    // Build the WaniKani API URL
    const wanikaniUrl = `${WANIKANI_API_BASE}/${endpoint}${queryString ? '?' + queryString : ''}`

    console.log('[WaniKani Proxy] Fetching:', wanikaniUrl)
    console.log('[WaniKani Proxy] Query params:', queryString)

    // Make the request to WaniKani API
    const response = await fetch(wanikaniUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WANIKANI_TOKEN}`,
        'Wanikani-Revision': '20170710',
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[WaniKani Proxy] API Error:', response.status, errorText)
      return NextResponse.json(
        { error: `WaniKani API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Validate the response has the expected structure
    if (!data || typeof data !== 'object') {
      console.error('[WaniKani Proxy] Invalid response structure')
      return NextResponse.json(
        { error: 'Invalid response from WaniKani API' },
        { status: 500 }
      )
    }

    // Log what we're returning for debugging
    if (data.data && Array.isArray(data.data)) {
      console.log(`[WaniKani Proxy] Returning ${data.data.length} results`)
      if (data.data.length > 0) {
        console.log('[WaniKani Proxy] First result:', data.data[0]?.data?.characters || data.data[0]?.data?.slug)
        // Log if we're getting the same mock data repeatedly
        const firstChars = data.data.slice(0, 4).map(item => item.data?.characters || item.data?.slug).join(', ')
        console.log('[WaniKani Proxy] First 4 results:', firstChars)

        // Check if this looks like mock data
        if (firstChars.includes('一') || firstChars.includes('one')) {
          console.warn('[WaniKani Proxy] WARNING: Response contains number words that may be mock data')
          console.log('[WaniKani Proxy] Full URL requested:', wanikaniUrl)
          console.log('[WaniKani Proxy] Token being used:', WANIKANI_TOKEN ? `${WANIKANI_TOKEN.substring(0, 8)}...` : 'NO TOKEN')
        }
      }
    }

    // Return the data with proper CORS headers
    // Use longer cache for vocabulary fetches (30 minutes for bulk fetches)
    const isVocabularyFetch = endpoint === 'subjects' && searchParams.get('types') === 'vocabulary' && searchParams.get('levels')
    const cacheControl = isVocabularyFetch
      ? 'public, max-age=1800' // 30 minutes for vocabulary bulk fetches
      : 'public, max-age=300'   // 5 minutes for regular searches

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': cacheControl,
      }
    })

  } catch (error) {
    console.error('[WaniKani Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from WaniKani API' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpoint, ...params } = body

    // Build the WaniKani API URL
    const wanikaniUrl = `${WANIKANI_API_BASE}/${endpoint || 'subjects'}`

    console.log('[WaniKani Proxy] POST to:', wanikaniUrl)

    // Make the request to WaniKani API
    const response = await fetch(wanikaniUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WANIKANI_TOKEN}`,
        'Wanikani-Revision': '20170710',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[WaniKani Proxy] API Error:', response.status, errorText)
      return NextResponse.json(
        { error: `WaniKani API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data)

  } catch (error) {
    console.error('[WaniKani Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from WaniKani API' },
      { status: 500 }
    )
  }
}