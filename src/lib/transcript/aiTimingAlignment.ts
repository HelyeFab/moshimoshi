export interface TimedTextSegment {
  text: string
  start: number
  end: number
}

export interface AlignmentResult {
  segments: TimedTextSegment[]
  matchedRatio: number
}

const MIN_DURATION_SEC = 0.2
const EPSILON_SEC = 0.02

interface CharTiming {
  char: string
  start: number
  end: number
}

function buildCharTimeline(source: TimedTextSegment[]): CharTiming[] {
  const timeline: CharTiming[] = []

  for (const seg of source) {
    const text = (seg.text || '').trim()
    if (!text) continue

    const chars = Array.from(text)
    const duration = Math.max(seg.end - seg.start, MIN_DURATION_SEC)
    const step = duration / chars.length

    for (let i = 0; i < chars.length; i++) {
      const start = seg.start + step * i
      const end = seg.start + step * (i + 1)
      timeline.push({ char: chars[i], start, end })
    }
  }

  return timeline
}

/**
 * Align AI-proposed segment texts to source timeline by exact text anchoring.
 * Returns null when alignment confidence is too low.
 */
export function alignAiTextsToSourceTimeline(
  aiTexts: string[],
  source: TimedTextSegment[],
  minMatchRatio: number = 0.95
): AlignmentResult | null {
  const cleanedAiTexts = aiTexts.map(t => (t || '').trim()).filter(Boolean)
  if (cleanedAiTexts.length === 0) return null

  const timeline = buildCharTimeline(source)
  if (timeline.length === 0) return null

  const sourceText = timeline.map(c => c.char).join('')
  const totalAiChars = cleanedAiTexts.reduce((sum, t) => sum + Array.from(t).length, 0)
  if (totalAiChars === 0) return null

  const aligned: TimedTextSegment[] = []
  let matchedChars = 0
  let cursor = 0
  let prevEnd = source[0].start

  for (const text of cleanedAiTexts) {
    const len = Array.from(text).length
    let idx = sourceText.indexOf(text, cursor)
    if (idx < 0) idx = sourceText.indexOf(text)

    if (idx < 0) {
      continue
    }

    const startChar = timeline[idx]
    const endChar = timeline[idx + len - 1]
    if (!startChar || !endChar) continue

    let start = startChar.start
    let end = endChar.end
    if (start < prevEnd) start = prevEnd + EPSILON_SEC
    if (end <= start) end = start + MIN_DURATION_SEC

    aligned.push({ text, start, end })
    prevEnd = end
    cursor = idx + len
    matchedChars += len
  }

  const matchedRatio = matchedChars / totalAiChars
  if (aligned.length === 0 || matchedRatio < minMatchRatio) return null

  return { segments: aligned, matchedRatio }
}

