import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

// GET: Fetch all feature flags
export async function GET(request: NextRequest) {
  try {
    // Check Firebase services are initialized
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Service not available' }, { status: 503 });
    }

    // Verify admin
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userRecord = await adminAuth.getUser(session.uid);
    const isAdmin = userRecord.customClaims?.admin === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Fetch feature flags from Firestore
    const docRef = adminDb.collection('config').doc('featureFlags');
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return NextResponse.json({ flags: docSnap.data() });
    } else {
      // Return defaults if not exists
      return NextResponse.json({ flags: {} });
    }
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

// POST: Update a feature flag
export async function POST(request: NextRequest) {
  try {
    // Check Firebase services are initialized
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Service not available' }, { status: 503 });
    }

    // Verify admin
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userRecord = await adminAuth.getUser(session.uid);
    const isAdmin = userRecord.customClaims?.admin === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { flag, enabled } = body;

    if (!flag || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body. Required: flag (string), enabled (boolean)' },
        { status: 400 }
      );
    }

    // Update feature flag in Firestore using Admin SDK
    const docRef = adminDb.collection('config').doc('featureFlags');
    await docRef.set(
      { [flag]: enabled },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      flag,
      enabled
    });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}

// PUT: Reset all feature flags to defaults
export async function PUT(request: NextRequest) {
  try {
    // Check Firebase services are initialized
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Service not available' }, { status: 503 });
    }

    // Verify admin
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userRecord = await adminAuth.getUser(session.uid);
    const isAdmin = userRecord.customClaims?.admin === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { defaults } = body;

    if (!defaults || typeof defaults !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Required: defaults (object)' },
        { status: 400 }
      );
    }

    // Reset feature flags in Firestore
    const docRef = adminDb.collection('config').doc('featureFlags');
    await docRef.set(defaults);

    return NextResponse.json({
      success: true,
      message: 'Feature flags reset to defaults'
    });
  } catch (error) {
    console.error('Error resetting feature flags:', error);
    return NextResponse.json(
      { error: 'Failed to reset feature flags' },
      { status: 500 }
    );
  }
}
