/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-09-22T15:15:41.380Z
 */

export type FeatureId = 'hiragana_practice' | 'katakana_practice' | 'kanji_browser' | 'custom_lists' | 'save_items' | 'youtube_shadowing' | 'media_upload' | 'stall_layout_customization';

export const FEATURE_IDS = [
  'hiragana_practice',
  'katakana_practice',
  'kanji_browser',
  'custom_lists',
  'save_items',
  'youtube_shadowing',
  'media_upload',
  'stall_layout_customization'
] as const;

export function isValidFeatureId(id: string): id is FeatureId {
  return FEATURE_IDS.includes(id as FeatureId);
}
