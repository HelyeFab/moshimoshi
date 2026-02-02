import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const POST = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    const { uid } = context.params || {}
    if (!uid) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user ID (support both UID and email as parameter)
    let userId: string
    try {
      const userRecord = await adminAuth.getUser(uid)
      userId = userRecord.uid
    } catch {
      try {
        const userRecord = await adminAuth.getUserByEmail(uid)
        userId = userRecord.uid
      } catch {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    // Parse request body for optional date specification
    let body: { date?: string } = {}
    try {
      body = await request.json()
    } catch {
      // No body provided, reset today's usage
    }

    const dateToReset = body.date || new Date().toISOString().split('T')[0]

    // Get the usage document for the specified date
    const usageRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('usage')
      .doc(dateToReset)

    const usageDoc = await usageRef.get()

    if (!usageDoc.exists) {
      return NextResponse.json({
        success: true,
        message: `No usage document found for ${dateToReset}`,
        data: { userId, date: dateToReset, wasDeleted: false }
      })
    }

    // Delete the usage document (reset usage)
    await usageRef.delete()

    return NextResponse.json({
      success: true,
      message: `Usage reset for ${dateToReset}`,
      data: {
        userId,
        date: dateToReset,
        wasDeleted: true,
        previousData: usageDoc.data()
      }
    })
  } catch (error: any) {
    console.error('[Admin API] Error resetting usage:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reset usage' },
      { status: 500 }
    )
  }
})
