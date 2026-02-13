import {
  mergeTranscriptSegments,
  shouldMergeTranscriptSegments,
  MergeableTranscriptSegment,
} from '../mergeSegments';

function seg(text: string, start: number, end: number): MergeableTranscriptSegment {
  return { text, start, end };
}

describe('shouldMergeTranscriptSegments', () => {
  it('should return false for fewer than 6 segments', () => {
    const segments = [seg('あ', 0, 1), seg('い', 1, 2), seg('う', 2, 3)];
    expect(shouldMergeTranscriptSegments(segments)).toBe(false);
  });

  it('should return true when >= 20% of segments are short (<= 3 chars)', () => {
    // 2 short out of 8 = 25% > 20%
    const segments = [
      seg('あ', 0, 1),
      seg('い', 1, 2),
      seg('こんにちは', 2, 3),
      seg('元気ですか', 3, 4),
      seg('今日はいい天気', 4, 5),
      seg('明日も晴れ', 5, 6),
      seg('散歩しましょう', 6, 7),
      seg('楽しみです', 7, 8),
    ];
    expect(shouldMergeTranscriptSegments(segments)).toBe(true);
  });

  it('should return false when < 20% of segments are short', () => {
    // 1 short out of 8 = 12.5% < 20%
    const segments = [
      seg('あ', 0, 1),
      seg('こんにちは', 1, 2),
      seg('元気ですか', 2, 3),
      seg('今日はいい天気', 3, 4),
      seg('明日も晴れ', 4, 5),
      seg('散歩しましょう', 5, 6),
      seg('楽しみです', 6, 7),
      seg('ありがとう', 7, 8),
    ];
    expect(shouldMergeTranscriptSegments(segments)).toBe(false);
  });
});

describe('mergeTranscriptSegments', () => {
  it('should return empty array for empty input', () => {
    expect(mergeTranscriptSegments([])).toEqual([]);
  });

  it('should return single segment unchanged', () => {
    const segments = [seg('こんにちは', 0, 2)];
    const result = mergeTranscriptSegments(segments);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('こんにちは');
  });

  it('should merge micro-fragments with small gaps', () => {
    const segments = [
      seg('こ', 0, 0.5),
      seg('ん', 0.5, 1.0),
      seg('にちは', 1.0, 2.0),
    ];
    const result = mergeTranscriptSegments(segments);
    expect(result.length).toBeLessThan(segments.length);
    // All text should be preserved
    const allText = result.map(r => r.text).join('');
    expect(allText).toBe('こんにちは');
  });

  it('should not merge across sentence boundaries (punctuation-ended segments)', () => {
    const segments = [
      seg('これはテストです。', 0, 3),
      seg('次の文章です。', 3.5, 6),
    ];
    const result = mergeTranscriptSegments(segments);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('これはテストです。');
    expect(result[1].text).toBe('次の文章です。');
  });

  it('should merge segments without sentence punctuation even with moderate gap', () => {
    const segments = [
      seg('これは', 0, 1),
      seg('テスト', 1.2, 2), // 0.2s gap, no sentence-end punctuation on first segment
    ];
    const result = mergeTranscriptSegments(segments);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('これはテスト');
  });

  it('should merge lonely fragments (<5 chars) with small gap', () => {
    const segments = [
      seg('あの', 0, 0.5),   // 2 chars < 5 = lonely fragment
      seg('今日はいい天気ですね', 0.7, 3), // gap 0.2s < 0.3s lonelyFragmentMaxGap
    ];
    const result = mergeTranscriptSegments(segments);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('あの今日はいい天気ですね');
  });

  it('should NOT merge lonely fragments with large gap', () => {
    const segments = [
      seg('あの', 0, 0.5),   // 2 chars = lonely
      seg('今日はいい天気ですね', 1.5, 3), // gap 1.0s > maxGap default
    ];
    const result = mergeTranscriptSegments(segments);
    expect(result).toHaveLength(2);
  });

  it('should respect maxChars limit', () => {
    const longText = 'あ'.repeat(45); // exactly maxChars
    const segments = [
      seg(longText, 0, 2),
      seg('短い文章です', 2.1, 3),
    ];
    const result = mergeTranscriptSegments(segments);
    expect(result).toHaveLength(2);
  });

  describe('monotonic timestamp invariant', () => {
    it('should preserve monotonic start times after merge', () => {
      const segments = [
        seg('あ', 0, 0.5),
        seg('い', 0.5, 1.0),
        seg('う', 1.0, 1.5),
        seg('えお', 2.0, 3.0),
        seg('かきくけ', 3.0, 4.0),
        seg('こ', 4.0, 4.5),
        seg('さしすせそ', 5.0, 6.0),
      ];
      const result = mergeTranscriptSegments(segments);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].start).toBeGreaterThanOrEqual(result[i - 1].start);
        expect(result[i].start).toBeGreaterThanOrEqual(result[i - 1].end);
      }
    });

    it('should preserve non-negative timestamps', () => {
      const segments = [
        seg('テスト', 0, 1),
        seg('です', 1, 2),
      ];
      const result = mergeTranscriptSegments(segments);
      for (const s of result) {
        expect(s.start).toBeGreaterThanOrEqual(0);
        expect(s.end).toBeGreaterThanOrEqual(s.start);
      }
    });
  });

  describe('ordering invariant', () => {
    it('should preserve segment text ordering', () => {
      const segments = [
        seg('最初', 0, 1),
        seg('の', 1, 1.3),
        seg('文章', 1.3, 2),
        seg('次の文章', 3, 4),
      ];
      const result = mergeTranscriptSegments(segments);
      const combinedText = result.map(r => r.text).join('');
      expect(combinedText).toBe('最初の文章次の文章');
    });
  });

  describe('punctuation boundary protection', () => {
    it('should NOT merge short punctuation-ended sentence with lonely next fragment', () => {
      // はい。 is 3 chars (< lonelyFragmentChars=5) AND ends with punctuation.
      // え is 1 char (lonely fragment) with small gap.
      // Line 83 must NOT merge across a punctuation-ended currentText.
      const segments = [
        seg('はい。', 0, 1),    // short complete sentence with punctuation
        seg('え', 1.1, 1.5),   // lonely fragment, gap 0.1s < lonelyFragmentMaxGap
      ];
      const result = mergeTranscriptSegments(segments);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('はい。');
      expect(result[1].text).toBe('え');
    });

    it('should NOT merge punctuation-ended segment with any lonely next fragment regardless of gap', () => {
      const segments = [
        seg('そうです。', 0, 2),  // ends with 。
        seg('あ', 2.05, 2.5),    // lonely fragment, tiny gap (0.05s)
      ];
      const result = mergeTranscriptSegments(segments);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('そうです。');
      expect(result[1].text).toBe('あ');
    });
  });

  describe('custom options', () => {
    it('should respect custom lonelyFragmentMaxGap', () => {
      // えーっと is 4 chars (≥ minChars so general merge won't fire, but < 5 = lonely fragment)
      // Next segment has sentence delimiter so the no-delimiter rule won't merge either.
      // Only the lonely fragment rule can merge these.
      const segments = [
        seg('えーっと', 0, 1),                     // 4 chars, lonely (<5), no punctuation
        seg('今日は天気がいいですね。', 1.2, 4),   // gap 0.2s, has 。
      ];
      // With lonelyFragmentMaxGap=0.1, the 0.2s gap exceeds it — lonely rule skipped, no merge
      const result = mergeTranscriptSegments(segments, { lonelyFragmentMaxGap: 0.1 });
      expect(result).toHaveLength(2);
    });
  });
});
