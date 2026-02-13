/**
 * Transcript chunking utility
 *
 * Some sources (esp. song lyrics) return very long "sentences" with no punctuation.
 * We split them into smaller chunks to keep shadowing snappy and avoid 30s+ lines.
 * Timing is distributed proportionally to character counts to preserve ordering.
 */

export interface BasicTranscriptSegment {
  start: number;
  end: number;
  text: string;
}

const SENTENCE_SPLIT_REGEX = /(?<=[。．！？!?！\?])\s*/;
const MAX_CHARS = 45; // soft cap per chunk
const TINY_TRAILING_CHARS = 4;

/**
 * Split Japanese text into words using Intl.Segmenter when available.
 * Returns null if the API is not available (graceful degradation).
 */
function segmentJapaneseWords(text: string): string[] | null {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return null;
  try {
    // Intl.Segmenter is Baseline since April 2024 but may not be in all TS lib targets
    const SegmenterCtor = (Intl as any).Segmenter;
    const segmenter = new SegmenterCtor('ja-JP', { granularity: 'word' });
    return Array.from(segmenter.segment(text) as Iterable<{ segment: string }>, s => s.segment);
  } catch {
    return null;
  }
}

/**
 * Detect if text is primarily Japanese (contains CJK characters).
 */
function isJapaneseText(text: string): boolean {
  // Match Hiragana, Katakana, CJK Unified Ideographs
  const cjkCount = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || []).length;
  return cjkCount > text.length * 0.3;
}

/**
 * Split text by character limit, respecting word boundaries for Japanese.
 * Uses Intl.Segmenter for Japanese text when available, falls back to
 * space-based splitting for romaji/English, then hard character slicing.
 */
function splitByCharLimit(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  // For Japanese text, try word-aware splitting first
  if (isJapaneseText(text)) {
    const words = segmentJapaneseWords(text);
    if (words && words.length > 1) {
      const chunks: string[] = [];
      let buffer = '';
      for (const word of words) {
        const candidate = buffer + word;
        if (candidate.length > limit && buffer.length > 0) {
          chunks.push(buffer);
          buffer = word;
        } else {
          buffer = candidate;
        }
      }
      if (buffer) chunks.push(buffer);
      if (chunks.length > 1) return normalizeTinyTrailingChunk(chunks);
    }
  }

  // Prefer splitting on spaces (common in romaji/lyric lines)
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const chunks: string[] = [];
    let buffer = '';

    for (const part of parts) {
      const candidate = buffer ? `${buffer} ${part}` : part;
      if (candidate.length > limit) {
        if (buffer) chunks.push(buffer);
        buffer = part;
      } else {
        buffer = candidate;
      }
    }

    if (buffer) chunks.push(buffer);
    return normalizeTinyTrailingChunk(chunks);
  }

  // Fallback: hard slice by characters
  const slices: string[] = [];
  for (let i = 0; i < text.length; i += limit) {
    slices.push(text.slice(i, i + limit));
  }
  return normalizeTinyTrailingChunk(slices);
}

/**
 * Avoid leaving tiny trailing fragments such as "ね。"/"よ。"/"か。"
 * by folding the tail back into the previous chunk.
 *
 * MAX_CHARS is a soft cap; allowing slight overflow is preferable to
 * producing unusable one-token practice segments.
 */
function normalizeTinyTrailingChunk(chunks: string[]): string[] {
  if (chunks.length < 2) return chunks;
  const last = chunks[chunks.length - 1]?.trim() ?? '';
  if (!last || last.length > TINY_TRAILING_CHARS) return chunks;

  // Preserve at least two chunks by rebalancing when there are exactly two.
  if (chunks.length === 2) {
    const first = chunks[0];
    const needed = TINY_TRAILING_CHARS + 1 - last.length;
    if (needed <= 0 || first.length <= needed) return chunks;

    const carry = first.slice(first.length - needed);
    const rebalancedFirst = first.slice(0, first.length - needed);
    const rebalancedLast = `${carry}${chunks[1]}`;
    if (!rebalancedFirst.trim()) return chunks;
    return [rebalancedFirst, rebalancedLast];
  }

  const normalized = [...chunks];
  normalized[normalized.length - 2] = `${normalized[normalized.length - 2]}${normalized[normalized.length - 1]}`;
  normalized.pop();
  return normalized;
}

function chunkSegment(segment: BasicTranscriptSegment): BasicTranscriptSegment[] {
  const duration = Math.max(segment.end - segment.start, 0.2);
  const cleanText = segment.text.trim();
  if (!cleanText) return [];

  let parts = cleanText
    .split(SENTENCE_SPLIT_REGEX)
    .map((p) => p.trim())
    .filter(Boolean);

  // If no punctuation-based split and still long, fall back to char/space splitting
  if (parts.length === 1 && cleanText.length > MAX_CHARS) {
    parts = splitByCharLimit(cleanText, MAX_CHARS);
  } else {
    // Enforce max length on each part
    parts = parts.flatMap((p) => splitByCharLimit(p, MAX_CHARS));
  }

  const totalChars = parts.reduce((sum, p) => sum + p.length, 0);
  if (totalChars === 0) return [];

  let cursor = segment.start;
  const chunks: BasicTranscriptSegment[] = [];

  parts.forEach((part, idx) => {
    const isLast = idx === parts.length - 1;
    // Distribute duration proportionally; ensure a small floor for each chunk
    const proportional = (part.length / totalChars) * duration;
    const chunkDuration = Math.max(proportional, 0.2);
    const end = isLast ? segment.end : Math.min(cursor + chunkDuration, segment.end);

    chunks.push({
      start: cursor,
      end,
      text: part,
    });

    cursor = end;
  });

  return chunks;
}

export function chunkTranscriptSegments(segments: BasicTranscriptSegment[]): BasicTranscriptSegment[] {
  return segments.flatMap((segment) => chunkSegment(segment));
}
