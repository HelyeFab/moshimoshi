/**
 * Batch Monitoring API
 * Combines metrics, backup status, and quota data into a single request
 * Reduces 3 API calls to 1 for the monitoring dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { reviewMetrics, metricsDashboard } from '@/lib/monitoring/metrics-dashboard'
import { redis } from '@/lib/redis/client'
import admin from 'firebase-admin'

/**
 * GET /api/admin/monitoring/batch
 * Fetches all monitoring data in a single request
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Authenticate and check admin
    const session = await requireAuth()

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      )
    }

    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isAdmin = userData?.role === 'admin' || userData?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // 2. Fetch all data in parallel
    const [metricsData, backupData, quotaData] = await Promise.all([
      fetchMetrics(),
      fetchBackupStatus(session.uid),
      fetchQuotaData(),
    ])

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      metrics: metricsData,
      backup: backupData,
      quota: quotaData,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    console.error('[Batch Monitoring] Error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monitoring data',
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * Fetch system metrics
 */
async function fetchMetrics() {
  try {
    const dashboardSummary = reviewMetrics.getDashboardSummary()
    const healthScore = reviewMetrics.getHealthScore()
    const allMetrics = metricsDashboard.getAllMetrics()

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      health: healthScore,
      summary: dashboardSummary,
      metrics: allMetrics,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    }
  } catch (error) {
    console.error('[Batch Monitoring] Metrics error:', error)
    return {
      error: 'Failed to fetch metrics',
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Fetch backup status
 */
async function fetchBackupStatus(adminUid: string) {
  try {
    if (!adminDb) {
      return { error: 'Database not available' }
    }

    // Check PITR status
    let pitrEnabled = false
    let pitrEarliestRestoreTime = null

    try {
      const credentials = {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }

      const client = new admin.firestore.v1.FirestoreAdminClient({
        credentials,
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'moshimoshi-de237',
      })

      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'moshimoshi-de237'
      const databasePath = client.databasePath(projectId, '(default)')
      const [database] = await client.getDatabase({ name: databasePath })

      pitrEnabled = database.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_ENABLED'

      if (pitrEnabled && database.earliestVersionTime) {
        const seconds = database.earliestVersionTime.seconds
        const secondsNum =
          typeof seconds === 'object' && seconds !== null && 'toNumber' in seconds
            ? (seconds as { toNumber: () => number }).toNumber()
            : Number(seconds)
        pitrEarliestRestoreTime = secondsNum ? new Date(secondsNum * 1000).toISOString() : null
      }
    } catch (pitrError) {
      console.error('[Batch Monitoring] PITR check error:', pitrError)
    }

    // Get recent backups
    const backupsSnapshot = await adminDb
      .collection('backup_history')
      .orderBy('startedAt', 'desc')
      .limit(5)
      .get()

    const recentBackups = backupsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        type: data.type ?? 'unknown',
        status: data.status ?? 'unknown',
        startedAt: data.startedAt ?? '',
        completedAt: data.completedAt,
        error: data.error,
      }
    })

    const successfulBackups = recentBackups.filter((b) => b.status === 'completed').length
    const failedBackups = recentBackups.filter((b) => b.status === 'failed').length
    const inProgressBackups = recentBackups.filter((b) => b.status === 'in_progress').length
    const lastSuccessfulBackup = recentBackups.find((b) => b.status === 'completed')

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'moshimoshi-de237.firebasestorage.app'

    return {
      success: true,
      status: {
        pitr: {
          enabled: pitrEnabled,
          earliestRestoreTime: pitrEarliestRestoreTime,
          retentionDays: pitrEnabled ? 7 : 0,
          status: pitrEnabled ? 'ACTIVE' : 'DISABLED',
        },
        backups: {
          total: recentBackups.length,
          successful: successfulBackups,
          failed: failedBackups,
          inProgress: inProgressBackups,
          lastSuccessful: lastSuccessfulBackup
            ? {
                id: lastSuccessfulBackup.id,
                timestamp: lastSuccessfulBackup.completedAt || lastSuccessfulBackup.startedAt,
                type: lastSuccessfulBackup.type,
              }
            : null,
        },
        storage: {
          bucket: bucketName,
          backupPath: `gs://${bucketName}/backups/`,
        },
        health: {
          status:
            pitrEnabled && successfulBackups > 0
              ? 'HEALTHY'
              : pitrEnabled
                ? 'WARNING'
                : 'CRITICAL',
        },
      },
      recentBackups,
    }
  } catch (error) {
    console.error('[Batch Monitoring] Backup status error:', error)
    return { error: 'Failed to fetch backup status' }
  }
}

/**
 * Fetch Firebase quota data
 */
async function fetchQuotaData() {
  try {
    if (!adminDb) {
      return { error: 'Database not available' }
    }

    // Free tier limits
    const FREE_TIER_LIMITS = {
      reads: 50000,
      writes: 20000,
      deletes: 20000,
      storage: 1024,
    }

    // Blaze plan soft limits for monitoring
    const BLAZE_SOFT_LIMITS = {
      reads: 1000000,
      writes: 500000,
      deletes: 100000,
      storage: 10240,
    }

    // Try to get actual quota from Redis
    const today = new Date().toISOString().slice(0, 10)
    let dailyReads = 0
    let dailyWrites = 0
    let dailyDeletes = 0
    let source: 'redis' | 'estimate' = 'estimate'

    try {
      const [reads, writes, deletes] = await Promise.all([
        redis.get(`quota:${today}:reads`),
        redis.get(`quota:${today}:writes`),
        redis.get(`quota:${today}:deletes`),
      ])

      if (reads !== null || writes !== null || deletes !== null) {
        dailyReads = Number(reads) || 0
        dailyWrites = Number(writes) || 0
        dailyDeletes = Number(deletes) || 0
        source = 'redis'
      }
    } catch (redisError) {
      console.warn('[Batch Monitoring] Redis quota read failed, using estimates')
    }

    // Fall back to estimates if no Redis data
    if (source === 'estimate') {
      const totalUsers = (await adminDb.collection('users').count().get()).data().count
      dailyReads = totalUsers * 50
      dailyWrites = totalUsers * 10
      dailyDeletes = Math.floor(totalUsers * 0.5)
    }

    const isFreeTier = process.env.FIREBASE_BILLING_PLAN === 'free' || false
    const limits = isFreeTier ? FREE_TIER_LIMITS : BLAZE_SOFT_LIMITS

    const quota = {
      reads: {
        used: dailyReads,
        limit: limits.reads,
        percentage: Math.round((dailyReads / limits.reads) * 100),
        remaining: limits.reads - dailyReads,
      },
      writes: {
        used: dailyWrites,
        limit: limits.writes,
        percentage: Math.round((dailyWrites / limits.writes) * 100),
        remaining: limits.writes - dailyWrites,
      },
      deletes: {
        used: dailyDeletes,
        limit: limits.deletes,
        percentage: Math.round((dailyDeletes / limits.deletes) * 100),
        remaining: limits.deletes - dailyDeletes,
      },
      storage: {
        used: 100, // Placeholder
        limit: limits.storage,
        percentage: Math.round((100 / limits.storage) * 100),
        remaining: limits.storage - 100,
        unit: 'MB',
      },
    }

    const maxPercentage = Math.max(
      quota.reads.percentage,
      quota.writes.percentage,
      quota.deletes.percentage,
      quota.storage.percentage
    )

    return {
      success: true,
      quota,
      status: maxPercentage < 60 ? 'healthy' : maxPercentage < 80 ? 'warning' : 'critical',
      source,
      billingPlan: isFreeTier ? 'free' : 'blaze',
      alerts:
        maxPercentage > 80
          ? [{ type: 'quota', severity: maxPercentage > 90 ? 'critical' : 'warning', message: `Quota at ${maxPercentage}%` }]
          : [],
    }
  } catch (error) {
    console.error('[Batch Monitoring] Quota error:', error)
    return { error: 'Failed to fetch quota data' }
  }
}
