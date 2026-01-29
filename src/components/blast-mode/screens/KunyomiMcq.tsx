/**
 * Kunyomi Reading MCQ Screen
 * Agent D - UI Components
 *
 * Shows kanji, asks for kunyomi reading
 */

'use client'

import React from 'react'
import { BaseMcqScreen } from './BaseMcqScreen'
import type { McqScreenProps } from './types'

export function KunyomiMcq(props: McqScreenProps) {
  return <BaseMcqScreen {...props} />
}
