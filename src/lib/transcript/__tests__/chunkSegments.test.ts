import { chunkTranscriptSegments, BasicTranscriptSegment } from '../chunkSegments';

function seg(text: string, start: number, end: number): BasicTranscriptSegment {
  return { text, start, end };
}

describe('chunkTranscriptSegments', () => {
  it('should return empty array for empty input', () => {
    expect(chunkTranscriptSegments([])).toEqual([]);
  });

  it('should return short segments unchanged', () => {
    const segments = [seg('こんにちは', 0, 2)];
    const result = chunkTranscriptSegments(segments);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('こんにちは');
  });

  it('should split on sentence punctuation', () => {
    const segments = [seg('こんにちは。元気ですか？', 0, 5)];
    const result = chunkTranscriptSegments(segments);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].text).toBe('こんにちは。');
    expect(result[1].text).toBe('元気ですか？');
  });

  it('should split long segments without punctuation', () => {
    // 50 chars, exceeds MAX_CHARS (45)
    const longText = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
    const segments = [seg(longText, 0, 10)];
    const result = chunkTranscriptSegments(segments);
    expect(result.length).toBeGreaterThan(1);
    // All text preserved
    const combined = result.map(r => r.text).join('');
    expect(combined).toBe(longText);
  });

  it('should split romaji/spaced text on spaces', () => {
    const text = 'kono sentaku wa totemo muzukashii desu ne minna san';
    const segments = [seg(text, 0, 10)];
    const result = chunkTranscriptSegments(segments);
    // Text should be split but all preserved
    const combined = result.map(r => r.text).join(' ');
    expect(combined.replace(/\s+/g, ' ')).toBe(text);
  });

  describe('timestamp invariants', () => {
    it('should produce monotonic timestamps', () => {
      const segments = [
        seg('これは長い文章です。もう一つの文章もあります。最後の文章。', 0, 15),
      ];
      const result = chunkTranscriptSegments(segments);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].start).toBeGreaterThanOrEqual(result[i - 1].start);
      }
    });

    it('should produce non-negative timestamps', () => {
      const segments = [seg('テスト文章です。', 0, 3)];
      const result = chunkTranscriptSegments(segments);
      for (const s of result) {
        expect(s.start).toBeGreaterThanOrEqual(0);
        expect(s.end).toBeGreaterThanOrEqual(s.start);
      }
    });

    it('should not exceed original segment end time', () => {
      const segments = [seg('テスト。もう一つ。', 5, 10)];
      const result = chunkTranscriptSegments(segments);
      for (const s of result) {
        expect(s.end).toBeLessThanOrEqual(10);
        expect(s.start).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe('Japanese word-aware splitting', () => {
    it('should handle text without punctuation that exceeds MAX_CHARS', () => {
      // Long Japanese text without punctuation
      const text = '今日は天気がとてもいいので公園に行って散歩をしてから友達と一緒にカフェでコーヒーを飲みました';
      const segments = [seg(text, 0, 10)];
      const result = chunkTranscriptSegments(segments);
      expect(result.length).toBeGreaterThan(1);
      // All text preserved
      const combined = result.map(r => r.text).join('');
      expect(combined).toBe(text);
    });

    it('should preserve all text when splitting', () => {
      const texts = [
        'テスト',
        'これは短い。',
        'これはもう少し長い文章ですがまだ大丈夫です',
        '非常に長い文章を書いてみましょうかこれは四十五文字を超えるかもしれませんがどうでしょうか確かに超えています',
      ];
      for (const text of texts) {
        const segments = [seg(text, 0, 10)];
        const result = chunkTranscriptSegments(segments);
        const combined = result.map(r => r.text).join('');
        expect(combined).toBe(text);
      }
    });

    it('should merge tiny trailing fragments like "ね。" into the previous chunk', () => {
      // 47 chars => would normally split as 45 + 2 ("ね。") without tail normalization
      const text = `${'あ'.repeat(45)}ね。`;
      const segments = [seg(text, 0, 10)];
      const result = chunkTranscriptSegments(segments);

      // All text preserved
      const combined = result.map(r => r.text).join('');
      expect(combined).toBe(text);

      // No tiny standalone trailing chunk
      expect(result[result.length - 1].text).not.toBe('ね。');
    });
  });

  describe('Intl.Segmenter unavailable fallback', () => {
    it('should produce deterministic output when Intl.Segmenter is unavailable', () => {
      // Temporarily remove Intl.Segmenter
      const originalSegmenter = (Intl as any).Segmenter;
      delete (Intl as any).Segmenter;

      try {
        // Long Japanese text without punctuation that exceeds MAX_CHARS
        const text = '今日は天気がとてもいいので公園に行って散歩をしてから友達と一緒にカフェでコーヒーを飲みました';
        const segments = [seg(text, 0, 10)];
        const result = chunkTranscriptSegments(segments);

        // Should still split (falls back to character slicing)
        expect(result.length).toBeGreaterThan(1);

        // All text must be preserved
        const combined = result.map(r => r.text).join('');
        expect(combined).toBe(text);

        // Timestamps must be monotonic
        for (let i = 1; i < result.length; i++) {
          expect(result[i].start).toBeGreaterThanOrEqual(result[i - 1].start);
        }

        // Determinism: running again produces same result
        const result2 = chunkTranscriptSegments(segments);
        expect(result2).toEqual(result);
      } finally {
        // Restore Intl.Segmenter
        (Intl as any).Segmenter = originalSegmenter;
      }
    });
  });

  describe('edge cases', () => {
    it('should skip empty text segments', () => {
      const segments = [seg('', 0, 1), seg('  ', 1, 2)];
      const result = chunkTranscriptSegments(segments);
      expect(result).toHaveLength(0);
    });

    it('should handle very short duration segments', () => {
      const segments = [seg('テスト', 5, 5.1)];
      const result = chunkTranscriptSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(5);
    });
  });
});
