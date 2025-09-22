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

    // Read the configuration file
    const configPath = path.join(process.cwd(), 'config', 'features.v1.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Process and format the configuration for the UI
    const processedConfig = {
      version: config.version,
      lastUpdated: config.lastUpdated,
      plans: config.plans,
      features: config.features.map((feature: any) => ({
        id: feature.id,
        name: feature.name,
        category: feature.category,
        limitType: feature.limitType,
        description: feature.description,
        metadata: feature.metadata
      })),
      limits: config.limits,
      metadata: config.metadata
    };

    return NextResponse.json(processedConfig, { status: 200 });
  } catch (error) {
    console.error('Error fetching configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}