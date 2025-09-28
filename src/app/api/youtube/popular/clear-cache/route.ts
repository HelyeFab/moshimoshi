import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { clearPopularVideosCache } from '../route';

export async function POST(req: NextRequest) {
  try {
    // Only allow admins to clear cache
    const session = await getSession();

    if (!session || !session.admin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Clear the cache
    clearPopularVideosCache();

    return NextResponse.json({
      success: true,
      message: 'Popular videos cache cleared successfully'
    });

  } catch (error: any) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}