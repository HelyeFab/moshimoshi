import { NextRequest, NextResponse } from 'next/server';

// Liveness probe - checks if the application is running
export async function GET(_request: NextRequest) {
  // Simple check that the application can respond
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}