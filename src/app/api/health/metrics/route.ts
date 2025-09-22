import { NextRequest, NextResponse } from 'next/server';
import { reviewMetrics, metricsDashboard } from '@/lib/monitoring/metrics-dashboard';
import { apiLogger, logRequest } from '@/lib/monitoring/logger';

// Metrics endpoint for monitoring
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check for authorization (basic auth or API key)
    const authHeader = request.headers.get('authorization');
    const apiKey = request.headers.get('x-api-key');
    
    const expectedApiKey = process.env.METRICS_API_KEY;
    
    if (process.env.NODE_ENV === 'production') {
      if (!authHeader && !apiKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      if (apiKey && apiKey !== expectedApiKey) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
    }

    // Get dashboard summary
    const dashboardSummary = reviewMetrics.getDashboardSummary();
    const healthScore = reviewMetrics.getHealthScore();
    const allMetrics = metricsDashboard.getAllMetrics();

    const response = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      health: healthScore,
      summary: dashboardSummary,
      metrics: allMetrics,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    logRequest('GET', '/api/health/metrics', Date.now() - startTime, { status: 200 });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    apiLogger.error('Metrics endpoint failed', { error: error instanceof Error ? error.message : String(error) });
    
    return NextResponse.json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    }, {
      status: 500
    });
  }
}