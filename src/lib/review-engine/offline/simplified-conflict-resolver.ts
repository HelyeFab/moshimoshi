/**
 * Simplified Conflict Resolution for Offline Sync
 * Implements last-write-wins strategy with clear, predictable behavior
 */

import { ReviewSession, SessionStatistics } from '../core/session.types';
import { ProgressData } from '../progress/progress-tracker';

export interface ConflictResolution<T> {
  resolved: T;
  conflictCount: number;
  strategy: 'last-write-wins';
  winner: 'local' | 'remote';
  timestamp: number;
}

export class SimplifiedConflictResolver {
  /**
   * Resolve session conflicts using last-write-wins
   */
  resolveSessionConflict(
    local: ReviewSession,
    remote: ReviewSession
  ): ConflictResolution<ReviewSession> {
    const localTime = local.lastActivityAt || 0;
    const remoteTime = remote.lastActivityAt || 0;
    const winner = remoteTime > localTime ? 'remote' : 'local';
    
    return {
      resolved: winner === 'remote' ? remote : local,
      conflictCount: this.countDifferences(local, remote),
      strategy: 'last-write-wins',
      winner,
      timestamp: Date.now()
    };
  }
  
  /**
   * Resolve progress conflicts using last-write-wins
   */
  resolveProgressConflict(
    local: ProgressData,
    remote: ProgressData
  ): ConflictResolution<ProgressData> {
    const localTime = local.lastReviewed || 0;
    const remoteTime = remote.lastReviewed || 0;
    const winner = remoteTime > localTime ? 'remote' : 'local';
    
    return {
      resolved: winner === 'remote' ? remote : local,
      conflictCount: this.countDifferences(local, remote),
      strategy: 'last-write-wins',
      winner,
      timestamp: Date.now()
    };
  }
  
  /**
   * Resolve statistics conflicts using last-write-wins
   * For statistics, we take the one with more completed items (more activity)
   */
  resolveStatisticsConflict(
    local: SessionStatistics,
    remote: SessionStatistics
  ): ConflictResolution<SessionStatistics> {
    const winner = remote.completedItems > local.completedItems ? 'remote' : 'local';
    
    return {
      resolved: winner === 'remote' ? remote : local,
      conflictCount: this.countDifferences(local, remote),
      strategy: 'last-write-wins',
      winner,
      timestamp: Date.now()
    };
  }
  
  /**
   * Batch resolve multiple items
   */
  resolveBatch<T extends { id?: string; lastModified?: number }>(
    localItems: T[],
    remoteItems: T[]
  ): T[] {
    const itemMap = new Map<string, T>();
    
    // Add all local items
    for (const item of localItems) {
      if (item.id) {
        itemMap.set(item.id, item);
      }
    }
    
    // Override with remote items if they're newer
    for (const remoteItem of remoteItems) {
      if (!remoteItem.id) continue;
      
      const localItem = itemMap.get(remoteItem.id);
      if (!localItem) {
        itemMap.set(remoteItem.id, remoteItem);
      } else {
        const localTime = localItem.lastModified || 0;
        const remoteTime = remoteItem.lastModified || 0;
        
        if (remoteTime > localTime) {
          itemMap.set(remoteItem.id, remoteItem);
        }
      }
    }
    
    return Array.from(itemMap.values());
  }
  
  /**
   * Count differences between two objects (for metrics)
   */
  private countDifferences(obj1: any, obj2: any): number {
    let count = 0;
    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    
    for (const key of keys) {
      if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        count++;
      }
    }
    
    return count;
  }
}

/**
 * Singleton instance
 */
export const conflictResolver = new SimplifiedConflictResolver();