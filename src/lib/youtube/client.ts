/**
 * YouTube API Client with Retry Logic
 *
 * Provides a resilient axios instance for YouTube Data API v3 calls
 * with exponential backoff retry for transient failures.
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';

export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Create dedicated axios instance for YouTube API
export const youtubeClient = axios.create({
  baseURL: YOUTUBE_API_BASE,
  timeout: 15000, // 15 second timeout
});

// Configure retry logic
axiosRetry(youtubeClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay, // 1s, 2s, 4s
  retryCondition: (error) => {
    // Retry on network errors
    if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
      return true;
    }

    // Retry on rate limiting (429)
    if (error.response?.status === 429) {
      console.warn('[YouTube API] Rate limited, retrying...');
      return true;
    }

    // Retry on server errors (5xx)
    if (error.response && error.response.status >= 500) {
      console.warn(`[YouTube API] Server error ${error.response.status}, retrying...`);
      return true;
    }

    return false;
  },
  onRetry: (retryCount, error, requestConfig) => {
    console.log(
      `[YouTube API] Retry attempt ${retryCount} for ${requestConfig.url}`,
      error.message
    );
  },
});

/**
 * Field selectors for optimized API responses
 * These reduce response size by ~75% without affecting functionality
 */
export const YOUTUBE_FIELDS = {
  // For video details (used in sync)
  VIDEO_DETAILS:
    'items(id,snippet(title,description,publishedAt,thumbnails(high,maxres,medium)),contentDetails(duration),statistics(viewCount,likeCount))',

  // For video info from URL (includes channel info)
  VIDEO_WITH_CHANNEL:
    'items(id,snippet(title,description,publishedAt,channelId,thumbnails(high,maxres,medium)),contentDetails(duration),statistics(viewCount,likeCount))',

  // For channel details
  CHANNEL_DETAILS:
    'items(id,snippet(title,description,customUrl,country,publishedAt,thumbnails(high,medium)),statistics(subscriberCount,videoCount,viewCount),brandingSettings(image(bannerExternalUrl)))',

  // For search results
  SEARCH_RESULTS: 'items(id(videoId),snippet(channelId))',
};

/**
 * Get the YouTube API key from environment
 */
export function getYouTubeApiKey(): string | undefined {
  return process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
}
