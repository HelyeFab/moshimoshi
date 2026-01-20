import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { UserList } from '@/types/userLists';
import { evaluate } from '@/lib/entitlements/evaluator';
import type { EvalContext } from '@/types/entitlements';

// Helper for database availability check
function getDb() {
  if (!adminDb) {
    throw new Error('Database not available');
  }
  return adminDb;
}

function normalizeListName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

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

    const db = getDb();

    // Get fresh user data from Firestore
    const userDoc = await db.collection('users').doc(session.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('[POST /api/lists/sync] Syncing list:', list.id, 'for user:', session.uid);

    // Save the list to Firebase
    const listsRef = db.collection('users').doc(session.uid).collection('lists');
    const existingListsSnapshot = await listsRef.get();
    const isExisting = existingListsSnapshot.docs.some(doc => doc.id === list.id);
    const normalizedName = normalizeListName(list.name || '');
    const duplicateList = existingListsSnapshot.docs.some(doc => {
      if (doc.id === list.id) return false;
      const data = doc.data() as UserList;
      if (!data?.name || !data?.type) return false;
      return data.type === list.type && normalizeListName(data.name) === normalizedName;
    });

    if (duplicateList) {
      return NextResponse.json(
        { error: 'List name already exists for this type', code: 'DUPLICATE_LIST' },
        { status: 409 }
      );
    }

    if (!isExisting) {
      let plan = 'free';
      if (userData?.subscription?.status === 'active' && userData?.subscription?.plan) {
        plan = userData.subscription.plan;
      }

      const nowUtcISO = new Date().toISOString();
      const currentCount = existingListsSnapshot.size;
      const context: EvalContext = {
        userId: session.uid,
        plan: plan as any,
        usage: { custom_lists: currentCount },
        nowUtcISO
      };
      const evalDecision = evaluate('custom_lists', context);

      if (!evalDecision.allow) {
        return NextResponse.json(
          {
            error: evalDecision.reason === 'limit_reached'
              ? `List limit reached (${evalDecision.limit} lists)`
              : 'Cannot create more lists',
            limit: evalDecision.limit,
            current: currentCount,
            remaining: evalDecision.remaining
          },
          { status: 429 }
        );
      }
    }
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
