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

    if (!userDoc.exists) {
      // User doesn't have a document yet - return free tier
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