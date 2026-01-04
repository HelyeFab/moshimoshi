import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore as adminDb, FieldValue } from '@/lib/firebase/admin';

/**
 * POST /api/youtube/track-visit
 * Tracks when a user clicks the "Visit Channel" button
 */
export async function POST(request: NextRequest) {
  try {
    const { channelId } = await request.json();

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    // Increment the visit count for this channel
    await adminDb.collection('youtubeChannels').doc(channelId).update({
      visitCount: FieldValue.increment(1),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking channel visit:', error);
    return NextResponse.json(
      { error: 'Failed to track visit' },
      { status: 500 }
    );
  }
}
