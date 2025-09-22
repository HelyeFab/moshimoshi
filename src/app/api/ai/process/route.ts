/**
 * Unified AI Processing API Endpoint
 * Single endpoint for all AI-powered features
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai/AIService';
import { AIRequest, AIResponse } from '@/lib/ai/types';
import { checkAdminRole } from '@/lib/firebase/auth-admin';
import { initAdmin } from '@/lib/firebase/admin';

// Initialize Firebase Admin
initAdmin();

// Configure for API route
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max execution time

// Initialize AI Service
const aiService = AIService.getInstance();

/**
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const health = await aiService.healthCheck();

    return NextResponse.json({
      status: health.healthy ? 'healthy' : 'unhealthy',
      ...health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 500 }
    );
  }
}

/**
 * Main AI processing endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // For admin-only tasks, check admin role
    const body: AIRequest = await request.json();
    const adminOnlyTasks = ['generate_story', 'generate_moodboard', 'suggest_improvements'];

    let userId: string | undefined;
    if (adminOnlyTasks.includes(body.task)) {
      const authResult = await checkAdminRole(authHeader);
      if (!authResult.isAdmin) {
        return NextResponse.json(
          { error: 'Admin access required for this task' },
          { status: 403 }
        );
      }
      userId = authResult.userId;
    } else {
      // For regular users, just extract user ID from token
      // This would normally validate the token and extract the user ID
      // For now, we'll use a placeholder
      userId = 'authenticated_user';
    }

    // Add metadata to request
    if (!body.metadata) {
      body.metadata = {};
    }
    body.metadata.userId = userId;
    body.metadata.sessionId = request.headers.get('x-session-id') || undefined;
    body.metadata.timestamp = new Date();
    body.metadata.source = 'api';

    // Process the request
    const startTime = Date.now();
    const response: AIResponse = await aiService.process(body);

    // Log processing time
    const processingTime = Date.now() - startTime;
    console.log(`✅ AI task completed: ${body.task} in ${processingTime}ms`);

    // Add CORS headers if needed
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('X-Processing-Time', processingTime.toString());

    if (response.cached) {
      headers.set('X-Cache-Hit', 'true');
    }

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('AI API Error:', error);

    // Determine error status code
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = 'An unexpected error occurred';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific error types
      if (error.message.includes('rate limit')) {
        statusCode = 429;
        errorCode = 'RATE_LIMIT';
      } else if (error.message.includes('Invalid')) {
        statusCode = 400;
        errorCode = 'INVALID_REQUEST';
      } else if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        errorCode,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}

/**
 * Batch processing endpoint
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check admin role for batch processing
    const authResult = await checkAdminRole(authHeader);
    if (!authResult.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required for batch processing' },
        { status: 403 }
      );
    }

    const { requests }: { requests: AIRequest[] } = await request.json();

    if (!Array.isArray(requests)) {
      return NextResponse.json(
        { error: 'Requests must be an array' },
        { status: 400 }
      );
    }

    if (requests.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 requests per batch' },
        { status: 400 }
      );
    }

    // Add metadata to all requests
    const enrichedRequests = requests.map(req => ({
      ...req,
      metadata: {
        ...req.metadata,
        userId: authResult.userId,
        timestamp: new Date(),
        source: 'batch_api'
      }
    }));

    // Process batch
    const startTime = Date.now();
    const results = await aiService.processBatch(enrichedRequests);
    const processingTime = Date.now() - startTime;

    console.log(`✅ Batch processing completed: ${results.length} requests in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      results,
      totalRequests: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      processingTime
    });

  } catch (error) {
    console.error('Batch API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Batch processing failed'
      },
      { status: 500 }
    );
  }
}

/**
 * Usage statistics endpoint
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || undefined;
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Check if requesting other user's stats (admin only)
    if (userId) {
      const authResult = await checkAdminRole(authHeader);
      if (!authResult.isAdmin && authResult.userId !== userId) {
        return NextResponse.json(
          { error: 'Cannot access other users\' statistics' },
          { status: 403 }
        );
      }
    }

    // Parse date range
    const timeRange = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : undefined;

    // Get statistics
    const stats = await aiService.getUsageStats(userId, timeRange);

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics'
      },
      { status: 500 }
    );
  }
}

/**
 * Cache management endpoint (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    const authResult = await checkAdminRole(authHeader);

    if (!authResult.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get pattern from query
    const url = new URL(request.url);
    const pattern = url.searchParams.get('pattern') || undefined;

    // Clear cache
    await aiService.clearCache(pattern);

    return NextResponse.json({
      success: true,
      message: pattern ? `Cleared cache entries matching: ${pattern}` : 'Cleared entire cache',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cache Clear Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cache'
      },
      { status: 500 }
    );
  }
}