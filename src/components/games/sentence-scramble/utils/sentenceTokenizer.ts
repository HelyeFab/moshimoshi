// Sentence tokenizer utility for the Sentence Scramble game
// Uses the existing Kuromoji tokenization service

interface TokenizeResponse {
  tokens: Array<{
    surface_form: string
    pos: string
    pos_detail_1: string
    reading?: string
  }>
  tokenCount: number
  success: boolean
}

/**
 * Tokenizes a Japanese sentence into word blocks suitable for the scramble game
 * Groups particles with their preceding words for more natural chunks
 */
export async function tokenizeSentence(text: string): Promise<string[]> {
  try {
    // Use the existing tokenization API
    const response = await fetch('/api/furigana/tokenize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      // Fall back to simple tokenization
      return simpleFallbackTokenizer(text)
    }

    const data: TokenizeResponse = await response.json()

    if (!data.success || !data.tokens) {
      return simpleFallbackTokenizer(text)
    }

    // Process tokens into game-appropriate chunks
    const chunks: string[] = []
    let currentChunk = ''

    for (let i = 0; i < data.tokens.length; i++) {
      const token = data.tokens[i]
      const nextToken = data.tokens[i + 1]

      // Accumulate the surface form
      currentChunk += token.surface_form

      // Decide when to create a new chunk
      const shouldSplit = shouldSplitAfterToken(token, nextToken)

      if (shouldSplit) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk)
        }
        currentChunk = ''
      }
    }

    // Add any remaining text
    if (currentChunk.trim()) {
      chunks.push(currentChunk)
    }

    // If we got too few chunks, use fallback
    if (chunks.length < 2) {
      return simpleFallbackTokenizer(text)
    }

    return chunks

  } catch (error) {
    console.error('Tokenization failed, using fallback:', error)
    return simpleFallbackTokenizer(text)
  }
}

/**
 * Determines if we should split after the current token
 */
function shouldSplitAfterToken(
  currentToken: { pos: string; pos_detail_1: string; surface_form: string },
  nextToken?: { pos: string; pos_detail_1: string; surface_form: string }
): boolean {
  // Don't split if there's no next token
  if (!nextToken) return true

  // Common particles that should stay with the preceding word
  const bindingParticles = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'から', 'まで', 'より', 'へ', 'や', 'の']

  // Keep particles with their preceding word
  if (nextToken.pos === '助詞' && bindingParticles.includes(nextToken.surface_form)) {
    return false
  }

  // Split after particles
  if (currentToken.pos === '助詞') {
    return true
  }

  // Split after punctuation
  if (currentToken.pos === '記号') {
    return true
  }

  // Split after auxiliary verbs
  if (currentToken.pos === '助動詞') {
    return true
  }

  // Keep verb stems with their conjugations
  if (currentToken.pos === '動詞' && nextToken.pos === '助動詞') {
    return false
  }

  // Keep na-adjectives with their な
  if (currentToken.pos === '形容動詞' && nextToken.surface_form === 'な') {
    return false
  }

  // Default: split between different content words
  const contentWords = ['名詞', '動詞', '形容詞', '形容動詞', '副詞']
  if (contentWords.includes(currentToken.pos) && contentWords.includes(nextToken.pos)) {
    return true
  }

  return false
}

/**
 * Simple fallback tokenizer for when the API is unavailable
 * Splits by common particles and punctuation
 */
export function simpleFallbackTokenizer(text: string): string[] {
  // Common particles to split on
  const particles = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'から', 'まで', 'より', 'へ', 'や', 'の']
  const punctuation = ['。', '！', '？', '、']

  const chunks: string[] = []
  let currentChunk = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    currentChunk += char

    // Check if current character is a splitting point
    if (particles.includes(char) || punctuation.includes(char)) {
      // For particles, check if we should include more characters
      if (particles.includes(char) && nextChar && !particles.includes(nextChar) && !punctuation.includes(nextChar)) {
        // Keep the particle with the preceding word
        if (currentChunk.length > 1) {
          chunks.push(currentChunk)
          currentChunk = ''
        }
      } else if (punctuation.includes(char)) {
        // Always split after punctuation
        chunks.push(currentChunk)
        currentChunk = ''
      }
    }
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk)
  }

  // If we got too few chunks, split by character groups
  if (chunks.length < 3) {
    return splitByCharacterType(text)
  }

  return chunks.filter(chunk => chunk.trim().length > 0)
}

/**
 * Splits text by character type (hiragana, katakana, kanji)
 * Used as a last resort when other methods fail
 */
function splitByCharacterType(text: string): string[] {
  const chunks: string[] = []
  let currentChunk = ''
  let currentType: 'hiragana' | 'katakana' | 'kanji' | 'other' | null = null

  for (const char of text) {
    const type = getCharacterType(char)

    if (currentType && type !== currentType && type !== 'other') {
      if (currentChunk) {
        chunks.push(currentChunk)
      }
      currentChunk = char
      currentType = type
    } else {
      currentChunk += char
      if (!currentType) currentType = type
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  // If still too few chunks, split into reasonable segments
  if (chunks.length < 3 && text.length > 6) {
    const segmentLength = Math.ceil(text.length / 4)
    const result: string[] = []
    for (let i = 0; i < text.length; i += segmentLength) {
      result.push(text.slice(i, i + segmentLength))
    }
    return result.filter(chunk => chunk.trim())
  }

  return chunks.filter(chunk => chunk.trim())
}

/**
 * Determines the type of a Japanese character
 */
function getCharacterType(char: string): 'hiragana' | 'katakana' | 'kanji' | 'other' {
  const code = char.charCodeAt(0)

  // Hiragana range
  if (code >= 0x3040 && code <= 0x309f) {
    return 'hiragana'
  }

  // Katakana range
  if (code >= 0x30a0 && code <= 0x30ff) {
    return 'katakana'
  }

  // Kanji range (common CJK ideographs)
  if (code >= 0x4e00 && code <= 0x9faf) {
    return 'kanji'
  }

  return 'other'
}