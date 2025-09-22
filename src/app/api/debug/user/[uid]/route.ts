import { NextRequest, NextResponse } from 'next/server'
import { adminFirestore } from '@/lib/firebase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const uid = params.uid
    console.log('Debug: Checking user with UID:', uid)

    // Fetch user document from Firestore using admin SDK
    const userDoc = await adminFirestore!.collection('users').doc(uid).get()

    if (!userDoc.exists) {
      return NextResponse.json({
        exists: false,
        uid: uid,
        message: 'User document not found'
      })
    }

    const userData = userDoc.data()

    return NextResponse.json({
      exists: true,
      uid: uid,
      data: userData,
      subscription: userData?.subscription || null,
      stripeCustomerId: userData?.stripeCustomerId || null
    })

  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user data', details: error },
      { status: 500 }
    )
  }
}