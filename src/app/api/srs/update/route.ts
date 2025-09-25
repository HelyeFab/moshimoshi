import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemId, srsData } = await request.json()

    if (!itemId || !srsData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Save to a dedicated srs_data collection
    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('srs_data')
      .doc(itemId)
      .set({
        itemId,
        ...srsData,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true })

    console.log(`[SRS] Updated SRS data for item ${itemId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating SRS data:', error)
    return NextResponse.json({ error: 'Failed to update SRS data' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all SRS data for the user
    const srsSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('srs_data')
      .get()

    const now = new Date()
    const items: any[] = []

    srsSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.nextReviewAt) {
        const nextReviewAt = data.nextReviewAt.toDate ? data.nextReviewAt.toDate() : new Date(data.nextReviewAt)
        const dueIn = Math.floor((nextReviewAt.getTime() - now.getTime()) / (1000 * 60 * 60))

        items.push({
          id: doc.id,
          ...data,
          nextReviewAt: nextReviewAt.toISOString(),
          dueIn,
          isOverdue: dueIn <= 0
        })
      }
    })

    // Sort by due date
    items.sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime())

    return NextResponse.json({
      success: true,
      items,
      stats: {
        total: items.length,
        overdue: items.filter(i => i.isOverdue).length
      }
    })
  } catch (error) {
    console.error('Error fetching SRS data:', error)
    return NextResponse.json({ error: 'Failed to fetch SRS data' }, { status: 500 })
  }
}