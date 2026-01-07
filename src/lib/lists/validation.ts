/**
 * Validation utilities for list items
 *
 * Ensures list items have sufficient metadata for flashcard conversion
 */

import type { ListItem } from '@/types/userLists'

/**
 * Validates that a list item has at least one metadata field required for flashcards.
 *
 * For flashcards to work properly, we need either:
 * - Reading (for kanji → reading practice)
 * - Meaning (for word → translation practice)
 * - Both (for comprehensive study)
 *
 * Without at least one of these, flashcards become:
 * - Empty on the back (if using DeckCreator logic)
 * - Identical front and back (if using FlashcardManager logic)
 *
 * @param metadata - Item metadata object
 * @returns true if item has reading OR meaning
 */
export function hasRequiredMetadata(metadata?: {
  reading?: string
  meaning?: string
  notes?: string
  jlptLevel?: number
  tags?: string[]
}): boolean {
  if (!metadata) return false

  const hasReading = !!metadata.reading?.trim()
  const hasMeaning = !!metadata.meaning?.trim()

  return hasReading || hasMeaning
}

/**
 * Checks if a list item is valid for flashcard conversion
 *
 * @param item - List item to validate
 * @returns true if item can be converted to a usable flashcard
 */
export function isValidForFlashcards(item: ListItem): boolean {
  return hasRequiredMetadata(item.metadata)
}

/**
 * Filters a list of items to only those valid for flashcards
 *
 * @param items - Array of list items
 * @returns Array of items with required metadata
 */
export function filterValidItems(items: ListItem[]): ListItem[] {
  return items.filter(isValidForFlashcards)
}

/**
 * Gets validation message for missing metadata
 *
 * @param hasReading - Whether reading is present
 * @param hasMeaning - Whether meaning is present
 * @returns Validation key for i18n
 */
export function getValidationMessage(metadata?: {
  reading?: string
  meaning?: string
}): string | null {
  if (!metadata) {
    return 'lists.validation.requireMetadata'
  }

  const hasReading = !!metadata.reading?.trim()
  const hasMeaning = !!metadata.meaning?.trim()

  if (!hasReading && !hasMeaning) {
    return 'lists.validation.requireMetadata'
  }

  return null
}

/**
 * Validates item metadata for creation/update
 *
 * @param content - Item content (required)
 * @param metadata - Item metadata
 * @returns Validation result with error message key if invalid
 */
export function validateItemForCreation(
  content: string,
  metadata?: {
    reading?: string
    meaning?: string
    notes?: string
  }
): { valid: boolean; errorKey?: string } {
  if (!content?.trim()) {
    return { valid: false, errorKey: 'lists.validation.contentRequired' }
  }

  if (!hasRequiredMetadata(metadata)) {
    return { valid: false, errorKey: 'lists.validation.requireMetadata' }
  }

  return { valid: true }
}
