/**
 * Firebase Usage Monitoring API
 * Admin-only endpoint to monitor Firebase operations by user tier
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { firebaseTracker } from '@/lib/monitoring/firebase-tracker'

/**
 * GET /api/admin/monitoring/firebase-usage
 * Get Firebase usage statistics and violations
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate and check admin
    const session = await requireAuth()

    // 2. Check if user is admin
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isAdmin = userData?.role === 'admin' || userData?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    // 3. Get monitoring data
    const summary = firebaseTracker.getSummary()
    const violations = firebaseTracker.getViolations()

    // 4. Get recent violations from Firestore (if in production)
    let storedViolations: any[] = []
    if (process.env.NODE_ENV === 'production') {
      try {
        const violationsSnapshot = await adminDb
          .collection('monitoring_violations')
          .orderBy('timestamp', 'desc')
          .limit(50)
          .get()

        storedViolations = violationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (error) {
        console.error('[Monitoring] Failed to fetch stored violations:', error)
      }
    }

    // 5. Calculate cost estimates
    const costEstimates = calculateCostEstimates(summary)

    // 6. Return comprehensive monitoring data
    return NextResponse.json({
      success: true,
      data: {
        summary,
        violations: {
          recent: violations,
          stored: storedViolations,
          count: summary.violations
        },
        costEstimates,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    })

  } catch (error: any) {
    console.error('Error fetching Firebase usage:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch usage data' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/monitoring/firebase-usage/clear
 * Clear monitoring data (development only)
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Cannot clear in production' } },
        { status: 403 }
      )
    }

    // Authenticate and check admin
    const session = await requireAuth()
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isAdmin = userData?.role === 'admin' || userData?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    // Clear the tracker
    firebaseTracker.clear()

    return NextResponse.json({
      success: true,
      message: 'Monitoring data cleared'
    })

  } catch (error: any) {
    console.error('Error clearing monitoring data:', error)

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to clear data' } },
      { status: 500 }
    )
  }
}

/**
 * Calculate cost estimates based on usage
 */
function calculateCostEstimates(summary: any) {
  // Firestore pricing (approximate)
  const READ_COST_PER_100K = 0.06 // $0.06 per 100,000 reads
  const WRITE_COST_PER_100K = 0.18 // $0.18 per 100,000 writes
  const DELETE_COST_PER_100K = 0.02 // $0.02 per 100,000 deletes

  const reads = summary.operationsByType['read'] || 0
  const writes = summary.operationsByType['write'] || 0
  const deletes = summary.operationsByType['delete'] || 0

  const readCost = (reads / 100000) * READ_COST_PER_100K
  const writeCost = (writes / 100000) * WRITE_COST_PER_100K
  const deleteCost = (deletes / 100000) * DELETE_COST_PER_100K

  const totalCost = readCost + writeCost + deleteCost

  // Calculate potential savings if free users were not using Firebase
  const freeUserPercentage = summary.freeUserOperations / Math.max(summary.totalOperations, 1)
  const potentialSavings = totalCost * freeUserPercentage

  return {
    reads: { count: reads, cost: readCost.toFixed(4) },
    writes: { count: writes, cost: writeCost.toFixed(4) },
    deletes: { count: deletes, cost: deleteCost.toFixed(4) },
    total: {
      operations: summary.totalOperations,
      cost: totalCost.toFixed(4),
      dailyProjection: (totalCost * 24).toFixed(2), // Assuming data is from 1 hour
      monthlyProjection: (totalCost * 24 * 30).toFixed(2)
    },
    savings: {
      potential: potentialSavings.toFixed(4),
      percentage: (freeUserPercentage * 100).toFixed(1) + '%',
      monthlyPotential: (potentialSavings * 24 * 30).toFixed(2)
    },
    violations: {
      count: summary.violations,
      estimatedCost: ((summary.violations / 100000) * WRITE_COST_PER_100K).toFixed(4)
    }
  }
}