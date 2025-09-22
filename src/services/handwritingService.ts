// Service wrapper for handwriting.js (Google IME API)
// Provides better recognition for hiragana and katakana characters

declare global {
  interface Window {
    handwriting: {
      recognize: (
        trace: number[][][], // Array of strokes, each stroke is array of [x, y] points
        options?: {
          language?: string
          numOfReturn?: number
          width?: number
          height?: number
        },
        callback?: (result: string[][], error?: any) => void
      ) => void
    }
  }
}

export interface HandwritingResult {
  candidates: string[]
  confidence: number[]
}

class HandwritingService {
  private isLoaded = false
  private loadPromise: Promise<void> | null = null

  // Load the handwriting.js script dynamically
  async loadScript(): Promise<void> {
    if (this.isLoaded) return
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof window !== 'undefined' && window.handwriting) {
        this.isLoaded = true
        resolve()
        return
      }

      // Load handwriting.js
      const script = document.createElement('script')
      script.src = '/scripts/handwriting.js'
      script.async = true

      script.onload = () => {
        this.isLoaded = true
        console.log('Handwriting.js loaded successfully')
        resolve()
      }

      script.onerror = () => {
        console.error('Failed to load handwriting.js')
        reject(new Error('Failed to load handwriting.js'))
      }

      document.head.appendChild(script)
    })

    return this.loadPromise
  }

  // Convert canvas strokes to handwriting.js format
  convertStrokesToTrace(strokes: Array<{ points: Array<{ x: number; y: number }> }>): number[][][] {
    return strokes.map(stroke =>
      stroke.points.map(point => [point.x, point.y])
    )
  }

  // Recognize characters using Google IME
  async recognize(
    strokes: Array<{ points: Array<{ x: number; y: number }> }>,
    canvasWidth: number = 300,
    canvasHeight: number = 300
  ): Promise<HandwritingResult> {
    await this.loadScript()

    return new Promise((resolve, reject) => {
      if (!window.handwriting) {
        reject(new Error('Handwriting.js not loaded'))
        return
      }

      const trace = this.convertStrokesToTrace(strokes)

      // Options for Japanese recognition
      const options = {
        language: 'ja', // Japanese
        numOfReturn: 10, // Return top 10 candidates
        width: canvasWidth,
        height: canvasHeight
      }

      window.handwriting.recognize(trace, options, (result, error) => {
        if (error) {
          console.error('Handwriting recognition error:', error)
          resolve({ candidates: [], confidence: [] })
          return
        }

        // Result is an array of arrays, flatten and take first set
        const candidates = result && result.length > 0 ? result.flat() : []

        // Generate confidence scores (Google IME doesn't provide them)
        // Higher confidence for earlier candidates
        const confidence = candidates.map((_, index) =>
          Math.max(0.3, 1 - (index * 0.1))
        )

        console.log('Handwriting.js recognition result:', candidates)

        resolve({
          candidates: candidates.slice(0, 10),
          confidence: confidence.slice(0, 10)
        })
      })
    })
  }

  // Filter results for kana only
  filterKanaOnly(result: HandwritingResult): HandwritingResult {
    const isKana = (char: string) => {
      const code = char.charCodeAt(0)
      // Hiragana: 0x3040-0x309F, Katakana: 0x30A0-0x30FF
      return (code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)
    }

    const filtered = result.candidates
      .map((char, index) => ({ char, confidence: result.confidence[index] }))
      .filter(item => isKana(item.char))

    return {
      candidates: filtered.map(item => item.char),
      confidence: filtered.map(item => item.confidence)
    }
  }
}

export const handwritingService = new HandwritingService()