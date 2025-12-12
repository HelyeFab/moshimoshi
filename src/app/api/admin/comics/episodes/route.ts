import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'

initAdmin()

/**
 * GET /api/admin/comics/episodes
 * List all comic episodes (including unpublished) for admin
 */
export async function GET(request: NextRequest) {
  try {
    // Check for admin key authentication
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

    const episodesSnapshot = await adminFirestore!
      .collection('comics')
      .where('seriesId', '==', seriesId)
      .orderBy('episodeNumber', 'desc')
      .limit(limit)
      .get()

    const episodes = episodesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      publishedAt: doc.data().publishedAt?.toDate?.() || doc.data().publishedAt,
    }))

    return NextResponse.json({
      success: true,
      episodes,
      count: episodes.length,
    })
  } catch (error) {
    console.error('Error fetching comic episodes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch episodes' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/comics/episodes
 * Delete a comic episode
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
    const userData = userDoc?.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { episodeId } = await request.json()

    if (!episodeId) {
      return NextResponse.json({ error: 'Episode ID required' }, { status: 400 })
    }

    // Check if it's a draft or published episode
    const draftDoc = await adminFirestore!.collection('comic_drafts').doc(episodeId).get()
    if (draftDoc.exists) {
      await adminFirestore!.collection('comic_drafts').doc(episodeId).delete()
      return NextResponse.json({ success: true, message: 'Draft deleted' })
    }

    const episodeDoc = await adminFirestore!.collection('comics').doc(episodeId).get()
    if (episodeDoc.exists) {
      await adminFirestore!.collection('comics').doc(episodeId).delete()

      // Update series episode count
      const episodeData = episodeDoc.data()
      if (episodeData?.seriesId) {
        const seriesRef = adminFirestore!.collection('comic_series').doc(episodeData.seriesId)
        const seriesDoc = await seriesRef.get()
        if (seriesDoc.exists) {
          const currentCount = seriesDoc.data()?.publishedEpisodeCount || 0
          await seriesRef.update({
            publishedEpisodeCount: Math.max(0, currentCount - 1),
            updatedAt: new Date(),
          })
        }
      }

      return NextResponse.json({ success: true, message: 'Episode deleted' })
    }

    return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
  } catch (error) {
    console.error('Error deleting comic episode:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete episode' },
      { status: 500 }
    )
  }
}
