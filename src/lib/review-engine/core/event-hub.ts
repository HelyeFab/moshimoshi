/**
 * Global URE Event Hub
 * Single EventEmitter shared across all features for gamification integration
 *
 * This module provides a singleton EventEmitter that ensures all URE events
 * are properly propagated to the gamification system, regardless of which
 * feature is using SessionManager.
 *
 * CRITICAL: This is the bridge between URE and gamification. All SessionManager
 * instances emit to this global hub, and gamificationListener subscribes to it.
 *
 * @example
 * ```typescript
 * // Initialize once on app mount
 * initializeEventHub(user.uid);
 *
 * // SessionManager automatically emits to hub
 * const manager = new SessionManager(storage, analytics);
 * await manager.completeSession(); // → emits to hub → gamification processes
 * ```
 */

import { ClientEventEmitter } from './client-event-emitter';
import { gamificationListener } from '@/lib/gamification/gamificationListener';

let eventHub: ClientEventEmitter | null = null;
let isInitialized = false;

/**
 * Get or create the global event hub
 *
 * This function returns a singleton ClientEventEmitter that serves as the
 * central event bus for all URE events. It's used by SessionManager to
 * emit events that need to be processed by gamification and other systems.
 *
 * @returns The global ClientEventEmitter instance
 */
export function getEventHub(): ClientEventEmitter {
  if (!eventHub) {
    eventHub = new ClientEventEmitter();
    eventHub.setMaxListeners(50); // Support many concurrent features
    console.log('[EventHub] Created global event hub');
  }
  return eventHub;
}

/**
 * Initialize the event hub with gamification listener
 *
 * This function should be called once when the app mounts (typically in a
 * root layout or app component). It sets up the gamification listener to
 * process URE events.
 *
 * IMPORTANT: Call this before starting any review sessions, otherwise
 * gamification events won't be processed.
 *
 * @param userId - The authenticated user's ID
 *
 * @example
 * ```typescript
 * useEffect(() => {
 *   if (user?.uid) {
 *     initializeEventHub(user.uid);
 *   }
 * }, [user?.uid]);
 * ```
 */
export function initializeEventHub(userId: string): void {
  const hub = getEventHub();

  // Only initialize once per user session
  if (isInitialized) {
    console.log('[EventHub] Already initialized, skipping');
    return;
  }

  // Initialize gamification listener with the hub
  // The gamificationListener will subscribe to SESSION_COMPLETED events
  // and process XP, streaks, and achievements
  gamificationListener.initialize(userId, hub as any);

  isInitialized = true;
  console.log('[EventHub] Initialized for user:', userId);
}

/**
 * Destroy the event hub and cleanup all listeners
 *
 * This function should be called when the user logs out or when the app
 * is unmounting. It ensures proper cleanup of event listeners to prevent
 * memory leaks.
 *
 * After calling this, you must call initializeEventHub() again before
 * starting new sessions.
 *
 * @example
 * ```typescript
 * // On logout
 * useEffect(() => {
 *   return () => {
 *     if (!user) {
 *       destroyEventHub();
 *     }
 *   };
 * }, [user]);
 * ```
 */
export function destroyEventHub(): void {
  if (!eventHub) {
    return;
  }

  console.log('[EventHub] Destroying event hub');

  // Cleanup gamification listener
  gamificationListener.destroy();

  // Remove all event listeners
  eventHub.removeAllListeners();

  // Reset state
  eventHub = null;
  isInitialized = false;

  console.log('[EventHub] Event hub destroyed');
}

/**
 * Check if the event hub is initialized
 *
 * @returns true if initialized, false otherwise
 */
export function isEventHubInitialized(): boolean {
  return isInitialized;
}

/**
 * Get diagnostic information about the event hub
 *
 * Useful for debugging event listener issues or memory leaks.
 *
 * @returns Object containing event hub statistics
 */
export function getEventHubDiagnostics(): {
  isInitialized: boolean;
  listenerCounts: Record<string, number>;
  totalListeners: number;
} {
  if (!eventHub) {
    return {
      isInitialized: false,
      listenerCounts: {},
      totalListeners: 0,
    };
  }

  const eventNames = eventHub.eventNames();
  const listenerCounts: Record<string, number> = {};
  let totalListeners = 0;

  for (const eventName of eventNames) {
    const count = eventHub.listenerCount(eventName);
    listenerCounts[eventName] = count;
    totalListeners += count;
  }

  return {
    isInitialized,
    listenerCounts,
    totalListeners,
  };
}
