import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getSession, getTierForSession } from '@/lib/auth/session'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { POLICY_VERSION } from '@/lib/entitlements/policy'

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000

function getPrivateKey(): string {
  const key = process.env.ENTITLEMENTS_PRIVATE_KEY
  if (!key) {
    throw new Error('ENTITLEMENTS_PRIVATE_KEY is not configured')
  }
  return key.replace(/\\n/g, '\n')
}

function mapTier(tier: 'guest' | 'free' | 'premium_monthly' | 'premium_yearly'): 'guest' | 'free' | 'premium' {
  if (tier === 'premium_monthly' || tier === 'premium_yearly') return 'premium'
  return tier
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401, headers: getSecurityHeaders() }
      )
    }

    const tier = await getTierForSession(session)
    const now = new Date()
    const payload = {
      userId: session.uid,
      tier: mapTier(tier),
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS).toISOString(),
      policyVersion: POLICY_VERSION
    }

    const token = jwt.sign(payload, getPrivateKey(), {
      algorithm: 'RS256',
      issuer: process.env.JWT_ISSUER || 'moshimoshi',
      audience: process.env.JWT_AUDIENCE || 'moshimoshi-app'
    })

    return NextResponse.json({ token }, { status: 200, headers: getSecurityHeaders() })
  } catch (error) {
    console.error('Entitlements snapshot error:', error)
    return NextResponse.json(
      { error: { code: 'SNAPSHOT_ERROR', message: 'Failed to generate snapshot' } },
      { status: 500, headers: getSecurityHeaders() }
    )
  }
}
