/**
 * TypeScript type definitions for the Chrome Handwriting Recognition API
 * @see https://developer.chrome.com/docs/web-platform/handwriting-recognition
 * @see https://wicg.github.io/handwriting-recognition/
 *
 * Browser support: Chromium 99+
 * Note: Japanese language support depends on the underlying platform
 */

interface HandwritingPoint {
  /** X coordinate relative to the canvas */
  x: number
  /** Y coordinate relative to the canvas */
  y: number
  /** Optional timestamp in milliseconds */
  t?: number
}

interface HandwritingStroke {
  /** Add a point to the stroke */
  addPoint(point: HandwritingPoint): void
  /** Get all points in the stroke */
  getPoints(): HandwritingPoint[]
  /** Clear all points from the stroke */
  clear(): void
}

interface HandwritingStrokeConstructor {
  new (): HandwritingStroke
}

interface HandwritingSegment {
  /** The recognized grapheme */
  grapheme: string
  /** Start index in the full text */
  beginIndex: number
  /** End index in the full text */
  endIndex: number
  /** Strokes that form this segment */
  drawingSegments: Array<{
    strokeIndex: number
    beginPointIndex: number
    endPointIndex: number
  }>
}

interface HandwritingPrediction {
  /** The recognized text */
  text: string
  /** Segmentation result (if supported and requested) */
  segmentationResult?: HandwritingSegment[]
}

interface HandwritingDrawingHints {
  /** Type of content expected */
  recognitionType?: 'text' | 'email' | 'number' | 'per-character'
  /** Type of input device */
  inputType?: 'mouse' | 'stylus' | 'touch'
  /** Expected characters (may be ignored by some implementations) */
  textContext?: string
  /** Number of alternative predictions to return */
  alternatives?: number
}

interface HandwritingDrawing {
  /** Add a completed stroke to the drawing */
  addStroke(stroke: HandwritingStroke): void
  /** Remove all strokes from the drawing */
  clear(): void
  /** Get predictions for the current drawing */
  getPrediction(): Promise<HandwritingPrediction[]>
  /** Get all strokes in the drawing */
  getStrokes(): HandwritingStroke[]
}

interface HandwritingRecognizer {
  /** Start a new drawing session */
  startDrawing(hints?: HandwritingDrawingHints): HandwritingDrawing
  /** Release resources associated with this recognizer */
  finish(): void
}

interface HandwritingRecognizerConstraints {
  /** Languages to recognize, in order of preference (BCP 47 codes) */
  languages: string[]
}

interface HandwritingRecognizerQueryResult {
  /** Whether text alternatives are supported */
  textAlternatives?: boolean | null
  /** Whether text segmentation is supported */
  textSegmentation?: boolean | null
  /** Supported hints */
  hints?: {
    recognitionType?: string[] | null
    inputType?: string[] | null
    textContext?: boolean | null
    alternatives?: boolean | null
  } | null
}

interface NavigatorHandwriting {
  /** Check if the API is supported and query capabilities */
  queryHandwritingRecognizerSupport(
    constraints: HandwritingRecognizerConstraints
  ): Promise<HandwritingRecognizerQueryResult | null>

  /** Create a handwriting recognizer for the specified languages */
  createHandwritingRecognizer(
    constraints: HandwritingRecognizerConstraints
  ): Promise<HandwritingRecognizer>
}

declare global {
  interface Navigator extends NavigatorHandwriting {}

  interface Window {
    HandwritingStroke: HandwritingStrokeConstructor
  }
}

export {
  HandwritingPoint,
  HandwritingStroke,
  HandwritingStrokeConstructor,
  HandwritingSegment,
  HandwritingPrediction,
  HandwritingDrawingHints,
  HandwritingDrawing,
  HandwritingRecognizer,
  HandwritingRecognizerConstraints,
  HandwritingRecognizerQueryResult,
  NavigatorHandwriting,
}
