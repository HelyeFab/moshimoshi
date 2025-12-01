/**
 * Backup Status API
 * Get current backup status and PITR configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import admin from 'firebase-admin'

/**
 * Backup history record structure stored in Firestore
 */
interface BackupHistoryRecord {
  id: string
  type: 'manual' | 'scheduled' | string
  status: 'in_progress' | 'completed' | 'failed'
  triggeredBy?: string
  triggeredByEmail?: string
  reason?: string
  collections?: string[]
  exportPath?: string
  operationName?: string | null
  startedAt: string
  completedAt?: string | null
  error?: string | null
  metadata?: {
    userAgent?: string | null
    ipAddress?: string | null
  }
}

/**
 * GET /api/admin/backup/status
 * Get backup system status including PITR configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Check adminDb is initialized
    if (!adminDb) {
      console.error('[Backup Status] Firebase Admin DB not initialized')
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      )
    }

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

    // 2. Check PITR status
    let pitrEnabled = false
    let pitrEarliestRestoreTime = null

    try {
      // Create credentials from environment variables
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
        // earliestVersionTime.seconds may be a Long type from protobuf
        const seconds = database.earliestVersionTime.seconds
        const secondsNum = typeof seconds === 'object' && seconds !== null && 'toNumber' in seconds
          ? (seconds as { toNumber: () => number }).toNumber()
          : Number(seconds)
        pitrEarliestRestoreTime = secondsNum
          ? new Date(secondsNum * 1000).toISOString()
          : null
      }
    } catch (pitrError: any) {
      console.error('[Backup Status] Failed to check PITR status:', pitrError)
      console.error('[Backup Status] Error details:', pitrError.message, pitrError.stack)
      // Continue without PITR info
    }

    // 3. Get recent backups
    const backupsSnapshot = await adminDb
      .collection('backup_history')
      .orderBy('startedAt', 'desc')
      .limit(10)
      .get()

    const recentBackups: BackupHistoryRecord[] = backupsSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        type: data.type ?? 'unknown',
        status: data.status ?? 'unknown',
        triggeredBy: data.triggeredBy,
        triggeredByEmail: data.triggeredByEmail,
        reason: data.reason,
        collections: data.collections,
        exportPath: data.exportPath,
        operationName: data.operationName,
        startedAt: data.startedAt ?? '',
        completedAt: data.completedAt,
        error: data.error,
        metadata: data.metadata,
      } as BackupHistoryRecord
    })

    // 4. Calculate backup statistics
    const totalBackups = recentBackups.length
    const successfulBackups = recentBackups.filter(b => b.status === 'completed').length
    const failedBackups = recentBackups.filter(b => b.status === 'failed').length
    const inProgressBackups = recentBackups.filter(b => b.status === 'in_progress').length

    const lastSuccessfulBackup = recentBackups.find(b => b.status === 'completed')
    const lastFailedBackup = recentBackups.find(b => b.status === 'failed')

    // 5. Get storage bucket info
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'moshimoshi-de237.firebasestorage.app'

    return NextResponse.json({
      success: true,
      status: {
        pitr: {
          enabled: pitrEnabled,
          earliestRestoreTime: pitrEarliestRestoreTime,
          retentionDays: pitrEnabled ? 7 : 0,
          status: pitrEnabled ? 'ACTIVE' : 'DISABLED',
        },
        backups: {
          total: totalBackups,
          successful: successfulBackups,
          failed: failedBackups,
          inProgress: inProgressBackups,
          lastSuccessful: lastSuccessfulBackup ? {
            id: lastSuccessfulBackup.id,
            timestamp: lastSuccessfulBackup.completedAt || lastSuccessfulBackup.startedAt,
            type: lastSuccessfulBackup.type,
          } : null,
          lastFailed: lastFailedBackup ? {
            id: lastFailedBackup.id,
            timestamp: lastFailedBackup.completedAt || lastFailedBackup.startedAt,
            error: lastFailedBackup.error,
          } : null,
        },
        storage: {
          bucket: bucketName,
          backupPath: `gs://${bucketName}/backups/`,
        },
        health: {
          status: pitrEnabled && successfulBackups > 0 ? 'HEALTHY' :
                  pitrEnabled ? 'WARNING' : 'CRITICAL',
          message: pitrEnabled && successfulBackups > 0
            ? 'Backup system operational with PITR enabled'
            : pitrEnabled
              ? 'PITR enabled but no recent backups'
              : 'CRITICAL: PITR not enabled - enable immediately!',
        }
      },
      recentBackups: recentBackups.slice(0, 5), // Only return 5 most recent
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('[Backup Status] Error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch backup status',
      details: error.message,
    }, { status: 500 })
  }
}
