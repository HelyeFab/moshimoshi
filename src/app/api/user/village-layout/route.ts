import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { ensureAdminInitialized, adminFirestore } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { DEFAULT_DISTRICT_ORDER, DistrictId } from '@/config/learning-village-types'

const DISTRICT_VALUES = ['foundation', 'study', 'immersion', 'play', 'community'] as const

const DistrictOrderSchema = z.object({
  districtOrder: z.array(z.enum(DISTRICT_VALUES)).min(1).max(DISTRICT_VALUES.length),
})

const DEFAULT_LAYOUT = {
  districtOrder: DEFAULT_DISTRICT_ORDER,
}

function getDocRef(userId: string) {
  return adminFirestore!
    .collection('users')
    .doc(userId)
    .collection('villageLayout')
    .doc('data')
}

export async function GET() {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    const doc = await getDocRef(session.uid).get()

    if (!doc.exists) {
      return NextResponse.json({
        success: true,
        data: DEFAULT_LAYOUT,
        source: 'default',
      })
    }

    const data = doc.data()
    const districtOrder = (data?.districtOrder as DistrictId[] | undefined) ?? DEFAULT_DISTRICT_ORDER

    return NextResponse.json({
      success: true,
      data: { districtOrder },
      source: 'user',
    })
  } catch (error) {
    console.error('[API] Error fetching village layout:', error)
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch village layout' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    const body = await request.json()
    const validation = DistrictOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid district order',
            details: validation.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { districtOrder } = validation.data

    await getDocRef(session.uid).set(
      {
        districtOrder,
        updatedAt: FieldValue.serverTimestamp(),
        source: 'onboarding-personalization',
      },
      { merge: true }
    )

    return NextResponse.json({
      success: true,
      data: { districtOrder },
      message: 'Village layout updated',
    })
  } catch (error) {
    console.error('[API] Error updating village layout:', error)
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update village layout' } },
      { status: 500 }
    )
  }
}
