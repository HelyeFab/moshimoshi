/**
 * Atomic Usage API
 * Agent 2 Implementation
 * 
 * POST /api/usage/:featureId/increment
 * Atomically increments usage and evaluates entitlements
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { evaluate, getTodayBucket } from '@/lib/entitlements/evaluator';
import { 
  FeatureId, 
  PlanType, 
  EvalContext, 
  Decision,
  UsageBucket,
  EntitlementLog 
} from '@/types/entitlements';

// Valid feature IDs
const VALID_FEATURES: Set<FeatureId> = new Set(['hiragana_practice', 'katakana_practice']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    // 1. Validate feature ID
    const { featureId: featureIdParam } = await params;
    const featureId = featureIdParam as FeatureId;
    if (!VALID_FEATURES.has(featureId)) {
      return NextResponse.json(
        { error: 'Invalid feature ID' },
        { status: 400 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { idempotencyKey } = body;

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'idempotencyKey is required' },
        { status: 400 }
      );
    }

    // 3. Get auth token and verify user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      if (!adminAuth) {
        throw new Error('Firebase Admin not initialized');
      }
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // 4. Check idempotency - prevent duplicate increments
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }
    const idempotencyRef = adminDb
      .collection('idempotency')
      .doc(`${userId}_${featureId}_${idempotencyKey}`);
    
    const idempotencyDoc = await idempotencyRef.get();
    if (idempotencyDoc.exists) {
      // Return cached decision
      const cached = idempotencyDoc.data() as { decision: Decision };
      return NextResponse.json(cached.decision);
    }

    // 5. Start Firestore transaction
    const decision = await adminDb.runTransaction(async (transaction) => {
      // Get user profile
      const userRef = adminDb!.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const plan: PlanType = userData?.subscription?.plan || 'free';
      
      // Get today's usage bucket
      const now = new Date();
      const nowUtcISO = now.toISOString();
      const bucketKey = getTodayBucket(nowUtcISO);
      
      const usageRef = adminDb!
        .collection('usage')
        .doc(userId)
        .collection('daily')
        .doc(bucketKey);
      
      const usageDoc = await transaction.get(usageRef);
      const usageData = usageDoc.exists 
        ? (usageDoc.data() as UsageBucket)
        : { userId, date: bucketKey, counts: {}, updatedAt: nowUtcISO };
      
      // Build evaluation context
      const usage: Record<FeatureId, number> = {
        hiragana_practice: usageData.counts.hiragana_practice || 0,
        katakana_practice: usageData.counts.katakana_practice || 0
      };
      
      const context: EvalContext = {
        userId,
        plan,
        usage,
        nowUtcISO,
        overrides: userData?.entitlementOverrides,
        tenant: userData?.tenant
      };
      
      // Evaluate entitlement
      const decision = evaluate(featureId, context);
      
      // If allowed, increment usage
      if (decision.allow) {
        const newCount = (usage[featureId] || 0) + 1;
        
        // Update usage bucket
        const updatedUsage: UsageBucket = {
          userId,
          date: bucketKey,
          counts: {
            ...usageData.counts,
            [featureId]: newCount
          },
          updatedAt: nowUtcISO
        };
        
        transaction.set(usageRef, updatedUsage);
        
        // Update decision with new usage
        decision.usageBefore = usage[featureId];
      }
      
      // Log decision
      const logRef = adminDb!.collection('logs').doc('entitlements').collection('decisions').doc();
      const logEntry: EntitlementLog = {
        ts: nowUtcISO,
        userId,
        featureId,
        plan,
        usageBefore: usage[featureId] || 0,
        limit: decision.limit || 0,
        allow: decision.allow,
        remaining: decision.remaining,
        reason: decision.reason,
        policyVersion: decision.policyVersion,
        idempotencyKey
      };
      
      transaction.set(logRef, logEntry);
      
      // Store idempotency record (expires after 24 hours)
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      transaction.set(idempotencyRef, {
        decision,
        createdAt: nowUtcISO,
        expiresAt: expiresAt.toISOString()
      });
      
      return decision;
    });

    // 6. Return decision
    return NextResponse.json(decision);

  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check current usage without incrementing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    // 1. Validate feature ID
    const { featureId: featureIdParam } = await params;
    const featureId = featureIdParam as FeatureId;
    if (!VALID_FEATURES.has(featureId)) {
      return NextResponse.json(
        { error: 'Invalid feature ID' },
        { status: 400 }
      );
    }

    // 2. Get auth token and verify user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      if (!adminAuth) {
        throw new Error('Firebase Admin not initialized');
      }
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // 3. Get user profile
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const plan: PlanType = userData?.subscription?.plan || 'free';

    // 4. Get today's usage
    const now = new Date();
    const nowUtcISO = now.toISOString();
    const bucketKey = getTodayBucket(nowUtcISO);
    
    const usageDoc = await adminDb!
      .collection('usage')
      .doc(userId)
      .collection('daily')
      .doc(bucketKey)
      .get();
    
    const usageData = usageDoc.exists 
      ? (usageDoc.data() as UsageBucket)
      : { userId, date: bucketKey, counts: {}, updatedAt: nowUtcISO };
    
    // 5. Build evaluation context
    const usage: Record<FeatureId, number> = {
      hiragana_practice: usageData.counts.hiragana_practice || 0,
      katakana_practice: usageData.counts.katakana_practice || 0
    };
    
    const context: EvalContext = {
      userId,
      plan,
      usage,
      nowUtcISO,
      overrides: userData?.entitlementOverrides,
      tenant: userData?.tenant
    };
    
    // 6. Evaluate and return
    const decision = evaluate(featureId, context);
    return NextResponse.json(decision);

  } catch (error) {
    console.error('Usage check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}