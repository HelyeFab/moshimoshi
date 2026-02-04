/**
 * Utility for splitting Japanese text into sentences
 * Handles Japanese sentence delimiters: 。！？
 *
 * Used by:
 * - EnhancedArticleReaderFinal (article content display + shadowing mode)
 * - MoshiShadowingPlayer (sentence-by-sentence playback)
 */

/**
 * Splits Japanese text into individual sentences
 * Preserves sentence delimiters (。！？) at the end of each sentence
 *
 * @param text - Japanese text to split
 * @returns Array of sentences with delimiters preserved
 *
 * @example
 * splitIntoSentences("彼は学生です。彼女は先生です。")
 * // Returns: ["彼は学生です。", "彼女は先生です。"]
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return []
  }

  const sentences: string[] = []
  // Split on Japanese sentence delimiters while capturing them
  // Regex explanation: ([。！？]) = capture group for delimiters
  const parts = text.split(/([。！？])/)
  let current = ''

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue

    // Check if this part is a delimiter
    if (/^[。！？]$/.test(part)) {
      current += part
      // Push completed sentence (text + delimiter)
      if (current.trim()) {
        sentences.push(current.trim())
        current = ''
      }
    } else {
      // Regular text - accumulate
      current += part
    }
  }

  // Add any remaining text (edge case: text without final delimiter)
  if (current.trim()) {
    sentences.push(current.trim())
  }

  return sentences
}

/**
 * Quick check if text contains sentence delimiters
 * Useful for validation before splitting
 */
export function hasSentenceDelimiters(text: string): boolean {
  return /[。！？]/.test(text)
}

/**
 * Count sentences in text (without actually splitting)
 */
export function countSentences(text: string): number {
  if (!text) return 0
  const matches = text.match(/[。！？]/g)
  return matches ? matches.length : 0
}
