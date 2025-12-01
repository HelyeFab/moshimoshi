import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/adminAuth';
import { spawn } from 'child_process';
import path from 'path';

// Define available scripts with metadata
const AVAILABLE_SCRIPTS = {
  'restore-user-stats': {
    file: 'restore-user-stats.ts',
    description: 'Restore user stats from firebase-user-data backups',
    requiresConfirmation: true,
    tier: 'critical'
  },
  'mark-users-verified': {
    file: 'mark-existing-users-verified.ts',
    description: 'Mark all existing users as email verified',
    requiresConfirmation: true,
    tier: 'critical'
  },
  'delete-test-users': {
    file: 'delete-test-users.ts',
    description: 'Delete all 10 test users',
    requiresConfirmation: true,
    tier: 'high'
  },
  'create-test-users': {
    file: 'create-test-users.ts',
    description: 'Create 10 test users with varied stats',
    requiresConfirmation: false,
    tier: 'high'
  },
  'verify-test-users': {
    file: 'verify-test-users.ts',
    description: 'Verify test user setup',
    requiresConfirmation: false,
    tier: 'high'
  },
  'migrate-leaderboard': {
    file: 'migrate-leaderboard-stats.ts',
    description: 'Migrate/refresh leaderboard stats',
    requiresConfirmation: true,
    tier: 'medium'
  },
  'gen-entitlements': {
    file: 'gen-entitlements.ts',
    description: 'Regenerate feature entitlements',
    requiresConfirmation: false,
    tier: 'medium'
  },
  'check-firebase': {
    file: 'check-firebase-collections.ts',
    description: 'Check Firebase collection health',
    requiresConfirmation: false,
    tier: 'medium'
  },
  'check-transcripts': {
    file: 'check-transcripts.ts',
    description: 'Check video transcript processing',
    requiresConfirmation: false,
    tier: 'low'
  },
  'check-video-processing': {
    file: 'check-video-processing.ts',
    description: 'Check video processing status (requires videoId)',
    requiresConfirmation: false,
    tier: 'low',
    requiresParams: true
  }
} as const;

type ScriptId = keyof typeof AVAILABLE_SCRIPTS;

/**
 * POST /api/admin/scripts/run
 * Execute an admin script
 */
export const POST = withAdminAuth(async (
  request: NextRequest,
  context: any
) => {
  try {
    const body = await request.json();
    const { scriptId, params } = body;

    if (!scriptId || !(scriptId in AVAILABLE_SCRIPTS)) {
      return NextResponse.json(
        { error: 'Invalid script ID' },
        { status: 400 }
      );
    }

    const script = AVAILABLE_SCRIPTS[scriptId as ScriptId];
    const scriptPath = path.join(process.cwd(), 'scripts', script.file);

    // Build command arguments
    const args: string[] = [];
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          args.push(`--${key}`, String(value));
        }
      });
    }

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      // Execute script using npx tsx
      const childProcess = spawn('npx', ['tsx', scriptPath, ...args], {
        cwd: process.cwd(),
        env: { ...process.env }
      });

      // Collect stdout
      childProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Collect stderr
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Handle completion
      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve(NextResponse.json({
            success: true,
            scriptId,
            output,
            executedBy: context?.user?.uid || 'unknown',
            executedAt: new Date().toISOString()
          }));
        } else {
          resolve(NextResponse.json({
            success: false,
            scriptId,
            output,
            error: errorOutput || `Script exited with code ${code}`,
            executedBy: context?.user?.uid || 'unknown',
            executedAt: new Date().toISOString()
          }, { status: 500 }));
        }
      });

      // Handle errors
      childProcess.on('error', (error) => {
        resolve(NextResponse.json({
          success: false,
          scriptId,
          error: error.message,
          executedBy: context?.user?.uid || 'unknown',
          executedAt: new Date().toISOString()
        }, { status: 500 }));
      });
    });

  } catch (error) {
    console.error('Error executing script:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute script',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/admin/scripts/run
 * Get list of available scripts
 */
export const GET = withAdminAuth(async (
  request: NextRequest,
  context: any
) => {
  const scripts = Object.entries(AVAILABLE_SCRIPTS).map(([id, script]) => ({
    id,
    ...script
  }));

  return NextResponse.json({
    scripts,
    count: scripts.length
  });
});
