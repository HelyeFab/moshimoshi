/**
 * API Route: Review Sessions
 * Handles session creation and listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { adminFirestore as db } from '@/lib/firebase/admin';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import { ReviewSession } from '@/lib/review-engine/core/session.types';
import { v4 as uuidv4 } from 'uuid';
import { validateSessionEntitlement, formatEntitlementError } from '@/lib/review-engine/api/session-entitlement-validator';
import { PlanType } from '@/types/entitlements';
import { checkRateLimit } from '@/lib/review-engine/api/rate-limiter';

// GET /api/review/sessions - List user sessions
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Build query
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not initialized' },
        { status: 500 }
      );
    }
    let query = db.collection('reviewSessions')
      .where('userId', '==', userId);
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (startDate) {
      query = query.where('startedAt', '>=', new Date(startDate).getTime());
    }
    
    if (endDate) {
      query = query.where('startedAt', '<=', new Date(endDate).getTime());
    }
    
    // Execute query with pagination
    const snapshot = await query
      .orderBy('startedAt', 'desc')
      .limit(limit + 1)
      .offset((page - 1) * limit)
      .get();
    
    const sessions: ReviewSession[] = [];
    let hasMore = false;
    let index = 0;
    
    snapshot.forEach((doc) => {
      if (index < limit) {
        sessions.push({ id: doc.id, ...doc.data() } as ReviewSession);
      } else {
        hasMore = true;
      }
      index++;
    });
    
    // Get total count
    const totalSnapshot = await query.count().get();
    const total = totalSnapshot.data().count;
    
    return NextResponse.json({
      success: true,
      data: {
        items: sessions,
        total,
        page,
        pageSize: limit,
        hasMore
      },
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch sessions'
      },
      { status: 500 }
    );
  }
}

// POST /api/review/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const body = await request.json();

    // Get user tier from session (set during auth)
    const userTier = (session.user as any).tier || 'free';

    // SECURITY: Rate limiting
    const rateLimit = checkRateLimit(userId, userTier as PlanType);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.`,
          details: {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            resetAt: rateLimit.resetAt,
            retryAfter: rateLimit.retryAfter
          }
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': (rateLimit.retryAfter || 60).toString()
          }
        }
      );
    }

    // Validate request body
    const { content, mode, config, source = 'manual', idempotencyKey } = body;

    // SECURITY: Idempotency check to prevent duplicate session creation
    if (idempotencyKey) {
      const existingSession = await checkIdempotency(userId, idempotencyKey);
      if (existingSession) {
        return NextResponse.json({
          success: true,
          data: existingSession,
          timestamp: Date.now(),
          idempotent: true
        });
      }
    }
    
    if (!content || !Array.isArray(content) || content.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Content array is required'
        },
        { status: 400 }
      );
    }
    
    if (!mode) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Review mode is required'
        },
        { status: 400 }
      );
    }

    // SECURITY: Validate entitlement before creating session
    const entitlementCheck = await validateSessionEntitlement(
      userId,
      userTier as PlanType,
      content
    );

    if (!entitlementCheck.allowed) {
      const errorResponse = formatEntitlementError(entitlementCheck);
      return NextResponse.json(
        {
          success: false,
          ...errorResponse
        },
        { status: 403 }
      );
    }

    // Create session ID
    const sessionId = uuidv4();
    const now = new Date();
    
    // Create session object
    const reviewSession: ReviewSession = {
      id: sessionId,
      userId,
      status: 'active',
      mode,
      items: content.map((item: ReviewableContent, index: number) => ({
        content: item,
        presentedAt: new Date(),
        hintsUsed: 0,
        attempts: 0,
        baseScore: 100,
        finalScore: 0
      })),
      currentIndex: 0,
      startedAt: now,
      lastActivityAt: now,
      config: config || {},
      source,
      metadata: {
        entitlement: {
          featureId: entitlementCheck.featureId,
          decision: entitlementCheck.decision,
          checkedAt: new Date().toISOString(),
          tier: userTier
        }
      },
      stats: {
        sessionId,
        totalItems: content.length,
        completedItems: 0,
        correctItems: 0,
        incorrectItems: 0,
        skippedItems: 0,
        averageResponseTime: 0,
        totalTime: 0,
        accuracy: 0,
        currentStreak: 0,
        bestStreak: 0,
        performanceByDifficulty: {
          easy: { correct: 0, total: 0, avgTime: 0 },
          medium: { correct: 0, total: 0, avgTime: 0 },
          hard: { correct: 0, total: 0, avgTime: 0 }
        },
        totalScore: 0,
        maxPossibleScore: content.length * 100,
        totalHintsUsed: 0,
        averageHintsPerItem: 0
      }
    };
    
    // Save to database
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not initialized' },
        { status: 500 }
      );
    }
    await db.collection('reviewSessions').doc(sessionId).set(reviewSession);

    // Save idempotency key if provided
    if (idempotencyKey) {
      await saveIdempotencyKey(userId, idempotencyKey, sessionId);
    }

    // Cache in Redis for quick access
    await cacheSession(sessionId, reviewSession);

    // Log session creation
    await logActivity(userId, 'session_created', { sessionId, mode, idempotencyKey });
    
    return NextResponse.json({
      success: true,
      data: reviewSession,
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('Error creating session:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message || 'Failed to create session'
      },
      { status: 500 }
    );
  }
}

// Helper: Cache session in Redis
async function cacheSession(sessionId: string, session: ReviewSession): Promise<void> {
  try {
    const { redis } = await import('@/lib/redis/client');
    await redis.setex(
      `session:${sessionId}`,
      3600, // 1 hour TTL
      JSON.stringify(session)
    );
  } catch (error) {
    console.error('Failed to cache session:', error);
  }
}

// Helper: Log user activity
async function logActivity(
  userId: string,
  action: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    if (db) {
      await db.collection('activityLogs').add({
        userId,
        action,
        metadata,
        timestamp: Date.now(),
        ip: metadata?.ip || 'unknown'
      });
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Helper: Check idempotency key
async function checkIdempotency(
  userId: string,
  idempotencyKey: string
): Promise<ReviewSession | null> {
  try {
    const { redis } = await import('@/lib/redis/client');
    const key = `idempotency:${userId}:${idempotencyKey}`;
    const sessionId = await redis.get(key);

    if (sessionId && db) {
      const doc = await db.collection('reviewSessions').doc(sessionId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as ReviewSession;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to check idempotency:', error);
    return null;
  }
}

// Helper: Save idempotency key
async function saveIdempotencyKey(
  userId: string,
  idempotencyKey: string,
  sessionId: string
): Promise<void> {
  try {
    const { redis } = await import('@/lib/redis/client');
    const key = `idempotency:${userId}:${idempotencyKey}`;
    // Store for 24 hours
    await redis.setex(key, 86400, sessionId);
  } catch (error) {
    console.error('Failed to save idempotency key:', error);
  }
}