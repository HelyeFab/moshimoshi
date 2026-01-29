/**
 * Other Reading MCQ Screen
 * Agent D - UI Components
 *
 * Shows kanji, asks for secondary/other reading
 */

'use client'

import React from 'react'
import { BaseMcqScreen } from './BaseMcqScreen'
import type { McqScreenProps } from './types'

export function OtherReadingMcq(props: McqScreenProps) {
  return <BaseMcqScreen {...props} />
}
