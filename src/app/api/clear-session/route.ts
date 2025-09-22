import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis/client';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Get the session cookie
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session');

    if (sessionCookie?.value) {
      // Decode the token to get session ID
      const parts = sessionCookie.value.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          if (payload.sid) {
            // Clear from Redis
            const sessionKey = `session:${payload.sid}`;
            await redis.del(sessionKey);
            console.log(`[Clear Session] Deleted Redis key: ${sessionKey}`);
          }
        } catch (e) {
          console.error('[Clear Session] Error parsing token:', e);
        }
      }
    }

    // Clear all session-related keys for the user
    const keys = await redis.keys('session:*');
    console.log(`[Clear Session] Found ${keys.length} session keys in Redis`);

    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[Clear Session] Cleared ${keys.length} session keys from Redis`);
    }

    // Clear the cookie
    cookieStore.delete('session');

    return NextResponse.json({
      success: true,
      message: 'Session cleared from Redis and cookies deleted',
      keysCleared: keys.length
    });
  } catch (error) {
    console.error('[Clear Session] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error clearing session',
      error: (error as Error).message
    });
  }
}