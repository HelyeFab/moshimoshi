/**
 * Core module exports for the Universal Review Engine
 * Central export point for all core interfaces, types, and utilities
 */

// Interfaces
export * from './interfaces'

// Types
export * from './types'

// Session types
export * from './session.types'

// Events
export * from './events'

// Errors
export * from './errors'

// Configuration
export * from './config.types'

// Re-export commonly used items for convenience
export type {
  // Main interfaces
  ReviewableContent,
  ValidationResult,
  Hint,
  ContentFilter,
  ContentStatistics,
  // Metadata interfaces
  KanaMetadata,
  KanjiMetadata,
  VocabularyMetadata,
  SentenceMetadata
} from './interfaces'

export type {
  // Core types
  ReviewMode,
  InputType,
  SessionStatus,
  SessionSource,
  ValidationStrategy,
  // Configurations
  ReviewModeConfig,
  ContentTypeConfig,
  PerformanceThresholds,
  ScoringConfig
} from './types'

export {
  DEFAULT_MODE_CONFIGS
} from './types'

export type {
  // Session types
  ReviewSession,
  ReviewSessionItem,
  SessionStatistics,
  CreateSessionOptions,
  UpdateSessionPayload,
  AnswerItemPayload,
  SessionSummary,
  AggregateStatistics
} from './session.types'

export {
  // Event enum
  ReviewEventType
} from './events'

export type {
  // Event types
  ReviewEvent,
  EventListener,
  IEventEmitter,
  // Event payloads
  SessionStartedPayload,
  SessionCompletedPayload,
  ItemAnsweredPayload,
  ProgressUpdatedPayload,
  StreakUpdatedPayload,
  AchievementUnlockedPayload
} from './events'

export {
  // Error classes
  ReviewEngineError,
  ValidationError,
  SessionError,
  SyncError,
  ContentError,
  ConfigurationError,
  AdapterError,
  StorageError,
  NetworkError,
  TimeoutError,
  AuthError,
  // Error utilities
  ERROR_CODES,
  isReviewEngineError,
  isRecoverableError,
  formatErrorMessage
} from './errors'

export type {
  // Configuration types
  ReviewEngineConfig,
  UserPreferences,
  RuntimeConfig
} from './config.types'

export {
  DEFAULT_CONFIG,
  validateConfig,
  mergeConfig
} from './config.types'