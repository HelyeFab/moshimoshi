import { NextResponse } from 'next/server'
import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'

export async function GET() {
  try {
    // Test Firebase Admin initialization
    ensureAdminInitialized()

    const tests = {
      adminInitialized: !!adminAuth && !!adminFirestore,
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID?.trim(),
    }

    // Try to list users (will fail if not properly authenticated)
    try {
      const userList = await adminAuth!.listUsers(1)
      tests.canListUsers = true
      tests.usersFound = userList.users.length
    } catch (error: any) {
      tests.canListUsers = false
      tests.listUsersError = error.message
    }

    // Try to read from Firestore
    try {
      const doc = await adminFirestore!.collection('test').doc('test').get()
      tests.canReadFirestore = true
    } catch (error: any) {
      tests.canReadFirestore = false
      tests.firestoreError = error.message
    }

    return NextResponse.json({
      success: true,
      tests
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}