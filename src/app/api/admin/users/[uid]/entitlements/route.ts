import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    const { uid } = context.params || {}
    if (!uid) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user ID (support both UID and email)
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

    // Get user subscription/tier
    const userDoc = await adminDb.collection('users').doc(userId).get()
    const userData = userDoc.exists ? userDoc.data() : null

    const tier = userData?.subscription?.plan || userData?.tier || 'free'
    const status = userData?.subscription?.status || 'active'

    // Get all usage documents
    const usageSnapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('usage')
      .get()

    interface UsageByDate {
      [date: string]: {
        features: Record<string, number>
        updatedAt: string | null
        hasOldSchema: boolean
      }
    }

    const usageByDate: UsageByDate = {}
    const schemaIssues: Array<{ date: string; type: string }> = []

    usageSnapshot.forEach((doc) => {
      const date = doc.id
      const data = doc.data()

      const features: Record<string, number> = {}
      let hasOldSchema = false

      Object.keys(data).forEach((key) => {
        // Skip metadata
        if (key === 'userId' || key === 'date' || key === 'updatedAt' || key === 'lastUpdated') {
          return
        }

        if (key === 'counts' && typeof data[key] === 'object') {
          // OLD SCHEMA
          hasOldSchema = true
          schemaIssues.push({ date, type: 'old_counts_schema' })
          Object.keys(data.counts).forEach((feature) => {
            features[feature] = data.counts[feature]
          })
        } else if (typeof data[key] === 'number') {
          // NEW SCHEMA: top-level feature counts
          features[key] = data[key]
        }
      })

      if (Object.keys(features).length > 0) {
        usageByDate[date] = {
          features,
          updatedAt: data.updatedAt || data.lastUpdated || null,
          hasOldSchema
        }
      }
    })

    // Sort dates (most recent first)
    const sortedDates = Object.keys(usageByDate).sort().reverse()

    // Get today's date and current month
    const today = new Date().toISOString().split('T')[0]
    const currentMonth = today.substring(0, 7)

    // Calculate total usage
    const totalUsage: Record<string, number> = {}
    const todayUsage: Record<string, number> = {}
    const monthUsage: Record<string, number> = {}

    sortedDates.forEach((date) => {
      const usage = usageByDate[date]
      Object.entries(usage.features).forEach(([feature, count]) => {
        totalUsage[feature] = (totalUsage[feature] || 0) + count

        if (date === today) {
          todayUsage[feature] = count
        }

        if (date.startsWith(currentMonth)) {
          monthUsage[feature] = (monthUsage[feature] || 0) + count
        }
      })
    })

    const response = {
      userId,
      tier,
      status,
      usage: {
        byDate: Object.fromEntries(
          sortedDates.slice(0, 10).map((date) => [
            date,
            {
              ...usageByDate[date],
              isToday: date === today,
              isThisMonth: date.startsWith(currentMonth)
            }
          ])
        ),
        totals: {
          today: todayUsage,
          month: monthUsage,
          allTime: totalUsage
        },
        totalDates: sortedDates.length
      },
      schemaIssues
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error: any) {
    console.error('[Admin API] Error fetching entitlements:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch entitlements' },
      { status: 500 }
    )
  }
})
