/**
 * Onyomi Reading MCQ Screen
 * Agent D - UI Components
 *
 * Shows kanji, asks for onyomi reading
 */

'use client'

import React from 'react'
import { BaseMcqScreen } from './BaseMcqScreen'
import type { McqScreenProps } from './types'

export function OnyomiMcq(props: McqScreenProps) {
  return <BaseMcqScreen {...props} />
}
