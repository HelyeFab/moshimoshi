/**
 * Manual Database Backup Trigger API
 * Allows admins to manually trigger a Firebase Firestore backup
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb, adminFirestore } from '@/lib/firebase/admin'

// Import the admin SDK that's already initialized
import admin from 'firebase-admin'

/**
 * POST /api/admin/backup/trigger
 * Trigger a manual Firebase backup
 *
 * Request body:
 * {
 *   collections?: string[]  // Optional: specific collections to backup (default: all)
 *   reason?: string         // Optional: reason for backup
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check adminDb is initialized
    if (!adminDb) {
      console.error('[Backup] Firebase Admin DB not initialized')
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

    // 2. Parse request body
    const body = await request.json().catch(() => ({}))
    const { collections, reason } = body

    // 3. Generate backup ID
    const backupId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const timestamp = new Date().toISOString()

    // 4. Prepare backup configuration
    // Use EU bucket since Firestore is in EU region (eur3)
    const bucketName = 'moshimoshi-de237-backups'
    const exportPath = `gs://${bucketName}/backups/manual/${backupId}`

    console.log(`[Backup] Starting manual backup: ${backupId}`)
    console.log(`[Backup] Export path: ${exportPath}`)
    console.log(`[Backup] Collections: ${collections ? collections.join(', ') : 'ALL'}`)

    try {
      // 5. Trigger Firebase export
      // Note: This requires the Firebase Admin SDK to be properly configured
      // with service account credentials that have Datastore Import Export Admin role

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

      const [operation] = await client.exportDocuments({
        name: databasePath,
        outputUriPrefix: exportPath,
        collectionIds: collections || undefined, // undefined = all collections
      })

      // 6. Log backup to Firestore
      const backupRecord = {
        id: backupId,
        type: 'manual',
        status: 'in_progress',
        triggeredBy: session.uid,
        triggeredByEmail: userData?.email || 'unknown',
        reason: reason || 'Manual backup',
        collections: collections || ['ALL'],
        exportPath,
        operationName: operation.name,
        startedAt: timestamp,
        completedAt: null,
        error: null,
        metadata: {
          userAgent: request.headers.get('user-agent'),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        }
      }

      await adminDb.collection('backup_history').doc(backupId).set(backupRecord)

      console.log(`[Backup] Backup initiated successfully: ${backupId}`)
      console.log(`[Backup] Operation: ${operation.name}`)

      return NextResponse.json({
        success: true,
        backup: {
          id: backupId,
          status: 'in_progress',
          exportPath,
          operationName: operation.name,
          startedAt: timestamp,
          collections: collections || ['ALL'],
        },
        message: 'Backup initiated successfully. This may take several minutes.',
      })

    } catch (exportError: any) {
      console.error('[Backup] Export failed:', exportError)
      console.error('[Backup] Error message:', exportError.message)
      console.error('[Backup] Error stack:', exportError.stack)
      console.error('[Backup] Error details:', JSON.stringify(exportError, null, 2))

      // Log failure to Firestore
      await adminDb.collection('backup_history').doc(backupId).set({
        id: backupId,
        type: 'manual',
        status: 'failed',
        triggeredBy: session.uid,
        triggeredByEmail: userData?.email || 'unknown',
        reason: reason || 'Manual backup',
        collections: collections || ['ALL'],
        exportPath,
        startedAt: timestamp,
        completedAt: new Date().toISOString(),
        error: exportError.message,
      })

      // Check if this is a permissions error
      if (exportError.message?.includes('permission') || exportError.message?.includes('PERMISSION_DENIED')) {
        return NextResponse.json({
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'Service account lacks Datastore Import Export Admin role. Please grant this permission in Google Cloud Console.',
          details: exportError.message,
        }, { status: 403 })
      }

      return NextResponse.json({
        success: false,
        error: 'BACKUP_FAILED',
        message: 'Failed to initiate backup',
        details: exportError.message,
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('[Backup] Error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: error.message,
    }, { status: 500 })
  }
}
