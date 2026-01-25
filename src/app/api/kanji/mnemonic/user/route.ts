import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { UserMnemonicDAO } from '@/lib/firebase/dao'

/**
 * GET /api/kanji/mnemonic/user?kanji=本
 * Fetch user's custom mnemonic for a kanji character
 */
export async function GET(request: NextRequest) {
  console.log('[UserMnemonic API] GET request received')
  try {
    const session = await getSession()
    console.log('[UserMnemonic API] Session:', session ? 'authenticated' : 'not authenticated')
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const kanji = searchParams.get('kanji')?.trim()
    console.log('[UserMnemonic API] Kanji param:', kanji)

    if (!kanji) {
      return NextResponse.json(
        { success: false, error: 'KANJI_REQUIRED' },
        { status: 400 }
      )
    }

    if (kanji.length > 4) {
      return NextResponse.json(
        { success: false, error: 'SINGLE_KANJI_ONLY' },
        { status: 400 }
      )
    }

    console.log('[UserMnemonic API] Creating DAO...')
    const dao = new UserMnemonicDAO()
    console.log('[UserMnemonic API] Calling dao.get()...')
    const mnemonic = await dao.get(session.uid, kanji)
    console.log('[UserMnemonic API] Got mnemonic:', !!mnemonic)

    if (!mnemonic) {
      return NextResponse.json({
        success: true,
        mnemonic: null,
      })
    }

    return NextResponse.json({
      success: true,
      mnemonic: {
        kanji: mnemonic.kanji,
        mnemonic: mnemonic.mnemonic,
        isPublic: mnemonic.isPublic,
        createdAt: mnemonic.createdAt.toDate().toISOString(),
        updatedAt: mnemonic.updatedAt.toDate().toISOString(),
      },
    })
  } catch (error) {
    console.error('[UserMnemonic API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/kanji/mnemonic/user
 * Save user's custom mnemonic for a kanji
 * Body: { kanji: string, mnemonic: string, isPublic?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const kanji = body?.kanji?.trim()
    const mnemonic = body?.mnemonic?.trim()
    const isPublic = body?.isPublic === true

    if (!kanji) {
      return NextResponse.json(
        { success: false, error: 'KANJI_REQUIRED' },
        { status: 400 }
      )
    }

    if (kanji.length > 4) {
      return NextResponse.json(
        { success: false, error: 'SINGLE_KANJI_ONLY' },
        { status: 400 }
      )
    }

    if (!mnemonic) {
      return NextResponse.json(
        { success: false, error: 'MNEMONIC_REQUIRED' },
        { status: 400 }
      )
    }

    if (mnemonic.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'MNEMONIC_TOO_LONG' },
        { status: 400 }
      )
    }

    const dao = new UserMnemonicDAO()
    await dao.upsert(session.uid, kanji, mnemonic, isPublic)

    return NextResponse.json({
      success: true,
      message: 'Mnemonic saved successfully',
    })
  } catch (error) {
    console.error('[UserMnemonic API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/kanji/mnemonic/user?kanji=本
 * Delete user's custom mnemonic for a kanji
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const kanji = searchParams.get('kanji')?.trim()

    if (!kanji) {
      return NextResponse.json(
        { success: false, error: 'KANJI_REQUIRED' },
        { status: 400 }
      )
    }

    const dao = new UserMnemonicDAO()
    const deleted = await dao.delete(session.uid, kanji)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Mnemonic deleted successfully',
    })
  } catch (error) {
    console.error('[UserMnemonic API] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
