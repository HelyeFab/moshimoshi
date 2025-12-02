import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { debugLog } from '@/lib/logger/debug-logger'
import {
  LearningVillageConfig,
  DEFAULT_CONFIG,
  mergeWithDefaults,
  StallConfig
} from '@/config/learning-village-types'

const log = debugLog('app:api:admin:learning-village')

const CONFIG_COLLECTION = 'config'
const CONFIG_DOC = 'learningVillage'

/**
 * Helper to verify admin access
 */
async function verifyAdmin(): Promise<{ isAdmin: boolean; uid: string | null; error?: string }> {
  const session = await getSession()

  if (!session) {
    return { isAdmin: false, uid: null, error: 'Not authenticated' }
  }

  try {
    const userDoc = await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .get()

    if (!userDoc.exists) {
      return { isAdmin: false, uid: session.uid, error: 'User not found' }
    }

    const userData = userDoc.data()
    const isAdmin = userData?.isAdmin === true

    return { isAdmin, uid: session.uid }
  } catch (error) {
    log('Error verifying admin:', error)
    return { isAdmin: false, uid: session.uid, error: 'Error checking admin status' }
  }
}

/**
 * GET /api/admin/learning-village
 * Fetch current Learning Village configuration
 * Public endpoint (config is needed for all users to render the village)
 */
export async function GET() {
  try {
    log('Fetching Learning Village config')

    const configDoc = await adminFirestore!
      .collection(CONFIG_COLLECTION)
      .doc(CONFIG_DOC)
      .get()

    if (!configDoc.exists) {
      log('No config found, returning defaults')
      return NextResponse.json({
        success: true,
        config: DEFAULT_CONFIG,
        source: 'defaults'
      })
    }

    const data = configDoc.data() as Partial<LearningVillageConfig>
    const config = mergeWithDefaults(data)

    log('Config fetched successfully')
    return NextResponse.json({
      success: true,
      config,
      source: 'firestore'
    })

  } catch (error) {
    log('Error fetching config:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch configuration',
      config: DEFAULT_CONFIG
    }, { status: 500 })
  }
}

/**
 * PUT /api/admin/learning-village
 * Update Learning Village configuration (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    log('Updating Learning Village config')

    // Verify admin access
    const { isAdmin, uid, error } = await verifyAdmin()

    if (!isAdmin) {
      log('Access denied:', error)
      return NextResponse.json({
        success: false,
        error: error || 'Admin access required'
      }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { stalls } = body as { stalls: StallConfig[] }

    if (!stalls || !Array.isArray(stalls)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request: stalls array required'
      }, { status: 400 })
    }

    // Validate stall configs
    for (const stall of stalls) {
      if (!stall.id || typeof stall.order !== 'number' || typeof stall.isPopular !== 'boolean') {
        return NextResponse.json({
          success: false,
          error: `Invalid stall config for: ${stall.id || 'unknown'}`
        }, { status: 400 })
      }
    }

    // Build new config
    const newConfig: LearningVillageConfig = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      updatedBy: uid!,
      stalls
    }

    // Save to Firestore
    await adminFirestore!
      .collection(CONFIG_COLLECTION)
      .doc(CONFIG_DOC)
      .set(newConfig)

    log('Config updated successfully by:', uid)
    return NextResponse.json({
      success: true,
      config: newConfig,
      message: 'Configuration updated successfully'
    })

  } catch (error) {
    log('Error updating config:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update configuration'
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/learning-village
 * Reset to default configuration (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    log('Resetting Learning Village config to defaults')

    // Verify admin access
    const { isAdmin, uid, error } = await verifyAdmin()

    if (!isAdmin) {
      log('Access denied:', error)
      return NextResponse.json({
        success: false,
        error: error || 'Admin access required'
      }, { status: 403 })
    }

    // Parse request body to check for action
    const body = await request.json().catch(() => ({}))

    if (body.action !== 'reset') {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use { action: "reset" } to reset to defaults.'
      }, { status: 400 })
    }

    // Build reset config with current timestamp
    const resetConfig: LearningVillageConfig = {
      ...DEFAULT_CONFIG,
      updatedAt: new Date().toISOString(),
      updatedBy: uid!
    }

    // Save to Firestore
    await adminFirestore!
      .collection(CONFIG_COLLECTION)
      .doc(CONFIG_DOC)
      .set(resetConfig)

    log('Config reset to defaults by:', uid)
    return NextResponse.json({
      success: true,
      config: resetConfig,
      message: 'Configuration reset to defaults'
    })

  } catch (error) {
    log('Error resetting config:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to reset configuration'
    }, { status: 500 })
  }
}
