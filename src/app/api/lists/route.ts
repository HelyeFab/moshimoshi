import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import type { UserList, CreateListRequest, ListItem } from '@/types/userLists';
import { DEFAULT_LIST_EMOJIS } from '@/types/userLists';
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

// GET /api/lists - Fetch all lists for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Guest users don't have lists
    if (!session.uid) {
      return NextResponse.json({ lists: [], storage: { location: 'none' } });
    }

    console.log('[GET /api/lists] Fetching from Firebase:', session.uid);

    const db = getDb();
    const listsRef = db.collection('users').doc(session.uid).collection('lists');
    const snapshot = await listsRef.orderBy('updatedAt', 'desc').get();

    const lists: UserList[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to JavaScript timestamps (milliseconds)
      const list = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
        items: data.items?.map((item: any) => ({
          ...item,
          createdAt: item.createdAt?.toMillis?.() || item.createdAt,
        })) || []
      } as UserList;
      lists.push(list);
    });

    // Fetch recently deleted list IDs (last 30 days) to prevent resurrection
    const deletedListsRef = db.collection('users').doc(session.uid).collection('deletedLists');
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const deletedSnapshot = await deletedListsRef
      .where('deletedAt', '>', thirtyDaysAgo)
      .get();

    const deletedListIds: string[] = [];
    deletedSnapshot.forEach(doc => {
      deletedListIds.push(doc.id);
    });

    console.log('[GET /api/lists] Found', lists.length, 'lists and', deletedListIds.length, 'recently deleted for user:', session.uid);

    return NextResponse.json({
      lists,
      deletedListIds,
      storage: {
        location: 'both',
        syncEnabled: true
      }
    });
  } catch (error) {
    console.error('Error fetching lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    );
  }
}

// POST /api/lists - Create a new list
export async function POST(request: NextRequest) {
  console.log('[POST /api/lists] ===== New list creation request =====');

  try {
    const session = await getSession();
    console.log('[POST /api/lists] Session check:', session ? 'Valid' : 'None', session?.uid);

    if (!session) {
      console.log('[POST /api/lists] ✗ No session - returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get fresh user data and check entitlements
    console.log('[POST /api/lists] Fetching user data from Firestore...');
    const db = getDb();
    const userDoc = await db.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    console.log('[POST /api/lists] User data exists:', userDoc.exists);

    if (!userDoc.exists) {
      console.log('[POST /api/lists] ✗ User document not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log subscription data to debug
    console.log('[POST /api/lists] User subscription data:', {
      uid: session.uid,
      subscription: userData?.subscription,
      hasSubscription: !!userData?.subscription,
      subscriptionStatus: userData?.subscription?.status,
      subscriptionPlan: userData?.subscription?.plan
    });

    // Determine the actual plan - check both subscription.plan and subscription.status
    let plan = 'free';
    if (userData?.subscription?.status === 'active' && userData?.subscription?.plan) {
      plan = userData.subscription.plan;
    }

    console.log('[POST /api/lists] Determined plan:', plan);

    // Guest users (no user doc) can't create lists
    if (!userData || plan === 'guest') {
      return NextResponse.json(
        { error: 'Please sign in to create lists' },
        { status: 403 }
      );
    }

    const body: CreateListRequest = await request.json();
    const { name, type, emoji, color, firstItem } = body;

    console.log('[POST /api/lists] Request body:', {
      name,
      type,
      emoji,
      color,
      hasFirstItem: !!firstItem
    });

    // Validate required fields
    if (!name || !type) {
      console.log('[POST /api/lists] ✗ Missing required fields');
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    const nowUtcISO = new Date().toISOString();
    const listsRef = db.collection('users').doc(session.uid).collection('lists');
    const existingListsSnapshot = await listsRef.get();
    const currentCount = existingListsSnapshot.size;
    const normalizedName = normalizeListName(name);
    const duplicateList = existingListsSnapshot.docs.some(doc => {
      const data = doc.data() as UserList;
      if (!data?.name || !data?.type) return false;
      return data.type === type && normalizeListName(data.name) === normalizedName;
    });
    const context: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: { custom_lists: currentCount },
      nowUtcISO
    };
    const evalDecision = evaluate('custom_lists', context);

    console.log('[POST /api/lists] Entitlement decision:', {
      allow: evalDecision.allow,
      reason: evalDecision.reason,
      limit: evalDecision.limit,
      remaining: evalDecision.remaining
    });

    if (duplicateList) {
      return NextResponse.json(
        { error: 'List name already exists for this type', code: 'DUPLICATE_LIST' },
        { status: 409 }
      );
    }

    if (!evalDecision.allow) {
      console.log('[POST /api/lists] ✗ Entitlement check failed - returning 429');
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

    console.log('[POST /api/lists] ✓ Entitlement check passed');

    // Create the new list
    const listId = uuidv4();
    const now = Date.now();

    // If there's a first item, prepare it
    const items: ListItem[] = [];
    if (firstItem) {
      items.push({
        id: uuidv4(),
        content: firstItem.content,
        type,
        metadata: {
          ...firstItem.metadata,
          addedAt: now
        }
      });
    }

    const newList: UserList = {
      id: listId,
      userId: session.uid,
      name,
      type,
      emoji: emoji || DEFAULT_LIST_EMOJIS[type] || '📚',
      color: color || 'primary',
      items,
      createdAt: now,
      updatedAt: now,
      settings: {
        reviewEnabled: true,
        sortOrder: 'dateAdded'
      }
    };

    console.log('[POST /api/lists] Saving to Firebase:', session.uid);

    try {
      const listsRef = db.collection('users').doc(session.uid).collection('lists');
      await listsRef.doc(listId).set(newList);
      console.log('[POST /api/lists] ✓ Successfully saved to Firebase');
    } catch (firebaseError) {
      console.error('[POST /api/lists] ✗ Firebase write failed:', firebaseError);
      throw firebaseError;
    }

    // Return the created list with storage and usage info
    console.log('[POST /api/lists] ✓ Returning success response');
    return NextResponse.json({
      success: true,
      data: newList,
      storage: {
        location: 'both',
        syncEnabled: true,
        plan
      },
      usage: {
        current: currentCount + 1,
        limit: evalDecision.limit === -1 ? 'unlimited' : evalDecision.limit,
        remaining:
          evalDecision.remaining === -1
            ? 'unlimited'
            : Math.max(0, (evalDecision.limit ?? 0) - (currentCount + 1))
      }
    });
  } catch (error) {
    console.error('[POST /api/lists] ✗✗✗ FATAL ERROR creating list ✗✗✗');
    console.error('[POST /api/lists] Error:', error);
    console.error('[POST /api/lists] Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[POST /api/lists] Stack trace:', error instanceof Error ? error.stack : '');
    return NextResponse.json(
      { error: 'Failed to create list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
