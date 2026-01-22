import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth/session';

// Helper for database availability check
function getDb() {
  if (!adminDb) {
    throw new Error('Database not available');
  }
  return adminDb;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const skipTracking = searchParams.get('skipTracking') === 'true';

    // Fetch the resource
    const doc = await db.collection('resources').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    const data = doc.data();

    // Only return published resources for public view
    if (data?.status !== 'published') {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    // Track unique views - don't increment on every page load
    if (!skipTracking) {
      const cookieStore = await cookies();
      const viewedResourcesCookie = cookieStore.get('viewed_resources');
      const viewedResources = viewedResourcesCookie ? JSON.parse(viewedResourcesCookie.value) : [];

      // Check if this resource has been viewed in this session
      const hasViewed = viewedResources.includes(id);

      if (!hasViewed) {
        // Track unique view
        await trackUniqueView(id, req);

        // Update cookie to remember this view (expires in 24 hours)
        viewedResources.push(id);
        (await cookies()).set('viewed_resources', JSON.stringify(viewedResources), {
          maxAge: 60 * 60 * 24, // 24 hours
          httpOnly: true,
          sameSite: 'lax'
        });
      }
    }

    // Get the latest view count after potential update
    const updatedDoc = await db.collection('resources').doc(id).get();
    const updatedData = updatedDoc.data();

    // Convert Firestore timestamps to ISO strings for JSON serialization
    const publishedAt = data.publishedAt?.toDate
      ? data.publishedAt.toDate().toISOString()
      : data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();

    const updatedAt = data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : publishedAt;

    return NextResponse.json({
      id: doc.id,
      title: data.title,
      description: data.description,
      content: data.content,
      imageUrl: data.imageUrl,
      imageAlt: data.imageAlt,
      externalUrl: data.externalUrl || null,
      status: data.status,
      category: data.category,
      tags: data.tags || [],
      featured: data.featured || false,
      views: updatedData?.views || data.views || 0, // Use actual count, not incremented
      publishedAt,
      updatedAt,
    });
  } catch (error) {
    console.error('Error fetching resource:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource' },
      { status: 500 }
    );
  }
}

async function trackUniqueView(resourceId: string, req: NextRequest) {
  try {
    const db = getDb();

    // Get user identifier (logged in user ID or anonymous session)
    const session = await getSession();
    const userId = session?.uid || null;

    // Get IP address for additional uniqueness (in production, this would come from headers)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Create a unique view record
    const viewData = {
      resourceId,
      userId,
      ip,
      userAgent: req.headers.get('user-agent') || 'unknown',
      timestamp: FieldValue.serverTimestamp(),
      date: new Date().toISOString().split('T')[0] // For daily analytics
    };

    // Check if this user has already viewed this resource today
    if (userId) {
      // For logged-in users, check by userId
      const existingView = await db
        .collection('resource_views')
        .where('resourceId', '==', resourceId)
        .where('userId', '==', userId)
        .where('date', '==', viewData.date)
        .limit(1)
        .get();

      if (!existingView.empty) {
        console.log(`User ${userId} already viewed resource ${resourceId} today`);
        return; // Don't count duplicate view
      }
    }

    // Record the unique view
    await db.collection('resource_views').add(viewData);

    // Increment the view count
    await db.collection('resources').doc(resourceId).update({
      views: FieldValue.increment(1),
      lastViewedAt: FieldValue.serverTimestamp()
    });

    console.log(`Tracked unique view for resource ${resourceId}`);
  } catch (error) {
    console.error('Error tracking view:', error);
    // Don't fail the request if tracking fails
  }
}