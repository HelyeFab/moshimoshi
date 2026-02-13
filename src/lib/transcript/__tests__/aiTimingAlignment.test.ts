import { alignAiTextsToSourceTimeline, type TimedTextSegment } from '../aiTimingAlignment'

describe('alignAiTextsToSourceTimeline', () => {
  it('aligns split boundary around 結ばれる onto source timeline', () => {
    const source: TimedTextSegment[] = [
      { text: '君の中にある赤とはきせもそれらが結', start: 38.12, end: 46.26 },
      { text: 'ばれるのは死んの', start: 46.28, end: 49.22 },
      { text: 'ぞ風の中でも負けないよな', start: 49.24, end: 57.08 },
    ]
    const aiTexts = ['君の中にある赤とはきせも', 'それらが結ばれるのは', '死んの', 'ぞ風の中でも負けないよな']

    const result = alignAiTextsToSourceTimeline(aiTexts, source)
    expect(result).not.toBeNull()
    expect(result!.segments.length).toBe(4)
    expect(result!.matchedRatio).toBeGreaterThan(0.99)
    expect(result!.segments[1].text).toContain('結ばれる')
    expect(result!.segments[1].start).toBeLessThan(result!.segments[1].end)
    expect(result!.segments[2].start).toBeGreaterThan(result!.segments[1].start)
  })

  it('returns null when match ratio is too low', () => {
    const source: TimedTextSegment[] = [
      { text: 'これはテストです。', start: 0, end: 2 },
      { text: '今日は晴れです。', start: 2, end: 4 },
    ]
    const aiTexts = ['完全に別の文章', 'マッチしない']

    const result = alignAiTextsToSourceTimeline(aiTexts, source, 0.95)
    expect(result).toBeNull()
  })

  it('keeps output monotonic and non-zero duration', () => {
    const source: TimedTextSegment[] = [
      { text: 'あいうえおかきくけこ', start: 0, end: 2 },
      { text: 'さしすせそたちつてと', start: 2, end: 4 },
    ]
    const aiTexts = ['あいうえお', 'かきくけこさし', 'すせそたちつてと']

    const result = alignAiTextsToSourceTimeline(aiTexts, source)
    expect(result).not.toBeNull()
    const segments = result!.segments
    for (let i = 0; i < segments.length; i++) {
      expect(segments[i].end).toBeGreaterThan(segments[i].start)
      if (i > 0) {
        expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].start)
      }
    }
  })
})

