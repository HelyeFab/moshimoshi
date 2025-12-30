// Wrapper service for KanjiCanvas library
// Provides TypeScript interface for the global KanjiCanvas object
//
// Recognition Priority Chain:
// 1. Chrome Handwriting Recognition API (native, offline-capable)
// 2. Google IME via handwriting.js (online, good accuracy)
// 3. KanjiCanvas library (offline fallback)

import { handwritingService } from './handwritingService'
import { chromeHandwritingService } from './chromeHandwritingService'

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

export type RecognitionEngine = 'chrome-native' | 'google-ime' | 'kanji-canvas' | 'unknown'

export interface RecognitionResult {
  candidates: string[]
  confidence: number[]
  /** Which recognition engine produced this result */
  engine?: RecognitionEngine
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
        console.warn('kanji-canvas.min.js not found; falling back to handwriting-only recognition')
        // Resolve without setting isLoaded so handwriting fallback can be used
        resolve()
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
      console.warn('KanjiCanvas not loaded; using handwriting fallback only')
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
      console.warn('KanjiCanvas not loaded; returning empty candidates (fallback will handle)')
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

  // Get filtered recognition results based on character type
  recognizeWithFilter(canvasId: string, characterType?: 'kanji' | 'kana'): RecognitionResult {
    const result = this.recognize(canvasId)

    if (result.candidates.length === 0) {
      return result
    }

    // If no character type specified, return original results
    if (!characterType || characterType === 'kanji') {
      return result
    }

    let filteredCandidates = result.candidates
    let filteredConfidence = result.confidence

    // If kana mode, prioritize kana characters
    if (characterType === 'kana') {
      const isKana = (char: string) => {
        const code = char.charCodeAt(0)
        // Hiragana: 0x3040-0x309F, Katakana: 0x30A0-0x30FF
        return (code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)
      }

      // Log for debugging
      console.log('Original candidates:', filteredCandidates)

      // Separate kana and kanji with their confidence scores
      const candidatesWithConfidence = filteredCandidates.map((char, index) => ({
        char,
        confidence: filteredConfidence[index] || 0.5
      }))

      const kanaCandidates = candidatesWithConfidence.filter(c => isKana(c.char))
      const kanjiCandidates = candidatesWithConfidence.filter(c => !isKana(c.char))

      console.log('Kana candidates found:', kanaCandidates.map(c => c.char))
      console.log('Kanji candidates found:', kanjiCandidates.map(c => c.char).slice(0, 5))

      // For kana mode, ONLY show kana candidates - no kanji at all
      const combined = kanaCandidates

      if (kanaCandidates.length === 0) {
        console.warn('No kana candidates found for kana character - recognition may have failed')
        // Return empty results if no kana found
        return { candidates: [], confidence: [] }
      }

      filteredCandidates = combined.map(c => c.char)
      filteredConfidence = combined.map(c => c.confidence)
    }

    return {
      candidates: filteredCandidates.slice(0, 10), // Return top 10 filtered candidates
      confidence: filteredConfidence.slice(0, 10)
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

  /**
   * Hybrid recognition using multiple engines with priority fallback:
   * 1. Chrome Handwriting Recognition API (native, offline-capable)
   * 2. Google IME via handwriting.js (online, good accuracy)
   * 3. KanjiCanvas library (offline fallback)
   */
  async recognizeHybrid(
    canvasId: string,
    strokes: Array<{ points: Array<{ x: number; y: number; timestamp?: number }> }>,
    characterType?: 'kanji' | 'kana',
    canvasWidth: number = 300,
    canvasHeight: number = 300
  ): Promise<RecognitionResult> {
    if (strokes.length === 0) {
      return { candidates: [], confidence: [], engine: 'unknown' }
    }

    // === PRIORITY 1: Chrome Handwriting Recognition API ===
    // Native browser API - fast, offline-capable, real confidence scores
    try {
      const chromeResult = await chromeHandwritingService.recognize(
        strokes,
        characterType || 'kanji'
      )

      if (chromeResult && chromeResult.candidates.length > 0) {
        console.log('[Recognition] Using Chrome native API:', chromeResult.candidates.slice(0, 5))
        return {
          candidates: chromeResult.candidates,
          confidence: chromeResult.confidence,
          engine: 'chrome-native',
        }
      }
    } catch (error) {
      // Chrome API not available or failed - continue to fallback
      const status = chromeHandwritingService.getSupportStatus()
      if (status.apiSupported === 'unknown') {
        console.log('[Recognition] Chrome API not available, using fallback')
      } else {
        console.warn('[Recognition] Chrome API error:', error)
      }
    }

    // === PRIORITY 2: Google IME via handwriting.js ===
    // Online API - good accuracy for Japanese
    let googleKanjiResult: RecognitionResult | null = null
    let googleKanaResult: RecognitionResult | null = null

    try {
      const googleResult = await handwritingService.recognize(strokes, canvasWidth, canvasHeight)
      console.log('[Recognition] Google IME raw result:', googleResult.candidates.slice(0, 10))

      // Apply appropriate filter based on character type
      if (characterType === 'kana') {
        const filtered = handwritingService.filterKanaOnly(googleResult)
        if (filtered.candidates.length > 0) {
          console.log('[Recognition] Using Google IME (kana):', filtered.candidates.slice(0, 5))
          return {
            candidates: filtered.candidates,
            confidence: filtered.confidence,
            engine: 'google-ime',
          }
        }
      } else if (characterType === 'kanji') {
        // For kanji mode, check if Google IME found any kanji
        googleKanjiResult = handwritingService.filterKanjiOnly(googleResult)
        googleKanaResult = handwritingService.filterKanaOnly(googleResult)

        if (googleKanjiResult.candidates.length > 0) {
          console.log('[Recognition] Using Google IME (kanji):', googleKanjiResult.candidates.slice(0, 5))
          return {
            candidates: googleKanjiResult.candidates,
            confidence: googleKanjiResult.confidence,
            engine: 'google-ime',
          }
        }
        // If no kanji from Google IME, continue to try KanjiCanvas before showing kana
        console.log('[Recognition] Google IME returned no kanji, trying KanjiCanvas...')
      } else {
        // No filter specified - filter out garbage
        const filtered = handwritingService.filterJapaneseOnly(googleResult)
        if (filtered.candidates.length > 0) {
          console.log('[Recognition] Using Google IME:', filtered.candidates.slice(0, 5))
          return {
            candidates: filtered.candidates,
            confidence: filtered.confidence,
            engine: 'google-ime',
          }
        }
      }
    } catch (error) {
      console.warn('[Recognition] Google IME failed:', error)
    }

    // === PRIORITY 3: KanjiCanvas library ===
    // Local library - specifically designed for kanji recognition
    const kanjiCanvasResult = this.recognizeWithFilter(canvasId, characterType)
    if (kanjiCanvasResult.candidates.length > 0) {
      console.log('[Recognition] Using KanjiCanvas:', kanjiCanvasResult.candidates.slice(0, 5))
      return {
        ...kanjiCanvasResult,
        engine: 'kanji-canvas',
      }
    }

    // === FALLBACK: If KanjiCanvas also failed, show Google IME kana results ===
    // This handles cases where user might be drawing kana in kanji search
    if (characterType === 'kanji' && googleKanaResult && googleKanaResult.candidates.length > 0) {
      console.log('[Recognition] Fallback to Google IME kana:', googleKanaResult.candidates.slice(0, 5))
      return {
        candidates: googleKanaResult.candidates,
        confidence: googleKanaResult.confidence,
        engine: 'google-ime',
      }
    }

    console.warn('[Recognition] All engines failed to produce candidates')
    return { candidates: [], confidence: [], engine: 'unknown' }
  }

  /**
   * Get the current status of available recognition engines
   */
  getEngineStatus(): {
    chromeApi: { available: boolean; japaneseSupported: boolean }
    googleIme: { available: boolean }
    kanjiCanvas: { available: boolean }
  } {
    const chromeStatus = chromeHandwritingService.getSupportStatus()

    return {
      chromeApi: {
        available: chromeStatus.apiSupported === 'supported',
        japaneseSupported: chromeStatus.japaneseSupported === 'supported',
      },
      googleIme: {
        available: true, // Always available (requires network)
      },
      kanjiCanvas: {
        available: this.isLoaded && !!window.KanjiCanvas,
      },
    }
  }

  /**
   * Pre-initialize all recognition engines for faster first recognition
   */
  async preloadEngines(): Promise<void> {
    const promises: Promise<unknown>[] = []

    // Initialize Chrome API if available
    if (chromeHandwritingService.isApiAvailable()) {
      promises.push(chromeHandwritingService.initialize())
    }

    // Load handwriting.js
    promises.push(handwritingService.loadScript())

    // Load KanjiCanvas
    promises.push(this.loadScripts())

    await Promise.allSettled(promises)

    console.log('[Recognition] Engine status:', this.getEngineStatus())
  }
}

export const kanjiCanvasService = new KanjiCanvasService()
