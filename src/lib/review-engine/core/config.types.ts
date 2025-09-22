/**
 * Configuration types for the Universal Review Engine
 * Defines configuration structures for the entire system
 */

import { ReviewMode, ReviewModeConfig, ContentTypeConfig, PerformanceThresholds, ScoringConfig } from './types'

/**
 * Main configuration for the review engine
 */
export interface ReviewEngineConfig {
  // Session defaults
  /**
   * Default number of items per session
   */
  defaultSessionLength: number
  
  /**
   * Maximum allowed session length
   */
  maxSessionLength: number
  
  /**
   * Session timeout in minutes (0 = no timeout)
   */
  sessionTimeout: number
  
  /**
   * Whether to auto-save session progress
   */
  autoSaveProgress: boolean
  
  /**
   * Auto-save interval in seconds
   */
  autoSaveInterval: number
  
  // Mode defaults
  /**
   * Default review mode for new sessions
   */
  defaultMode: ReviewMode
  
  /**
   * Configuration for each review mode
   */
  modeConfigs: Record<ReviewMode, ReviewModeConfig>
  
  // Content type configurations
  /**
   * Configuration for each content type
   */
  contentConfigs: Record<string, ContentTypeConfig>
  
  // Offline settings
  /**
   * Offline-first configuration
   */
  offline: {
    /**
     * Whether offline mode is enabled
     */
    enabled: boolean
    
    /**
     * Sync interval in seconds
     */
    syncInterval: number
    
    /**
     * Maximum items in sync queue
     */
    maxQueueSize: number
    
    /**
     * Storage quota in MB
     */
    storageQuota: number
    
    /**
     * Whether to persist sessions offline
     */
    persistSessions: boolean
    
    /**
     * Cache expiry in hours
     */
    cacheExpiry: number
  }
  
  // Performance
  /**
   * Performance optimization settings
   */
  performance: {
    /**
     * Number of items to preload
     */
    preloadNext: number
    
    /**
     * Number of items to keep in cache
     */
    cacheSize: number
    
    /**
     * Debounce delay for input in milliseconds
     */
    debounceDelay: number
    
    /**
     * Batch size for bulk operations
     */
    batchSize: number
    
    /**
     * Whether to use web workers
     */
    useWebWorkers: boolean
    
    /**
     * Maximum concurrent requests
     */
    maxConcurrentRequests: number
  }
  
  // Features
  /**
   * Feature toggles
   */
  features: {
    /**
     * Enable streak tracking
     */
    streaks: boolean
    
    /**
     * Enable achievements system
     */
    achievements: boolean
    
    /**
     * Enable analytics tracking
     */
    analytics: boolean
    
    /**
     * Enable hint system
     */
    hints: boolean
    
    /**
     * Enable audio playback
     */
    audio: boolean
    
    /**
     * Enable image display
     */
    images: boolean
    
    /**
     * Enable video content
     */
    videos: boolean
    
    /**
     * Enable spaced repetition
     */
    spacedRepetition: boolean
    
    /**
     * Enable confidence ratings
     */
    confidenceRatings: boolean
    
    /**
     * Enable keyboard shortcuts
     */
    keyboardShortcuts: boolean
    
    /**
     * Enable progress sharing
     */
    socialSharing: boolean
  }
  
  // API endpoints
  /**
   * API configuration
   */
  api: {
    /**
     * Base URL for API calls
     */
    baseUrl: string
    
    /**
     * Request timeout in milliseconds
     */
    timeout: number
    
    /**
     * Number of retry attempts
     */
    retryAttempts: number
    
    /**
     * Delay between retries in milliseconds
     */
    retryDelay: number
    
    /**
     * API version
     */
    version: string
    
    /**
     * Custom headers
     */
    headers?: Record<string, string>
  }
  
  // Scoring
  /**
   * Scoring configuration
   */
  scoring: ScoringConfig
  
  // Performance thresholds
  /**
   * Performance metric thresholds
   */
  thresholds: PerformanceThresholds
  
  // Localization
  /**
   * Localization settings
   */
  localization: {
    /**
     * Default language
     */
    defaultLanguage: string
    
    /**
     * Available languages
     */
    availableLanguages: string[]
    
    /**
     * Date format
     */
    dateFormat: string
    
    /**
     * Time format
     */
    timeFormat: '12h' | '24h'
  }
  
  // Accessibility
  /**
   * Accessibility options
   */
  accessibility: {
    /**
     * Enable screen reader support
     */
    screenReaderSupport: boolean
    
    /**
     * Enable high contrast mode
     */
    highContrast: boolean
    
    /**
     * Enable reduced motion
     */
    reducedMotion: boolean
    
    /**
     * Font size multiplier
     */
    fontSizeMultiplier: number
    
    /**
     * Enable focus indicators
     */
    focusIndicators: boolean
  }
}

/**
 * User preferences that override config
 */
export interface UserPreferences {
  /**
   * Preferred review mode
   */
  preferredMode?: ReviewMode
  
  /**
   * Session length preference
   */
  sessionLength?: number
  
  /**
   * Audio enabled
   */
  audioEnabled?: boolean
  
  /**
   * Hints enabled
   */
  hintsEnabled?: boolean
  
  /**
   * Theme preference
   */
  theme?: 'light' | 'dark' | 'auto'
  
  /**
   * Font size preference
   */
  fontSize?: 'small' | 'medium' | 'large' | 'extra-large'
  
  /**
   * Keyboard shortcuts enabled
   */
  keyboardShortcutsEnabled?: boolean
  
  /**
   * Notification preferences
   */
  notifications?: {
    streaks: boolean
    achievements: boolean
    reminders: boolean
  }
}

/**
 * Runtime configuration that can be modified
 */
export interface RuntimeConfig {
  /**
   * Current session config overrides
   */
  sessionOverrides?: Partial<ReviewEngineConfig>
  
  /**
   * Debug mode
   */
  debug: boolean
  
  /**
   * Verbose logging
   */
  verboseLogging: boolean
  
  /**
   * Performance monitoring
   */
  performanceMonitoring: boolean
  
  /**
   * Feature flags for A/B testing
   */
  featureFlags?: Record<string, boolean>
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ReviewEngineConfig = {
  // Session defaults
  defaultSessionLength: 20,
  maxSessionLength: 100,
  sessionTimeout: 30,
  autoSaveProgress: true,
  autoSaveInterval: 30,
  
  // Mode defaults
  defaultMode: 'recognition',
  modeConfigs: {} as Record<ReviewMode, ReviewModeConfig>, // Will be filled from types.ts
  
  // Content configs
  contentConfigs: {},
  
  // Offline settings
  offline: {
    enabled: true,
    syncInterval: 60,
    maxQueueSize: 1000,
    storageQuota: 50,
    persistSessions: true,
    cacheExpiry: 24
  },
  
  // Performance
  performance: {
    preloadNext: 3,
    cacheSize: 50,
    debounceDelay: 300,
    batchSize: 20,
    useWebWorkers: true,
    maxConcurrentRequests: 3
  },
  
  // Features
  features: {
    streaks: true,
    achievements: true,
    analytics: true,
    hints: true,
    audio: true,
    images: true,
    videos: false,
    spacedRepetition: true,
    confidenceRatings: true,
    keyboardShortcuts: true,
    socialSharing: false
  },
  
  // API
  api: {
    baseUrl: '/api/review/v2',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    version: 'v2'
  },
  
  // Scoring
  scoring: {
    basePoints: 10,
    speedBonusMultiplier: 1.5,
    streakBonusMultiplier: 1.2,
    hintPenalty: 2,
    retryPenalty: 3,
    useDifficultyWeighting: true
  },
  
  // Thresholds
  thresholds: {
    masteryThreshold: 0.9,
    passingThreshold: 0.7,
    fastResponseTime: 2000,
    minValidResponseTime: 100
  },
  
  // Localization
  localization: {
    defaultLanguage: 'en',
    availableLanguages: ['en', 'ja'],
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h'
  },
  
  // Accessibility
  accessibility: {
    screenReaderSupport: true,
    highContrast: false,
    reducedMotion: false,
    fontSizeMultiplier: 1.0,
    focusIndicators: true
  }
}

/**
 * Configuration validator
 */
export function validateConfig(config: Partial<ReviewEngineConfig>): boolean {
  // Add validation logic here
  return true
}

/**
 * Merge configurations with defaults
 */
export function mergeConfig(
  custom: Partial<ReviewEngineConfig>,
  defaults: ReviewEngineConfig = DEFAULT_CONFIG
): ReviewEngineConfig {
  return {
    ...defaults,
    ...custom,
    offline: { ...defaults.offline, ...custom.offline },
    performance: { ...defaults.performance, ...custom.performance },
    features: { ...defaults.features, ...custom.features },
    api: { ...defaults.api, ...custom.api },
    scoring: { ...defaults.scoring, ...custom.scoring },
    thresholds: { ...defaults.thresholds, ...custom.thresholds },
    localization: { ...defaults.localization, ...custom.localization },
    accessibility: { ...defaults.accessibility, ...custom.accessibility }
  }
}