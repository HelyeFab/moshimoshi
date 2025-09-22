import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { validateSession } from '@/lib/auth/session';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized();

    // Validate admin session (same as other admin routes)
    const session = await validateSession(request);
    if (!session.valid || !session.payload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin from Firebase
    const userDoc = await adminFirestore!.collection('users').doc(session.payload.uid).get();
    const userData = userDoc?.data();
    if (!userData?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Read from the GENERATED TypeScript files
    let featureIds: string[] = [];
    let planTypes: string[] = [];
    let limits: Record<string, Record<string, number>> = {};

    try {
      // Read FeatureId from the generated file
      const featureIdPath = path.join(process.cwd(), 'src', 'types', 'FeatureId.ts');
      const featureIdContent = await fs.readFile(featureIdPath, 'utf-8');

      // Parse FeatureId type
      const featureIdMatch = featureIdContent.match(/export type FeatureId = ([^;]+);/);
      if (featureIdMatch) {
        featureIds = featureIdMatch[1]
          .split('|')
          .map(s => s.trim().replace(/['"]/g, ''));
      } else {
        console.warn('Could not find FeatureId type definition in FeatureId.ts');
      }

      // Read PlanType from entitlements.ts
      const entitlementsPath = path.join(process.cwd(), 'src', 'types', 'entitlements.ts');
      const entitlementsContent = await fs.readFile(entitlementsPath, 'utf-8');
      const planTypeMatch = entitlementsContent.match(/export type PlanType = ([^;]+);/);
      if (planTypeMatch) {
        planTypes = planTypeMatch[1]
          .split('|')
          .map(s => s.trim().replace(/['"]/g, ''));
      }

      // Try to read the evaluator file for actual limits
      const evaluatorPath = path.join(process.cwd(), 'src', 'lib', 'entitlements', 'evaluator.ts');
      try {
        const evaluatorContent = await fs.readFile(evaluatorPath, 'utf-8');

        // Extract LIMITS constant
        const limitsMatch = evaluatorContent.match(/const LIMITS[^=]*=\s*featuresConfig\.limits[^;]*/);
        if (limitsMatch) {
          // Get the actual limits from the imported config
          const configPath = path.join(process.cwd(), 'config', 'features.v1.json');
          const configContent = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(configContent);
          limits = config.limits;
        }
      } catch (e) {
        console.warn('Could not read evaluator file:', e);
      }
    } catch (error) {
      console.warn('Could not read types files:', error);
    }

    const codeData = {
      featureIds,
      planTypes,
      limits,
      sourceFiles: [
        'src/types/FeatureId.ts (generated)',
        'src/types/entitlements.ts'
      ],
      lastModified: featureIds.length > 0 ? new Date().toISOString() : null
    };

    return NextResponse.json(codeData, { status: 200 });
  } catch (error) {
    console.error('Error fetching TypeScript types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TypeScript types', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}