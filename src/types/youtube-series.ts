import { Timestamp } from 'firebase/firestore';

/**
 * YouTube Series Types
 * For managing curated YouTube channels and series for Japanese learning
 */

export interface YouTubeChannel {
  id: string;
  channelId: string; // YouTube channel ID
  channelTitle: string;
  channelUrl: string;

  // Channel metadata from YouTube API
  thumbnailUrl?: string;
  bannerUrl?: string;
  description?: string;
  customUrl?: string;
  country?: string;
  publishedAt?: string;

  // Channel statistics
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number; // Total channel views

  // Source tracking (if added via video URL)
  sourceVideoUrl?: string;
  sourceVideoId?: string;
  sourceVideoTitle?: string;

  // Monitoring settings
  monitoringEnabled: boolean;
  checkInterval: number; // Hours between checks (default: 24)
  lastCheckedAt?: Timestamp;
  lastVideoId?: string; // To detect new videos

  // Resource generation settings
  autoCreateResource: boolean;
  resourceCategory: string; // Category for auto-created resources
  resourceTags: string[]; // Tags to apply to resources

  // Shadowing integration
  autoExtractTranscript: boolean;
  shadowingEnabled: boolean; // Enable direct shadowing links

  // Featured status
  isFeatured?: boolean; // Featured channels appear first with a ribbon badge

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Stats
  videosImported: number;
  totalViews?: number; // Views on imported resources
  totalShadowingSessions: number;
}

export interface YouTubeSeries {
  id: string;
  channelId: string; // Reference to YouTubeChannel
  playlistId?: string; // Optional: specific playlist to monitor
  seriesTitle: string;
  seriesDescription?: string;

  // Filter settings
  titleFilter?: string; // Regex to match video titles
  minDuration?: number; // Minimum video duration in seconds
  maxDuration?: number; // Maximum video duration in seconds
  languageFilter?: string; // e.g., 'ja' for Japanese

  // Import settings
  importAll: boolean; // Import all matching videos or just new ones
  maxVideosPerCheck: number; // Limit videos imported per check

  // Metadata
  isActive: boolean;
  lastImportedAt?: Timestamp;
  videosInSeries: string[]; // Video IDs
}

export interface YouTubeVideoResource {
  id: string;
  videoId: string; // YouTube video ID
  channelId: string; // YouTube channel ID (not document ID)
  seriesId?: string; // Reference to YouTubeSeries

  // Video metadata
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number; // Seconds
  publishedAt: Timestamp;
  viewCount?: number;
  likeCount?: number;

  // Channel info
  channelTitle: string;

  // Resource data
  resourceId?: string; // ID of created resource post
  resourceSlug?: string; // URL slug for resource

  // Transcript data
  transcriptCached: boolean;
  transcriptId?: string; // Reference to cached transcript
  transcriptLanguage?: string;
  transcriptExtractedAt?: Timestamp;

  // Shadowing data
  shadowingUrl: string; // Direct link to shadowing practice
  shadowingSessionCount: number;
  averageCompletionRate?: number;

  // Import metadata
  importedAt: Timestamp;
  importedBy: string; // 'system' or user ID
  autoImported: boolean;

  // Analytics
  resourceViews: number;
  shadowingStarts: number;
  shadowingCompletions: number;
}

export interface YouTubeImportLog {
  id: string;
  channelId: string;
  seriesId?: string;

  // Import details
  startedAt: Timestamp;
  completedAt?: Timestamp;
  status: 'pending' | 'processing' | 'completed' | 'failed';

  // Results
  videosChecked: number;
  videosImported: number;
  videosSkipped: number;
  errors?: string[];

  // API usage
  youtubeApiCalls: number;

  // Metadata
  triggeredBy: 'cron' | 'manual' | 'webhook';
  executedBy: string; // 'system' or user ID
}

export interface YouTubeChannelStats {
  channelId: string;
  totalVideosImported: number;
  totalResourceViews: number;
  totalShadowingSessions: number;
  averageCompletionRate: number;
  mostPopularVideo?: {
    videoId: string;
    title: string;
    views: number;
    shadowingSessions: number;
  };
  lastImportDate?: Timestamp;
  nextScheduledCheck?: Timestamp;
}

// Form types for UI
export interface YouTubeChannelFormData {
  channelUrl: string;
  monitoringEnabled: boolean;
  checkInterval: number;
  autoCreateResource: boolean;
  resourceCategory: string;
  resourceTags: string;
  autoExtractTranscript: boolean;
  shadowingEnabled: boolean;
}

export interface YouTubeSeriesFormData {
  channelId: string;
  playlistId?: string;
  seriesTitle: string;
  seriesDescription?: string;
  titleFilter?: string;
  minDuration?: number;
  maxDuration?: number;
  importAll: boolean;
  maxVideosPerCheck: number;
}