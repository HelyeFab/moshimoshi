import { NextRequest, NextResponse } from 'next/server';
import { reviewMetrics } from '@/lib/monitoring/metrics-dashboard';
import { apiLogger, logRequest } from '@/lib/monitoring/logger';

// Basic health check endpoint
export async function GET(_request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get health score from metrics
    const healthScore = reviewMetrics.getHealthScore();
    
    const response = {
      status: healthScore.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      healthScore: healthScore.score,
      issues: healthScore.issues
    };

    logRequest('GET', '/api/health', Date.now() - startTime, { status: 200 });

    return NextResponse.json(response, {
      status: healthScore.status === 'healthy' ? 200 : 
              healthScore.status === 'degraded' ? 207 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': healthScore.status
      }
    });
  } catch (error) {
    apiLogger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': 'unhealthy'
      }
    });
  }
}