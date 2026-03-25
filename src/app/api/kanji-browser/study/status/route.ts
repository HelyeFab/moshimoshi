import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

const FREE_UNLOCK_LIMIT = 10

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({
        plan: 'guest',
        unlockedCount: 0,
        unlockedKanji: [],
        remaining: 0,
        limit: 0,
        isUnlimited: false,
        canStudy: false,
      })
    }

    const db = getAdminDb()
    const userId = session.uid

    let plan = 'free'
    try {
      const userDoc = await db.collection('users').doc(userId).get()
      const userData = userDoc.data()
      plan = userData?.subscription?.plan || 'free'
    } catch (error) {
      console.error('[kanji-browser-study-status] Error fetching user plan:', error)
    }

    const progressDoc = await db
      .collection('users')
      .doc(userId)
      .collection('progress')
      .doc('kanji_browser_study')
      .get()

    const unlockedCount = progressDoc.exists ? progressDoc.data()?.unlockedCount || 0 : 0
    const unlockedKanji = progressDoc.exists ? progressDoc.data()?.unlockedKanji || [] : []
    const isUnlimited = plan === 'premium_monthly' || plan === 'premium_yearly'

    return NextResponse.json({
      plan,
      unlockedCount,
      unlockedKanji,
      remaining: isUnlimited ? -1 : Math.max(0, FREE_UNLOCK_LIMIT - unlockedCount),
      limit: isUnlimited ? -1 : FREE_UNLOCK_LIMIT,
      isUnlimited,
      canStudy: true,
    })
  } catch (error) {
    console.error('[kanji-browser-study-status] Error loading status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
