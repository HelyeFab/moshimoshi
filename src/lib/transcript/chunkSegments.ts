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

function splitByCharLimit(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

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
    return chunks;
  }

  // Fallback: hard slice by characters
  const slices: string[] = [];
  for (let i = 0; i < text.length; i += limit) {
    slices.push(text.slice(i, i + limit));
  }
  return slices;
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
