import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    // Only allow for authenticated users
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // This endpoint just returns info about what should be checked
    // The actual localStorage check happens on the client side
    return NextResponse.json({
      success: true,
      message: 'Check browser console for localStorage debug info',
      userId: session.uid,
      checkKeys: [
        'moshimoshi_study_lists',
        'moshimoshi_saved_items',
        'moshimoshi_sync_queue'
      ]
    });
  } catch (error) {
    console.error('Debug storage error:', error);
    return NextResponse.json(
      { error: 'Failed to get debug info' },
      { status: 500 }
    );
  }
}