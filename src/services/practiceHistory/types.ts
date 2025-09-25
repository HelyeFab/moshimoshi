export interface PracticeHistoryItem {
  id: string; // Composite key: userId_videoId for Firebase, just videoId for IndexedDB
  videoUrl: string;
  videoTitle: string;
  videoId: string; // YouTube video ID
  thumbnailUrl?: string;
  channelName?: string;
  lastPracticed: Date;
  firstPracticed: Date;
  practiceCount: number;
  totalPracticeTime?: number; // in seconds
  duration?: number; // video duration in seconds
  contentType: 'youtube' | 'audio' | 'video';
  metadata?: {
    channelTitle?: string;
    description?: string;
    publishedAt?: string;
  };
}

export interface PracticeSession {
  videoId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
}

export interface PracticeHistoryStorage {
  init(): Promise<void>;
  addOrUpdateItem(item: PracticeHistoryItem): Promise<void>;
  getItem(videoId: string): Promise<PracticeHistoryItem | null>;
  getAllItems(): Promise<PracticeHistoryItem[]>;
  deleteItem(videoId: string): Promise<void>;
  clearAll(): Promise<void>;
  getItemsByDateRange(startDate: Date, endDate: Date): Promise<PracticeHistoryItem[]>;
  getMostPracticed(limit: number): Promise<PracticeHistoryItem[]>;
}