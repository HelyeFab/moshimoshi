import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminStorage } from '@/lib/firebase/admin'
import { getStorageDecision } from '@/lib/api/storage-helper'

/**
 * GET /api/anki/media/list - List all media files for the current user
 *
 * Used by media-sync-utility to verify which files exist in Firebase Storage
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decision = await getStorageDecision(session)
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        error: 'Premium subscription required',
        isPremium: false
      }, { status: 403 })
    }

    if (!adminStorage) {
      return NextResponse.json({ error: 'Storage not available' }, { status: 500 })
    }

    // List all files in user's anki-media folder
    const bucket = adminStorage.bucket()
    const [files] = await bucket.getFiles({
      prefix: `anki-media/${session.uid}/`
    })

    // Return file metadata
    const fileList = files.map(file => ({
      name: file.name,
      size: parseInt(file.metadata.size || '0'),
      contentType: file.metadata.contentType,
      timeCreated: file.metadata.timeCreated,
      updated: file.metadata.updated
    }))

    return NextResponse.json({
      success: true,
      files: fileList,
      totalFiles: fileList.length,
      totalSize: fileList.reduce((sum, f) => sum + f.size, 0)
    })

  } catch (error: any) {
    console.error('[Media List API] Error:', error)
    return NextResponse.json({
      error: 'Failed to list media files',
      details: error.message
    }, { status: 500 })
  }
}
