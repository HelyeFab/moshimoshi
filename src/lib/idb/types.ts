/**
 * IndexedDB Types for moshimoshi PWA
 * Agent 3 - Data & Sync
 *
 * Type definitions for all IndexedDB stores and operations
 */

// Store Types
export interface List {
  id: string;
  type: 'sentences' | 'words' | 'verbs' | 'adjectives';
  title: string;
  createdAt: number;
  updatedAt: number;
  userId?: string;
  syncStatus?: 'pending' | 'synced' | 'conflict';
  lastSyncAt?: number;
}

export interface Item {
  id: string;
  listId: string;
  payload: any; // Flexible content structure
  tags?: string[];
  createdAt: number;
  updatedAt?: number;
  syncStatus?: 'pending' | 'synced' | 'conflict';
}

export interface ReviewQueueItem {
  id: string;
  itemId: string;
  dueAt: number;
  fsrsState?: {
    difficulty: number;
    stability: number;
    retrievability: number;
    lapses: number;
    reps: number;
    interval: number;
  };
  history: ReviewHistory[];
  lastReviewAt?: number;
  syncStatus?: 'pending' | 'synced' | 'conflict';
}

export interface ReviewHistory {
  timestamp: number;
  rating: number; // 1-5
  responseTime: number; // milliseconds
  correct: boolean;
}

export interface Streak {
  id: 'global'; // Single global streak record
  current: number;
  best: number;
  lastActiveAt: number;
  startedAt: number;
  history?: Array<{ date: string; count: number }>;
  syncStatus?: 'pending' | 'synced' | 'conflict';
}

export interface Settings {
  id: 'ui' | 'notifications' | 'sync';
  a2hsDismissedAt?: number;
  badgeEnabled?: boolean;
  mediaSessionEnabled?: boolean;
  notificationsEnabled?: boolean;
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  syncEnabled?: boolean;
  lastSyncAt?: number;
  [key: string]: any; // Allow extension
}

// Sync Outbox for offline operations
export interface SyncOutboxItem {
  id: string; // opId
  type: 'addList' | 'updateList' | 'deleteList' |
        'addItem' | 'updateItem' | 'deleteItem' |
        'updateReview' | 'updateStreak' | 'updateSettings';
  payload: any;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
}

// Conflict Resolution Types
export type ConflictResolution = 'local' | 'remote' | 'merge';

export interface ConflictItem {
  type: string;
  localVersion: any;
  remoteVersion: any;
  resolution?: ConflictResolution;
  resolvedAt?: number;
}

// Database Schema Version
export const DB_VERSION = 1;
export const DB_NAME = 'moshimoshi';

// Store Names
export const STORES = {
  LISTS: 'lists',
  ITEMS: 'items',
  REVIEW_QUEUE: 'reviewQueue',
  STREAKS: 'streaks',
  SETTINGS: 'settings',
  SYNC_OUTBOX: 'sync_outbox',
  CONFLICTS: 'conflicts'
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];