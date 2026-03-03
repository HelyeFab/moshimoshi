import type { WordType } from '@/types/drill'
import type { ExtendedConjugationForms } from '@/types/conjugation'
import { CONJUGATION_USAGE_NOTES } from './conjugation-usage-notes'
import type { ConjugationUsageNote } from './schema'

type ConjugationFormKey = keyof ExtendedConjugationForms

export function getConjugationUsageNote(
  form: ConjugationFormKey,
  wordType?: WordType | null
): ConjugationUsageNote | null {
  const entry = CONJUGATION_USAGE_NOTES[form]
  if (!entry) return null

  if (wordType && entry.overrides?.[wordType as keyof NonNullable<typeof entry.overrides>]) {
    return entry.overrides[wordType as keyof NonNullable<typeof entry.overrides>] ?? entry.default
  }

  return entry.default
}
