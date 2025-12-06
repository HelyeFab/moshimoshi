import { NextRequest, NextResponse } from 'next/server'
import { adminFirestore } from '@/lib/firebase/admin'

/**
 * GET /api/moodboards
 * List all active moodboards (public endpoint for learning feature)
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const jlpt = searchParams.get('jlpt') // Optional JLPT filter

    // Fetch all moodboards and filter/sort in memory (avoids composite index requirement)
    const snapshot = await adminFirestore
      .collection('moodBoards')
      .limit(500) // Reasonable upper limit
      .get()

    let moodboards = snapshot.docs
      .map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          title: data.title,
          emoji: data.emoji,
          jlpt: data.jlpt,
          background: data.background,
          description: data.description,
          kanji: data.kanji || [],
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
        }
      })
      // Filter active only
      .filter(board => board.isActive === true)

    // Apply JLPT filter if specified
    if (jlpt && ['N5', 'N4', 'N3', 'N2', 'N1'].includes(jlpt)) {
      moodboards = moodboards.filter(board => board.jlpt === jlpt)
    }

    // Sort by sortOrder
    moodboards.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

    // Apply limit
    moodboards = moodboards.slice(0, limit)

    return NextResponse.json({ moodboards })
  } catch (error) {
    console.error('Error fetching moodboards:', error)
    return NextResponse.json({ error: 'Failed to fetch moodboards' }, { status: 500 })
  }
}
