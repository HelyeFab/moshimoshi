import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { practiceHistoryService } from '@/services/practiceHistory/PracticeHistoryService';
import { PracticeHistoryItem } from '@/services/practiceHistory/types';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    // Get session
    const session = await getSession();

    // Initialize service with user info
    const isPremium = false; // Will check from fresh Firestore data if logged in
    let userTier = 'guest';

    if (session) {
      // Fetch fresh user data from Firestore (NEVER trust session.tier)
      const userDoc = await adminDb.collection('users').doc(session.uid).get();
      const userData = userDoc.data();
      userTier = userData?.subscription?.plan || 'free';
    }

    const isPremiumUser = userTier === 'premium_monthly' || userTier === 'premium_annual' || userTier === 'premium_yearly';
    await practiceHistoryService.initialize(session?.uid, isPremiumUser);

    // Parse request body
    const body = await req.json();
    const {
      videoUrl,
      videoTitle,
      videoId,
      thumbnailUrl,
      channelName,
      duration,
      practiceTime,
      metadata
    } = body;

    // Validate required fields
    if (!videoUrl || !videoTitle || !videoId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create practice history item
    const practiceItem: PracticeHistoryItem = {
      id: session ? `${session.uid}_${videoId}` : videoId,
      videoUrl,
      videoTitle,
      videoId,
      thumbnailUrl,
      channelName,
      lastPracticed: new Date(),
      firstPracticed: new Date(),
      practiceCount: 1,
      totalPracticeTime: practiceTime || 0,
      duration,
      contentType: 'youtube',
      metadata
    };

    // Add or update the practice item
    await practiceHistoryService.addOrUpdateItem(practiceItem);

    return NextResponse.json({
      success: true,
      message: 'Practice tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking practice:', error);
    return NextResponse.json(
      { error: 'Failed to track practice' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get session
    const session = await getSession();

    // Initialize service
    let userTier = 'guest';
    if (session) {
      // Fetch fresh user data from Firestore
      const userDoc = await adminDb.collection('users').doc(session.uid).get();
      const userData = userDoc.data();
      userTier = userData?.subscription?.plan || 'free';
    }

    const isPremiumUser = userTier === 'premium_monthly' || userTier === 'premium_annual' || userTier === 'premium_yearly';
    await practiceHistoryService.initialize(session?.uid, isPremiumUser);

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'recent';

    // Get practice history
    let items: PracticeHistoryItem[] = [];

    if (sortBy === 'mostPracticed') {
      items = await practiceHistoryService.getMostPracticed(limit);
    } else {
      items = await practiceHistoryService.getRecentItems(limit);
    }

    return NextResponse.json({
      success: true,
      items,
      userTier,
      count: items.length
    });
  } catch (error: any) {
    console.error('Error fetching practice history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practice history' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Get session
    const session = await getSession();

    // Parse request body
    const body = await req.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId' },
        { status: 400 }
      );
    }

    // Initialize service
    let userTier = 'guest';
    if (session) {
      // Fetch fresh user data from Firestore
      const userDoc = await adminDb.collection('users').doc(session.uid).get();
      const userData = userDoc.data();
      userTier = userData?.subscription?.plan || 'free';
    }

    const isPremiumUser = userTier === 'premium_monthly' || userTier === 'premium_annual' || userTier === 'premium_yearly';
    await practiceHistoryService.initialize(session?.uid, isPremiumUser);

    // Delete the item
    await practiceHistoryService.deleteItem(videoId);

    return NextResponse.json({
      success: true,
      message: 'Practice history item deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting practice history item:', error);
    return NextResponse.json(
      { error: 'Failed to delete practice history item' },
      { status: 500 }
    );
  }
}