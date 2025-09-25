import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { UserList } from '@/types/userLists';

/**
 * POST /api/lists/sync
 * Sync a local list to Firebase (for correcting lists created with wrong session tier)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the list data from request
    const list: UserList = await request.json();

    // Verify the list belongs to this user
    if (list.userId !== session.uid) {
      return NextResponse.json(
        { error: 'Cannot sync lists for other users' },
        { status: 403 }
      );
    }

    // Get fresh user data from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('[POST /api/lists/sync] Syncing list:', list.id, 'for user:', session.uid);

    // Save the list to Firebase
    const listsRef = adminDb.collection('users').doc(session.uid).collection('lists');
    await listsRef.doc(list.id).set(list);

    console.log('[POST /api/lists/sync] Successfully synced list:', list.id);

    return NextResponse.json({
      success: true,
      message: 'List synced successfully',
      listId: list.id
    });
  } catch (error) {
    console.error('Error syncing list:', error);
    return NextResponse.json(
      { error: 'Failed to sync list' },
      { status: 500 }
    );
  }
}