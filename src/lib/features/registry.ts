/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-09-22T15:15:41.380Z
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
    description: 'Create and manage custom study lists for words, kanji, and sentences'
  },
  'save_items': {
    id: 'save_items',
    name: 'Save Items to Lists',
    category: 'organization',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'monthly',
    notifications: false,
    description: 'Save vocabulary words, kanji, and sentences to your custom lists'
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
  'stall_layout_customization': {
    id: 'stall_layout_customization',
    name: 'Learning Village Layout Customization',
    category: 'personalization',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'none',
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
