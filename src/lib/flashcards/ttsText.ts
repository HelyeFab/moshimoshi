import { stripFurigana } from '@/lib/flashcards/furiganaUtils'

const decodeBasicEntities = (text: string): string =>
  text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")

/**
 * Normalize card text for TTS:
 * - keep ruby base text, drop readings
 * - remove markup without introducing token-breaking spaces
 * - preserve intentional line boundaries as pauses
 */
export const normalizeTextForTTS = (text?: string | null): string => {
  if (!text) return ''

  const noFurigana = stripFurigana(text)

  return decodeBasicEntities(noFurigana)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, '')
    .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n+\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
