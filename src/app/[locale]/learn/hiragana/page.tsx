'use client'

import { KanaLearningComponent } from '@/components/learn/KanaLearningComponent'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

export default function HiraganaLearningPage() {
  return (
    <>
      <KanaLearningComponent defaultScript="hiragana" />
      <MobileNavSpacer />
    </>
  )
}