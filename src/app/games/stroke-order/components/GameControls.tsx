'use client'

import React from 'react'
import { Lightbulb, MousePointer, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nContext'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
export type InputMode = 'click' | 'draw'

interface Props {
  difficulty: Difficulty
  onDifficultyChange: (difficulty: Difficulty) => void
  inputMode: InputMode
  onInputModeChange: (mode: InputMode) => void
  onHint: () => void
  hintsRemaining: number
}

const difficulties: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'expert', label: 'Expert' },
]

export default function GameControls({
  difficulty,
  onDifficultyChange,
  inputMode,
  onInputModeChange,
  onHint,
  hintsRemaining,
}: Props) {
  const { strings } = useI18n()

  return (
    <div className="flex flex-col gap-4">
      {/* First row: Difficulty and Hint */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{strings.games?.strokeOrder?.difficulty || 'Difficulty'}:</span>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {difficulties.map((diff) => (
              <Button
                key={diff.value}
                variant={difficulty === diff.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onDifficultyChange(diff.value)}
                className={`h-8 px-3 ${
                  difficulty === diff.value
                    ? ''
                    : 'hover:bg-white/60 dark:hover:bg-gray-700'
                }`}
              >
                {diff.label}
              </Button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onHint}
          disabled={hintsRemaining === 0}
          className="flex items-center gap-2"
        >
          <Lightbulb className="h-4 w-4" />
          <span>{strings.games?.strokeOrder?.hint || 'Hint'} ({hintsRemaining})</span>
        </Button>
      </div>

      {/* Second row: Input mode */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-medium">{strings.games?.strokeOrder?.inputMode || 'Input Mode'}:</span>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <Button
            variant={inputMode === 'click' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onInputModeChange('click')}
            className="flex items-center gap-2 h-8"
          >
            <MousePointer className="h-4 w-4" />
            <span>{strings.games?.strokeOrder?.clickMode || 'Click'}</span>
          </Button>
          <Button
            variant={inputMode === 'draw' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onInputModeChange('draw')}
            className="flex items-center gap-2 h-8"
          >
            <Pencil className="h-4 w-4" />
            <span>{strings.games?.strokeOrder?.drawMode || 'Draw'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}