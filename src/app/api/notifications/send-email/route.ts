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

    const resolveUserId = (value: unknown): string | null => {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value
      }

      if (value && typeof value === 'object' && typeof (value as { userId?: unknown }).userId === 'string') {
        const userId = (value as { userId: string }).userId.trim()
        return userId.length > 0 ? userId : null
      }

      return null
    }

    let result;
    switch (type) {
      case 'dailyReminder': {
        const userId = resolveUserId(data)
        if (!userId) {
          return NextResponse.json(
            { error: 'Missing userId for dailyReminder' },
            { status: 400 }
          )
        }
        result = await notificationService.sendDailyReminder(userId);
        break;
      }

      case 'weeklyProgress': {
        const userId = resolveUserId(data)
        if (!userId) {
          return NextResponse.json(
            { error: 'Missing userId for weeklyProgress' },
            { status: 400 }
          )
        }
        result = await notificationService.sendWeeklyProgressReport(userId);
        break;
      }

      case 'achievement': {
        const payload = (data && typeof data === 'object') ? data as Record<string, unknown> : {}
        const userId = resolveUserId(payload)
        const achievementId = typeof payload.achievementId === 'string'
          ? payload.achievementId
          : typeof payload.achievement === 'string'
            ? payload.achievement
            : null

        if (!userId || !achievementId) {
          return NextResponse.json(
            { error: 'Missing userId or achievementId for achievement notification' },
            { status: 400 }
          )
        }

        result = await notificationService.sendAchievementAlert(
          userId,
          achievementId
        );
        break;
      }

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
