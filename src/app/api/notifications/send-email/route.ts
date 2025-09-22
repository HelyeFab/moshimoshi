import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/notifications/notification-service';

/**
 * POST /api/notifications/send-email
 * Internal endpoint for Firebase Functions to trigger email notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from our Firebase Functions
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { type, data } = await request.json();

    let result;
    switch (type) {
      case 'dailyReminder':
        result = await notificationService.sendDailyReminder(data);
        break;

      case 'weeklyProgress':
        result = await notificationService.sendWeeklyProgressReport(data);
        break;

      case 'achievement':
        result = await notificationService.sendAchievementAlert(
          data.userId,
          data.achievement
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type,
      result
    });

  } catch (error) {
    console.error('Send email API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}