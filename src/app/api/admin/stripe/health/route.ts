/**
 * Health check endpoint for Stripe testing system
 * Tests all dependencies without making actual API calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminFirestore } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  const checks: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {}
  };

  try {
    // 1. Session check
    try {
      const session = await getSession();
      checks.checks.session = {
        status: session ? 'OK' : 'NO_SESSION',
        hasUid: !!session?.uid,
        uid: session?.uid
      };
    } catch (error: any) {
      checks.checks.session = {
        status: 'ERROR',
        error: error.message
      };
    }

    // 2. Firebase Admin check
    checks.checks.firebaseAdmin = {
      status: adminFirestore ? 'OK' : 'NOT_INITIALIZED',
      available: !!adminFirestore
    };

    // 3. Stripe env vars check
    checks.checks.stripe = {
      secretKey: process.env.STRIPE_SECRET_KEY ? 'PRESENT' : 'MISSING',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'PRESENT' : 'MISSING',
    };

    // 4. App URL check
    checks.checks.appUrl = {
      value: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
      status: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL) ? 'OK' : 'MISSING'
    };

    // Overall status
    const hasErrors = Object.values(checks.checks).some((check: any) =>
      check.status === 'ERROR' || check.status === 'MISSING' || check.status === 'NOT_INITIALIZED'
    );

    return NextResponse.json({
      ...checks,
      overall: hasErrors ? 'UNHEALTHY' : 'HEALTHY'
    }, {
      status: hasErrors ? 500 : 200
    });

  } catch (error: any) {
    return NextResponse.json({
      ...checks,
      overall: 'ERROR',
      error: error.message,
      stack: error.stack
    }, {
      status: 500
    });
  }
}
