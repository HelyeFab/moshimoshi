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

    // Get user ID and email (support both UID and email as parameter)
    let userId: string
    let userEmail: string | undefined
    try {
      const userRecord = await adminAuth.getUser(uid)
      userId = userRecord.uid
      userEmail = userRecord.email
    } catch {
      try {
        const userRecord = await adminAuth.getUserByEmail(uid)
        userId = userRecord.uid
        userEmail = userRecord.email
      } catch {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    // 1. Check waitlist status
    let waitlistStatus = null
    if (userEmail) {
      const waitlistSnapshot = await adminDb
        .collection('waitlist')
        .where('email', '==', userEmail)
        .limit(1)
        .get()

      if (!waitlistSnapshot.empty) {
        const waitlistData = waitlistSnapshot.docs[0].data()
        waitlistStatus = {
          onWaitlist: true,
          linkedUid: waitlistData.linkedUid || null,
          discountGranted: waitlistData.discountGranted || false,
          joinedAt: waitlistData.createdAt || null
        }
      } else {
        waitlistStatus = {
          onWaitlist: false
        }
      }
    }

    // 2. Check discount eligibility
    const discountDoc = await adminDb
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(userId)
      .get()

    let discountEligibility = null
    if (discountDoc.exists) {
      const data = discountDoc.data()
      discountEligibility = {
        eligible: data?.eligible || false,
        promotionCodeId: data?.promotionCodeId || null,
        source: data?.source || null,
        redeemed: data?.redeemed || false,
        redeemedAt: data?.redeemedAt || null,
        status:
          data?.eligible && !data?.redeemed
            ? 'active'
            : data?.redeemed
            ? 'redeemed'
            : 'ineligible'
      }
    } else {
      discountEligibility = {
        eligible: false,
        status: 'no_discount_document'
      }
    }

    const response = {
      userId,
      email: userEmail,
      waitlist: waitlistStatus,
      discount: discountEligibility
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error: any) {
    console.error('[Admin API] Error fetching promotions data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch promotions data' },
      { status: 500 }
    )
  }
})
