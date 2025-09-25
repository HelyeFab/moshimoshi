import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import type { UserList, CreateListRequest, ListItem } from '@/types/userLists';
import { DEFAULT_LIST_EMOJIS } from '@/types/userLists';
import { evaluate } from '@/lib/entitlements/evaluator';
import { getBucketKey } from '@/lib/entitlements/policy';
import { EvalContext } from '@/types/entitlements';
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper';

// GET /api/lists - Fetch all lists for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check storage decision
    const decision = await getStorageDecision(session);

    // Guest users don't have lists
    if (decision.plan === 'guest') {
      return NextResponse.json({ lists: [], storage: { location: 'none' } });
    }

    // Only fetch from Firebase for premium users
    // Free users should fetch from their local IndexedDB (handled client-side)
    if (!decision.shouldWriteToFirebase) {
      console.log('[GET /api/lists] Free user - should use local storage:', session.uid);
      return NextResponse.json({
        lists: [],
        storage: {
          location: 'local',
          message: 'Free users should fetch from IndexedDB'
        }
      });
    }

    console.log('[GET /api/lists] Premium user - fetching from Firebase:', session.uid);

    const listsRef = adminDb.collection('users').doc(session.uid).collection('lists');
    const snapshot = await listsRef.orderBy('updatedAt', 'desc').get();

    const lists: UserList[] = [];
    snapshot.forEach(doc => {
      lists.push({ id: doc.id, ...doc.data() } as UserList);
    });

    console.log('[GET /api/lists] Found', lists.length, 'lists in Firebase for user:', session.uid);

    return NextResponse.json({
      lists,
      storage: {
        location: decision.storageLocation,
        syncEnabled: decision.shouldWriteToFirebase
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
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get fresh user data and check entitlements
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();

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

    // Count existing lists for usage tracking
    const listsSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('lists')
      .count()
      .get();
    const currentListCount = listsSnapshot.data().count;

    // Get monthly usage for custom_lists feature
    const monthBucket = getBucketKey('monthly', new Date());
    const usageRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(monthBucket);
    const usageDoc = await usageRef.get();
    const monthlyUsage = usageDoc.data()?.custom_lists || 0;

    // Build evaluation context
    const evalContext: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: { custom_lists: monthlyUsage },
      nowUtcISO: new Date().toISOString()
    };

    // Check entitlements
    const evalDecision = evaluate('custom_lists', evalContext);

    if (!evalDecision.allow) {
      return NextResponse.json(
        {
          error: evalDecision.reason === 'limit_reached'
            ? `Monthly list creation limit reached (${evalDecision.limit} lists)`
            : 'Cannot create more lists',
          limit: evalDecision.limit,
          current: monthlyUsage,
          remaining: evalDecision.remaining
        },
        { status: 429 }
      );
    }

    const body: CreateListRequest = await request.json();
    const { name, type, emoji, color, firstItem } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

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

    // Check storage decision
    const decision = await getStorageDecision(session);

    // Only save to Firebase for premium users
    if (decision.shouldWriteToFirebase) {
      console.log('[POST /api/lists] Premium user - saving to Firebase:', session.uid);

      const batch = adminDb.batch();

      // Save the list
      const listsRef = adminDb.collection('users').doc(session.uid).collection('lists');
      batch.set(listsRef.doc(listId), newList);

      // Update usage tracking
      batch.set(usageRef, {
        custom_lists: (monthlyUsage || 0) + 1,
        lastUpdated: new Date()
      }, { merge: true });

      await batch.commit();
      console.log('[POST /api/lists] Successfully saved to Firebase and updated usage');
    } else {
      console.log('[POST /api/lists] Free user - returning list for local storage:', session.uid);
      // Still update usage tracking for free users
      await usageRef.set({
        custom_lists: (monthlyUsage || 0) + 1,
        lastUpdated: new Date()
      }, { merge: true });
    }

    // Return the created list with storage and usage info
    return createStorageResponse(
      newList,
      decision,
      {
        usage: {
          current: monthlyUsage + 1,
          limit: evalDecision.limit === -1 ? 'unlimited' : evalDecision.limit,
          remaining: evalDecision.remaining === -1 ? 'unlimited' : Math.max(0, evalDecision.remaining - 1)
        }
      }
    );
  } catch (error) {
    console.error('Error creating list:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : '');
    return NextResponse.json(
      { error: 'Failed to create list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}