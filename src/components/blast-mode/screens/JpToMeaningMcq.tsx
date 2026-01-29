/**
 * Japanese → Meaning MCQ Screen
 * Agent D - UI Components
 *
 * Shows Japanese text, asks for English meaning
 */

'use client'

import React from 'react'
import { BaseMcqScreen } from './BaseMcqScreen'
import type { McqScreenProps } from './types'

export function JpToMeaningMcq(props: McqScreenProps) {
  return <BaseMcqScreen {...props} />
}
