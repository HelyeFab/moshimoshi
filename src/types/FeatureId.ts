/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-10-06T16:18:55.740Z
 */

export type FeatureId = 'hiragana_practice' | 'katakana_practice' | 'kanji_browser' | 'custom_lists' | 'conjugation_drill' | 'youtube_shadowing' | 'media_upload' | 'save_items' | 'todos' | 'flashcard_decks' | 'stall_layout_customization';

export const FEATURE_IDS = [
  'hiragana_practice',
  'katakana_practice',
  'kanji_browser',
  'custom_lists',
  'conjugation_drill',
  'youtube_shadowing',
  'media_upload',
  'save_items',
  'todos',
  'flashcard_decks',
  'stall_layout_customization'
] as const;

export function isValidFeatureId(id: string): id is FeatureId {
  return FEATURE_IDS.includes(id as FeatureId);
}
