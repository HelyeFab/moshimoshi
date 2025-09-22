import { NextRequest, NextResponse } from 'next/server';
import { apiLogger, logRequest } from '@/lib/monitoring/logger';
import { getRedisClient } from '@/lib/redis/client';
import { adminDb } from '@/lib/firebase/admin';

// Readiness probe - checks if the application is ready to serve traffic
export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {};

  // Check Redis connectivity
  try {
    const redis = await getRedisClient();
    await redis.ping();
    checks.redis = { status: 'ok' };
  } catch (error) {
    checks.redis = { 
      status: 'error', 
      message: 'Redis connection failed' 
    };
    apiLogger.error('Redis health check failed', { error: error instanceof Error ? error.message : String(error) });
  }

  // Check Firebase connectivity
  try {
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    // Attempt a simple read operation
    const testCollection = adminDb.collection('_health_check');
    await testCollection.limit(1).get();
    checks.firebase = { status: 'ok' };
  } catch (error) {
    checks.firebase = { 
      status: 'error', 
      message: 'Firebase connection failed' 
    };
    apiLogger.error('Firebase health check failed', { error: error instanceof Error ? error.message : String(error) });
  }

  // Check if environment variables are properly configured
  const requiredEnvVars = [
    'FIREBASE_PROJECT_ID',
    'UPSTASH_REDIS_REST_URL',
    'NEXT_PUBLIC_SENTRY_DSN'
  ];

  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missingEnvVars.length === 0) {
    checks.environment = { status: 'ok' };
  } else {
    checks.environment = {
      status: 'error',
      message: `Missing environment variables: ${missingEnvVars.join(', ')}`
    };
  }

  // Determine overall readiness
  const allChecksOk = Object.values(checks).every(check => check.status === 'ok');
  const overallStatus = allChecksOk ? 'ready' : 'not_ready';

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    responseTime: Date.now() - startTime
  };

  logRequest(
    'GET', 
    '/api/health/ready', 
    Date.now() - startTime,
    { status: allChecksOk ? 200 : 503 }
  );

  return NextResponse.json(response, {
    status: allChecksOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Readiness-Status': overallStatus
    }
  });
}