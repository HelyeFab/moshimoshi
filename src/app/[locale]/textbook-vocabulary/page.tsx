'use client'

// Delegate to TextbookVocabularyPage with EntitlementGate
import { EntitlementGate } from '@/components/review-engine/EntitlementGate'
import TextbookVocabularyPage from './TextbookVocabularyPage'

export default function TextbookVocabularyRoutePage() {
  return (
    <EntitlementGate featureId="textbook_vocabulary">
      <TextbookVocabularyPage />
    </EntitlementGate>
  )
}
