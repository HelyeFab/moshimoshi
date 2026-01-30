/**
 * Shared types for Blast Mode screen components
 * Agent D - UI Components
 */

export interface BaseScreenProps {
  prompt: string
  onAnswer: (answer: string | string[], correct: boolean, responseTime: number) => void
  disabled?: boolean
}

export interface McqScreenProps extends BaseScreenProps {
  options: string[]
  correctAnswer: string
}

export interface TileScreenProps extends BaseScreenProps {
  tiles: string[]
  correctOrder: string[]
}

export interface ScreenFeedbackState {
  show: boolean
  correct: boolean
  message?: string
}
