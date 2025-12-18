'use client'

// Delegate to the main TextbookVocabularyPage with EntitlementGate
import TextbookVocabularyPage from '../../textbook-vocabulary/TextbookVocabularyPage'
import { EntitlementGate } from '@/components/review-engine/EntitlementGate'

export default function TextbookVocabularyToolPage() {
  return (
    <EntitlementGate featureId="textbook_vocabulary">
      <TextbookVocabularyPage />
    </EntitlementGate>
  )
}
