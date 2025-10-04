/**
 * Scheduled Leaderboard Functions
 *
 * Placeholder stubs for leaderboard snapshot updates.
 * TODO: Implement actual leaderboard snapshot logic when needed.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';

/**
 * Scheduled function to update leaderboard snapshots
 * Runs daily to maintain leaderboard rankings
 */
export const updateLeaderboardSnapshots = onSchedule({
  schedule: 'every 24 hours',
  timeZone: 'UTC',
  region: 'europe-west1',
}, async (event) => {
  console.log('Leaderboard snapshot update triggered (placeholder)');
  // TODO: Implement snapshot logic
});

/**
 * Callable function to manually trigger leaderboard update
 * For admin use
 */
export const updateLeaderboardManually = onCall({
  region: 'europe-west1',
}, async (request) => {
  console.log('Manual leaderboard update requested (placeholder)');
  // TODO: Implement manual update logic
  return { success: true, message: 'Placeholder - not implemented' };
});
