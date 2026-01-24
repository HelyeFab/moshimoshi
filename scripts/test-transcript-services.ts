/**
 * YouTube Transcript Service Health Check
 * Tests all fallback providers individually
 *
 * Run with: npx tsx scripts/test-transcript-services.ts
 */

import axios from 'axios'
import { Innertube } from 'youtubei.js'
import { getSubtitles } from 'youtube-captions-scraper'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const VIDEO_ID = 'baQw2j-Wy9Y'

interface TestResult {
  service: string
  status: 'success' | 'failed' | 'skipped'
  message: string
  segmentCount?: number
  responseTime?: number
  error?: string
}

const results: TestResult[] = []

async function testYouTubeDataAPI(): Promise<TestResult> {
  const start = Date.now()
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    return { service: 'YouTube Data API', status: 'skipped', message: 'No API key configured' }
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/captions', {
      params: { part: 'snippet', videoId: VIDEO_ID, key: apiKey },
      timeout: 5000
    })

    const tracks = response.data.items || []
    const hasJapanese = tracks.some((t: any) => t.snippet.language === 'ja')

    return {
      service: 'YouTube Data API',
      status: 'success',
      message: `Found ${tracks.length} caption tracks. Japanese: ${hasJapanese ? 'Yes' : 'No'}`,
      responseTime: Date.now() - start
    }
  } catch (error: any) {
    return {
      service: 'YouTube Data API',
      status: 'failed',
      message: error.response?.data?.error?.message || error.message,
      error: error.response?.status?.toString(),
      responseTime: Date.now() - start
    }
  }
}

async function testSupaDataAI(): Promise<TestResult> {
  const start = Date.now()
  const apiKey = process.env.SUPA_YOUTUBE_API_KEY

  if (!apiKey) {
    return { service: 'SupaData AI', status: 'skipped', message: 'No API key configured' }
  }

  try {
    const response = await axios.get('https://api.supadata.ai/v1/transcript', {
      params: { url: `https://youtube.com/watch?v=${VIDEO_ID}`, lang: 'ja' },
      headers: { 'x-api-key': apiKey },
      timeout: 30000
    })

    const segmentCount = response.data.content?.length || 0

    return {
      service: 'SupaData AI',
      status: 'success',
      message: `Language: ${response.data.lang}, Available: ${response.data.availableLangs?.join(', ')}`,
      segmentCount,
      responseTime: Date.now() - start
    }
  } catch (error: any) {
    const status = error.response?.status
    let message = error.message

    if (status === 429) message = 'Rate limit exceeded (monthly quota)'
    else if (status === 401) message = 'Invalid API key'
    else if (status === 403) message = 'API key forbidden'
    else if (status === 404) message = 'No transcript found'

    return {
      service: 'SupaData AI',
      status: 'failed',
      message,
      error: status?.toString(),
      responseTime: Date.now() - start
    }
  }
}

async function testRailwayServer(): Promise<TestResult> {
  const start = Date.now()
  const url = 'https://modal-services-production.up.railway.app'

  try {
    const response = await axios.get(`${url}/get-japanese-transcript`, {
      params: { videoId: VIDEO_ID },
      timeout: 15000
    })

    return {
      service: 'Railway Server',
      status: response.data.available ? 'success' : 'failed',
      message: response.data.available
        ? `Japanese: ${response.data.isJapanese}, Title: ${response.data.title?.substring(0, 30)}...`
        : 'Transcript not available',
      segmentCount: response.data.segments?.length,
      responseTime: Date.now() - start
    }
  } catch (error: any) {
    return {
      service: 'Railway Server',
      status: 'failed',
      message: error.message,
      error: error.response?.status?.toString() || error.code,
      responseTime: Date.now() - start
    }
  }
}

async function testSheldonServer(): Promise<TestResult> {
  const start = Date.now()
  const apiKey = process.env.SHELDON_API_KEY
  const url = process.env.SHELDON_API_URL || 'https://api.selfmind.dev/transcript/api/youtube'

  if (!apiKey) {
    return { service: 'Sheldon Server', status: 'skipped', message: 'No API key configured' }
  }

  try {
    const response = await axios.get(`${url}/${VIDEO_ID}`, {
      headers: { 'X-API-Key': apiKey },
      timeout: 15000
    })

    return {
      service: 'Sheldon Server',
      status: response.data.available ? 'success' : 'failed',
      message: response.data.available
        ? `Japanese: ${response.data.isJapanese}, Title: ${response.data.title?.substring(0, 30)}...`
        : 'Transcript not available',
      segmentCount: response.data.segments?.length,
      responseTime: Date.now() - start
    }
  } catch (error: any) {
    return {
      service: 'Sheldon Server',
      status: 'failed',
      message: error.message,
      error: error.response?.status?.toString() || error.code,
      responseTime: Date.now() - start
    }
  }
}

async function testYouTubeiJSEnhanced(): Promise<TestResult> {
  const start = Date.now()

  try {
    const client = await Innertube.create()
    const videoInfo = await client.getInfo(VIDEO_ID)
    const transcriptInfo = await videoInfo.getTranscript()

    const languageMenu = (transcriptInfo as any)?.transcript?.content?.footer?.language_menu
    const availableLanguages = languageMenu?.sub_menu_items || []
    const japaneseOptions = availableLanguages.filter((lang: any) => {
      const title = (lang.title || '').toLowerCase()
      return title.includes('japanese') || title.includes('日本語')
    })

    const segments = (transcriptInfo as any)?.transcript?.content?.body?.initial_segments || []

    return {
      service: 'YouTubei.js (getTranscript)',
      status: segments.length > 0 ? 'success' : 'failed',
      message: `Japanese options: ${japaneseOptions.length}, Languages: ${availableLanguages.map((l: any) => l.title).join(', ')}`,
      segmentCount: segments.length,
      responseTime: Date.now() - start
    }
  } catch (error: any) {
    return {
      service: 'YouTubei.js (getTranscript)',
      status: 'failed',
      message: error.message,
      responseTime: Date.now() - start
    }
  }
}

/**
 * Workaround attempt: Use getBasicInfo() to get caption track URLs, then fetch timedtext XML directly.
 * Reference: https://github.com/LuanRT/YouTube.js/issues/1102
 *
 * STATUS: BLOCKED - YouTube returns empty responses for timedtext API from non-residential IPs.
 * The caption track URLs are correctly extracted, but fetching returns 0 bytes.
 * This is why SupaData/Railway/Sheldon (residential proxy services) work but direct requests fail.
 */
async function testYouTubeiJSCaptionTracks(): Promise<TestResult> {
  const start = Date.now()

  try {
    const client = await Innertube.create()
    const basicInfo = await client.getBasicInfo(VIDEO_ID)

    // Access caption tracks from basicInfo
    const captionTracks = (basicInfo as any).captions?.caption_tracks || []

    if (captionTracks.length === 0) {
      return {
        service: 'YouTubei.js (Caption Tracks)',
        status: 'failed',
        message: 'No caption tracks found in basicInfo',
        responseTime: Date.now() - start
      }
    }

    // Find Japanese caption track
    const jaTrack = captionTracks.find((track: any) =>
      track.language_code === 'ja' || track.vss_id?.includes('.ja')
    )

    if (!jaTrack) {
      const availableLangs = captionTracks.map((t: any) => t.language_code).join(', ')
      return {
        service: 'YouTubei.js (Caption Tracks)',
        status: 'failed',
        message: `No Japanese track. Available: ${availableLangs}`,
        responseTime: Date.now() - start
      }
    }

    const captionUrl = jaTrack.base_url
    if (!captionUrl) {
      return {
        service: 'YouTubei.js (Caption Tracks)',
        status: 'failed',
        message: 'Caption track found but no URL',
        responseTime: Date.now() - start
      }
    }

    // Try to fetch the timedtext XML
    // Note: YouTube blocks this from non-residential IPs
    const captionResponse = await axios.get(captionUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const xmlData = String(captionResponse.data)

    // Parse XML to count segments
    const textMatches = xmlData.match(/<text[^>]*>([^<]*)<\/text>/g) || []
    const segmentCount = textMatches.length

    if (segmentCount === 0 && xmlData.length === 0) {
      return {
        service: 'YouTubei.js (Caption Tracks)',
        status: 'failed',
        message: `Track URL found but YouTube returned empty (IP blocked). Track: ${jaTrack.language_code}`,
        responseTime: Date.now() - start
      }
    }

    // Extract first segment text for preview
    let firstText = ''
    if (textMatches.length > 0) {
      const match = textMatches[0].match(/<text[^>]*>([^<]*)<\/text>/)
      if (match) {
        firstText = match[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").substring(0, 30)
      }
    }

    return {
      service: 'YouTubei.js (Caption Tracks)',
      status: segmentCount > 0 ? 'success' : 'failed',
      message: segmentCount > 0
        ? `Found ${captionTracks.length} tracks. First: "${firstText}..."`
        : `Empty caption data from timedtext API`,
      segmentCount,
      responseTime: Date.now() - start
    }
  } catch (error: any) {
    return {
      service: 'YouTubei.js (Caption Tracks)',
      status: 'failed',
      message: error.message || 'Unknown error',
      responseTime: Date.now() - start
    }
  }
}

async function testYouTubeCaptionsScraper(): Promise<TestResult> {
  const start = Date.now()

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
    })

    const captions = await Promise.race([
      getSubtitles({ videoID: VIDEO_ID, lang: 'ja' }),
      timeoutPromise
    ]) as any[]

    return {
      service: 'youtube-captions-scraper',
      status: captions.length > 0 ? 'success' : 'failed',
      message: captions.length > 0 ? `First segment: "${captions[0]?.text?.substring(0, 50)}..."` : 'No captions returned',
      segmentCount: captions.length,
      responseTime: Date.now() - start
    }
  } catch (error: any) {
    return {
      service: 'youtube-captions-scraper',
      status: 'failed',
      message: error.message,
      responseTime: Date.now() - start
    }
  }
}

async function main() {
  console.log('🎬 YouTube Transcript Service Health Check')
  console.log(`📹 Test Video ID: ${VIDEO_ID}`)
  console.log('─'.repeat(60))

  // Run all tests
  const tests = [
    testYouTubeDataAPI,
    testSupaDataAI,
    testRailwayServer,
    testSheldonServer,
    testYouTubeiJSEnhanced,
    testYouTubeiJSCaptionTracks,  // Workaround for broken getTranscript()
    testYouTubeCaptionsScraper
  ]

  for (const test of tests) {
    const result = await test()
    results.push(result as TestResult)

    const icon = result.status === 'success' ? '✅' : result.status === 'skipped' ? '⏭️' : '❌'
    console.log(`\n${icon} ${result.service}`)
    console.log(`   Status: ${result.status}`)
    console.log(`   Message: ${result.message}`)
    if (result.segmentCount) console.log(`   Segments: ${result.segmentCount}`)
    if (result.responseTime) console.log(`   Response Time: ${result.responseTime}ms`)
    if (result.error) console.log(`   Error Code: ${result.error}`)
  }

  // Summary
  console.log('\n' + '─'.repeat(60))
  console.log('📊 SUMMARY')
  console.log('─'.repeat(60))

  const successful = results.filter(r => r.status === 'success').length
  const failed = results.filter(r => r.status === 'failed').length
  const skipped = results.filter(r => r.status === 'skipped').length

  console.log(`✅ Successful: ${successful}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⏭️ Skipped: ${skipped}`)

  if (failed > 0) {
    console.log('\n⚠️ Failed Services:')
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`   - ${r.service}: ${r.message}`)
    })
  }
}

main().catch(console.error)
