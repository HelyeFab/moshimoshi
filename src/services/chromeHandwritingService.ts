/**
 * Chrome Handwriting Recognition Service
 *
 * Provides access to the native Chrome Handwriting Recognition API
 * for Japanese character recognition with automatic fallback detection.
 *
 * @see https://developer.chrome.com/docs/web-platform/handwriting-recognition
 *
 * Browser support: Chromium 99+
 * Japanese support: Platform-dependent (may require Japanese IME installed)
 */

import type {
  HandwritingRecognizer,
  HandwritingRecognizerQueryResult,
  HandwritingPrediction,
} from '@/types/handwriting-recognition'

export interface ChromeRecognitionResult {
  candidates: string[]
  confidence: number[]
  engine: 'chrome-native'
}

export interface StrokeInput {
  points: Array<{ x: number; y: number; timestamp?: number }>
}

type SupportStatus = 'supported' | 'unsupported' | 'unknown'

class ChromeHandwritingService {
  private recognizer: HandwritingRecognizer | null = null
  private initPromise: Promise<void> | null = null
  private apiSupported: SupportStatus = 'unknown'
  private japaneseSupported: SupportStatus = 'unknown'
  private queryResult: HandwritingRecognizerQueryResult | null = null

  /**
   * Check if the Chrome Handwriting Recognition API is available
   */
  isApiAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'createHandwritingRecognizer' in navigator &&
      typeof window !== 'undefined' &&
      'HandwritingStroke' in window
    )
  }

  /**
   * Query whether Japanese language recognition is supported
   * Results are cached after first query
   */
  async queryJapaneseSupport(): Promise<HandwritingRecognizerQueryResult | null> {
    if (!this.isApiAvailable()) {
      this.japaneseSupported = 'unsupported'
      return null
    }

    if (this.queryResult !== null) {
      return this.queryResult
    }

    try {
      // Query for Japanese support
      const result = await navigator.queryHandwritingRecognizerSupport({
        languages: ['ja'],
      })

      this.queryResult = result
      this.japaneseSupported = result ? 'supported' : 'unsupported'

      console.log('[ChromeHandwriting] Japanese support query result:', result)
      return result
    } catch (error) {
      console.warn('[ChromeHandwriting] Failed to query Japanese support:', error)
      this.japaneseSupported = 'unsupported'
      return null
    }
  }

  /**
   * Initialize the recognizer for Japanese characters
   * Returns true if initialization was successful
   */
  async initialize(): Promise<boolean> {
    // Return cached result if already initialized
    if (this.recognizer) {
      return true
    }

    // Return existing initialization promise if in progress
    if (this.initPromise) {
      await this.initPromise
      return this.recognizer !== null
    }

    this.initPromise = this._doInitialize()
    await this.initPromise
    return this.recognizer !== null
  }

  private async _doInitialize(): Promise<void> {
    if (!this.isApiAvailable()) {
      console.log('[ChromeHandwriting] API not available in this browser')
      this.apiSupported = 'unsupported'
      return
    }

    this.apiSupported = 'supported'

    // First check if Japanese is supported
    const queryResult = await this.queryJapaneseSupport()
    if (!queryResult) {
      console.log('[ChromeHandwriting] Japanese recognition not supported on this platform')
      return
    }

    try {
      // Create the recognizer for Japanese
      this.recognizer = await navigator.createHandwritingRecognizer({
        languages: ['ja'],
      })

      console.log('[ChromeHandwriting] Recognizer initialized successfully for Japanese')
    } catch (error) {
      console.warn('[ChromeHandwriting] Failed to create recognizer:', error)
      this.recognizer = null

      // Try English as fallback to verify API works
      try {
        const enRecognizer = await navigator.createHandwritingRecognizer({
          languages: ['en'],
        })
        enRecognizer.finish()
        console.log('[ChromeHandwriting] English recognizer works - Japanese may not be installed')
      } catch {
        console.warn('[ChromeHandwriting] API available but no language models installed')
      }
    }
  }

  /**
   * Check if the service is ready for recognition
   */
  isReady(): boolean {
    return this.recognizer !== null
  }

  /**
   * Get the current support status
   */
  getSupportStatus(): {
    apiSupported: SupportStatus
    japaneseSupported: SupportStatus
    ready: boolean
  } {
    return {
      apiSupported: this.apiSupported,
      japaneseSupported: this.japaneseSupported,
      ready: this.isReady(),
    }
  }

  /**
   * Recognize characters from stroke data
   *
   * @param strokes Array of strokes, each containing points with x, y, and optional timestamp
   * @param characterType Type of character expected ('kanji' | 'kana')
   * @returns Recognition result with candidates and confidence scores
   */
  async recognize(
    strokes: StrokeInput[],
    characterType: 'kanji' | 'kana' = 'kanji'
  ): Promise<ChromeRecognitionResult | null> {
    if (!this.recognizer) {
      const initialized = await this.initialize()
      if (!initialized || !this.recognizer) {
        return null
      }
    }

    if (strokes.length === 0) {
      return { candidates: [], confidence: [], engine: 'chrome-native' }
    }

    try {
      // Start a new drawing session
      const drawing = this.recognizer.startDrawing({
        recognitionType: 'per-character', // Best for single kanji/kana
        alternatives: 10, // Request top 10 candidates
      })

      // Convert our stroke format to Chrome API format
      for (const stroke of strokes) {
        const hwStroke = new window.HandwritingStroke()

        for (const point of stroke.points) {
          hwStroke.addPoint({
            x: point.x,
            y: point.y,
            t: point.timestamp,
          })
        }

        drawing.addStroke(hwStroke)
      }

      // Get predictions
      const predictions: HandwritingPrediction[] = await drawing.getPrediction()

      // Clear the drawing (cleanup)
      drawing.clear()

      if (!predictions || predictions.length === 0) {
        return { candidates: [], confidence: [], engine: 'chrome-native' }
      }

      // Extract candidates and generate confidence scores
      // Chrome API returns predictions ordered by likelihood
      const candidates: string[] = []
      const confidence: number[] = []

      for (let i = 0; i < predictions.length; i++) {
        const prediction = predictions[i]
        const text = prediction.text

        // For per-character mode, we may get multi-character predictions
        // Split into individual characters
        for (const char of text) {
          if (!candidates.includes(char)) {
            candidates.push(char)
            // Generate confidence score based on position
            // First prediction gets highest confidence, decreasing for alternatives
            confidence.push(Math.max(0.3, 1 - candidates.length * 0.08))
          }
        }
      }

      // Filter by character type if needed
      const filteredResult = this.filterByCharacterType(
        { candidates, confidence, engine: 'chrome-native' as const },
        characterType
      )

      console.log('[ChromeHandwriting] Recognition result:', filteredResult.candidates.slice(0, 5))

      return filteredResult
    } catch (error) {
      console.error('[ChromeHandwriting] Recognition failed:', error)
      return null
    }
  }

  /**
   * Filter candidates by character type (kanji or kana)
   */
  private filterByCharacterType(
    result: ChromeRecognitionResult,
    characterType: 'kanji' | 'kana'
  ): ChromeRecognitionResult {
    if (characterType !== 'kana') {
      // For kanji mode, return all candidates
      return result
    }

    // For kana mode, filter to only hiragana and katakana
    const isKana = (char: string): boolean => {
      const code = char.charCodeAt(0)
      // Hiragana: U+3040-U+309F, Katakana: U+30A0-U+30FF
      return (code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)
    }

    const filteredCandidates: string[] = []
    const filteredConfidence: number[] = []

    for (let i = 0; i < result.candidates.length; i++) {
      if (isKana(result.candidates[i])) {
        filteredCandidates.push(result.candidates[i])
        filteredConfidence.push(result.confidence[i])
      }
    }

    return {
      candidates: filteredCandidates,
      confidence: filteredConfidence,
      engine: 'chrome-native',
    }
  }

  /**
   * Clean up and release resources
   */
  dispose(): void {
    if (this.recognizer) {
      try {
        this.recognizer.finish()
      } catch (error) {
        console.warn('[ChromeHandwriting] Error during disposal:', error)
      }
      this.recognizer = null
    }
    this.initPromise = null
  }

  /**
   * Reset the service (useful for testing or language changes)
   */
  reset(): void {
    this.dispose()
    this.apiSupported = 'unknown'
    this.japaneseSupported = 'unknown'
    this.queryResult = null
  }
}

// Export singleton instance
export const chromeHandwritingService = new ChromeHandwritingService()
