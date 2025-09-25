import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getServerSession } from '@/lib/auth/session';
import {
  ResourceFormData,
  ResourceListItem,
  ResourcePost
} from '@/types/resources';
import {
  validateResourceFormData,
  prepareResourceForSaving,
  formatResourceListItem
} from '@/utils/resources';

export async function GET(req: NextRequest) {
  try {
    // Check authentication and admin status
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin status from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
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

    return NextResponse.json(resources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication and admin status
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin status from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const formData: ResourceFormData = await req.json();

    // Validate form data
    const errors = validateResourceFormData(formData);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Prepare resource data
    const resourceData = prepareResourceForSaving(formData, session.uid);

    // Set author email from user data
    if (resourceData.author && userData.email) {
      resourceData.author.email = userData.email;
      resourceData.author.name = userData.displayName || 'Admin';
    }

    // Check if slug already exists
    const slugQuery = await adminDb.collection('resources')
      .where('slug', '==', resourceData.slug)
      .get();

    if (!slugQuery.empty) {
      return NextResponse.json(
        { error: 'A resource with this slug already exists' },
        { status: 400 }
      );
    }

    // Create the resource
    const docRef = await adminDb.collection('resources').add(resourceData);

    return NextResponse.json({
      id: docRef.id,
      message: 'Resource created successfully'
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }
}