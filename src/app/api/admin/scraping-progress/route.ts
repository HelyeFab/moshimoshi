import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const progressId = searchParams.get('id');

    if (!progressId) {
      return NextResponse.json(
        { success: false, error: 'Progress ID is required' },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection('scraping_progress').doc(progressId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({
        success: true,
        progress: null,
        message: 'Progress not found - scraping may not have started yet'
      });
    }

    const data = doc.data();

    return NextResponse.json({
      success: true,
      progress: {
        stage: data?.stage || 'unknown',
        substage: data?.substage || null,
        details: data?.details || '',
        percentage: data?.percentage || 0,
        status: data?.status || 'unknown',
        startedAt: data?.startedAt?.toDate?.()?.toISOString() || null,
        updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
        completedAt: data?.completedAt?.toDate?.()?.toISOString() || null
      }
    });

  } catch (error) {
    console.error('Error fetching scraping progress:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

// DELETE - Clean up old progress entries
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const progressId = searchParams.get('id');

    if (progressId) {
      // Delete specific progress entry
      await adminDb.collection('scraping_progress').doc(progressId).delete();
      return NextResponse.json({ success: true, message: 'Progress entry deleted' });
    }

    // Delete all old progress entries (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldEntries = await adminDb.collection('scraping_progress')
      .where('startedAt', '<', oneHourAgo)
      .get();

    const batch = adminDb.batch();
    oldEntries.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Deleted ${oldEntries.size} old progress entries`
    });

  } catch (error) {
    console.error('Error deleting progress:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete progress' },
      { status: 500 }
    );
  }
}
