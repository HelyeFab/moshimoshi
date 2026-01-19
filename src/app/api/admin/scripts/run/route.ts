import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { spawn } from 'child_process'
import path from 'path'

// Define available scripts with metadata
const AVAILABLE_SCRIPTS = {
  'mark-users-verified': {
    file: 'mark-existing-users-verified.ts',
    description: 'Mark users as email verified (all or by email)',
    requiresConfirmation: true,
    tier: 'critical',
    requiresParams: true,
    paramConfig: {
      email: { type: 'text', label: 'Email Address (leave empty for all users)' },
    },
  },
  'delete-test-users': {
    file: 'delete-test-users.ts',
    description: 'Delete all 10 test users',
    requiresConfirmation: true,
    tier: 'high',
  },
  'create-test-users': {
    file: 'create-test-users.ts',
    description: 'Create 10 test users with varied stats',
    requiresConfirmation: false,
    tier: 'high',
  },
  'verify-test-users': {
    file: 'verify-test-users.ts',
    description: 'Verify test user setup',
    requiresConfirmation: false,
    tier: 'high',
  },
  'check-entitlements': {
    file: 'check-entitlements.ts',
    description: 'Check user entitlements and usage data',
    requiresConfirmation: false,
    tier: 'low',
    requiresParams: true,
    paramConfig: {
      userId: { type: 'text', label: 'User ID' },
      email: { type: 'text', label: 'Email Address (alternative to User ID)' },
    },
  },
  'backfill-story-translations': {
    file: 'backfill-story-translations.ts',
    description: 'Add English translations to stories using OpenAI',
    requiresConfirmation: true,
    tier: 'medium',
    requiresParams: true,
    paramConfig: {
      dryRun: { type: 'boolean', label: 'Dry Run (preview only)' },
      limit: { type: 'number', label: 'Limit (stories to process)' },
      storyId: { type: 'text', label: 'Story ID (specific story)' },
    },
  },
  'backfill-story-word-explanations': {
    file: 'backfillStoryWordExplanations.ts',
    description: 'Generate word explanations for published stories',
    requiresConfirmation: true,
    tier: 'medium',
    requiresParams: true,
    paramConfig: {
      dryRun: { type: 'boolean', label: 'Dry Run (preview only)' },
      story: { type: 'text', label: 'Story ID (specific story)' },
    },
  },
} as const

type ScriptId = keyof typeof AVAILABLE_SCRIPTS

/**
 * POST /api/admin/scripts/run
 * Execute an admin script
 */
export const POST = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    const body = await request.json()
    const { scriptId, params } = body

    if (!scriptId || !(scriptId in AVAILABLE_SCRIPTS)) {
      return NextResponse.json({ error: 'Invalid script ID' }, { status: 400 })
    }

    const script = AVAILABLE_SCRIPTS[scriptId as ScriptId]
    const scriptPath = path.join(process.cwd(), 'scripts', script.file)

    // Build command arguments
    const args: string[] = []
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          // Handle boolean flags (e.g., --dry-run)
          if (typeof value === 'boolean' && value === true) {
            // Convert camelCase to kebab-case for flags
            const flagKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
            args.push(`--${flagKey}`)
          } else if (typeof value !== 'boolean') {
            // Handle other values (number, string)
            // Convert camelCase to kebab-case for keys
            const paramKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
            args.push(`--${paramKey}=${String(value)}`)
          }
        }
      })
    }

    return new Promise(resolve => {
      let output = ''
      let errorOutput = ''

      // Execute script using npx tsx
      const childProcess = spawn('npx', ['tsx', scriptPath, ...args], {
        cwd: process.cwd(),
        env: { ...process.env },
      })

      // Collect stdout
      childProcess.stdout.on('data', data => {
        output += data.toString()
      })

      // Collect stderr
      childProcess.stderr.on('data', data => {
        errorOutput += data.toString()
      })

      // Handle completion
      childProcess.on('close', code => {
        if (code === 0) {
          resolve(
            NextResponse.json({
              success: true,
              scriptId,
              output,
              executedBy: context?.user?.uid || 'unknown',
              executedAt: new Date().toISOString(),
            })
          )
        } else {
          resolve(
            NextResponse.json(
              {
                success: false,
                scriptId,
                output,
                error: errorOutput || `Script exited with code ${code}`,
                executedBy: context?.user?.uid || 'unknown',
                executedAt: new Date().toISOString(),
              },
              { status: 500 }
            )
          )
        }
      })

      // Handle errors
      childProcess.on('error', error => {
        resolve(
          NextResponse.json(
            {
              success: false,
              scriptId,
              error: error.message,
              executedBy: context?.user?.uid || 'unknown',
              executedAt: new Date().toISOString(),
            },
            { status: 500 }
          )
        )
      })
    })
  } catch (error) {
    console.error('Error executing script:', error)
    return NextResponse.json(
      {
        error: 'Failed to execute script',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})

/**
 * GET /api/admin/scripts/run
 * Get list of available scripts
 */
export const GET = withAdminAuth(async (request: NextRequest, _context: AdminContext) => {
  const scripts = Object.entries(AVAILABLE_SCRIPTS).map(([id, script]) => ({
    id,
    ...script,
  }))

  return NextResponse.json({
    scripts,
    count: scripts.length,
  })
})
