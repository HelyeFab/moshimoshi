import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'

// Available promo codes from environment
const PROMO_CODES = [
  {
    id: process.env.THANKYOU50_PROMO_CODE_ID,
    name: 'THANKYOU50',
    description: '50% off - Thank you discount'
  },
  {
    id: process.env.THANKYOU10_PROMO_CODE_ID,
    name: 'THANKYOU10',
    description: '10% off - Thank you discount'
  },
  {
    id: process.env.PRELAUNCH_PROMO_CODE_ID,
    name: 'MOSHI25 (Prelaunch)',
    description: '25% off - Prelaunch discount'
  }
].filter(code => code.id) // Only include codes that have IDs configured

export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    return NextResponse.json({
      success: true,
      data: PROMO_CODES
    })
  } catch (error: any) {
    console.error('[Admin API] Error fetching promo codes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch promo codes' },
      { status: 500 }
    )
  }
})
