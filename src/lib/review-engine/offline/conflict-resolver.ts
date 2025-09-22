// Conflict Resolution for Offline Sync

import { ReviewSession, SessionStatistics } from '../core/session.types';
import { ProgressData } from '../progress/progress-tracker';

export type ConflictResolutionStrategy = 'last-write-wins' | 'merge' | 'client-wins' | 'server-wins';

export interface ConflictResolution<T> {
  resolved: T;
  conflicts: ConflictDetail[];
  strategy: ConflictResolutionStrategy;
}

export interface ConflictDetail {
  field: string;
  localValue: any;
  remoteValue: any;
  resolvedValue: any;
  reason: string;
}

export class ConflictResolver {
  private strategy: ConflictResolutionStrategy;
  
  constructor(strategy: ConflictResolutionStrategy = 'merge') {
    this.strategy = strategy;
  }
  
  resolveSessionConflict(
    local: ReviewSession,
    remote: ReviewSession
  ): ConflictResolution<ReviewSession> {
    const conflicts: ConflictDetail[] = [];
    let resolved: ReviewSession;
    
    switch (this.strategy) {
      case 'last-write-wins':
        resolved = this.lastWriteWinsSession(local, remote, conflicts);
        break;
        
      case 'merge':
        resolved = this.mergeSession(local, remote, conflicts);
        break;
        
      case 'client-wins':
        resolved = local;
        this.recordConflicts(local, remote, conflicts);
        break;
        
      case 'server-wins':
        resolved = remote;
        this.recordConflicts(local, remote, conflicts);
        break;
        
      default:
        resolved = this.mergeSession(local, remote, conflicts);
    }
    
    return {
      resolved,
      conflicts,
      strategy: this.strategy
    };
  }
  
  private lastWriteWinsSession(
    local: ReviewSession,
    remote: ReviewSession,
    conflicts: ConflictDetail[]
  ): ReviewSession {
    // Compare last activity timestamps
    const useRemote = remote.lastActivityAt > local.lastActivityAt;
    
    if (useRemote) {
      conflicts.push({
        field: 'session',
        localValue: local.lastActivityAt,
        remoteValue: remote.lastActivityAt,
        resolvedValue: remote.lastActivityAt,
        reason: 'Remote session is newer'
      });
      return remote;
    } else {
      conflicts.push({
        field: 'session',
        localValue: local.lastActivityAt,
        remoteValue: remote.lastActivityAt,
        resolvedValue: local.lastActivityAt,
        reason: 'Local session is newer'
      });
      return local;
    }
  }
  
  private mergeSession(
    local: ReviewSession,
    remote: ReviewSession,
    conflicts: ConflictDetail[]
  ): ReviewSession {
    const merged: ReviewSession = { ...local };
    
    // Use the most recent activity timestamp
    if (remote.lastActivityAt > local.lastActivityAt) {
      merged.lastActivityAt = remote.lastActivityAt;
      conflicts.push({
        field: 'lastActivityAt',
        localValue: local.lastActivityAt,
        remoteValue: remote.lastActivityAt,
        resolvedValue: merged.lastActivityAt,
        reason: 'Using more recent activity timestamp'
      });
    }
    
    // Merge status - prefer active/completed over paused/abandoned
    const statusPriority: Record<string, number> = {
      'completed': 4,
      'active': 3,
      'paused': 2,
      'abandoned': 1
    };
    
    if (statusPriority[remote.status] > statusPriority[local.status]) {
      merged.status = remote.status;
      conflicts.push({
        field: 'status',
        localValue: local.status,
        remoteValue: remote.status,
        resolvedValue: merged.status,
        reason: 'Using higher priority status'
      });
    }
    
    // Merge current index - use the higher value (more progress)
    if (remote.currentIndex > local.currentIndex) {
      merged.currentIndex = remote.currentIndex;
      conflicts.push({
        field: 'currentIndex',
        localValue: local.currentIndex,
        remoteValue: remote.currentIndex,
        resolvedValue: merged.currentIndex,
        reason: 'Using higher progress index'
      });
    }
    
    // Merge items - combine attempts and preserve progress
    merged.items = this.mergeSessionItems(local.items, remote.items, conflicts);
    
    // Merge statistics if present
    if (local.stats && remote.stats) {
      merged.stats = this.mergeStatistics(local.stats, remote.stats, conflicts);
    } else if (remote.stats) {
      merged.stats = remote.stats;
    }
    
    // Use the most recent completion time
    if (remote.endedAt && local.endedAt) {
      merged.endedAt = new Date(Math.max(remote.endedAt.getTime(), local.endedAt.getTime()));
    } else if (remote.endedAt) {
      merged.endedAt = remote.endedAt;
    }
    
    return merged;
  }
  
  private mergeSessionItems(
    localItems: any[],
    remoteItems: any[],
    conflicts: ConflictDetail[]
  ): any[] {
    const itemMap = new Map<string, any>();
    
    // Add all local items
    for (const item of localItems) {
      itemMap.set(item.content.id, item);
    }
    
    // Merge remote items
    for (const remoteItem of remoteItems) {
      const localItem = itemMap.get(remoteItem.content.id);
      
      if (localItem) {
        // Merge the items
        const merged = {
          ...localItem,
          attempts: [...localItem.attempts, ...remoteItem.attempts],
          hintsUsed: Math.max(localItem.hintsUsed, remoteItem.hintsUsed),
          skipped: localItem.skipped || remoteItem.skipped,
          endedAt: localItem.endedAt || remoteItem.endedAt
        };
        
        // Remove duplicate attempts based on timestamp
        const uniqueAttempts = new Map();
        for (const attempt of merged.attempts) {
          uniqueAttempts.set(attempt.timestamp, attempt);
        }
        merged.attempts = Array.from(uniqueAttempts.values());
        
        itemMap.set(remoteItem.content.id, merged);
        
        if (localItem.attempts.length !== remoteItem.attempts.length) {
          conflicts.push({
            field: `item-${remoteItem.content.id}`,
            localValue: localItem.attempts.length,
            remoteValue: remoteItem.attempts.length,
            resolvedValue: merged.attempts.length,
            reason: 'Merged attempts from both sources'
          });
        }
      } else {
        // Add remote item if not in local
        itemMap.set(remoteItem.content.id, remoteItem);
      }
    }
    
    return Array.from(itemMap.values());
  }
  
  private mergeStatistics(
    local: SessionStatistics,
    remote: SessionStatistics,
    conflicts: ConflictDetail[]
  ): SessionStatistics {
    const merged: SessionStatistics = { ...local };
    
    // Take maximum values for cumulative statistics
    const maxFields: (keyof SessionStatistics)[] = [
      'completedItems',
      'correctItems',
      'totalItems',
      'totalHintsUsed',
      'bestStreak'
    ];
    
    for (const field of maxFields) {
      const localValue = local[field] as number;
      const remoteValue = remote[field] as number;
      
      if (remoteValue > localValue) {
        (merged[field] as number) = remoteValue;
        conflicts.push({
          field: `statistics.${field}`,
          localValue,
          remoteValue,
          resolvedValue: remoteValue,
          reason: 'Using maximum value'
        });
      }
    }
    
    // Average the averages (weighted by number of items)
    if (remote.completedItems > 0) {
      const totalItems = local.completedItems + remote.completedItems;
      merged.averageResponseTime = 
        (local.averageResponseTime * local.completedItems + 
         remote.averageResponseTime * remote.completedItems) / totalItems;
    }
    
    // Recalculate accuracy
    if (merged.completedItems > 0) {
      merged.accuracy = (merged.correctItems / merged.completedItems) * 100;
    }
    
    // Use longer total time
    merged.totalTime = Math.max(local.totalTime, remote.totalTime);
    
    return merged;
  }
  
  resolveProgressConflict(
    local: ProgressData,
    remote: ProgressData
  ): ConflictResolution<ProgressData> {
    const conflicts: ConflictDetail[] = [];
    let resolved: ProgressData;
    
    switch (this.strategy) {
      case 'last-write-wins':
        resolved = this.lastWriteWinsProgress(local, remote, conflicts);
        break;
        
      case 'merge':
        resolved = this.mergeProgress(local, remote, conflicts);
        break;
        
      case 'client-wins':
        resolved = local;
        this.recordProgressConflicts(local, remote, conflicts);
        break;
        
      case 'server-wins':
        resolved = remote;
        this.recordProgressConflicts(local, remote, conflicts);
        break;
        
      default:
        resolved = this.mergeProgress(local, remote, conflicts);
    }
    
    return {
      resolved,
      conflicts,
      strategy: this.strategy
    };
  }
  
  private lastWriteWinsProgress(
    local: ProgressData,
    remote: ProgressData,
    conflicts: ConflictDetail[]
  ): ProgressData {
    const useRemote = remote.lastReviewed > local.lastReviewed;
    
    if (useRemote) {
      conflicts.push({
        field: 'progress',
        localValue: local.lastReviewed,
        remoteValue: remote.lastReviewed,
        resolvedValue: remote.lastReviewed,
        reason: 'Remote progress is newer'
      });
      return remote;
    } else {
      conflicts.push({
        field: 'progress',
        localValue: local.lastReviewed,
        remoteValue: remote.lastReviewed,
        resolvedValue: local.lastReviewed,
        reason: 'Local progress is newer'
      });
      return local;
    }
  }
  
  private mergeProgress(
    local: ProgressData,
    remote: ProgressData,
    conflicts: ConflictDetail[]
  ): ProgressData {
    const merged: ProgressData = { ...local };
    
    // Take maximum values for cumulative fields
    merged.learned = Math.max(local.learned, remote.learned);
    merged.reviewCount = Math.max(local.reviewCount, remote.reviewCount);
    merged.correctCount = Math.max(local.correctCount, remote.correctCount);
    merged.incorrectCount = Math.max(local.incorrectCount, remote.incorrectCount);
    
    // Use most recent review time
    merged.lastReviewed = Math.max(local.lastReviewed, remote.lastReviewed);
    
    // Use nearest future review time
    if (local.nextReview && remote.nextReview) {
      merged.nextReview = Math.min(local.nextReview, remote.nextReview);
    } else {
      merged.nextReview = local.nextReview || remote.nextReview;
    }
    
    // Use higher SRS level
    if (local.srsLevel !== undefined && remote.srsLevel !== undefined) {
      merged.srsLevel = Math.max(local.srsLevel, remote.srsLevel);
    } else {
      merged.srsLevel = local.srsLevel ?? remote.srsLevel;
    }
    
    // Use higher streak
    if (local.streak !== undefined && remote.streak !== undefined) {
      merged.streak = Math.max(local.streak, remote.streak);
    } else {
      merged.streak = local.streak ?? remote.streak;
    }
    
    // Record conflicts for significant differences
    if (Math.abs(local.reviewCount - remote.reviewCount) > 1) {
      conflicts.push({
        field: 'reviewCount',
        localValue: local.reviewCount,
        remoteValue: remote.reviewCount,
        resolvedValue: merged.reviewCount,
        reason: 'Significant difference in review counts'
      });
    }
    
    return merged;
  }
  
  private recordConflicts(local: any, remote: any, conflicts: ConflictDetail[]): void {
    for (const key in local) {
      if (local[key] !== remote[key]) {
        conflicts.push({
          field: key,
          localValue: local[key],
          remoteValue: remote[key],
          resolvedValue: local[key],
          reason: 'Conflict recorded, using local value'
        });
      }
    }
  }
  
  private recordProgressConflicts(
    local: ProgressData,
    remote: ProgressData,
    conflicts: ConflictDetail[]
  ): void {
    const fields: (keyof ProgressData)[] = [
      'learned', 'reviewCount', 'correctCount', 'incorrectCount',
      'lastReviewed', 'nextReview', 'srsLevel', 'streak'
    ];
    
    for (const field of fields) {
      if (local[field] !== remote[field]) {
        conflicts.push({
          field,
          localValue: local[field],
          remoteValue: remote[field],
          resolvedValue: local[field],
          reason: `Using ${this.strategy === 'client-wins' ? 'local' : 'remote'} value`
        });
      }
    }
  }
  
  setStrategy(strategy: ConflictResolutionStrategy): void {
    this.strategy = strategy;
  }
  
  getStrategy(): ConflictResolutionStrategy {
    return this.strategy;
  }
}