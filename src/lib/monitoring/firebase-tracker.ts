/**
 * Firebase Operation Tracker
 * Temporary logging system to track Firebase operations by user tier
 * This helps identify any free users still accessing Firebase
 */

export interface FirebaseOperation {
  userId: string
  operation: 'read' | 'write' | 'delete' | 'batch'
  collection: string
  documentId?: string
  isPremium: boolean
  tier: 'guest' | 'free' | 'premium'
  timestamp: number
  source: string // Which API route triggered this
  success: boolean
  error?: string
}

class FirebaseUsageTracker {
  private static instance: FirebaseUsageTracker
  private operations: Map<string, FirebaseOperation> = new Map()
  private violationCount = 0 // Count of free users hitting Firebase

  private constructor() {}

  static getInstance(): FirebaseUsageTracker {
    if (!FirebaseUsageTracker.instance) {
      FirebaseUsageTracker.instance = new FirebaseUsageTracker()
    }
    return FirebaseUsageTracker.instance
  }

  /**
   * Track a Firebase operation
   */
  async trackOperation(
    userId: string,
    operation: FirebaseOperation['operation'],
    collection: string,
    isPremium: boolean,
    source: string,
    documentId?: string
  ): Promise<void> {
    const key = `${userId}-${Date.now()}-${Math.random()}`
    const op: FirebaseOperation = {
      userId,
      operation,
      collection,
      documentId,
      isPremium,
      tier: isPremium ? 'premium' : 'free',
      timestamp: Date.now(),
      source,
      success: true
    }

    this.operations.set(key, op)

    // ALERT: Free user doing Firebase operations
    if (!isPremium && (operation === 'write' || operation === 'delete')) {
      this.violationCount++
      console.error(`[🚨 FIREBASE VIOLATION] Free user ${userId} performing ${operation} on ${collection} from ${source}`)
      console.error(`[🚨 VIOLATION COUNT] Total violations: ${this.violationCount}`)

      // Log to a special monitoring collection (admin only)
      if (process.env.NODE_ENV === 'production') {
        await this.logViolation(op)
      }
    } else if (isPremium) {
      console.log(`[✅ Firebase] Premium user ${userId} - ${operation} on ${collection}`)
    }

    // Clean old operations (keep last 1000)
    if (this.operations.size > 1000) {
      const sortedKeys = Array.from(this.operations.keys()).sort()
      for (let i = 0; i < 100; i++) {
        this.operations.delete(sortedKeys[i])
      }
    }
  }

  /**
   * Log violations to monitoring collection
   */
  private async logViolation(op: FirebaseOperation): Promise<void> {
    try {
      // Import dynamically to avoid circular dependencies
      const { adminDb } = await import('@/lib/firebase/admin')

      await adminDb.collection('monitoring_violations').add({
        ...op,
        detectedAt: new Date().toISOString(),
        severity: 'HIGH',
        message: `Free user ${op.userId} accessed Firebase ${op.operation} on ${op.collection}`
      })
    } catch (error) {
      console.error('[Monitoring] Failed to log violation:', error)
    }
  }

  /**
   * Get summary of operations
   */
  getSummary(): {
    totalOperations: number
    freeUserOperations: number
    premiumUserOperations: number
    violations: number
    operationsByType: Record<string, number>
    operationsByCollection: Record<string, number>
  } {
    let freeOps = 0
    let premiumOps = 0
    const byType: Record<string, number> = {}
    const byCollection: Record<string, number> = {}

    this.operations.forEach(op => {
      if (op.isPremium) {
        premiumOps++
      } else {
        freeOps++
      }

      byType[op.operation] = (byType[op.operation] || 0) + 1
      byCollection[op.collection] = (byCollection[op.collection] || 0) + 1
    })

    return {
      totalOperations: this.operations.size,
      freeUserOperations: freeOps,
      premiumUserOperations: premiumOps,
      violations: this.violationCount,
      operationsByType: byType,
      operationsByCollection: byCollection
    }
  }

  /**
   * Get recent violations
   */
  getViolations(): FirebaseOperation[] {
    return Array.from(this.operations.values())
      .filter(op => !op.isPremium && (op.operation === 'write' || op.operation === 'delete'))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50)
  }

  /**
   * Clear all tracked operations (for testing)
   */
  clear(): void {
    this.operations.clear()
    this.violationCount = 0
  }
}

// Export singleton instance
export const firebaseTracker = FirebaseUsageTracker.getInstance()

/**
 * Helper function to wrap Firebase operations with tracking
 */
export async function trackFirebaseOp<T>(
  userId: string,
  operation: FirebaseOperation['operation'],
  collection: string,
  isPremium: boolean,
  source: string,
  fn: () => Promise<T>
): Promise<T> {
  const tracker = FirebaseUsageTracker.getInstance()

  try {
    await tracker.trackOperation(userId, operation, collection, isPremium, source)
    const result = await fn()
    return result
  } catch (error) {
    console.error(`[Firebase Error] ${operation} on ${collection} failed:`, error)
    throw error
  }
}

// Log summary every 5 minutes in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const tracker = FirebaseUsageTracker.getInstance()
    const summary = tracker.getSummary()

    if (summary.totalOperations > 0) {
      console.log('='.repeat(60))
      console.log('[📊 Firebase Usage Summary]')
      console.log(`Total Operations: ${summary.totalOperations}`)
      console.log(`Premium Users: ${summary.premiumUserOperations}`)
      console.log(`Free Users: ${summary.freeUserOperations}`)
      console.log(`🚨 VIOLATIONS: ${summary.violations}`)
      console.log('Operations by Type:', summary.operationsByType)
      console.log('Operations by Collection:', summary.operationsByCollection)
      console.log('='.repeat(60))
    }
  }, 5 * 60 * 1000) // 5 minutes
}