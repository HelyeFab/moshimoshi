import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'

initAdmin()

/**
 * GET /api/admin/comics/drafts
 * List comic episode drafts
 */
export async function GET(request: NextRequest) {
  try {
    // Check for admin key authentication (for scheduled functions)
    const adminKey = request.headers.get('X-Admin-Key')
    const expectedAdminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025'

    if (adminKey !== expectedAdminKey) {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      const userData = userDoc?.data()
      if (!userData?.isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const seriesId = searchParams.get('seriesId') || 'moshi-goes-to-japan'

    const draftsSnapshot = await adminFirestore!
      .collection('comic_drafts')
      .where('seriesId', '==', seriesId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const drafts = draftsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
    }))

    return NextResponse.json({
      success: true,
      drafts,
      count: drafts.length,
    })
  } catch (error) {
    console.error('Error fetching comic drafts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch drafts' },
      { status: 500 }
    )
  }
}
