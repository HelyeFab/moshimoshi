/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-09-25T11:33:10.258Z
 */

export type FeatureId = 'hiragana_practice' | 'katakana_practice' | 'kanji_browser' | 'custom_lists' | 'save_items' | 'youtube_shadowing' | 'media_upload' | 'stall_layout_customization' | 'todos' | 'conjugation_drill';

export const FEATURE_IDS = [
  'hiragana_practice',
  'katakana_practice',
  'kanji_browser',
  'custom_lists',
  'save_items',
  'youtube_shadowing',
  'media_upload',
  'stall_layout_customization',
  'todos',
  'conjugation_drill'
] as const;

export function isValidFeatureId(id: string): id is FeatureId {
  return FEATURE_IDS.includes(id as FeatureId);
}
