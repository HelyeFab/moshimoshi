// Audit logging for security events and user actions
// Provides comprehensive logging for compliance and security monitoring

import { redis, RedisKeys } from '@/lib/redis/client'

// Audit event types
export enum AuditEvent {
  // Authentication events
  SIGN_IN = 'auth.signin',
  SIGN_OUT = 'auth.signout',
  SIGN_UP = 'auth.signup',
  PASSWORD_RESET_REQUEST = 'auth.password_reset_request',
  PASSWORD_RESET_CONFIRM = 'auth.password_reset_confirm',
  PASSWORD_CHANGE = 'auth.password_change',
  EMAIL_VERIFY = 'auth.email_verify',
  MAGIC_LINK_REQUEST = 'auth.magic_link_request',
  MAGIC_LINK_SIGNIN = 'auth.magic_link_signin',
  SESSION_REFRESH = 'auth.session_refresh',
  ACCOUNT_LOCKOUT = 'auth.account_lockout',
  
  // User events
  PROFILE_UPDATE = 'user.profile_update',
  TIER_CHANGE = 'user.tier_change',
  SUBSCRIPTION_CREATE = 'user.subscription_create',
  SUBSCRIPTION_CANCEL = 'user.subscription_cancel',
  ACCOUNT_DELETE = 'user.account_delete',
  
  // Admin events
  ADMIN_USER_UPDATE = 'admin.user_update',
  ADMIN_USER_DELETE = 'admin.user_delete',
  ADMIN_TIER_OVERRIDE = 'admin.tier_override',
  ADMIN_LOGIN = 'admin.login',
  ADMIN_DATA_EXPORT = 'admin.data_export',
  
  // Security events
  FAILED_LOGIN = 'security.failed_login',
  SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit_exceeded',
  INVALID_TOKEN = 'security.invalid_token',
  CSRF_ATTEMPT = 'security.csrf_attempt',
  
  // System events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_WARNING = 'system.warning',
}

// Audit event severity levels
export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Audit log entry interface
export interface AuditLogEntry {
  id: string
  timestamp: Date
  event: AuditEvent
  severity: AuditSeverity
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  details: Record<string, any>
  outcome: 'success' | 'failure' | 'warning'
  metadata?: {
    location?: string
    device?: string
    source?: string
  }
}

// Audit context for requests
export interface AuditContext {
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  endpoint?: string
}

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/**
 * Determine event severity based on event type
 */
function getEventSeverity(event: AuditEvent): AuditSeverity {
  switch (event) {
    case AuditEvent.ACCOUNT_DELETE:
    case AuditEvent.ADMIN_USER_DELETE:
    case AuditEvent.SUSPICIOUS_ACTIVITY:
    case AuditEvent.CSRF_ATTEMPT:
      return AuditSeverity.CRITICAL

    case AuditEvent.ADMIN_LOGIN:
    case AuditEvent.ADMIN_USER_UPDATE:
    case AuditEvent.ADMIN_TIER_OVERRIDE:
    case AuditEvent.PASSWORD_RESET_CONFIRM:
    case AuditEvent.TIER_CHANGE:
    case AuditEvent.ACCOUNT_LOCKOUT:
      return AuditSeverity.HIGH

    case AuditEvent.FAILED_LOGIN:
    case AuditEvent.RATE_LIMIT_EXCEEDED:
    case AuditEvent.INVALID_TOKEN:
    case AuditEvent.SYSTEM_WARNING:
      return AuditSeverity.MEDIUM

    default:
      return AuditSeverity.LOW
  }
}

/**
 * Parse user agent for device information
 */
function parseUserAgent(userAgent?: string): { device?: string; browser?: string } {
  if (!userAgent) return {}

  const device = /(Mobile|Tablet|Desktop|Bot)/i.exec(userAgent)?.[1]
  const browser = /(Chrome|Firefox|Safari|Edge|Opera)/i.exec(userAgent)?.[1]

  return { device, browser }
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  event: AuditEvent,
  context: AuditContext = {},
  details: Record<string, any> = {},
  outcome: 'success' | 'failure' | 'warning' = 'success'
): Promise<void> {
  try {
    const id = generateAuditId()
    const timestamp = new Date()
    const severity = getEventSeverity(event)
    const userAgentInfo = parseUserAgent(context.userAgent)

    const logEntry: AuditLogEntry = {
      id,
      timestamp,
      event,
      severity,
      userId: context.userId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: {
        ...details,
        endpoint: context.endpoint,
      },
      outcome,
      metadata: {
        device: userAgentInfo.device,
        source: 'moshimoshi-app',
      },
    }

    // Store in Redis with 30-day expiration (2592000 seconds)
    const auditKey = RedisKeys.adminAudit(event, timestamp.toISOString())
    await redis.setex(auditKey, 2592000, JSON.stringify(logEntry))

    // Store daily audit index in a sorted set for reliable "most recent" queries
    const dayKey = timestamp.toISOString().slice(0, 10)
    const dailyZsetKey = `audit_daily_zset:${dayKey}`
    const score = timestamp.getTime()

    await redis.zadd(dailyZsetKey, score, auditKey)
    await redis.expire(dailyZsetKey, 2592000) // 30 days

    // Keep legacy daily hash for backward compatibility during transition
    const dailyHashKey = `audit_daily:${dayKey}`
    const keyType = await redis.type(dailyHashKey)
    if (keyType === 'set') {
      // Delete legacy SET key - old format only stored IDs without key paths
      await redis.del(dailyHashKey)
      console.log(`[AUDIT] Migrated legacy SET key to HASH: ${dailyHashKey}`)
    }

    await redis.hset(dailyHashKey, id, auditKey)
    await redis.expire(dailyHashKey, 2592000) // 30 days

    // Store user-specific audit trail
    if (context.userId) {
      const userAuditKey = `user_audit:${context.userId}`
      await redis.lpush(userAuditKey, JSON.stringify({
        id,
        event,
        timestamp,
        outcome,
        details: Object.keys(details).length > 0 ? details : undefined,
      }))
      
      // Keep only last 100 entries per user
      await redis.ltrim(userAuditKey, 0, 99)
      await redis.expire(userAuditKey, 2592000) // 30 days
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT] ${event} - ${outcome}`, {
        userId: context.userId,
        severity,
        details,
      })
    }

    // Critical events should also be logged to console in production
    if (severity === AuditSeverity.CRITICAL) {
      console.error(`[CRITICAL AUDIT] ${event}`, {
        id,
        userId: context.userId,
        ipAddress: context.ipAddress,
        details,
      })
    }

  } catch (error) {
    console.error('Failed to log audit event:', error)
    // Don't throw - audit logging shouldn't break the main flow
  }
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 50
): Promise<Array<{
  id: string
  event: AuditEvent
  timestamp: Date
  outcome: string
  details?: Record<string, any>
}>> {
  try {
    const userAuditKey = `user_audit:${userId}`
    const logs = await redis.lrange(userAuditKey, 0, limit - 1)
    
    return logs.map((log: string) => {
      const parsed = JSON.parse(log as string)
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      }
    })
  } catch (error) {
    console.error('Failed to get user audit logs:', error)
    return []
  }
}

/**
 * Get audit logs for a specific date
 */
export async function getAuditLogsByDate(
  date: string, // YYYY-MM-DD format
  limit: number = 100
): Promise<AuditLogEntry[]> {
  try {
    const dailyZsetKey = `audit_daily_zset:${date}`
    const dailyHashKey = `audit_daily:${date}`

    // Prefer sorted set for accurate "most recent" ordering
    const zsetType = await redis.type(dailyZsetKey)
    if (zsetType === 'zset') {
      const keys = await redis.zrevrange(dailyZsetKey, 0, limit - 1)
      if (!keys || keys.length === 0) return []

      const logs: AuditLogEntry[] = []
      for (const key of keys) {
        const logData = await redis.get(key as string)
        if (logData) {
          const log = JSON.parse(logData as string)
          logs.push({
            ...log,
            timestamp: new Date(log.timestamp),
          })
        }
      }

      return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    }

    // Fallback: legacy hash store (unordered)
    const keyType = await redis.type(dailyHashKey)

    if (keyType === 'set') {
      // Legacy SET format - delete it since the old structure only stored IDs
      // without key paths, making the data unretrievable anyway
      await redis.del(dailyHashKey)
      console.log(`[AUDIT] Cleaned up legacy SET key: ${dailyHashKey}`)
      return []
    }

    if (keyType !== 'hash' && keyType !== 'none') {
      // Unexpected type - log and return empty
      console.warn(`[AUDIT] Unexpected key type '${keyType}' for ${dailyHashKey}`)
      return []
    }

    const idToKeyMap = await redis.hgetall(dailyHashKey)

    if (!idToKeyMap || Object.keys(idToKeyMap).length === 0) return []

    // Get the key paths (values from the hash), limited to requested amount
    const keys = Object.values(idToKeyMap).slice(0, limit) as string[]
    const logs: AuditLogEntry[] = []

    // Batch fetch all entries by their direct key paths
    for (const key of keys) {
      const logData = await redis.get(key)
      if (logData) {
        const log = JSON.parse(logData as string)
        logs.push({
          ...log,
          timestamp: new Date(log.timestamp),
        })
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  } catch (error) {
    console.error('Failed to get audit logs by date:', error)
    return []
  }
}

/**
 * Log authentication attempt
 */
export async function logAuthAttempt(
  event: AuditEvent.SIGN_IN | AuditEvent.SIGN_UP | AuditEvent.FAILED_LOGIN | AuditEvent.MAGIC_LINK_SIGNIN,
  context: AuditContext,
  details: {
    email?: string
    method?: 'email' | 'google' | 'magic_link'
    reason?: string
    recaptchaScore?: number
  } = {},
  outcome: 'success' | 'failure' = 'success'
): Promise<void> {
  await logAuditEvent(event, context, {
    email: details.email,
    authMethod: details.method,
    failureReason: details.reason,
    recaptchaScore: details.recaptchaScore,
  }, outcome)
}

/**
 * Log admin action
 */
export async function logAdminAction(
  action: string,
  adminUserId: string,
  context: AuditContext,
  details: Record<string, any> = {}
): Promise<void> {
  await logAuditEvent(AuditEvent.ADMIN_LOGIN, context, {
    action,
    adminUserId,
    ...details,
  })
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  event: AuditEvent,
  context: AuditContext,
  details: Record<string, any> = {}
): Promise<void> {
  await logAuditEvent(event, context, details, 'warning')
}

/**
 * Log system error
 */
export async function logSystemError(
  error: Error,
  context: AuditContext,
  details: Record<string, any> = {}
): Promise<void> {
  await logAuditEvent(AuditEvent.SYSTEM_ERROR, context, {
    errorMessage: error.message,
    errorStack: error.stack,
    ...details,
  }, 'failure')
}

/**
 * Clean up old audit logs (call this periodically)
 */
export async function cleanupAuditLogs(daysToKeep: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    // In a production environment, you'd implement proper cleanup logic
    // This is a simplified version
    console.log(`Cleaning up audit logs older than ${cutoffDate.toISOString()}`)
    
    // Delete daily indexes older than cutoff
    for (let i = daysToKeep; i < daysToKeep + 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayKey = date.toISOString().slice(0, 10)
      const dailyHashKey = `audit_daily:${dayKey}`
      const dailyZsetKey = `audit_daily_zset:${dayKey}`
      await redis.del(dailyHashKey, dailyZsetKey)
    }
    
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error)
  }
}

/**
 * Get audit statistics
 */
export async function getAuditStats(
  startDate: Date,
  endDate: Date
): Promise<{
  totalEvents: number
  eventsByType: Record<string, number>
  eventsBySeverity: Record<string, number>
  failureRate: number
}> {
  try {
    // This is a simplified implementation
    // In production, you'd want proper analytics storage
    
    const stats = {
      totalEvents: 0,
      eventsByType: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
      failureRate: 0,
    }
    
    // Calculate date range
    const dateRange: string[] = []
    const current = new Date(startDate)
    while (current <= endDate) {
      dateRange.push(current.toISOString().slice(0, 10))
      current.setDate(current.getDate() + 1)
    }
    
    let totalFailures = 0
    
    for (const date of dateRange) {
      const logs = await getAuditLogsByDate(date)
      
      for (const log of logs) {
        stats.totalEvents++
        
        // Count by event type
        stats.eventsByType[log.event] = (stats.eventsByType[log.event] || 0) + 1
        
        // Count by severity
        stats.eventsBySeverity[log.severity] = (stats.eventsBySeverity[log.severity] || 0) + 1
        
        // Count failures
        if (log.outcome === 'failure') {
          totalFailures++
        }
      }
    }
    
    stats.failureRate = stats.totalEvents > 0 ? (totalFailures / stats.totalEvents) * 100 : 0
    
    return stats
  } catch (error) {
    console.error('Failed to get audit stats:', error)
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      failureRate: 0,
    }
  }
}
