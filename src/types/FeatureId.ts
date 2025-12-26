/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-12-26T15:38:35.843Z
 */

export type FeatureId = 'hiragana_practice' | 'katakana_practice' | 'kanji_browser' | 'kanji_connection' | 'kanji_mastery' | 'drawing_practice' | 'custom_lists' | 'conjugation_drill' | 'grammar_explanations' | 'youtube_shadowing' | 'media_upload' | 'save_items' | 'todos' | 'flashcard_decks' | 'anki_imports' | 'flashcard_daily_reviews' | 'stall_layout_customization' | 'pwa_push' | 'pwa_bg_sync' | 'pwa_periodic_sync' | 'pwa_share_target' | 'pwa_fs_access' | 'pwa_badging' | 'pwa_media_session' | 'word_lookup' | 'news' | 'story' | 'books' | 'kanji_mood_board' | 'drill' | 'my_list' | 'textbook_vocabulary' | 'flashcards' | 'resources' | 'blogs' | 'vocabulary' | 'comics';

export const FEATURE_IDS = [
  'hiragana_practice',
  'katakana_practice',
  'kanji_browser',
  'kanji_connection',
  'kanji_mastery',
  'drawing_practice',
  'custom_lists',
  'conjugation_drill',
  'grammar_explanations',
  'youtube_shadowing',
  'media_upload',
  'save_items',
  'todos',
  'flashcard_decks',
  'anki_imports',
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
  'news',
  'story',
  'books',
  'kanji_mood_board',
  'drill',
  'my_list',
  'textbook_vocabulary',
  'flashcards',
  'resources',
  'blogs',
  'vocabulary',
  'comics'
] as const;

export function isValidFeatureId(id: string): id is FeatureId {
  return FEATURE_IDS.includes(id as FeatureId);
}
