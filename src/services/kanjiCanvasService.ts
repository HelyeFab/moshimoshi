// Wrapper service for KanjiCanvas library
// Provides TypeScript interface for the global KanjiCanvas object

declare global {
  interface Window {
    KanjiCanvas: {
      init: (canvasId: string) => void
      erase: (canvasId: string) => void
      deleteLast: (canvasId: string) => void
      recognize: (canvasId: string) => string | string[]
      refPatterns?: any[]
    }
  }
}

export interface RecognitionResult {
  candidates: string[]
  confidence: number[]
}

class KanjiCanvasService {
  private isLoaded = false
  private loadPromise: Promise<void> | null = null

  // Load the KanjiCanvas scripts dynamically
  async loadScripts(): Promise<void> {
    if (this.isLoaded) return
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof window !== 'undefined' && window.KanjiCanvas) {
        this.isLoaded = true
        resolve()
        return
      }

      // Load kanji-canvas.min.js
      const kanjiCanvasScript = document.createElement('script')
      kanjiCanvasScript.src = '/scripts/kanji-canvas.min.js'
      kanjiCanvasScript.async = true

      kanjiCanvasScript.onload = () => {
        // Load ref-patterns.js after kanji-canvas loads
        const refPatternsScript = document.createElement('script')
        refPatternsScript.src = '/scripts/ref-patterns.js'
        refPatternsScript.async = true

        refPatternsScript.onload = () => {
          this.isLoaded = true
          console.log('KanjiCanvas loaded successfully')
          resolve()
        }

        refPatternsScript.onerror = () => {
          console.error('Failed to load ref-patterns.js')
          reject(new Error('Failed to load ref-patterns.js'))
        }

        document.head.appendChild(refPatternsScript)
      }

      kanjiCanvasScript.onerror = () => {
        console.error('Failed to load kanji-canvas.min.js')
        reject(new Error('Failed to load kanji-canvas.min.js'))
      }

      document.head.appendChild(kanjiCanvasScript)
    })

    return this.loadPromise
  }

  // Initialize a canvas for drawing
  async initCanvas(canvasId: string): Promise<void> {
    await this.loadScripts()

    // Check if canvas exists in DOM
    const canvasElement = document.getElementById(canvasId)
    if (!canvasElement) {
      throw new Error(`Canvas with id ${canvasId} not found in DOM`)
    }

    if (window.KanjiCanvas) {
      try {
        window.KanjiCanvas.init(canvasId)
      } catch (error) {
        console.error('KanjiCanvas.init error:', error)
        throw error
      }
    } else {
      throw new Error('KanjiCanvas not loaded')
    }
  }

  // Clear the canvas
  eraseCanvas(canvasId: string): void {
    if (!this.isLoaded || !window.KanjiCanvas) {
      console.warn('KanjiCanvas not loaded')
      return
    }
    window.KanjiCanvas.erase(canvasId)
  }

  // Delete the last stroke
  deleteLastStroke(canvasId: string): void {
    if (!this.isLoaded || !window.KanjiCanvas) {
      console.warn('KanjiCanvas not loaded')
      return
    }
    window.KanjiCanvas.deleteLast(canvasId)
  }

  // Recognize the drawn character
  recognize(canvasId: string): RecognitionResult {
    if (!this.isLoaded || !window.KanjiCanvas) {
      console.warn('KanjiCanvas not loaded')
      return { candidates: [], confidence: [] }
    }

    try {
      const result = window.KanjiCanvas.recognize(canvasId)

      // The library returns a string of candidates
      if (typeof result === 'string') {
        const candidates = result.split('')

        // Generate mock confidence scores (in real implementation, these would come from the algorithm)
        // First candidate has highest confidence, decreasing for subsequent ones
        const confidence = candidates.map((_, index) => {
          return Math.max(0.3, 1 - (index * 0.15))
        })

        return { candidates, confidence }
      }

      return { candidates: [], confidence: [] }
    } catch (error) {
      console.error('Recognition error:', error)
      return { candidates: [], confidence: [] }
    }
  }

  // Check if a character matches the expected one
  checkMatch(canvasId: string, expectedCharacter: string, characterType?: 'kanji' | 'kana'): {
    isMatch: boolean
    confidence: number
    candidates: string[]
  } {
    const result = this.recognize(canvasId)

    if (result.candidates.length === 0) {
      return { isMatch: false, confidence: 0, candidates: [] }
    }

    let filteredCandidates = result.candidates

    // If kana mode, prioritize kana characters
    if (characterType === 'kana') {
      const isKana = (char: string) => {
        const code = char.charCodeAt(0)
        // Hiragana: 0x3040-0x309F, Katakana: 0x30A0-0x30FF
        return (code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)
      }

      // Separate kana and kanji
      const kanaCandidates = filteredCandidates.filter(isKana)
      const kanjiCandidates = filteredCandidates.filter(c => !isKana(c))

      // Prioritize kana, then add some kanji as fallback
      filteredCandidates = [...kanaCandidates, ...kanjiCandidates.slice(0, 2)]
    }

    // Check if expected character is in the filtered candidates
    const matchIndex = filteredCandidates.indexOf(expectedCharacter)
    const isMatch = matchIndex !== -1 && matchIndex < 5
    const confidence = isMatch ? result.confidence[matchIndex] : 0

    return {
      isMatch,
      confidence,
      candidates: filteredCandidates.slice(0, 5) // Return top 5 candidates
    }
  }

  // Calculate a score based on recognition results
  calculateScore(canvasId: string, expectedCharacter: string): number {
    const result = this.checkMatch(canvasId, expectedCharacter)

    if (!result.isMatch) {
      // Even if not a direct match, give partial credit if character structure is similar
      return 40 // Base score for attempting
    }

    // Score based on position in candidates and confidence
    const matchIndex = result.candidates.indexOf(expectedCharacter)

    if (matchIndex === 0) {
      // Perfect match as top candidate
      return Math.round(90 + (result.confidence * 10))
    } else if (matchIndex === 1) {
      // Second candidate
      return Math.round(75 + (result.confidence * 10))
    } else if (matchIndex <= 2) {
      // Third candidate
      return Math.round(65 + (result.confidence * 5))
    } else {
      // Lower candidates
      return Math.round(55 + (result.confidence * 5))
    }
  }
}

export const kanjiCanvasService = new KanjiCanvasService()