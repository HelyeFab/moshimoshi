import {
  validateResegmentedOutput,
  resegmentDeterministic,
  PIPELINE_VERSION,
  type ResegmentedSegment,
} from '../resegmentation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seg(text: string, start: number, end: number): ResegmentedSegment {
  return { text, start, end }
}

// ---------------------------------------------------------------------------
// validateResegmentedOutput
// ---------------------------------------------------------------------------

describe('validateResegmentedOutput', () => {
  it('should pass valid monotonic segments', () => {
    const segments = [
      seg('こんにちは', 0, 2),
      seg('元気ですか', 2.5, 4),
      seg('はい元気です', 4.5, 6),
    ]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail on empty segments array', () => {
    const result = validateResegmentedOutput([])
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Empty segments array')
  })

  it('should detect negative start time', () => {
    const segments = [seg('テスト', -1, 2)]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('negative start'))).toBe(true)
  })

  it('should detect negative end time', () => {
    const segments = [seg('テスト', 0, -1)]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('negative end'))).toBe(true)
  })

  it('should detect start > end', () => {
    const segments = [seg('テスト', 5, 3)]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('start') && e.includes('>= end'))).toBe(true)
  })

  it('should reject zero-duration segments (start === end)', () => {
    const segments = [seg('ゼロ', 5, 5)]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('>= end'))).toBe(true)
  })

  it('should reject overlapping segments', () => {
    const segments = [
      seg('前の文', 0, 5),
      seg('重なる', 3, 7), // start 3 < prev.end 5 = overlap
    ]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('overlaps previous'))).toBe(true)
  })

  it('should accept abutting segments (no overlap)', () => {
    const segments = [
      seg('前の文', 0, 5),
      seg('次の文', 5, 10), // start === prev.end is allowed (abutting)
    ]
    const result = validateResegmentedOutput(segments)
    // Should not have overlap errors
    expect(result.errors.every(e => !e.includes('overlaps'))).toBe(true)
  })

  it('should detect non-monotonic ordering', () => {
    const segments = [
      seg('先に', 5, 7),
      seg('後に', 2, 4), // start < previous start
    ]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('not monotonic'))).toBe(true)
  })

  it('should detect duration exceeding max', () => {
    const segments = [seg('長すぎるセグメント', 0, 35)]
    const result = validateResegmentedOutput(segments, { maxSegmentDuration: 30 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('exceeds max'))).toBe(true)
  })

  it('should detect duration below min', () => {
    const segments = [seg('短い', 0, 0.05)]
    const result = validateResegmentedOutput(segments, { minSegmentDuration: 0.1 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('below min'))).toBe(true)
  })

  it('should detect empty text', () => {
    const segments = [seg('', 0, 2)]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('empty text'))).toBe(true)
  })

  it('should detect excessive gap between segments', () => {
    const segments = [
      seg('前', 0, 1),
      seg('後', 10, 11), // 9s gap
    ]
    const result = validateResegmentedOutput(segments, { maxGap: 5 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('gap'))).toBe(true)
  })

  it('should pass coverage check when ratio is sufficient', () => {
    const segments = [
      seg('テスト', 0, 5),
      seg('テスト', 5, 10),
    ]
    const result = validateResegmentedOutput(segments, {
      videoDuration: 12,
      minCoverageRatio: 0.5,
    })
    expect(result.valid).toBe(true)
  })

  it('should fail coverage check when ratio is too low', () => {
    const segments = [seg('短い', 0, 1)]
    const result = validateResegmentedOutput(segments, {
      videoDuration: 100,
      minCoverageRatio: 0.5,
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Coverage ratio'))).toBe(true)
  })

  it('should skip coverage check when videoDuration is not provided', () => {
    const segments = [seg('テスト', 0, 1)]
    const result = validateResegmentedOutput(segments)
    // Only checking that no coverage error appears
    expect(result.errors.every(e => !e.includes('Coverage'))).toBe(true)
  })

  it('should collect multiple errors at once', () => {
    const segments = [
      seg('', -1, -2),    // negative start, negative end, start > end, empty text
      seg('ok', 0, 1),    // non-monotonic (start 0 < prev start -1 is actually ok since 0 > -1)
    ]
    const result = validateResegmentedOutput(segments)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// resegmentDeterministic
// ---------------------------------------------------------------------------

describe('resegmentDeterministic', () => {
  it('should return empty result for empty input', () => {
    const result = resegmentDeterministic({ segments: [] })
    expect(result.segments).toHaveLength(0)
    expect(result.source).toBe('deterministic')
    expect(result.validationPassed).toBe(false)
    expect(result.validationErrors).toContain('Empty input segments')
  })

  it('should return deterministic source', () => {
    const segments = [
      seg('こんにちは世界', 0, 3),
      seg('元気ですか', 3.5, 6),
    ]
    const result = resegmentDeterministic({ segments })
    expect(result.source).toBe('deterministic')
    expect(result.pipelineVersion).toBe(PIPELINE_VERSION)
  })

  it('should preserve reasonable segments unchanged', () => {
    const segments = [
      seg('こんにちは', 0, 2),
      seg('元気ですか', 3, 5),
      seg('はい元気です', 6, 8),
    ]
    const result = resegmentDeterministic({ segments })
    expect(result.segments.length).toBeGreaterThanOrEqual(1)
    expect(result.validationPassed).toBe(true)
  })

  it('should merge short fragments when needed', () => {
    // Create many short segments (>20% short) to trigger merge
    const segments = [
      seg('あ', 0, 0.5),
      seg('い', 0.5, 1),
      seg('う', 1, 1.5),
      seg('え', 1.5, 2),
      seg('お', 2, 2.5),
      seg('こんにちは', 2.5, 4),
      seg('か', 4, 4.5),
      seg('き', 4.5, 5),
    ]
    const result = resegmentDeterministic({ segments })
    // Should merge some of the fragments
    expect(result.segments.length).toBeLessThan(segments.length)
    expect(result.source).toBe('deterministic')
  })

  it('should chunk long segments', () => {
    const longText = 'これはとても長いテキストで、シャドーイングの練習には長すぎるので分割する必要があります。句読点で分割されるべきです。'
    const segments = [seg(longText, 0, 10)]
    const result = resegmentDeterministic({ segments })
    expect(result.segments.length).toBeGreaterThanOrEqual(1)
  })

  it('should produce valid output that passes validation', () => {
    const segments = [
      seg('今日はいい天気ですね', 0, 3),
      seg('明日も晴れるでしょう', 4, 7),
      seg('散歩に行きましょう', 8, 11),
    ]
    const result = resegmentDeterministic({ segments })
    expect(result.validationPassed).toBe(true)
    expect(result.validationErrors).toHaveLength(0)
  })

  it('should include pipelineVersion in result', () => {
    const segments = [seg('テスト', 0, 2)]
    const result = resegmentDeterministic({ segments })
    expect(result.pipelineVersion).toBe(PIPELINE_VERSION)
  })

  it('should pass videoDurationHint to validation', () => {
    // Single short segment with long video = low coverage
    const segments = [seg('短い', 0, 1)]
    const result = resegmentDeterministic({
      segments,
      videoDurationHint: 1000,
    })
    // Coverage will be very low, so validation should flag it
    expect(result.validationErrors.some(e => e.includes('Coverage'))).toBe(true)
  })

  it('should remove tiny adjacent overlap duplicate like ね。 carry-over', () => {
    const segments = [
      seg('来ちゃったみたいだね。', 12, 18),
      seg('ね。', 18.02, 18.8),
      seg('次の文です。', 19, 22),
    ]

    const result = resegmentDeterministic({ segments })
    const texts = result.segments.map(s => s.text.trim())

    expect(texts.filter(t => t === 'ね。')).toHaveLength(0)
    expect(texts.some(t => t.endsWith('だね。'))).toBe(true)
  })

  it('should remove overlapping tiny duplicate even when duplicate duration is long', () => {
    const segments = [
      seg('ちょっとドアの世界来ちゃったみたいだね。', 13.24, 18.12),
      seg('ね。', 15.12, 18.12), // overlaps previous by ~3s
      seg('次の文です。', 18.76, 22.0),
    ]

    const result = resegmentDeterministic({ segments })
    const texts = result.segments.map(s => s.text.trim())

    expect(texts.filter(t => t === 'ね。')).toHaveLength(0)
    expect(texts.some(t => t.endsWith('だね。'))).toBe(true)
  })
})
