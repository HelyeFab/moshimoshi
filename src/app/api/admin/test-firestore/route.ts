/**
 * Minimal test endpoint to debug Firestore modelSheet issue
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'

initAdmin()

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  console.log('[TestFirestore] Starting test...')

  try {
    const adminKey = request.headers.get('X-Admin-Key')
    if (adminKey !== process.env.INTEGRITY_CHECKER_ADMIN_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { storyId, testData } = body

    if (!storyId) {
      return NextResponse.json({ error: 'storyId required' }, { status: 400 })
    }

    console.log('[TestFirestore] Testing Firestore update for:', storyId)
    console.log('[TestFirestore] Test data length:', testData?.length || 0)

    // Test 1: Simple update
    console.log('[TestFirestore] Test 1: Simple string...')
    await adminFirestore!.collection('stories').doc(storyId).update({
      testField: 'simple-string',
    })
    console.log('[TestFirestore] Test 1: SUCCESS')

    // Test 2: Update with modelSheet object
    console.log('[TestFirestore] Test 2: modelSheet object with small string...')
    await adminFirestore!
      .collection('stories')
      .doc(storyId)
      .update({
        modelSheet: {
          imageUrl: 'https://example.com/test.png',
          referenceImageData: 'small-test-string',
        },
      })
    console.log('[TestFirestore] Test 2: SUCCESS')

    // Test 3: Update with larger data
    if (testData) {
      console.log('[TestFirestore] Test 3: modelSheet with provided data...')
      await adminFirestore!
        .collection('stories')
        .doc(storyId)
        .update({
          modelSheet: {
            imageUrl: 'https://example.com/test.png',
            referenceImageData: testData,
          },
        })
      console.log('[TestFirestore] Test 3: SUCCESS')
    }

    // Clean up
    console.log('[TestFirestore] Cleaning up...')
    const { FieldValue } = await import('firebase-admin/firestore')
    await adminFirestore!.collection('stories').doc(storyId).update({
      testField: FieldValue.delete(),
      modelSheet: FieldValue.delete(),
    })
    console.log('[TestFirestore] Cleanup: SUCCESS')

    return NextResponse.json({ success: true, message: 'All tests passed' })
  } catch (error: any) {
    console.error('[TestFirestore] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        name: error.name,
      },
      { status: 500 }
    )
  }
}
