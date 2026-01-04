import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminFirestore as adminDb, Timestamp } from '@/lib/firebase/admin';

// Check if user is admin
async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    if (!adminDb) return false;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    return userData?.isAdmin === true || userData?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// GET - List all channels
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isUserAdmin(session.uid);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const channelsSnapshot = await adminDb
      .collection('youtubeChannels')
      .orderBy('createdAt', 'desc')
      .get();

    const channels = channelsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ channels });
  } catch (error: any) {
    console.error('Error fetching channels:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}

// POST - Create new channel
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isUserAdmin(session.uid);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const channelData = await request.json();

    // Add timestamps
    const dataWithTimestamps = {
      ...channelData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection('youtubeChannels').add(dataWithTimestamps);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Channel created successfully'
    });
  } catch (error: any) {
    console.error('Error creating channel:', error);
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
  }
}

// PUT - Update existing channel
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isUserAdmin(session.uid);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id, ...channelData } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    // Update with new timestamp
    const dataWithTimestamp = {
      ...channelData,
      updatedAt: Timestamp.now(),
    };

    await adminDb.collection('youtubeChannels').doc(id).update(dataWithTimestamp);

    return NextResponse.json({
      success: true,
      message: 'Channel updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating channel:', error);
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 });
  }
}

// DELETE - Delete channel
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isUserAdmin(session.uid);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    await adminDb.collection('youtubeChannels').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting channel:', error);
    return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 });
  }
}
