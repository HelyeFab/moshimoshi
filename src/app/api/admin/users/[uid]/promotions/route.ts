import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

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

// PATCH - Update discount eligibility
export const PATCH = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    const { uid } = context.params || {}
    if (!uid) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user ID (support both UID and email as parameter)
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

    // Parse request body
    const body = await request.json()
    const { action, promotionCodeId, source } = body

    const discountRef = adminDb
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(userId)

    const discountDoc = await discountRef.get()

    let result: any = {}

    switch (action) {
      case 'grant':
        // Grant discount eligibility
        if (!promotionCodeId) {
          return NextResponse.json({ error: 'promotionCodeId is required for grant action' }, { status: 400 })
        }
        await discountRef.set({
          eligible: true,
          promotionCodeId,
          source: source || 'admin_granted',
          redeemed: false,
          redeemedAt: null,
          grantedAt: FieldValue.serverTimestamp(),
          grantedBy: 'admin'
        }, { merge: true })
        result = { action: 'grant', promotionCodeId, source: source || 'admin_granted' }
        break

      case 'update':
        // Update promotion code ID
        if (!promotionCodeId) {
          return NextResponse.json({ error: 'promotionCodeId is required for update action' }, { status: 400 })
        }
        if (!discountDoc.exists) {
          return NextResponse.json({ error: 'No discount document exists. Use grant action instead.' }, { status: 400 })
        }
        const previousCodeId = discountDoc.data()?.promotionCodeId
        await discountRef.update({
          promotionCodeId,
          source: source || discountDoc.data()?.source,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: 'admin'
        })
        result = { action: 'update', previousCodeId, newCodeId: promotionCodeId }
        break

      case 'revoke':
        // Revoke discount eligibility
        if (!discountDoc.exists) {
          return NextResponse.json({ error: 'No discount document to revoke' }, { status: 400 })
        }
        await discountRef.update({
          eligible: false,
          revokedAt: FieldValue.serverTimestamp(),
          revokedBy: 'admin'
        })
        result = { action: 'revoke' }
        break

      case 'reset_redemption':
        // Reset redemption status (allow re-use of discount)
        if (!discountDoc.exists) {
          return NextResponse.json({ error: 'No discount document to reset' }, { status: 400 })
        }
        await discountRef.update({
          redeemed: false,
          redeemedAt: null,
          redemptionResetAt: FieldValue.serverTimestamp(),
          redemptionResetBy: 'admin'
        })
        result = { action: 'reset_redemption' }
        break

      default:
        return NextResponse.json({ error: 'Invalid action. Use: grant, update, revoke, or reset_redemption' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Discount ${action} successful`,
      data: { userId, email: userEmail, ...result }
    })
  } catch (error: any) {
    console.error('[Admin API] Error updating promotions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update promotions' },
      { status: 500 }
    )
  }
})
