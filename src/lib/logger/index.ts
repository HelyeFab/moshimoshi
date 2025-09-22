/**
 * Unified Logger Interface
 * Automatically selects the best logger based on environment
 *
 * - Development: Uses 'debug' module for lightweight, filterable logging
 * - Production: Uses 'pino' for high-performance structured logging
 *
 * Usage:
 * import logger from '@/lib/logger'
 * logger.streak('Streak updated', { count: 5 })
 * logger.error('Failed to sync', error)
 */

import { debugLog } from './debug-logger'

// For now, always use debug logger to avoid pino issues
// We can switch to pino later when properly configured
const logger = debugLog

// Export unified interface
export default logger
export { logger }

// Also export specific implementations if needed
export { debugLog } from './debug-logger'

