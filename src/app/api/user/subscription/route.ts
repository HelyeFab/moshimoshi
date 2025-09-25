// API endpoint to get user's subscription data
// Uses session authentication to fetch from Firestore server-side

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'

// Named export for GET method (App Router style)
export async function GET(request: NextRequest) {
  try {
    // Get session from JWT
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user document from Firestore using admin SDK (no permission issues)
    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()

    console.log('[GET /api/user/subscription] User doc exists:', userDoc.exists);
    console.log('[GET /api/user/subscription] Session uid:', session.uid);
    console.log('[GET /api/user/subscription] Session tier:', session.tier);

    if (!userDoc.exists) {
      // User doesn't have a document yet - return free tier
      console.log('[GET /api/user/subscription] No user doc, returning free tier');
      return NextResponse.json({
        subscription: {
          plan: 'free',
          status: 'active'
        }
      })
    }

    const userData = userDoc.data()
    const subscription = userData?.subscription || {
      plan: 'free',
      status: 'active'
    }

    console.log('[GET /api/user/subscription] Raw subscription from DB:', JSON.stringify(subscription));
    console.log('[GET /api/user/subscription] Plan:', subscription.plan, 'Status:', subscription.status);

    // Convert Firestore Timestamp to ISO string for client
    if (subscription.currentPeriodEnd) {
      // Check if it's a Firestore Timestamp
      if (subscription.currentPeriodEnd.toDate && typeof subscription.currentPeriodEnd.toDate === 'function') {
        subscription.currentPeriodEnd = subscription.currentPeriodEnd.toDate().toISOString()
      } else if (subscription.currentPeriodEnd._seconds) {
        // Handle raw Firestore timestamp format
        subscription.currentPeriodEnd = new Date(subscription.currentPeriodEnd._seconds * 1000).toISOString()
      }
    }

    return NextResponse.json({ subscription })

  } catch (error) {
    console.error('Error fetching subscription:', error)

    // Default to free tier on error
    return NextResponse.json({
      subscription: {
        plan: 'free',
        status: 'active'
      }
    })
  }
}