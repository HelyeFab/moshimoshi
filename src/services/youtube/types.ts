/**
 * YouTube History Types
 * For tracking full video metadata (premium feature)
 */

export interface YouTubeVideoItem {
  id: string; // Composite key: userId_videoId for Firebase, just videoId for IndexedDB
  videoId: string; // YouTube video ID
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl?: string;
  channelName?: string;
  channelId?: string;
  lastWatched: Date;
  firstWatched: Date;
  watchCount: number;
  totalWatchTime?: number; // in seconds
  duration?: number; // video duration in seconds
  metadata?: {
    description?: string;
    publishedAt?: string;
    viewCount?: number;
    likeCount?: number;
  };
  personalNotes?: string; // User's personal notes about the video
}

export interface YouTubeHistoryStorage {
  init(): Promise<void>;
  addOrUpdateVideo(video: YouTubeVideoItem): Promise<void>;
  getVideo(videoId: string): Promise<YouTubeVideoItem | null>;
  getAllVideos(): Promise<YouTubeVideoItem[]>;
  deleteVideo(videoId: string): Promise<void>;
  clearAll(): Promise<void>;
  getRecentVideos(limit: number): Promise<YouTubeVideoItem[]>;
  searchVideos(query: string): Promise<YouTubeVideoItem[]>;
}