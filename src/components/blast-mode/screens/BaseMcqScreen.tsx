/**
 * Base MCQ Screen Component
 * Agent D - UI Components
 *
 * Shared component for all multiple-choice question screens
 * Uses app theme tokens, no hardcoded colors
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { McqScreenProps } from './types'
import { useTranslation } from '@/hooks/useTranslation'

export function BaseMcqScreen({
  prompt,
  options,
  correctAnswer,
  onAnswer,
  disabled = false
}: McqScreenProps) {
  const { t } = useTranslation()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Reset state when prompt changes
  useEffect(() => {
    setSelectedOption(null)
    setShowFeedback(false)
    setIsCorrect(false)
  }, [prompt])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleOptionSelect = (option: string) => {
    if (disabled || showFeedback) return

    setSelectedOption(option)
    const correct = option === correctAnswer
    setIsCorrect(correct)
    setShowFeedback(true)

    // Clear any existing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Auto-advance after feedback
    timeoutRef.current = setTimeout(() => {
      onAnswer(option, correct)
    }, 1200)
  }

  // Keyboard navigation
  useEffect(() => {
    if (disabled || showFeedback) return

    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key
      if (key >= '1' && key <= '4') {
        const index = parseInt(key) - 1
        if (index < options.length) {
          handleOptionSelect(options[index])
        }
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [options, disabled, showFeedback])

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Prompt */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xl text-center text-foreground font-medium">
            {prompt}
          </p>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="grid gap-3">
        {options.map((option, index) => {
          const isSelected = selectedOption === option
          const showCorrect = showFeedback && option === correctAnswer
          const showIncorrect = showFeedback && isSelected && !isCorrect

          return (
            <motion.div
              key={option}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Button
                variant="outline"
                className={cn(
                  "w-full h-auto py-4 px-6 text-lg justify-start items-start relative",
                  "transition-all duration-200",
                  isSelected && !showFeedback && "ring-2 ring-ring",
                  showCorrect && "bg-green-50 dark:bg-green-950 border-green-500",
                  showIncorrect && "bg-red-50 dark:bg-red-950 border-red-500"
                )}
                onClick={() => handleOptionSelect(option)}
                disabled={disabled || showFeedback}
                aria-label={`Option ${index + 1}: ${option}`}
              >
                {/* Option number */}
                <span className="text-muted-foreground mr-3 font-mono">
                  {index + 1}
                </span>

                {/* Option text */}
                <span className="flex-1 text-left whitespace-normal break-words leading-relaxed">
                  {option}
                </span>

                {/* Feedback icon */}
                {showCorrect && (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-2" />
                )}
                {showIncorrect && (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-2" />
                )}
              </Button>
            </motion.div>
          )
        })}
      </div>

      {/* Keyboard hint */}
      {!showFeedback && (
        <p className="text-sm text-muted-foreground text-center">
          {t('blastMode.screens.mcq.hint')}
        </p>
      )}
    </div>
  )
}
