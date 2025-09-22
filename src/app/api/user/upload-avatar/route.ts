// Avatar upload endpoint
// Handles user profile image uploads with validation

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, adminStorage, ensureAdminInitialized } from '@/lib/firebase/admin'
import { getSecurityHeaders } from '@/lib/auth/validation'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: NextRequest) {
  console.log('[API /user/upload-avatar] Upload request received')

  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized()

    // Check authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        {
          status: 401,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_FILE',
            message: 'No file provided',
          },
        },
        {
          status: 400,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'File must be JPEG, PNG, GIF, or WebP',
          },
        },
        {
          status: 400,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File must be less than 2MB',
          },
        },
        {
          status: 400,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.type.split('/')[1]
    const filename = `avatars/${session.uid}_${timestamp}.${extension}`

    // Upload to Firebase Storage
    // Use the bucket name from environment or default format
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
                       `${process.env.FIREBASE_ADMIN_PROJECT_ID}.appspot.com`
    const bucket = adminStorage!.bucket(bucketName)
    const fileRef = bucket.file(filename)

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uid: session.uid,
          uploadedAt: new Date().toISOString(),
        },
      },
    })

    // Make the file public
    await fileRef.makePublic()

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`

    // Delete old avatar if exists and is not a Google avatar
    try {
      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      const userData = userDoc.data()
      const oldPhotoURL = userData?.photoURL

      // Only delete if it's a custom upload (contains our bucket URL)
      if (oldPhotoURL && oldPhotoURL.includes('storage.googleapis.com') && oldPhotoURL.includes(bucketName)) {
        const oldFilename = oldPhotoURL.split('/').pop()
        if (oldFilename) {
          const oldFile = bucket.file(`avatars/${oldFilename}`)
          await oldFile.delete().catch(err => {
            console.error('Error deleting old avatar:', err)
            // Continue even if deletion fails
          })
        }
      }
    } catch (error) {
      console.error('Error handling old avatar:', error)
      // Continue even if this fails
    }

    // Update user profile in Firestore
    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .update({
        photoURL: publicUrl,
        updatedAt: new Date(),
      })

    console.log('[API /user/upload-avatar] Avatar uploaded successfully:', publicUrl)

    return NextResponse.json(
      {
        success: true,
        photoURL: publicUrl,
      },
      {
        status: 200,
        headers: getSecurityHeaders(),
      }
    )

  } catch (error: any) {
    console.error('[API /user/upload-avatar] Error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'UPLOAD_FAILED',
          message: error.message || 'Failed to upload avatar',
        },
      },
      {
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}

// DELETE endpoint to remove custom avatar
export async function DELETE(request: NextRequest) {
  console.log('[API /user/upload-avatar] Delete request received')

  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized()

    // Check authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        {
          status: 401,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Get current user data
    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const currentPhotoURL = userData?.photoURL

    // Only delete if it's a custom upload
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
                       `${process.env.FIREBASE_ADMIN_PROJECT_ID}.appspot.com`
    const bucket = adminStorage!.bucket(bucketName)
    if (currentPhotoURL && currentPhotoURL.includes('storage.googleapis.com') && currentPhotoURL.includes(bucketName)) {
      const filename = currentPhotoURL.split('/').pop()
      if (filename) {
        const file = bucket.file(`avatars/${filename}`)
        await file.delete().catch(err => {
          console.error('Error deleting avatar file:', err)
        })
      }
    }

    // Update user profile to remove photoURL
    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .update({
        photoURL: null,
        updatedAt: new Date(),
      })

    console.log('[API /user/upload-avatar] Avatar deleted successfully')

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
        headers: getSecurityHeaders(),
      }
    )

  } catch (error: any) {
    console.error('[API /user/upload-avatar] Delete error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'DELETE_FAILED',
          message: error.message || 'Failed to delete avatar',
        },
      },
      {
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}