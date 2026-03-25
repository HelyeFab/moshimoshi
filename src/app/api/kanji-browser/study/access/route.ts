/**
 * Kanji Browser Study Access API
 * POST /api/kanji-browser/study/access
 *
 * Handles unlock-or-reuse access for Kanji Browser study.
 * Implements atomic transaction for new kanji unlocks.
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

interface AccessRequest {
  kanji: string;
}

interface AccessResponse {
  allow: boolean;
  newlyUnlocked: boolean;      // Always present: true if just unlocked, false otherwise
  unlockedCount: number;        // Always present when allow=true
  remaining: number;            // Always present when allow=true (-1 = unlimited)
  plan: string;                 // Always present
  reason?: string;              // Present when allow=false
  limit?: number;               // Present when allow=false
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
    if (!body || typeof body.kanji !== 'string' || body.kanji.length !== 1) {
      return NextResponse.json(
        { error: 'Invalid request. Expected { kanji: string } with single character' },
        { status: 400 }
      );
    }

    const { kanji } = body as AccessRequest;

    // 2. Require authentication
    const session = await getSession();
    if (!session || !session.uid) {
      return NextResponse.json(
        {
          allow: false,
          newlyUnlocked: false,
          unlockedCount: 0,
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
      console.log(`[kanji-browser-study] User ${userId} has plan: ${plan}`);
    } catch (error) {
      console.error('[kanji-browser-study] Error fetching user plan:', error);
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

    const unlockedKanji = progressData?.unlockedKanji || [];
    const alreadyUnlocked = unlockedKanji.includes(kanji);

    // 5. Premium users: always allow
    if (isPremium) {
      // Mark as unlocked if not already
      if (!alreadyUnlocked) {
        await progressRef.set(
          {
            unlockedKanji: FieldValue.arrayUnion(kanji),
            unlockedCount: (progressData?.unlockedCount || 0) + 1,
            lastUnlockedAt: nowUtc,
            updatedAt: nowUtc
          },
          { merge: true }
        );

        return NextResponse.json({
          allow: true,
          newlyUnlocked: true,
          unlockedCount: (progressData?.unlockedCount || 0) + 1,
          remaining: -1,
          plan
        });
      }

      return NextResponse.json({
        allow: true,
        newlyUnlocked: false,
        unlockedCount: progressData?.unlockedCount || 0,
        remaining: -1,
        plan
      });
    }

    // 6. Already unlocked: allow without consuming quota
    if (alreadyUnlocked) {
      return NextResponse.json({
        allow: true,
        newlyUnlocked: false,
        unlockedCount: progressData?.unlockedCount || 0,
        remaining: getRemaining(plan, progressData?.unlockedCount || 0),
        plan
      });
    }

    // 7. New kanji: check entitlement and atomically unlock if allowed
    const bucketKey = getBucketKey(FEATURE_ID, userId, nowUtc);
    const usageRef = db.collection('users').doc(userId).collection('usage').doc(bucketKey);

    // Get current usage
    const usageDoc = await usageRef.get();
    const usageData = usageDoc.data();
    const currentUsage = usageData?.[FEATURE_ID] || 0;

    // Evaluate entitlement
    const evalContext: EvalContext = {
      userId,
      plan: plan as any,
      usage: { [FEATURE_ID]: currentUsage },
      nowUtcISO: nowUtc
    };

    const decision = evaluate(FEATURE_ID, evalContext);

    // If denied, return denial
    if (!decision.allow) {
      return NextResponse.json({
        allow: false,
        newlyUnlocked: false,
        unlockedCount: progressData?.unlockedCount || 0,
        remaining: decision.remaining,
        plan,
        reason: decision.reason,
        limit: decision.limit
      });
    }

    // If allowed, atomically unlock the kanji and increment usage
    try {
      await db.runTransaction(async (transaction) => {
        // Re-read progress doc to ensure consistency
        const currentProgressDoc = await transaction.get(progressRef);
        const currentProgressData = currentProgressDoc.exists
          ? (currentProgressDoc.data() as Partial<KanjiBrowserStudyProgress>)
          : null;

        const currentUnlockedKanji = currentProgressData?.unlockedKanji || [];

        // Double-check not already unlocked (race condition guard)
        if (currentUnlockedKanji.includes(kanji)) {
          return; // Already unlocked by another request
        }

        // Re-read usage to ensure consistency
        const currentUsageDoc = await transaction.get(usageRef);
        const currentUsageData = currentUsageDoc.data();
        const latestUsage = currentUsageData?.[FEATURE_ID] || 0;
        const latestUnlockedCount = currentProgressData?.unlockedCount || 0;

        // Re-check the free cap using the latest transaction state to prevent
        // concurrent requests from pushing the user past the unlock limit.
        if (latestUsage >= FREE_UNLOCK_LIMIT || latestUnlockedCount >= FREE_UNLOCK_LIMIT) {
          throw new UnlockLimitExceededError();
        }

        // Update progress doc: add kanji to unlocked set
        transaction.set(
          progressRef,
          {
            unlockedKanji: FieldValue.arrayUnion(kanji),
            unlockedCount: (currentProgressData?.unlockedCount || 0) + 1,
            lastUnlockedAt: nowUtc,
            updatedAt: nowUtc
          },
          { merge: true }
        );

        // Update usage doc: increment count
        transaction.set(
          usageRef,
          {
            [FEATURE_ID]: latestUsage + 1,
            updatedAt: nowUtc,
            lastUpdated: nowUtc
          },
          { merge: true }
        );
      });

      // Success: kanji unlocked
      const newUnlockedCount = (progressData?.unlockedCount || 0) + 1;
      const newRemaining = getRemaining(plan, newUnlockedCount);

      return NextResponse.json({
        allow: true,
        newlyUnlocked: true,
        unlockedCount: newUnlockedCount,
        remaining: newRemaining,
        plan
      });

    } catch (error) {
      if (error instanceof UnlockLimitExceededError) {
        const latestUnlockedCount = progressData?.unlockedCount || 0;
        return NextResponse.json({
          allow: false,
          newlyUnlocked: false,
          unlockedCount: latestUnlockedCount,
          remaining: getRemaining(plan, latestUnlockedCount),
          plan,
          reason: 'limit_reached',
          limit: FREE_UNLOCK_LIMIT
        });
      }
      console.error('[kanji-browser-study] Transaction failed:', error);
      return NextResponse.json(
        { error: 'Failed to unlock kanji. Please try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[kanji-browser-study] Error in access API:', error);
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
