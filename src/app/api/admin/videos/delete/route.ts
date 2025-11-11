import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminFirestore as adminDb } from '@/lib/firebase/admin';

export async function DELETE(req: NextRequest) {
  try {
    // Get session and check admin status
    const session = await getSession();

    if (!session || !session.admin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get videoId from request body
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    console.log(`Admin ${session.email} is deleting video ${videoId}`);

    // Delete from userYouTubeHistory collection (all user records)
    const historySnapshot = await adminDb!
      .collection('userYouTubeHistory')
      .where('videoId', '==', videoId)
      .get();

    const deletePromises: Promise<any>[] = [];
    let deletedCount = 0;

    // Delete all matching documents
    historySnapshot.forEach((doc) => {
      deletePromises.push(doc.ref.delete());
      deletedCount++;
    });

    // Also delete from userPracticeHistory collection
    const practiceSnapshot = await adminDb!
      .collection('userPracticeHistory')
      .where('contentId', '==', videoId)
      .where('contentType', '==', 'youtube')
      .get();

    practiceSnapshot.forEach((doc) => {
      deletePromises.push(doc.ref.delete());
      deletedCount++;
    });

    // Execute all deletions
    await Promise.all(deletePromises);

    // Log admin action for audit trail
    await adminDb!.collection('adminActions').add({
      action: 'delete_video',
      adminId: session.uid,
      adminEmail: session.email,
      videoId,
      deletedDocuments: deletedCount,
      timestamp: new Date(),
      reason: 'Admin manual deletion from popular videos'
    });

    return NextResponse.json({
      success: true,
      message: `Video ${videoId} deleted from all user histories`,
      deletedDocuments: deletedCount
    });

  } catch (error: any) {
    console.error('Error deleting video:', error);
    return NextResponse.json(
      { error: 'Failed to delete video', details: error.message },
      { status: 500 }
    );
  }
}