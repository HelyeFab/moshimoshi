import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminStorage, adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/admin/upload
 * Upload files to Firebase Storage (admin only)
 * Accepts multipart/form-data with 'file' field
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

    if (!adminStorage) {
      console.error('[Admin Upload] Firebase Storage not initialized');
      return NextResponse.json(
        { error: 'Storage service not available' },
        { status: 503 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP, SVG)' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const filename = `resources/${uuidv4()}.${fileExtension}`;

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Firebase Storage
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(filename);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy: session.uid,
          uploadedByEmail: session.email,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Make file publicly accessible
    await fileRef.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    console.log('[Admin Upload] File uploaded:', filename, 'by', session.email);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('[Admin Upload] Error uploading file:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/upload
 * Delete a file from Firebase Storage (admin only)
 * Query params: ?filename=resources/uuid.ext
 */
export async function DELETE(request: NextRequest) {
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

    if (!adminStorage) {
      return NextResponse.json(
        { error: 'Storage service not available' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Security: Only allow deletion from resources folder
    if (!filename.startsWith('resources/')) {
      return NextResponse.json(
        { error: 'Can only delete files from resources folder' },
        { status: 403 }
      );
    }

    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(filename);

    // Check if file exists
    const [exists] = await fileRef.exists();
    if (!exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Delete the file
    await fileRef.delete();

    console.log('[Admin Upload] File deleted:', filename, 'by', session.email);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('[Admin Upload] Error deleting file:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
