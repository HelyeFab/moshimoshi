'use client'

import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import MultipleChoiceInput from './inputs/MultipleChoiceInput'
import TextInput from './inputs/TextInput'

interface AnswerInputProps {
  mode: ReviewMode
  content: ReviewableContent
  contentPool?: ReviewableContent[]  // Pool for generating multiple choice options
  onAnswer: (answer: string, confidence?: number) => void
  disabled: boolean
  showAnswer: boolean
}

export default function AnswerInput({
  mode,
  content,
  contentPool = [],
  onAnswer,
  disabled,
  showAnswer
}: AnswerInputProps) {
  const inputProps = { content, onAnswer, disabled, showAnswer }
  const multipleChoiceProps = { ...inputProps, contentPool }
  
  switch (mode) {
    case 'recognition':
      return <MultipleChoiceInput {...multipleChoiceProps} />
      
    case 'recall':
      return <TextInput {...inputProps} />
      
    case 'listening':
      return <MultipleChoiceInput {...multipleChoiceProps} />
      
    default:
      return <TextInput {...inputProps} />
  }
}