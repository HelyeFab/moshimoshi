/**
 * Firebase Quota Monitoring API
 * Tracks Firestore read/write/delete operations and quota usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

/**
 * GET /api/admin/monitoring/quota
 * Get Firebase quota usage and limits
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate and check admin
    const session = await requireAuth()

    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isAdmin = userData?.role === 'admin' || userData?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // 2. Get usage data from the monitoring collection (if you're tracking it)
    // For now, we'll estimate based on your tier and typical usage

    // Firebase Free Tier Limits (Spark Plan)
    const FREE_TIER_LIMITS = {
      reads: 50000,      // 50K reads per day
      writes: 20000,     // 20K writes per day
      deletes: 20000,    // 20K deletes per day
      storage: 1024,     // 1 GB storage
    }

    // Firebase Blaze Plan (Pay as you go) - no hard limits but we set soft limits for monitoring
    const BLAZE_SOFT_LIMITS = {
      reads: 1000000,    // 1M reads per day (soft limit for alerting)
      writes: 500000,    // 500K writes per day
      deletes: 100000,   // 100K deletes per day
      storage: 10240,    // 10 GB soft limit
    }

    // 3. Get actual usage from your app
    // This is a simplified version - you'd track this in real-time in production
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if you have a usage tracking collection
    let dailyReads = 0
    let dailyWrites = 0
    let dailyDeletes = 0

    try {
      // Try to get from usage tracking if implemented
      const usageDoc = await adminDb
        .collection('system_metrics')
        .doc('daily_quota')
        .get()

      if (usageDoc.exists) {
        const data = usageDoc.data()
        dailyReads = data?.reads || 0
        dailyWrites = data?.writes || 0
        dailyDeletes = data?.deletes || 0
      }
    } catch (err) {
      // If no tracking exists, estimate based on collections size
      console.log('[Quota] No usage tracking found, using estimates')
    }

    // 4. If no tracking, provide estimates
    if (dailyReads === 0 && dailyWrites === 0) {
      // Estimate based on your user count
      const totalUsers = (await adminDb.collection('users').count().get()).data().count

      // Rough estimates (adjust based on your actual usage patterns)
      dailyReads = totalUsers * 50   // Assume 50 reads per user per day
      dailyWrites = totalUsers * 10  // Assume 10 writes per user per day
      dailyDeletes = Math.floor(totalUsers * 0.5)  // Assume 0.5 deletes per user per day
    }

    // 5. Check storage usage
    // Note: This requires the Firebase Management API which needs additional setup
    // For now, we'll estimate based on document count
    const estimatedStorageMB = 100 // Placeholder - you'd calculate this properly

    // 6. Determine if on free tier or Blaze
    const isFreeTier = process.env.FIREBASE_BILLING_PLAN === 'free' || false
    const limits = isFreeTier ? FREE_TIER_LIMITS : BLAZE_SOFT_LIMITS

    // 7. Calculate percentages
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
        used: estimatedStorageMB,
        limit: limits.storage,
        percentage: Math.round((estimatedStorageMB / limits.storage) * 100),
        remaining: limits.storage - estimatedStorageMB,
        unit: 'MB',
      },
    }

    // 8. Determine health status
    const maxPercentage = Math.max(
      quota.reads.percentage,
      quota.writes.percentage,
      quota.deletes.percentage,
      quota.storage.percentage
    )

    let status: 'healthy' | 'warning' | 'critical'
    if (maxPercentage < 60) {
      status = 'healthy'
    } else if (maxPercentage < 80) {
      status = 'warning'
    } else {
      status = 'critical'
    }

    // 9. Generate alerts
    const alerts = []
    if (quota.reads.percentage > 80) {
      alerts.push({
        type: 'quota',
        severity: quota.reads.percentage > 90 ? 'critical' : 'warning',
        message: `Read quota at ${quota.reads.percentage}% (${quota.reads.used.toLocaleString()}/${quota.reads.limit.toLocaleString()})`,
      })
    }
    if (quota.writes.percentage > 80) {
      alerts.push({
        type: 'quota',
        severity: quota.writes.percentage > 90 ? 'critical' : 'warning',
        message: `Write quota at ${quota.writes.percentage}% (${quota.writes.used.toLocaleString()}/${quota.writes.limit.toLocaleString()})`,
      })
    }
    if (quota.storage.percentage > 80) {
      alerts.push({
        type: 'quota',
        severity: quota.storage.percentage > 90 ? 'critical' : 'warning',
        message: `Storage quota at ${quota.storage.percentage}% (${quota.storage.used}MB/${quota.storage.limit}MB)`,
      })
    }

    return NextResponse.json({
      success: true,
      quota,
      status,
      alerts,
      billingPlan: isFreeTier ? 'free' : 'blaze',
      timestamp: new Date().toISOString(),
      note: 'Usage estimates are based on typical patterns. Enable real-time tracking for accurate data.',
    })

  } catch (error: any) {
    console.error('[Quota Monitoring] Error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch quota data',
      details: error.message,
    }, { status: 500 })
  }
}
