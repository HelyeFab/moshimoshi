import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth';

/**
 * GET /api/admin/analytics
 *
 * Fetches analytics data from Vercel Analytics API
 * Requires admin authentication
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {

    const vercelAccessToken = process.env.VERCEL_ACCESS_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    if (!vercelAccessToken || !vercelProjectId) {
      return NextResponse.json(
        {
          error: 'Vercel Analytics not configured',
          message: 'Please set VERCEL_ACCESS_TOKEN and VERCEL_PROJECT_ID environment variables',
          visitors: 0
        },
        { status: 200 } // Return 200 but with error message
      );
    }

    // Get page URL from query params (default to /waitlist)
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '/waitlist';
    const since = searchParams.get('since') || '7d'; // Last 7 days by default

    // Build Vercel Analytics API URL
    // Correct API endpoint: https://api.vercel.com/v1/web/insights/views
    const baseUrl = 'https://api.vercel.com/v1/web/insights/views';
    const params = new URLSearchParams();
    params.append('projectId', vercelProjectId);
    params.append('path', path);
    params.append('since', since);
    if (vercelTeamId) {
      params.append('teamId', vercelTeamId);
    }

    const analyticsUrl = `${baseUrl}?${params.toString()}`;

    // Fetch analytics from Vercel
    const response = await fetch(analyticsUrl, {
      headers: {
        'Authorization': `Bearer ${vercelAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Vercel Analytics API error:', response.status, response.statusText);
      return NextResponse.json(
        {
          error: 'Failed to fetch analytics',
          message: `Vercel API returned ${response.status}`,
          visitors: 0
        },
        { status: 200 }
      );
    }

    const data = await response.json();

    // Extract total visitors from the response
    // Vercel Analytics API structure may vary, adjust as needed
    const totalVisitors = data?.total || data?.visitors || 0;

    return NextResponse.json({
      success: true,
      path,
      since,
      visitors: totalVisitors,
      data: data, // Include full response for debugging
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        visitors: 0
      },
      { status: 200 } // Return 200 to prevent UI errors
    );
  }
});
