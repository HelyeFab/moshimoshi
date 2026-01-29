'use client'

import { BlastStep, BlastStepAnswer } from '@/lib/blast-mode/types'
import {
  MeaningToJpMcq,
  JpToMeaningMcq,
  OnyomiMcq,
  KunyomiMcq,
  OtherReadingMcq,
  JpReassemble
} from '@/components/blast-mode/screens'

interface BlastStepRendererProps {
  step: BlastStep
  stepIndex: number
  totalSteps: number
  onAnswer: (answer: string | string[], correct: boolean) => void
  isAnswered: boolean
  wasCorrect?: boolean
  savedAnswer?: BlastStepAnswer
}

/**
 * Blast Step Renderer
 * Maps step types to their screen components
 *
 * PLACEHOLDER: Will be fully implemented when Agent D delivers screen components
 */
export default function BlastStepRenderer({
  step,
  stepIndex,
  totalSteps,
  onAnswer,
  isAnswered,
  savedAnswer
}: BlastStepRendererProps) {
  const disabled = isAnswered

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step Indicator */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Step {stepIndex + 1} of {totalSteps}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide">
          {step.stepType.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Prompt handled inside each screen component */}

      {/* Content based on step type */}
      {step.stepType === 'meaning_to_jp_mcq' && (
        <MeaningToJpMcq
          prompt={step.prompt}
          options={step.options || []}
          correctAnswer={step.answer as string}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      )}

      {step.stepType === 'jp_to_meaning_mcq' && (
        <JpToMeaningMcq
          prompt={step.prompt}
          options={step.options || []}
          correctAnswer={step.answer as string}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      )}

      {step.stepType === 'onyomi_mcq' && (
        <OnyomiMcq
          prompt={step.prompt}
          options={step.options || []}
          correctAnswer={step.answer as string}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      )}

      {step.stepType === 'kunyomi_mcq' && (
        <KunyomiMcq
          prompt={step.prompt}
          options={step.options || []}
          correctAnswer={step.answer as string}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      )}

      {step.stepType === 'other_reading_mcq' && (
        <OtherReadingMcq
          prompt={step.prompt}
          options={step.options || []}
          correctAnswer={step.answer as string}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      )}

      {step.stepType === 'jp_reassemble' && (
        <JpReassemble
          prompt={step.prompt}
          tiles={step.tiles || []}
          correctOrder={Array.isArray(step.answer) ? step.answer : []}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      )}

      {/* Saved answer hint when navigating back */}
      {isAnswered && savedAnswer && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <span className="font-medium">Saved:</span>{' '}
          {Array.isArray(savedAnswer.userAnswer)
            ? savedAnswer.userAnswer.join('')
            : savedAnswer.userAnswer}
        </div>
      )}
    </div>
  )
}
