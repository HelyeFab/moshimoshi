import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb, adminAuth } from '@/lib/firebase/admin'
import { redis } from '@/lib/redis/client'
import { AuditEvent, AuditSeverity, getAuditLogsByDate } from '@/lib/auth/audit'

interface AuthEventSummary {
  recentEvents: Array<{
    id: string
    event: string
    timestamp: string
    userId?: string
    email?: string
    outcome: string
    severity: string
    ipAddress?: string
    details?: Record<string, unknown>
  }>
  stats: {
    totalSignIns: number
    totalSignUps: number
    failedLogins: number
    activeSessionsEstimate: number
    securityEvents: number
  }
  recentUsers: Array<{
    uid: string
    email: string
    lastSignIn: string | null
    creationTime: string
    providers: string[]
  }>
  securityAlerts: Array<{
    id: string
    event: string
    timestamp: string
    severity: string
    details: Record<string, unknown>
  }>
}

export async function GET(_request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify admin status from Firestore
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 3. Get date range for queries (last 7 days)
    const today = new Date()
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().slice(0, 10))
    }

    // 4. Fetch audit events from Redis
    const allEvents: Array<{
      id: string
      event: string
      timestamp: string
      userId?: string
      outcome: string
      severity?: string
      ipAddress?: string
      details?: Record<string, unknown>
    }> = []

    // Query audit logs by date
    for (const date of dates.slice(0, 3)) { // Last 3 days for performance
      const dayLogs = await getAuditLogsByDate(date, 50)
      for (const log of dayLogs) {
        allEvents.push({
          id: log.id,
          event: log.event,
          timestamp: log.timestamp.toISOString(),
          userId: log.userId,
          outcome: log.outcome,
          severity: log.severity,
          ipAddress: log.ipAddress,
          details: log.details,
        })
      }
    }

    // 5. Calculate stats from events
    const stats = {
      totalSignIns: 0,
      totalSignUps: 0,
      failedLogins: 0,
      activeSessionsEstimate: 0,
      securityEvents: 0,
    }

    const securityAlerts: AuthEventSummary['securityAlerts'] = []

    // Count failed logins and security events from audit logs
    // (Sign-ins and sign-ups are counted from Firebase Auth metadata for reliability)
    for (const event of allEvents) {
      if (event.event === AuditEvent.FAILED_LOGIN) stats.failedLogins++

      // Collect security events
      if (
        event.event === AuditEvent.FAILED_LOGIN ||
        event.event === AuditEvent.SUSPICIOUS_ACTIVITY ||
        event.event === AuditEvent.RATE_LIMIT_EXCEEDED ||
        event.event === AuditEvent.INVALID_TOKEN ||
        event.event === AuditEvent.CSRF_ATTEMPT ||
        event.event === AuditEvent.ACCOUNT_LOCKOUT
      ) {
        stats.securityEvents++
        if (event.severity === AuditSeverity.HIGH || event.severity === AuditSeverity.CRITICAL) {
          securityAlerts.push({
            id: event.id,
            event: event.event,
            timestamp: event.timestamp,
            severity: event.severity || 'medium',
            details: event.details || {},
          })
        }
      }
    }

    // 6. Get recent users from Firebase Auth (last 20 sign-ins)
    const recentUsers: AuthEventSummary['recentUsers'] = []

    // Calculate date thresholds for stats
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    try {
      if (!adminAuth) {
        throw new Error('Firebase Auth not initialized')
      }
      // List users sorted by last sign-in (Firebase doesn't support this directly,
      // so we get recent users and sort client-side)
      const listUsersResult = await adminAuth.listUsers(1000)

      const usersWithSignIn = listUsersResult.users
        .filter(user => user.metadata.lastSignInTime)
        .sort((a, b) => {
          const aTime = new Date(a.metadata.lastSignInTime || 0).getTime()
          const bTime = new Date(b.metadata.lastSignInTime || 0).getTime()
          return bTime - aTime
        })

      // Count sign-ins and sign-ups from Firebase Auth metadata (more reliable than audit logs)
      for (const user of usersWithSignIn) {
        const lastSignIn = new Date(user.metadata.lastSignInTime || 0)
        const creationTime = new Date(user.metadata.creationTime || 0)

        // Count sign-ins in last 3 days
        if (lastSignIn >= threeDaysAgo) {
          stats.totalSignIns++
        }

        // Count sign-ups in last 3 days
        if (creationTime >= threeDaysAgo) {
          stats.totalSignUps++
        }
      }

      // Get top 20 for display
      for (const user of usersWithSignIn.slice(0, 20)) {
        recentUsers.push({
          uid: user.uid,
          email: user.email || 'No email',
          lastSignIn: user.metadata.lastSignInTime || null,
          creationTime: user.metadata.creationTime || '',
          providers: user.providerData.map(p => p.providerId),
        })
      }
    } catch (err) {
      console.error('[Auth Events] Error fetching users from Firebase Auth:', err)
    }

    // 7. Estimate active sessions from Redis
    try {
      const sessionKeys = await redis.keys('session:*')
      stats.activeSessionsEstimate = Array.isArray(sessionKeys) ? sessionKeys.length : 0
    } catch (err) {
      console.error('[Auth Events] Error counting sessions:', err)
    }

    // 8. Enrich events with email from Firebase Auth
    const enrichedEvents = await Promise.all(
      allEvents.slice(0, 50).map(async (event) => {
        let email: string | undefined
        if (event.userId && adminAuth) {
          try {
            const user = await adminAuth.getUser(event.userId)
            email = user.email
          } catch {
            // User may have been deleted
          }
        }
        return {
          ...event,
          email,
          severity: event.severity || 'low', // Ensure severity is always defined
        }
      })
    )

    // 9. Sort events by timestamp (most recent first)
    enrichedEvents.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    const response: AuthEventSummary = {
      recentEvents: enrichedEvents,
      stats,
      recentUsers,
      securityAlerts: securityAlerts.slice(0, 10),
    }

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Auth Events] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auth events', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
