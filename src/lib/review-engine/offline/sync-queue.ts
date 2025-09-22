// Sync Queue Management for Offline-First Functionality

import { IndexedDBStorage } from './indexed-db';
import { ReviewSession, SessionStatistics } from '../core/session.types';
import { ProgressData } from '../progress/progress-tracker';
import { reviewLogger } from '@/lib/monitoring/logger';

export interface SyncQueueItem {
  id?: number;
  type: 'session' | 'answer' | 'statistics' | 'progress';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface ReviewAPIClient {
  createSession(session: Partial<ReviewSession>): Promise<ReviewSession>;
  updateSession(id: string, updates: Partial<ReviewSession>): Promise<ReviewSession>;
  submitAnswer(data: any): Promise<any>;
  saveStatistics(statistics: SessionStatistics): Promise<void>;
  updateProgress(progress: ProgressData): Promise<void>;
}

export class SyncQueue {
  private queue: SyncQueueItem[] = [];
  private isProcessing = false;
  private syncInterval: number | null = null;
  private onlineListener?: () => void;
  private offlineListener?: () => void;
  private maxRetries = 3;
  private baseRetryDelay = 1000; // Base delay in ms for exponential backoff
  
  constructor(
    private storage: IndexedDBStorage,
    private apiClient: ReviewAPIClient
  ) {
    this.loadQueue();
    this.setupNetworkListeners();
  }
  
  private async loadQueue(): Promise<void> {
    try {
      const allItems = await this.storage.getSyncQueue();
      const pendingItems = allItems.filter(item => item.status === 'pending');
      const syncingItems = allItems.filter(item => item.status === 'syncing');
      
      // Reset syncing items to pending (they were interrupted)
      for (const item of syncingItems) {
        item.status = 'pending';
        if (item.id) {
          await this.storage.updateSyncQueueItem(item.id, { status: 'pending' });
        }
      }
      
      this.queue = [...pendingItems, ...syncingItems].sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      reviewLogger.error('Failed to load sync queue:', error);
    }
  }
  
  private setupNetworkListeners(): void {
    this.onlineListener = () => {
      reviewLogger.info('Network connection restored, processing sync queue...');
      this.process();
    };
    
    this.offlineListener = () => {
      reviewLogger.info('Network connection lost, pausing sync queue...');
      this.pause();
    };
    
    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);
  }
  
  async add(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };
    
    try {
      // Generate a temporary id for queue management
      queueItem.id = Date.now() + Math.random();
      // Save to IndexedDB
      await this.storage.addToSyncQueue(queueItem);
      
      // Add to memory queue
      this.queue.push(queueItem);
      
      // Try to sync immediately if online
      if (navigator.onLine && !this.isProcessing) {
        this.process();
      }
    } catch (error) {
      reviewLogger.error('Failed to add item to sync queue:', error);
    }
  }
  
  async process(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && navigator.onLine) {
      const item = this.queue[0];
      
      try {
        // Update status to syncing
        item.status = 'syncing';
        if (item.id) {
          await this.storage.updateSyncQueueItem(item.id, { status: 'syncing' });
        }
        
        // Attempt to sync the item
        await this.syncItem(item);
        
        // Mark as completed
        item.status = 'completed';
        if (item.id) {
          await this.storage.updateSyncQueueItem(item.id, { status: 'completed' });
        }
        
        // Remove from queue and storage
        this.queue.shift();
        if (item.id) {
          await this.storage.removeSyncQueueItem(item.id);
        }
        
        reviewLogger.info(`Successfully synced ${item.type} item`);
      } catch (error: any) {
        reviewLogger.error(`Failed to sync ${item.type} item:`, error);
        
        item.retryCount++;
        item.status = 'failed';
        item.error = error.message || 'Unknown error';
        
        if (item.retryCount >= this.maxRetries) {
          // Move to dead letter queue
          reviewLogger.error(`Moving ${item.type} item to dead letter queue after ${this.maxRetries} retries`);
          await this.moveToDeadLetter(item);
          this.queue.shift();
        } else {
          // Update status and move to end of queue for retry
          if (item.id) {
            await this.storage.updateSyncQueueItem(item.id, { 
              retryCount: item.retryCount,
              error: item.error,
              status: item.status 
            });
          }
          this.queue.push(this.queue.shift()!);
          
          // Wait before retrying (exponential backoff)
          const delay = this.baseRetryDelay * Math.pow(2, item.retryCount - 1);
          await this.delay(delay);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async syncItem(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'session':
        if (item.action === 'create') {
          await this.apiClient.createSession(item.data);
        } else if (item.action === 'update') {
          await this.apiClient.updateSession(item.data.id, item.data);
        }
        break;
        
      case 'answer':
        await this.apiClient.submitAnswer(item.data);
        break;
        
      case 'statistics':
        await this.apiClient.saveStatistics(item.data);
        break;
        
      case 'progress':
        await this.apiClient.updateProgress(item.data);
        break;
        
      default:
        throw new Error(`Unknown sync item type: ${item.type}`);
    }
  }
  
  private async moveToDeadLetter(item: SyncQueueItem): Promise<void> {
    try {
      await this.storage.moveToDeadLetter(item);
    } catch (error) {
      reviewLogger.error('Failed to move item to dead letter queue:', error);
    }
  }
  
  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) return;
    
    reviewLogger.info(`Starting auto-sync with interval: ${intervalMs}ms`);
    
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.isProcessing) {
        this.process();
      }
    }, intervalMs);
    
    // Process immediately if online
    if (navigator.onLine) {
      this.process();
    }
  }
  
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      reviewLogger.info('Auto-sync stopped');
    }
  }
  
  pause(): void {
    this.isProcessing = false;
  }
  
  async getQueueStatus(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    total: number;
  }> {
    const pending = this.queue.filter(item => item.status === 'pending').length;
    const syncing = this.queue.filter(item => item.status === 'syncing').length;
    const failed = this.queue.filter(item => item.status === 'failed').length;
    
    return {
      pending,
      syncing,
      failed,
      total: this.queue.length
    };
  }
  
  async retry(itemId: number): Promise<void> {
    const item = this.queue.find(i => i.id === itemId);
    if (item) {
      item.retryCount = 0;
      item.status = 'pending';
      item.error = undefined;
      if (item.id) {
        await this.storage.updateSyncQueueItem(item.id, { error: undefined });
      }
      
      if (navigator.onLine && !this.isProcessing) {
        this.process();
      }
    }
  }
  
  async retryAll(): Promise<void> {
    for (const item of this.queue) {
      if (item.status === 'failed') {
        item.retryCount = 0;
        item.status = 'pending';
        item.error = undefined;
        if (item.id) {
          await this.storage.updateSyncQueueItem(item.id, { error: undefined });
        }
      }
    }
    
    if (navigator.onLine && !this.isProcessing) {
      this.process();
    }
  }
  
  async clear(): Promise<void> {
    // Clear from storage
    for (const item of this.queue) {
      if (item.id) {
        await this.storage.removeSyncQueueItem(item.id);
      }
    }
    
    // Clear memory queue
    this.queue = [];
  }
  
  cleanup(): void {
    this.stopAutoSync();
    
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
    }
    
    if (this.offlineListener) {
      window.removeEventListener('offline', this.offlineListener);
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}