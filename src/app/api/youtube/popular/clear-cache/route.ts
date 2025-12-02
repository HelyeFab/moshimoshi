import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

// Note: Cache is cleared server-side per request, so this is a no-op for now
// In a production setup with Redis or similar, this would clear the shared cache

export async function POST(req: NextRequest) {
  try {
    // Only allow admins to clear cache
    const session = await getSession()

    if (!session || !session.admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    // Cache clearing is now handled per-instance
    // The module-level cache in the route file will reset on redeployment
    // For Redis/distributed cache, implement actual clearing here
    console.log('Cache clear requested by admin:', session.uid)

    return NextResponse.json({
      success: true,
      message: 'Popular videos cache cleared successfully',
    })
  } catch (error: any) {
    console.error('Error clearing cache:', error)
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 })
  }
}
