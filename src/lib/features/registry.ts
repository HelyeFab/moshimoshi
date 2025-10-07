/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-10-07T13:27:25.395Z
 */

import type { FeatureId } from '@/types/FeatureId';
import { Permission } from '@/lib/access/permissionMap';

export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  category: string;
  lifecycle: 'active' | 'deprecated' | 'hidden';
  permission: Permission;
  limitType: 'daily' | 'weekly' | 'monthly';
  notifications: boolean;
  description?: string;
}

export const FEATURE_REGISTRY: Record<FeatureId, FeatureDefinition> = {
  'hiragana_practice': {
    id: 'hiragana_practice',
    name: 'Hiragana Practice',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: true,
    description: 'Practice hiragana characters with SRS-based review sessions'
  },
  'katakana_practice': {
    id: 'katakana_practice',
    name: 'Katakana Practice',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: true,
    description: 'Practice katakana characters with SRS-based review sessions'
  },
  'kanji_browser': {
    id: 'kanji_browser',
    name: 'Kanji Browser',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: false,
    description: 'Browse and explore kanji with detailed information'
  },
  'custom_lists': {
    id: 'custom_lists',
    name: 'Custom Lists',
    category: 'organization',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'monthly',
    notifications: false,
    description: 'Create and manage custom learning lists for vocabulary, kanji, and sentences'
  },
  'conjugation_drill': {
    id: 'conjugation_drill',
    name: 'Conjugation Drill',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: true,
    description: 'Practice Japanese verb and adjective conjugations with interactive drills'
  },
  'grammar_explanations': {
    id: 'grammar_explanations',
    name: 'Grammar Explanations',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: false,
    description: 'Get AI-powered grammar explanations for Japanese sentences'
  },
  'youtube_shadowing': {
    id: 'youtube_shadowing',
    name: 'YouTube Shadowing',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: true,
    description: 'Practice Japanese pronunciation and listening with YouTube videos and transcript shadowing'
  },
  'media_upload': {
    id: 'media_upload',
    name: 'Media File Upload',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: false,
    description: 'Upload and practice with your own video/audio files for shadowing practice'
  },
  'save_items': {
    id: 'save_items',
    name: 'Save Items',
    category: 'organization',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'monthly',
    notifications: false,
    description: 'Save vocabulary, kanji, and other items to your personal collection'
  },
  'todos': {
    id: 'todos',
    name: 'Todo Lists',
    category: 'organization',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'monthly',
    notifications: false,
    description: 'Create and manage learning todo lists and goals'
  },
  'flashcard_decks': {
    id: 'flashcard_decks',
    name: 'Flashcard Decks',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'monthly',
    notifications: false,
    description: 'Create custom flashcard decks for spaced repetition practice'
  },
  'stall_layout_customization': {
    id: 'stall_layout_customization',
    name: 'Learning Village Layout Customization',
    category: 'personalization',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: false,
    description: 'Customize the layout of Learning Village stalls by dragging and dropping them to your preferred order'
  }
};

export function getFeature(id: FeatureId): FeatureDefinition {
  return FEATURE_REGISTRY[id];
}

export function getActiveFeatures(): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.lifecycle === 'active');
}

export function getFeaturesByCategory(category: string): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.category === category);
}

export function getFeaturesByPermission(permission: Permission): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.permission === permission);
}
