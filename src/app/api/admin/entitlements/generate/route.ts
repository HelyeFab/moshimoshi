import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if adminDb is initialized
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // Check if user is admin
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();

    if (!userData?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    console.log('[Admin] Generating entitlements types...');

    // Run the generation script
    const projectRoot = path.resolve(process.cwd());
    const scriptPath = path.join(projectRoot, 'scripts', 'gen-entitlements.ts');

    try {
      // Try with tsx first (most common)
      const { stdout, stderr } = await execAsync(`npx tsx ${scriptPath}`, {
        cwd: projectRoot
      });

      console.log('[Admin] Generation output:', stdout);
      if (stderr) {
        console.error('[Admin] Generation warnings:', stderr);
      }

      // Log the admin action
      await adminDb.collection('admin_logs').add({
        action: 'entitlements_generated',
        adminUid: session.uid,
        adminEmail: session.email,
        timestamp: new Date(),
        details: {
          stdout: stdout.substring(0, 1000), // Limit log size
          stderr: stderr ? stderr.substring(0, 1000) : null
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Entitlements types generated successfully',
        output: stdout,
        warnings: stderr || null
      });

    } catch (scriptError: any) {
      console.error('[Admin] Script execution failed:', scriptError);

      // If tsx fails, try with ts-node
      if (scriptError.message.includes('tsx')) {
        try {
          const { stdout, stderr } = await execAsync(`npx ts-node ${scriptPath}`, {
            cwd: projectRoot
          });

          return NextResponse.json({
            success: true,
            message: 'Entitlements types generated successfully (using ts-node)',
            output: stdout,
            warnings: stderr || null
          });
        } catch (tsNodeError: any) {
          console.error('[Admin] ts-node also failed:', tsNodeError);
        }
      }

      // If both fail, try with node directly (assuming it's compiled)
      try {
        const compiledPath = scriptPath.replace('.ts', '.js');
        const { stdout, stderr } = await execAsync(`node ${compiledPath}`, {
          cwd: projectRoot
        });

        return NextResponse.json({
          success: true,
          message: 'Entitlements types generated successfully (using compiled JS)',
          output: stdout,
          warnings: stderr || null
        });
      } catch (nodeError: any) {
        console.error('[Admin] Node execution also failed:', nodeError);

        return NextResponse.json({
          error: 'Failed to execute generation script',
          details: scriptError.message
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('[Admin] Entitlements generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate entitlements',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}