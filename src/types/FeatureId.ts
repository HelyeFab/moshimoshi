/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-12-06T16:46:04.851Z
 */

export type FeatureId =
  | 'hiragana_practice'
  | 'katakana_practice'
  | 'kanji_browser'
  | 'custom_lists'
  | 'conjugation_drill'
  | 'grammar_explanations'
  | 'youtube_shadowing'
  | 'media_upload'
  | 'save_items'
  | 'todos'
  | 'flashcard_decks'
  | 'flashcard_daily_reviews'
  | 'stall_layout_customization'
  | 'pwa_push'
  | 'pwa_bg_sync'
  | 'pwa_periodic_sync'
  | 'pwa_share_target'
  | 'pwa_fs_access'
  | 'pwa_badging'
  | 'pwa_media_session'
  | 'word_lookup'

export const FEATURE_IDS = [
  'hiragana_practice',
  'katakana_practice',
  'kanji_browser',
  'custom_lists',
  'conjugation_drill',
  'grammar_explanations',
  'youtube_shadowing',
  'media_upload',
  'save_items',
  'todos',
  'flashcard_decks',
  'flashcard_daily_reviews',
  'stall_layout_customization',
  'pwa_push',
  'pwa_bg_sync',
  'pwa_periodic_sync',
  'pwa_share_target',
  'pwa_fs_access',
  'pwa_badging',
  'pwa_media_session',
  'word_lookup',
] as const

export function isValidFeatureId(id: string): id is FeatureId {
  return FEATURE_IDS.includes(id as FeatureId)
}
