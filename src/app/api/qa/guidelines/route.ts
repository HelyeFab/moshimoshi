import { NextRequest, NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'
import { TEA_HOUSE_GUIDELINES_VERSION } from '@/lib/qa/guidelines'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    if (!userDoc.exists) {
      return NextResponse.json({ acknowledged: false })
    }

    const teaHouseData = userDoc.data()?.teaHouse || {}
    const acknowledged =
      teaHouseData.acknowledgedGuidelines === true &&
      teaHouseData.guidelinesVersion === TEA_HOUSE_GUIDELINES_VERSION

    return NextResponse.json({ acknowledged })
  } catch (error) {
    console.error('[API /qa/guidelines] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch guidelines' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.tier === 'guest') {
      return NextResponse.json({ error: 'Guests cannot acknowledge' }, { status: 403 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const body = await request.json()
    if (body?.acknowledged !== true) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    await adminDb.collection('users').doc(session.uid).set(
      {
        teaHouse: {
          acknowledgedGuidelines: true,
          acknowledgedAt: FieldValue.serverTimestamp(),
          guidelinesVersion: TEA_HOUSE_GUIDELINES_VERSION,
        },
      },
      { merge: true }
    )

    return NextResponse.json({ acknowledged: true })
  } catch (error) {
    console.error('[API /qa/guidelines] POST error:', error)
    return NextResponse.json({ error: 'Failed to acknowledge guidelines' }, { status: 500 })
  }
}
