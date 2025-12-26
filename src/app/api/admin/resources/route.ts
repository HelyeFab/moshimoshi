import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import {
  ResourceFormData,
  ResourceListItem,
} from '@/types/resources';
import {
  validateResourceFormData,
  prepareResourceForSaving,
  formatResourceListItem
} from '@/utils/resources';

/**
 * GET /api/admin/resources
 * Get all resources (admin only)
 * Query params: ?status=draft|published|scheduled|all
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin status
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Verify admin status from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Query resources from Firestore
    let query = adminDb.collection('resources').orderBy('updatedAt', 'desc');

    // Apply status filter if provided
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const resources: ResourceListItem[] = [];

    snapshot.forEach((doc) => {
      resources.push(formatResourceListItem({ id: doc.id, ...doc.data() }));
    });

    return NextResponse.json({
      success: true,
      data: resources
    });
  } catch (error: any) {
    console.error('[Admin Resources] Error fetching resources:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch resources' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/resources
 * Create a new resource (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin status
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Verify admin status from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const formData: ResourceFormData = await request.json();

    // Validate form data
    const errors = validateResourceFormData(formData);
    if (errors.length > 0) {
      console.error('[Admin Resources] Validation errors:', errors);
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Prepare resource data
    const resourceData = prepareResourceForSaving(formData, session.uid);

    // Set author info from user data
    if (resourceData.author) {
      resourceData.author.email = userData.email || session.email;
      resourceData.author.name = userData.displayName || session.email?.split('@')[0] || 'Admin';
    }

    // Check if slug already exists
    const slugQuery = await adminDb.collection('resources')
      .where('slug', '==', resourceData.slug)
      .get();

    if (!slugQuery.empty) {
      console.warn('[Admin Resources] Slug already exists:', resourceData.slug);
      return NextResponse.json(
        { error: 'A resource with this slug already exists' },
        { status: 400 }
      );
    }

    // Create the resource
    const docRef = await adminDb.collection('resources').add(resourceData);

    console.log('[Admin Resources] Resource created:', docRef.id, 'by', session.email);

    return NextResponse.json({
      id: docRef.id,
      message: 'Resource created successfully'
    });
  } catch (error) {
    console.error('[Admin Resources] Error creating resource:', error);
    return NextResponse.json(
      { error: 'Failed to create resource', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
