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
    const episodeId = searchParams.get('episodeId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const seriesId = searchParams.get('seriesId') || 'moshi-goes-to-japan'

    // If episodeId is provided, fetch single episode
    if (episodeId) {
      const episodeDoc = await adminFirestore!.collection('comics').doc(episodeId).get()
      if (!episodeDoc.exists) {
        return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
      }

      const episode = {
        id: episodeDoc.id,
        ...episodeDoc.data(),
        createdAt: episodeDoc.data()?.createdAt?.toDate?.() || episodeDoc.data()?.createdAt,
        updatedAt: episodeDoc.data()?.updatedAt?.toDate?.() || episodeDoc.data()?.updatedAt,
        publishedAt: episodeDoc.data()?.publishedAt?.toDate?.() || episodeDoc.data()?.publishedAt,
      }

      return NextResponse.json({
        success: true,
        episodes: [episode],
        count: 1,
      })
    }

    // Otherwise, fetch list of episodes
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
 * PATCH /api/admin/comics/episodes
 * Update a comic episode (title, panel order, etc.)
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { episodeId, updates } = body

    if (!episodeId) {
      return NextResponse.json({ error: 'Episode ID required' }, { status: 400 })
    }

    // Validate updates - only allow specific fields
    const allowedFields = ['title', 'titleJa', 'description', 'descriptionJa', 'panels']
    const sanitizedUpdates: Record<string, any> = {}

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field]
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    // Add updatedAt timestamp
    sanitizedUpdates.updatedAt = new Date()

    // Update the episode
    const episodeRef = adminFirestore!.collection('comics').doc(episodeId)
    const episodeDoc = await episodeRef.get()

    if (!episodeDoc.exists) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    await episodeRef.update(sanitizedUpdates)

    console.log(`[ComicEpisodes] Episode updated: ${episodeId}`, Object.keys(sanitizedUpdates))

    return NextResponse.json({
      success: true,
      episodeId,
      updatedFields: Object.keys(sanitizedUpdates),
    })
  } catch (error) {
    console.error('Error updating comic episode:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update episode' },
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
