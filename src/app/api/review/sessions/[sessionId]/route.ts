/**
 * API Route: Individual Session Operations
 * Handles session retrieval, updates, and completion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { adminFirestore as db } from '@/lib/firebase/admin';
import { ReviewSession } from '@/lib/review-engine/core/session.types';

// GET /api/review/sessions/[sessionId] - Get session details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { sessionId } = await params;
    const userId = session.user.id;
    
    // Try to get from cache first
    const cached = await getCachedSession(sessionId);
    if (cached) {
      // Verify ownership
      if (cached.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: cached,
        timestamp: Date.now()
      });
    }
    
    // Get from database
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not initialized' },
        { status: 500 }
      );
    }
    const doc = await db.collection('reviewSessions').doc(sessionId).get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }
    
    const reviewSession = { id: doc.id, ...doc.data() } as ReviewSession;
    
    // Verify ownership
    if (reviewSession.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // Cache for future requests
    await cacheSession(sessionId, reviewSession);
    
    return NextResponse.json({
      success: true,
      data: reviewSession,
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('Error fetching session:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch session'
      },
      { status: 500 }
    );
  }
}

// PATCH /api/review/sessions/[sessionId] - Update session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { sessionId } = await params;
    const userId = session.user.id;
    const updates = await request.json();
    
    // Get existing session
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not initialized' },
        { status: 500 }
      );
    }
    const doc = await db.collection('reviewSessions').doc(sessionId).get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }
    
    const reviewSession = doc.data() as ReviewSession;
    
    // Verify ownership
    if (reviewSession.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // Validate status transitions
    if (updates.status) {
      const validTransitions: Record<string, string[]> = {
        'active': ['paused', 'completed', 'abandoned'],
        'paused': ['active', 'completed', 'abandoned'],
        'completed': [],
        'abandoned': []
      };
      
      if (!validTransitions[reviewSession.status]?.includes(updates.status)) {
        return NextResponse.json(
          {
            success: false,
            error: 'INVALID_TRANSITION',
            message: `Cannot transition from ${reviewSession.status} to ${updates.status}`
          },
          { status: 400 }
        );
      }
    }
    
    // Apply updates
    const updatedSession = {
      ...reviewSession,
      ...updates,
      lastActivityAt: Date.now()
    };
    
    // Save to database
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not initialized' },
        { status: 500 }
      );
    }
    await db.collection('reviewSessions').doc(sessionId).update(updatedSession);
    
    // Update cache
    await cacheSession(sessionId, updatedSession);
    
    return NextResponse.json({
      success: true,
      data: updatedSession,
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('Error updating session:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message || 'Failed to update session'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/review/sessions/[sessionId] - Delete/abandon session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { sessionId } = await params;
    const userId = session.user.id;
    
    // Get existing session
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not initialized' },
        { status: 500 }
      );
    }
    const doc = await db.collection('reviewSessions').doc(sessionId).get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }
    
    const reviewSession = doc.data() as ReviewSession;
    
    // Verify ownership
    if (reviewSession.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // Mark as abandoned instead of deleting
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not initialized' },
        { status: 500 }
      );
    }
    await db.collection('reviewSessions').doc(sessionId).update({
      status: 'abandoned',
      abandonedAt: Date.now(),
      lastActivityAt: Date.now()
    });
    
    // Clear cache
    await clearSessionCache(sessionId);
    
    return NextResponse.json({
      success: true,
      message: 'Session abandoned',
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('Error deleting session:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message || 'Failed to delete session'
      },
      { status: 500 }
    );
  }
}

// Helper: Get cached session
async function getCachedSession(sessionId: string): Promise<ReviewSession | null> {
  try {
    const { redis } = await import('@/lib/redis/client');
    const cached = await redis.get(`session:${sessionId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Failed to get cached session:', error);
    return null;
  }
}

// Helper: Cache session
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

// Helper: Clear session cache
async function clearSessionCache(sessionId: string): Promise<void> {
  try {
    const { redis } = await import('@/lib/redis/client');
    await redis.del(`session:${sessionId}`);
  } catch (error) {
    console.error('Failed to clear session cache:', error);
  }
}