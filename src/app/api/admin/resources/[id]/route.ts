import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import {
  ResourceFormData,
  ResourcePost
} from '@/types/resources';
import {
  validateResourceFormData,
  prepareResourceForUpdate,
  formatResourceForDisplay
} from '@/utils/resources';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the resource
    const docRef = adminDb.collection('resources').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const resource = formatResourceForDisplay({ id: doc.id, ...doc.data() });

    return NextResponse.json(resource);
  } catch (error) {
    console.error('Error fetching resource:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check authentication and admin status
    const session = await getSession();
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

    // Get existing resource
    const docRef = adminDb.collection('resources').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const existingData = doc.data();

    // Prepare update data
    const updates = prepareResourceForUpdate(formData);

    // If changing from draft to published, set publishedAt
    if (formData.status === 'published' && existingData?.status !== 'published') {
      (updates as any).publishedAt = new Date();
    }

    // Check if slug is being changed and if new slug already exists
    if (updates.slug && updates.slug !== existingData?.slug) {
      const slugQuery = await adminDb.collection('resources')
        .where('slug', '==', updates.slug)
        .get();

      if (!slugQuery.empty && slugQuery.docs[0].id !== id) {
        return NextResponse.json(
          { error: 'A resource with this slug already exists' },
          { status: 400 }
        );
      }
    }

    // Update the resource
    await docRef.update(updates);

    return NextResponse.json({
      message: 'Resource updated successfully'
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    return NextResponse.json(
      { error: 'Failed to update resource' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check authentication and admin status
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin status from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete the resource
    const docRef = adminDb.collection('resources').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json({
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 }
    );
  }
}