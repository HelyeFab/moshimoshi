/**
 * Stage A — Moshi Player transcript route integration test.
 *
 * Tests the route via HTTP against the running dev server.
 * Requires: `npm run dev` running on localhost:3000
 *
 * Known test videos (from the overview doc):
 *   V1: uk7gKixqVNU — normal Japanese speech
 *   V2: 9LW9DpmhrPE — music/lyrics case
 */

const BASE = 'http://localhost:3000/api/moshi-player/transcript'

async function callRoute(videoId: string) {
  const res = await fetch(`${BASE}/${videoId}`)
  return {
    status: res.status,
    data: await res.json(),
  }
}

describe('Moshi Player transcript route', () => {
  jest.setTimeout(60000)

  test('rejects invalid video ID', async () => {
    const { status, data } = await callRoute('invalid!')
    expect(status).toBe(400)
    expect(data.available).toBe(false)
    expect(data.error).toContain('Invalid video ID')
  })

  test('rejects too-short video ID', async () => {
    const { status, data } = await callRoute('abc')
    expect(status).toBe(400)
    expect(data.available).toBe(false)
  })

  test('V1: Japanese speech video returns correct shape', async () => {
    const { status, data } = await callRoute('uk7gKixqVNU')
    expect(status).toBe(200)
    expect(data).toHaveProperty('available')
    expect(data).toHaveProperty('videoId', 'uk7gKixqVNU')

    if (data.available) {
      // Success shape validation
      expect(data).toHaveProperty('title')
      expect(data).toHaveProperty('language')
      expect(data).toHaveProperty('source')
      expect(data).toHaveProperty('segments')
      expect(data).toHaveProperty('totalSegments')
      expect(data).toHaveProperty('totalDuration')

      expect(Array.isArray(data.segments)).toBe(true)
      expect(data.segments.length).toBeGreaterThan(0)

      // Segment shape
      const seg = data.segments[0]
      expect(seg).toHaveProperty('start')
      expect(seg).toHaveProperty('end')
      expect(seg).toHaveProperty('duration')
      expect(seg).toHaveProperty('text')
      expect(typeof seg.start).toBe('number')
      expect(typeof seg.text).toBe('string')
      expect(seg.text.length).toBeGreaterThan(0)

      // Source must be one of our providers
      expect(['cache', 'youtubei-api', 'youtubei-timedtext', 'sheldon', 'supa']).toContain(
        data.source,
      )

      // Raw segments must NOT contain practice metadata
      expect(seg).not.toHaveProperty('words')
      expect(seg).not.toHaveProperty('translation')
      expect(seg).not.toHaveProperty('practiceType')

      console.log(
        `[TEST] V1: ${data.totalSegments} segments via "${data.source}" (${data.language})`,
      )
    } else {
      // If unavailable, must have clean error
      expect(data).toHaveProperty('error')
      console.log(`[TEST] V1 unavailable: ${data.error}`)
    }
  })

  test('V2: music video does not crash', async () => {
    const { status, data } = await callRoute('9LW9DpmhrPE')
    expect(status).toBe(200)
    expect(data).toHaveProperty('available')
    expect(data).toHaveProperty('videoId', '9LW9DpmhrPE')

    if (data.available) {
      expect(data.segments.length).toBeGreaterThan(0)
      console.log(
        `[TEST] V2: ${data.totalSegments} segments via "${data.source}"`,
      )
    } else {
      expect(data).toHaveProperty('error')
      console.log(`[TEST] V2 unavailable: ${data.error}`)
    }
  })

  test('response includes availableLanguages when successful', async () => {
    const { data } = await callRoute('uk7gKixqVNU')
    if (data.available) {
      expect(data).toHaveProperty('availableLanguages')
      expect(Array.isArray(data.availableLanguages)).toBe(true)
    }
  })
})
