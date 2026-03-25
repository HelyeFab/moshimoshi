/**
 * Kanji Browser Study Batch Access API
 * POST /api/kanji-browser/study/access/batch
 *
 * Handles multi-kanji unlock-or-reuse access for Kanji Browser study.
 * Evaluates all kanji together and unlocks atomically if allowed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';
import type { EvalContext } from '@/lib/entitlements/evaluator';
import type { FeatureId } from '@/types/FeatureId';

const FEATURE_ID: FeatureId = 'kanji_browser_study';
const FREE_UNLOCK_LIMIT = 10;

interface KanjiBrowserStudyProgress {
  unlockedKanji: string[];
  unlockedCount: number;
  lastUnlockedAt: string;
  updatedAt: string;
}

interface BatchAccessRequest {
  kanji: string[];
}

interface BatchAccessResponse {
  allow: boolean;
  alreadyUnlockedCount: number;    // How many were already unlocked
  newUnlockCount: number;           // How many would be newly unlocked
  totalUnlockedCount: number;       // Total after this operation (if allowed)
  remaining: number;                // Remaining slots after this operation (-1 = unlimited)
  plan: string;
  reason?: string;                  // Present when allow=false
  limit?: number;                   // Present when allow=false
}

class UnlockLimitExceededError extends Error {
  constructor() {
    super('Unlock limit exceeded');
    this.name = 'UnlockLimitExceededError';
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getAdminDb();

    // 1. Parse and validate request
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.kanji) || body.kanji.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected { kanji: string[] } with at least one character' },
        { status: 400 }
      );
    }

    const { kanji: kanjiList } = body as BatchAccessRequest;

    // Validate each kanji is a single character
    if (kanjiList.some(k => typeof k !== 'string' || k.length !== 1)) {
      return NextResponse.json(
        { error: 'Invalid request. Each kanji must be a single character' },
        { status: 400 }
      );
    }

    // Deduplicate the list
    const uniqueKanji = Array.from(new Set(kanjiList));

    // 2. Require authentication
    const session = await getSession();
    if (!session || !session.uid) {
      return NextResponse.json(
        {
          allow: false,
          alreadyUnlockedCount: 0,
          newUnlockCount: uniqueKanji.length,
          totalUnlockedCount: 0,
          remaining: 0,
          plan: 'guest',
          reason: 'Authentication required'
        },
        { status: 401 }
      );
    }

    const userId = session.uid;
    const nowUtc = new Date().toISOString();

    // 3. Load user plan from Firestore (fresh, never trust session)
    let plan: string = 'free';
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      plan = userData?.subscription?.plan || 'free';
      console.log(`[kanji-browser-study-batch] User ${userId} has plan: ${plan}`);
    } catch (error) {
      console.error('[kanji-browser-study-batch] Error fetching user plan:', error);
      plan = 'free';
    }

    const isPremium = plan === 'premium_monthly' || plan === 'premium_yearly';

    // 4. Load current unlocked kanji state
    const progressRef = db
      .collection('users')
      .doc(userId)
      .collection('progress')
      .doc('kanji_browser_study');

    const progressDoc = await progressRef.get();
    const progressData = progressDoc.exists
      ? (progressDoc.data() as Partial<KanjiBrowserStudyProgress>)
      : null;

    const currentUnlockedKanji = progressData?.unlockedKanji || [];
    const currentUnlockedCount = progressData?.unlockedCount || 0;

    // 5. Classify selected kanji
    const alreadyUnlocked: string[] = [];
    const newKanji: string[] = [];

    uniqueKanji.forEach(k => {
      if (currentUnlockedKanji.includes(k)) {
        alreadyUnlocked.push(k);
      } else {
        newKanji.push(k);
      }
    });

    // 6. Premium users: always allow
    if (isPremium) {
      // If there are new kanji to unlock, do it
      if (newKanji.length > 0) {
        await progressRef.set(
          {
            unlockedKanji: FieldValue.arrayUnion(...newKanji),
            unlockedCount: currentUnlockedCount + newKanji.length,
            lastUnlockedAt: nowUtc,
            updatedAt: nowUtc
          },
          { merge: true }
        );
      }

      return NextResponse.json({
        allow: true,
        alreadyUnlockedCount: alreadyUnlocked.length,
        newUnlockCount: newKanji.length,
        totalUnlockedCount: currentUnlockedCount + newKanji.length,
        remaining: -1,
        plan
      });
    }

    // 7. Already unlocked only: allow without consuming quota
    if (newKanji.length === 0) {
      return NextResponse.json({
        allow: true,
        alreadyUnlockedCount: alreadyUnlocked.length,
        newUnlockCount: 0,
        totalUnlockedCount: currentUnlockedCount,
        remaining: getRemaining(plan, currentUnlockedCount),
        plan
      });
    }

    // 8. Check if we can unlock all new kanji
    const bucketKey = getBucketKey(FEATURE_ID, userId, nowUtc);
    const usageRef = db.collection('users').doc(userId).collection('usage').doc(bucketKey);

    // Get current usage
    const usageDoc = await usageRef.get();
    const usageData = usageDoc.data();
    const currentUsage = usageData?.[FEATURE_ID] || 0;

    // Evaluate entitlement for the required number of new unlocks
    const evalContext: EvalContext = {
      userId,
      plan: plan as any,
      usage: { [FEATURE_ID]: currentUsage },
      nowUtcISO: nowUtc
    };

    const decision = evaluate(FEATURE_ID, evalContext);

    // Check if we have enough remaining slots for all new kanji
    const remainingSlots = decision.remaining;
    const canUnlockAll = decision.allow && (remainingSlots === -1 || remainingSlots >= newKanji.length);

    // 9. If denied or insufficient slots, return denial
    if (!canUnlockAll) {
      return NextResponse.json({
        allow: false,
        alreadyUnlockedCount: alreadyUnlocked.length,
        newUnlockCount: newKanji.length,
        totalUnlockedCount: currentUnlockedCount,
        remaining: decision.remaining,
        plan,
        reason: 'limit_reached',
        limit: decision.limit ?? FREE_UNLOCK_LIMIT
      });
    }

    // 10. Atomically unlock all new kanji and increment usage by the count
    try {
      await db.runTransaction(async (transaction) => {
        // Re-read progress doc to ensure consistency
        const currentProgressDoc = await transaction.get(progressRef);
        const currentProgressData = currentProgressDoc.exists
          ? (currentProgressDoc.data() as Partial<KanjiBrowserStudyProgress>)
          : null;

        const currentUnlockedKanjiInTx = currentProgressData?.unlockedKanji || [];
        const currentUnlockedCountInTx = currentProgressData?.unlockedCount || 0;

        // Filter out kanji that were unlocked by another concurrent request
        const stillNewKanji = newKanji.filter(k => !currentUnlockedKanjiInTx.includes(k));

        if (stillNewKanji.length === 0) {
          // All kanji were already unlocked by another request
          return;
        }

        // Re-read usage to ensure consistency
        const currentUsageDoc = await transaction.get(usageRef);
        const currentUsageData = currentUsageDoc.data();
        const latestUsage = currentUsageData?.[FEATURE_ID] || 0;
        const latestUnlockedCount = currentProgressData?.unlockedCount || 0;

        // Re-check the free cap using the latest transaction state to prevent
        // concurrent batch requests from exceeding the unlock limit.
        if (
          latestUsage + stillNewKanji.length > FREE_UNLOCK_LIMIT ||
          latestUnlockedCount + stillNewKanji.length > FREE_UNLOCK_LIMIT
        ) {
          throw new UnlockLimitExceededError();
        }

        // Update progress doc: add all new kanji to unlocked set
        transaction.set(
          progressRef,
          {
            unlockedKanji: FieldValue.arrayUnion(...stillNewKanji),
            unlockedCount: currentUnlockedCountInTx + stillNewKanji.length,
            lastUnlockedAt: nowUtc,
            updatedAt: nowUtc
          },
          { merge: true }
        );

        // Update usage doc: increment by the number of new kanji
        transaction.set(
          usageRef,
          {
            [FEATURE_ID]: latestUsage + stillNewKanji.length,
            updatedAt: nowUtc,
            lastUpdated: nowUtc
          },
          { merge: true }
        );
      });

      // Success: all new kanji unlocked
      const newUnlockedCount = currentUnlockedCount + newKanji.length;
      const newRemaining = getRemaining(plan, newUnlockedCount);

      return NextResponse.json({
        allow: true,
        alreadyUnlockedCount: alreadyUnlocked.length,
        newUnlockCount: newKanji.length,
        totalUnlockedCount: newUnlockedCount,
        remaining: newRemaining,
        plan
      });

    } catch (error) {
      if (error instanceof UnlockLimitExceededError) {
        return NextResponse.json({
          allow: false,
          alreadyUnlockedCount: alreadyUnlocked.length,
          newUnlockCount: newKanji.length,
          totalUnlockedCount: currentUnlockedCount,
          remaining: getRemaining(plan, currentUnlockedCount),
          plan,
          reason: 'limit_reached',
          limit: FREE_UNLOCK_LIMIT
        });
      }
      console.error('[kanji-browser-study-batch] Transaction failed:', error);
      return NextResponse.json(
        { error: 'Failed to unlock kanji. Please try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[kanji-browser-study-batch] Error in batch access API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Calculate remaining unlock slots based on plan and current count
 */
function getRemaining(plan: string, unlockedCount: number): number {
  // Premium plans have unlimited (-1)
  if (plan === 'premium_monthly' || plan === 'premium_yearly') {
    return -1;
  }

  // Free plan has 10 unlocks
  if (plan === 'free') {
    return Math.max(0, FREE_UNLOCK_LIMIT - unlockedCount);
  }

  // Guest has 0
  return 0;
}
