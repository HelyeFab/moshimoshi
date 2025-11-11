import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore as adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    // Load all channels and filter in memory to avoid index requirement
    const channelsSnapshot = await adminDb
      .collection('youtubeChannels')
      .get();

    const allChannels = channelsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter for active channels and sort by title
    const channels = allChannels
      .filter((channel: any) => channel.monitoringEnabled === true)
      .sort((a: any, b: any) => (a.channelTitle || '').localeCompare(b.channelTitle || ''));

    return NextResponse.json({
      channels
    });

  } catch (error: any) {
    console.error('Error fetching YouTube series:', error);
    return NextResponse.json(
      { error: 'Failed to fetch YouTube series' },
      { status: 500 }
    );
  }
}