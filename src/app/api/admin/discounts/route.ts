/**
 * Admin API endpoint to manage user discounts
 *
 * GET - Get discount status for a user, or list available discount types
 * POST - Grant a discount to a user
 * DELETE - Revoke a discount from a user
 *
 * Security: Admin-only access via session check
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import {
  grantDiscount,
  revokeDiscount,
  getDiscountStatus,
  getAdminGrantableDiscountTypes,
  getSourcesForDiscountType,
  DISCOUNT_TYPES,
  type DiscountTypeId,
} from '@/lib/stripe/discounts'

// Helper function to check if user is admin
async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    if (!adminFirestore) return false
    const userDoc = await adminFirestore.collection('users').doc(uid).get()
    const userData = userDoc.data()
    return userData?.isAdmin === true
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * GET /api/admin/discounts?uid=xxx - Get discount status for a user
 * GET /api/admin/discounts?types=true - Get available discount types
 * GET /api/admin/discounts?sources=thankyou - Get sources for a discount type
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(session.uid)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    // Return available discount types
    if (searchParams.get('types') === 'true') {
      const types = getAdminGrantableDiscountTypes()
      return NextResponse.json({ types })
    }

    // Return sources for a specific discount type
    const discountType = searchParams.get('sources') as DiscountTypeId | null
    if (discountType) {
      if (!DISCOUNT_TYPES[discountType]) {
        return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 })
      }
      const sources = getSourcesForDiscountType(discountType)
      return NextResponse.json({ sources })
    }

    // Return discount status for a user
    const targetUid = searchParams.get('uid')
    if (!targetUid) {
      return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 })
    }

    const status = await getDiscountStatus(targetUid)

    return NextResponse.json({
      status: status || { hasDiscount: false },
    })
  } catch (error) {
    console.error('[Admin Discounts API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get discount info' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/discounts
 * Grant a discount to a user
 *
 * Body: { targetUserId, discountType, source }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(session.uid)
    if (!isAdmin) {
      console.warn(`[Admin Discounts API] Non-admin user ${session.uid} attempted to grant discount`)
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { targetUserId, discountType, source } = body as {
      targetUserId: string
      discountType: DiscountTypeId
      source: string
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 })
    }

    if (!discountType) {
      return NextResponse.json({ error: 'Missing discountType' }, { status: 400 })
    }

    if (!DISCOUNT_TYPES[discountType]) {
      return NextResponse.json(
        { error: `Invalid discountType. Must be one of: ${Object.keys(DISCOUNT_TYPES).join(', ')}` },
        { status: 400 }
      )
    }

    if (!DISCOUNT_TYPES[discountType].adminGrantable) {
      return NextResponse.json(
        { error: `Discount type "${discountType}" cannot be granted manually` },
        { status: 400 }
      )
    }

    if (!source) {
      return NextResponse.json({ error: 'Missing source' }, { status: 400 })
    }

    const validSources = getSourcesForDiscountType(discountType)
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify target user exists
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const targetUserDoc = await adminFirestore.collection('users').doc(targetUserId).get()
    if (!targetUserDoc.exists) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    await grantDiscount(targetUserId, discountType, source, session.uid)

    // Log admin action
    await adminFirestore.collection('admin_logs').add({
      action: 'discount_granted',
      adminUid: session.uid,
      adminEmail: session.email,
      targetUserId,
      discountType,
      source: `${discountType}_${source}`,
      timestamp: new Date(),
    })

    const discountLabel = DISCOUNT_TYPES[discountType].label
    console.log(`[Admin Discounts API] Admin ${session.uid} granted ${discountType} discount to ${targetUserId} (source: ${source})`)

    return NextResponse.json({
      success: true,
      message: `${discountLabel} discount granted to user`,
      discountType,
      source: `${discountType}_${source}`,
    })
  } catch (error) {
    console.error('[Admin Discounts API] Error granting discount:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to grant discount' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/discounts
 * Revoke a discount from a user
 *
 * Body: { targetUserId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(session.uid)
    if (!isAdmin) {
      console.warn(`[Admin Discounts API] Non-admin user ${session.uid} attempted to revoke discount`)
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { targetUserId } = body as { targetUserId: string }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 })
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    await revokeDiscount(targetUserId, session.uid)

    // Log admin action
    await adminFirestore.collection('admin_logs').add({
      action: 'discount_revoked',
      adminUid: session.uid,
      adminEmail: session.email,
      targetUserId,
      timestamp: new Date(),
    })

    console.log(`[Admin Discounts API] Admin ${session.uid} revoked discount from ${targetUserId}`)

    return NextResponse.json({
      success: true,
      message: 'Discount revoked from user',
    })
  } catch (error) {
    console.error('[Admin Discounts API] Error revoking discount:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke discount' },
      { status: 500 }
    )
  }
}
