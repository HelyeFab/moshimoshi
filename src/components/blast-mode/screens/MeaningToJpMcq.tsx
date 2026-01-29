/**
 * Meaning → Japanese MCQ Screen
 * Agent D - UI Components
 *
 * Shows English meaning, asks for Japanese text
 */

'use client'

import React from 'react'
import { BaseMcqScreen } from './BaseMcqScreen'
import type { McqScreenProps } from './types'

export function MeaningToJpMcq(props: McqScreenProps) {
  return <BaseMcqScreen {...props} />
}
