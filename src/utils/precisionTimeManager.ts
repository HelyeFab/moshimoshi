/**
 * Precision Time Manager for High-Fidelity YouTube Shadowing
 * Provides frame-accurate synchronization and timing utilities
 */

export interface TimeSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface ABRepeatConfig {
  startTime: number;
  endTime: number;
  currentRepeat: number;
  totalRepeats: number;
  pauseDuration: number; // milliseconds between repeats
  isActive: boolean;
}

export class PrecisionTimeManager {
  private frameRate = 60; // Target 60fps for smooth playback
  private frameInterval = 1000 / this.frameRate; // ~16.67ms per frame
  private lastSyncTime = 0;
  private syncCallbacks: Set<(time: number) => void> = new Set();
  private animationFrameId: number | null = null;
  private playerGetTime: (() => number) | null = null;
  
  // Precision thresholds
  private readonly SYNC_THRESHOLD = 0.05; // 50ms accuracy threshold
  private readonly SEEK_PRECISION = 0.001; // 1ms seek precision
  private readonly PRELOAD_BUFFER = 2; // Preload 2 seconds ahead
  
  constructor() {
    this.startSync = this.startSync.bind(this);
    this.stopSync = this.stopSync.bind(this);
    this.syncLoop = this.syncLoop.bind(this);
  }
  
  /**
   * Set the player's getCurrentTime function
   */
  setPlayer(getTimeFunc: () => number): void {
    this.playerGetTime = getTimeFunc;
  }
  
  /**
   * Start high-precision time synchronization
   */
  startSync(): void {
    if (this.animationFrameId !== null) return;
    console.log('[TIME-MANAGER] Starting sync loop');
    this.syncLoop();
  }
  
  /**
   * Stop synchronization
   */
  stopSync(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Main synchronization loop using requestAnimationFrame for precision
   */
  private syncLoop(): void {
    if (!this.playerGetTime) {
      this.animationFrameId = requestAnimationFrame(this.syncLoop);
      return;
    }
    
    const currentTime = this.playerGetTime();
    
    // Log every second for debugging
    if (Math.floor(currentTime) !== Math.floor(this.lastSyncTime)) {
      console.log(`[TIME-MANAGER] Current time: ${currentTime.toFixed(2)}`);
    }
    
    // Only trigger callbacks if time changed significantly (avoid micro-updates)
    if (Math.abs(currentTime - this.lastSyncTime) >= this.SEEK_PRECISION) {
      this.lastSyncTime = currentTime;
      this.syncCallbacks.forEach(callback => callback(currentTime));
    }
    
    this.animationFrameId = requestAnimationFrame(this.syncLoop);
  }
  
  /**
   * Register a callback for time updates
   */
  onTimeUpdate(callback: (time: number) => void): () => void {
    this.syncCallbacks.add(callback);
    return () => this.syncCallbacks.delete(callback);
  }
  
  /**
   * Find the active segment for a given time with precision
   */
  findActiveSegment(segments: TimeSegment[], currentTime: number): TimeSegment | null {
    // Binary search for performance with large transcript arrays
    let left = 0;
    let right = segments.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const segment = segments[mid];
      
      // Account for floating-point precision
      const startDiff = currentTime - segment.startTime;
      const endDiff = segment.endTime - currentTime;
      
      if (startDiff >= -this.SEEK_PRECISION && endDiff >= -this.SEEK_PRECISION) {
        return segment;
      }
      
      if (currentTime < segment.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    return null;
  }
  
  /**
   * Calculate precise seek time for A/B repeat
   */
  calculateRepeatSeek(config: ABRepeatConfig): number {
    // Add tiny offset to ensure we're within the segment
    return config.startTime + this.SEEK_PRECISION;
  }
  
  /**
   * Check if current time reached segment end (with precision tolerance)
   */
  isSegmentComplete(currentTime: number, endTime: number): boolean {
    const result = currentTime >= (endTime - this.SYNC_THRESHOLD);
    if (result) {
      console.log(`[TIME-MANAGER] Segment complete check: current=${currentTime.toFixed(3)}, end=${endTime.toFixed(3)}, threshold=${this.SYNC_THRESHOLD}, COMPLETE=${result}`);
    }
    return result;
  }
  
  /**
   * Get segments that should be preloaded
   */
  getPreloadSegments(
    segments: TimeSegment[], 
    currentIndex: number, 
    preloadCount = 3
  ): TimeSegment[] {
    const start = Math.max(0, currentIndex - 1);
    const end = Math.min(segments.length, currentIndex + preloadCount);
    return segments.slice(start, end);
  }
  
  /**
   * Format time for display (mm:ss.ms)
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopSync();
    this.syncCallbacks.clear();
    this.playerGetTime = null;
  }
}

// Singleton instance for global time management
export const timeManager = new PrecisionTimeManager();