import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import type { UserList, CreateListRequest, ListItem } from '@/types/userLists';
import { DEFAULT_LIST_EMOJIS } from '@/types/userLists';
import { evaluate } from '@/lib/entitlements/evaluator';
import { getBucketKey } from '@/lib/entitlements/policy';
import { EvalContext } from '@/types/entitlements';

// GET /api/lists - Fetch all lists for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get fresh user data from Firestore (don't trust session tier)
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    const plan = userData?.subscription?.plan || 'free';

    // Guest users (no user doc) don't have lists
    if (!userData || plan === 'guest') {
      return NextResponse.json({ lists: [] });
    }

    // For free and premium users, fetch from Firebase
    console.log('[GET /api/lists] Fetching lists for user:', session.uid, 'with plan:', plan);

    const listsRef = adminDb.collection('users').doc(session.uid).collection('lists');
    const snapshot = await listsRef.orderBy('updatedAt', 'desc').get();

    const lists: UserList[] = [];
    snapshot.forEach(doc => {
      lists.push({ id: doc.id, ...doc.data() } as UserList);
    });

    console.log('[GET /api/lists] Found', lists.length, 'lists in Firebase for user:', session.uid);

    return NextResponse.json({ lists });
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
    const decision = evaluate('custom_lists', evalContext);

    if (!decision.allow) {
      return NextResponse.json(
        {
          error: decision.reason === 'limit_reached'
            ? `Monthly list creation limit reached (${decision.limit} lists)`
            : 'Cannot create more lists',
          limit: decision.limit,
          current: monthlyUsage,
          remaining: decision.remaining
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

    // Save to Firebase for all authenticated users
    console.log('[POST /api/lists] Creating list for user:', session.uid, 'with plan:', plan);

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
    console.log('[POST /api/lists] Successfully created list and updated usage');

    // Return the created list with updated usage info
    return NextResponse.json({
      list: newList,
      usage: {
        current: monthlyUsage + 1,
        limit: decision.limit === -1 ? 'unlimited' : decision.limit,
        remaining: decision.remaining === -1 ? 'unlimited' : Math.max(0, decision.remaining - 1)
      }
    });
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