/**
 * SRS (Spaced Repetition System) Module
 * 
 * A complete implementation of the SM-2 algorithm with enhancements
 * for optimal learning and retention.
 */

// Core exports
export { SRSAlgorithm, DEFAULT_SRS_CONFIG } from './algorithm'
export type { ReviewResult, SRSConfig } from './algorithm'

export { SRSStateManager, DEFAULT_STATE_CONFIG } from './state-manager'
export type { CollectionStats, StateTransitionConfig } from './state-manager'

export { DifficultyCalculator, DEFAULT_DIFFICULTY_CONFIG } from './difficulty'
export type { DifficultyFactors, DifficultyConfig } from './difficulty'

export { SRSIntegration, DEFAULT_INTEGRATION_CONFIG } from './integration'
export type { 
  ProgressUpdateEvent, 
  AchievementEvent, 
  IntegrationConfig 
} from './integration'

// Re-export extended interfaces from core
export type { 
  SRSData, 
  ReviewableContentWithSRS 
} from '../core/interfaces'