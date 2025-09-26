/**
 * IndexedDB Module Exports
 * Agent 3 - Data & Sync
 *
 * Central export point for all PWA data layer functionality
 */

// Core exports
export { idbClient, IDBClient, type ListsApi } from './client';
export { outboxManager, OutboxManager, queueOp } from './outbox';
export { firebaseSync, FirebaseSyncManager } from './firebase-sync';
export { accountCleanup, AccountCleanupManager } from './account-cleanup';

// Type exports
export * from './types';

// Service Worker sync module (for SW integration)
export { handleSyncOutbox, handlePeriodicSync } from './sync-worker';

// Initialize all managers
export async function initializeDataLayer(userId?: string): Promise<void> {
  console.log('[DataLayer] Initializing...');

  // Initialize account cleanup listeners
  accountCleanup.initialize();

  // Initialize Firebase sync if user is logged in
  if (userId) {
    await firebaseSync.initialize(userId);
  }

  // Set up sync status listener
  outboxManager.onStatusChange((status) => {
    console.log('[DataLayer] Sync status:', status);
  });

  // Set up sync complete listener
  firebaseSync.onSyncComplete((result) => {
    console.log('[DataLayer] Sync complete:', result);
  });

  console.log('[DataLayer] Initialization complete');
}

// Helper function to check if data layer is ready
export async function isDataLayerReady(): Promise<boolean> {
  try {
    // Try to get due count (simple operation)
    const count = await idbClient.getDueCount();
    return typeof count === 'number';
  } catch {
    return false;
  }
}

// Export entitlement check for PWA features
export function canUsePWAFeature(feature: string): boolean {
  // This would integrate with the existing entitlements system
  // For now, return true for basic features
  const basicFeatures = ['indexeddb', 'offline', 'cache'];
  const premiumFeatures = ['periodicSync', 'backgroundSync', 'push'];

  if (basicFeatures.includes(feature)) {
    return true;
  }

  // Check premium features against entitlements
  // This would use the actual entitlements evaluator
  return false;
}