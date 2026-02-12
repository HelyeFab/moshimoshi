export type MergeableTranscriptSegment = {
  start: number;
  end: number;
  text: string;
  words?: string[];
  translation?: string;
};

type MergeOptions = {
  minChars?: number;
  minDuration?: number;
  maxChars?: number;
  maxGap?: number;
};

const DEFAULT_OPTIONS: Required<MergeOptions> = {
  minChars: 4,
  minDuration: 0.6,
  maxChars: 45,
  maxGap: 0.9,
};

const SENTENCE_END_REGEX = /[。！？!?]$/;
const SENTENCE_DELIMITER_REGEX = /[。！？!?]/;
const WORD_SPLIT_REGEX = /[\s、。！？]/;

function needsSpaceJoin(left: string, right: string): boolean {
  return /[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right);
}

function mergeText(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  return needsSpaceJoin(left, right) ? `${left} ${right}` : `${left}${right}`;
}

function splitWords(text: string): string[] {
  return text.split(WORD_SPLIT_REGEX).filter(Boolean);
}

function shouldMergePair(
  current: MergeableTranscriptSegment,
  next: MergeableTranscriptSegment,
  options: Required<MergeOptions>
): boolean {
  const currentText = current.text.trim();
  const nextText = next.text.trim();
  if (!currentText || !nextText) return false;

  const gap = next.start - current.end;
  if (gap > options.maxGap) return false;

  if (currentText.length >= options.maxChars) return false;

  const combinedLength =
    currentText.length + nextText.length + (needsSpaceJoin(currentText, nextText) ? 1 : 0);
  if (combinedLength > options.maxChars) return false;

  const currentDuration = current.end - current.start;
  const nextDuration = next.end - next.start;

  const currentComplete =
    SENTENCE_END_REGEX.test(currentText) &&
    currentText.length >= options.minChars &&
    currentDuration >= options.minDuration;

  if (currentComplete) return false;

  if (currentText.length < options.minChars || currentDuration < options.minDuration) return true;
  if (nextText.length < options.minChars || nextDuration < options.minDuration) return true;

  if (!SENTENCE_DELIMITER_REGEX.test(currentText) && !SENTENCE_DELIMITER_REGEX.test(nextText)) {
    return true;
  }

  return false;
}

export function shouldMergeTranscriptSegments(
  segments: MergeableTranscriptSegment[]
): boolean {
  if (segments.length < 6) return false;
  const shortCount = segments.filter(seg => seg.text.trim().length <= 3).length;
  const ratio = shortCount / segments.length;
  return ratio >= 0.35;
}

export function mergeTranscriptSegments(
  segments: MergeableTranscriptSegment[],
  options?: MergeOptions
): MergeableTranscriptSegment[] {
  if (segments.length === 0) return segments;
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const merged: MergeableTranscriptSegment[] = [];
  let buffer: MergeableTranscriptSegment | null = null;

  for (const segment of segments) {
    const cleanText = segment.text.trim();
    if (!cleanText) continue;

    if (!buffer) {
      buffer = { ...segment, text: cleanText, words: segment.words || splitWords(cleanText) };
      continue;
    }

    if (shouldMergePair(buffer, segment, opts)) {
      const combinedText = mergeText(buffer.text.trim(), cleanText);
      buffer = {
        ...buffer,
        end: segment.end,
        text: combinedText,
        words: splitWords(combinedText),
      };
      continue;
    }

    merged.push(buffer);
    buffer = { ...segment, text: cleanText, words: segment.words || splitWords(cleanText) };
  }

  if (buffer) merged.push(buffer);

  return merged;
}
