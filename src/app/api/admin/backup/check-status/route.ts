/**
 * Check Backup Status API
 * Checks Firebase operations and updates backup records
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import admin from 'firebase-admin'
import type { BackupRecord } from '@/types/admin'

/**
 * POST /api/admin/backup/check-status
 * Check status of in-progress backups and update records
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate and check admin
    const session = await requireAuth()

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
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

    // 2. Get all in-progress backups
    const inProgressSnapshot = await adminDb
      .collection('backup_history')
      .where('status', '==', 'in_progress')
      .get()

    if (inProgressSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No backups to check',
        checked: 0,
        updated: 0,
      })
    }

    // 3. Check each backup operation
    const credentials = {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }

    const client = new admin.firestore.v1.FirestoreAdminClient({
      credentials,
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'moshimoshi-de237',
    })

    let updated = 0
    const results: Array<{ id: string; status: string; updated: boolean; error?: string }> = []

    for (const doc of inProgressSnapshot.docs) {
      const backup = doc.data() as Partial<BackupRecord>
      const backupId = doc.id

      try {
        if (!backup.operationName) {
          // No operation name, mark as failed
          await adminDb.collection('backup_history').doc(backupId).update({
            status: 'failed',
            completedAt: new Date().toISOString(),
            error: 'No operation name recorded',
          })
          updated++
          results.push({
            id: backupId,
            status: 'failed',
            updated: true,
          })
          continue
        }

        // Get the operation status
        const operationsClient = client.operationsClient
        // Type assertion needed for Google Cloud protobuf types
        const [operation] = await operationsClient.getOperation({
          name: backup.operationName,
        } as Parameters<typeof operationsClient.getOperation>[0])

        if (operation.done) {
          if (operation.error) {
            // Operation failed
            await adminDb.collection('backup_history').doc(backupId).update({
              status: 'failed',
              completedAt: new Date().toISOString(),
              error: operation.error.message || 'Unknown error',
            })
          } else {
            // Operation completed successfully
            await adminDb.collection('backup_history').doc(backupId).update({
              status: 'completed',
              completedAt: new Date().toISOString(),
            })
          }

          updated++
          results.push({
            id: backupId,
            status: operation.error ? 'failed' : 'completed',
            updated: true,
          })

          console.log(`[Backup Status] Updated ${backupId} to ${operation.error ? 'failed' : 'completed'}`)
        } else {
          results.push({
            id: backupId,
            status: 'still_in_progress',
            updated: false,
          })
        }
      } catch (error: any) {
        console.error(`[Backup Status] Error checking ${backupId}:`, error.message)
        results.push({
          id: backupId,
          status: 'error',
          error: error.message,
          updated: false,
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: inProgressSnapshot.size,
      updated,
      results,
    })

  } catch (error: any) {
    console.error('[Backup Status Check] Error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to check backup status',
      details: error.message,
    }, { status: 500 })
  }
}
