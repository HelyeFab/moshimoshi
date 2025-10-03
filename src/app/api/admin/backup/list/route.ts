/**
 * Backup List API
 * Get list of all backups with filtering options
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

/**
 * GET /api/admin/backup/list
 * Get paginated list of backups
 *
 * Query params:
 * - limit: number (default: 20, max: 100)
 * - type: 'manual' | 'scheduled' | 'all' (default: 'all')
 * - status: 'completed' | 'failed' | 'in_progress' | 'all' (default: 'all')
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

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const typeFilter = searchParams.get('type') || 'all'
    const statusFilter = searchParams.get('status') || 'all'

    // 3. Build query
    let query: any = adminDb.collection('backup_history')

    // Apply filters
    if (typeFilter !== 'all') {
      query = query.where('type', '==', typeFilter)
    }

    if (statusFilter !== 'all') {
      query = query.where('status', '==', statusFilter)
    }

    // Order and limit
    query = query.orderBy('startedAt', 'desc').limit(limit)

    // 4. Execute query
    const snapshot = await query.get()

    const backups = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        type: data.type,
        status: data.status,
        triggeredBy: data.triggeredByEmail || data.triggeredBy,
        reason: data.reason,
        collections: data.collections,
        exportPath: data.exportPath,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        error: data.error,
        duration: data.completedAt && data.startedAt
          ? calculateDuration(data.startedAt, data.completedAt)
          : null,
      }
    })

    // 5. Calculate summary statistics
    const summary = {
      total: backups.length,
      completed: backups.filter(b => b.status === 'completed').length,
      failed: backups.filter(b => b.status === 'failed').length,
      inProgress: backups.filter(b => b.status === 'in_progress').length,
      manual: backups.filter(b => b.type === 'manual').length,
      scheduled: backups.filter(b => b.type === 'scheduled').length,
    }

    return NextResponse.json({
      success: true,
      backups,
      summary,
      filters: {
        type: typeFilter,
        status: statusFilter,
        limit,
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('[Backup List] Error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch backup list',
      details: error.message,
    }, { status: 500 })
  }
}

/**
 * Calculate duration between two ISO timestamps
 */
function calculateDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const durationMs = end - start

  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}
