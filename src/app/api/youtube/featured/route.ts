import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore as adminDb } from '@/lib/firebase/admin';

function getTimestampValue(value: any): number {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const snapshot = await adminDb.collection('youtubeChannels').get();
    const featuredChannels = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, any>))
      .filter((channel) => channel.isFeatured === true && channel.sourceVideoId);

    if (featuredChannels.length === 0) {
      return NextResponse.json({ success: true, featured: null });
    }

    featuredChannels.sort((a: any, b: any) => {
      const aUpdated = getTimestampValue(a.updatedAt) || getTimestampValue(a.createdAt);
      const bUpdated = getTimestampValue(b.updatedAt) || getTimestampValue(b.createdAt);
      return bUpdated - aUpdated;
    });

    const channel = featuredChannels[0] as Record<string, any>;
    const videoId = channel.sourceVideoId as string;
    const fallbackUrl = `https://www.youtube.com/watch?v=${videoId}`;

    return NextResponse.json({
      success: true,
      featured: {
        videoId,
        videoUrl: channel.sourceVideoUrl || fallbackUrl,
        videoTitle: channel.sourceVideoTitle || channel.channelTitle || 'Featured Video',
        channelName: channel.channelTitle || 'Unknown Channel',
        thumbnailUrl:
          channel.sourceVideoThumbnailUrl ||
          channel.thumbnailUrl ||
          `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        description: channel.description || '',
      },
    });
  } catch (error) {
    console.error('[API /youtube/featured] Error:', error);
    return NextResponse.json({ success: true, featured: null });
  }
}
