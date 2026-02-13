import { computeSegmentQuality, QualityInput } from '../segmentQuality';

function seg(text: string, start: number, end: number): QualityInput {
  return { text, start, end };
}

describe('computeSegmentQuality', () => {
  it('should return 0 for empty input', () => {
    const result = computeSegmentQuality([]);
    expect(result.score).toBe(0);
    expect(result.totalSegments).toBe(0);
  });

  it('should return 1.0 for perfectly segmented content', () => {
    // All segments: sentence-ending, 2.5-8s duration, 15-80 chars
    const segments = [
      seg('これはテスト文章です。', 0, 4),       // 11 chars... too short
    ];
    // Actually need 15+ chars
    const idealSegments = [
      seg('これはとても良いテスト文章です。', 0, 4),     // 15 chars, 4s, ends with 。
      seg('次の文章もテストですよね！', 4, 8),           // 13 chars... need more
    ];
    // Let me make segments that truly meet all criteria
    const perfectSegments = [
      seg('今日はとても天気がいいですね。', 0, 4),       // 14 chars — just under. Let's be more precise
    ];
    // 15+ chars, 2.5-8s, ends with 。？！
    const goodSegments = [
      seg('今日はとてもいい天気ですよね。', 0, 4),       // 14 chars — hmm
      seg('散歩に行きたいと思いませんか？', 4, 8),       // 14 chars
    ];
    // Actually: 今日はとてもいい天気ですよね。= 14 chars. Need to count more carefully.
    // Let's use longer text
    const trueGoodSegments = [
      seg('今日はとてもいい天気ですよね、散歩に行きましょう。', 0, 5),  // 22 chars, 5s, ends with 。
      seg('公園で友達に会えたらいいなと思っています！', 5, 10),         // 19 chars, 5s, ends with ！
    ];
    const result = computeSegmentQuality(trueGoodSegments);
    expect(result.sentenceTerminalRatio).toBe(1);
    expect(result.durationInRangeRatio).toBe(1);
    expect(result.textLengthInRangeRatio).toBe(1);
    expect(result.score).toBe(1);
  });

  it('should return low score for micro-fragments', () => {
    const segments = [
      seg('あ', 0, 0.5),
      seg('い', 0.5, 1.0),
      seg('う', 1.0, 1.5),
      seg('え', 1.5, 2.0),
    ];
    const result = computeSegmentQuality(segments);
    // No sentence terminators, all too short in duration and text length
    expect(result.sentenceTerminalRatio).toBe(0);
    expect(result.durationInRangeRatio).toBe(0);
    expect(result.textLengthInRangeRatio).toBe(0);
    expect(result.score).toBe(0);
  });

  it('should return moderate score for mixed quality', () => {
    const segments = [
      seg('今日はとてもいい天気ですよね、散歩に行きましょう。', 0, 5),  // good: 22c, 5s, 。
      seg('うん', 5, 5.5),                                            // bad: 2c, 0.5s, no punc
      seg('そうですね、確かにいい天気です！', 5.5, 10),                 // good: 15c, 4.5s, ！
      seg('あ', 10, 10.3),                                            // bad: 1c, 0.3s, no punc
    ];
    const result = computeSegmentQuality(segments);
    expect(result.sentenceTerminalRatio).toBe(0.5); // 2/4
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  it('should penalize oversized segments', () => {
    const segments = [
      seg('これはとても長い文章です。', 0, 15),  // 13 chars, 15s duration (too long)
    ];
    const result = computeSegmentQuality(segments);
    expect(result.durationInRangeRatio).toBe(0); // 15s > 8s max
  });

  it('should handle segments with only good duration but bad text', () => {
    const segments = [
      seg('短い', 0, 4),  // 2 chars < 15 min, but 4s is good duration, no sentence end
    ];
    const result = computeSegmentQuality(segments);
    expect(result.durationInRangeRatio).toBe(1);
    expect(result.sentenceTerminalRatio).toBe(0);
    expect(result.textLengthInRangeRatio).toBe(0);
    expect(result.score).toBeCloseTo(1 / 3, 5);
  });

  it('should count natural pauses as sentence terminals', () => {
    // Segments without punctuation but with significant gaps between them
    const segments = [
      seg('今日は天気がいいですね散歩しましょう', 0, 5),   // no punctuation, gap to next = 1.0s > 0.5s
      seg('公園で友達に会えたらいいなと思います', 6, 10),   // no punctuation, no next segment
    ];
    const result = computeSegmentQuality(segments);
    // First segment has natural pause (1.0s gap > 0.5s threshold), second has no next → not counted
    expect(result.sentenceTerminalRatio).toBe(0.5); // 1/2
  });

  it('should count both punctuation and pause terminals without double-counting', () => {
    const segments = [
      seg('今日はとてもいい天気ですよね。', 0, 4),          // punctuation + gap 2.0s (both match)
      seg('公園で友達に会えたらいいなと思います', 6, 10),   // no punctuation, no next
    ];
    const result = computeSegmentQuality(segments);
    // First: punctuation=yes, pause=yes → counts as 1. Second: neither → 0.
    expect(result.sentenceTerminalRatio).toBe(0.5); // 1/2
  });

  it('should report correct totalSegments', () => {
    const segments = [
      seg('テスト', 0, 1),
      seg('テスト', 1, 2),
      seg('テスト', 2, 3),
    ];
    const result = computeSegmentQuality(segments);
    expect(result.totalSegments).toBe(3);
  });

  it('should return score between 0 and 1 for any input', () => {
    const testCases: QualityInput[][] = [
      [seg('a', 0, 100)],
      [seg('。', 0, 0.01)],
      [seg('x'.repeat(200), 0, 0.1)],
      Array.from({ length: 100 }, (_, i) => seg(`テスト${i}`, i, i + 0.1)),
    ];
    for (const segments of testCases) {
      const result = computeSegmentQuality(segments);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });
});
