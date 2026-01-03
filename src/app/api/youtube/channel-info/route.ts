import { NextRequest, NextResponse } from 'next/server';
import { youtubeClient, getYouTubeApiKey, YOUTUBE_FIELDS } from '@/lib/youtube/client';

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const cleanUrl = url.split('?')[0] + (url.includes('?v=') ? '?v=' + url.split('?v=')[1]?.split('&')[0] : '');

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// Extract channel ID from channel URLs
// Note: @handles are NOT extracted here - they need to be resolved via YouTube search API
function extractChannelId(url: string): string | null {
  const patterns = [
    /youtube\.com\/channel\/([^\/\?]+)/,  // Direct channel ID (UCxxxxxxxx)
    /youtube\.com\/c\/([^\/\?]+)/,         // Custom URL (legacy)
    /youtube\.com\/user\/([^\/\?]+)/       // Username (legacy)
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Use the API key from environment
    const API_KEY = getYouTubeApiKey();

    if (!API_KEY) {
      return NextResponse.json(
        { error: 'YouTube API key not configured' },
        { status: 500 }
      );
    }

    let channelId: string | null = null;
    let videoInfo = null;

    // Check if it's a video URL or channel URL
    const videoId = extractVideoId(url);

    if (videoId) {
      // It's a video URL - get channel info from the video (with retry logic)
      const videoResponse = await youtubeClient.get('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoId,
          key: API_KEY,
          fields: YOUTUBE_FIELDS.VIDEO_WITH_CHANNEL,
        }
      });

      if (videoResponse.data.items && videoResponse.data.items.length > 0) {
        const video = videoResponse.data.items[0];
        channelId = video.snippet.channelId;

        // Store video info for response
        videoInfo = {
          videoId: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnailUrl: video.snippet.thumbnails?.maxres?.url ||
                       video.snippet.thumbnails?.high?.url ||
                       video.snippet.thumbnails?.medium?.url,
          duration: parseDuration(video.contentDetails.duration),
          viewCount: parseInt(video.statistics.viewCount || '0'),
          likeCount: parseInt(video.statistics.likeCount || '0'),
          publishedAt: video.snippet.publishedAt
        };
      }
    } else {
      // Try to extract channel ID from channel URL
      channelId = extractChannelId(url);

      // If still no channel ID, check if it's a handle (@username)
      if (!channelId && url.includes('@')) {
        const handleMatch = url.match(/@([^\/\?]+)/);
        if (handleMatch) {
          // Search for channel by handle (with retry logic)
          const searchResponse = await youtubeClient.get('/search', {
            params: {
              part: 'snippet',
              q: handleMatch[1],
              type: 'channel',
              maxResults: 1,
              key: API_KEY,
              fields: 'items(snippet(channelId))',
            }
          });

          if (searchResponse.data.items && searchResponse.data.items.length > 0) {
            channelId = searchResponse.data.items[0].snippet.channelId;
          }
        }
      }
    }

    if (!channelId) {
      return NextResponse.json(
        { error: 'Could not extract channel information from URL' },
        { status: 400 }
      );
    }

    // Fetch channel information (with retry logic and optimized fields)
    const channelResponse = await youtubeClient.get('/channels', {
      params: {
        part: 'snippet,statistics,brandingSettings',
        id: channelId,
        key: API_KEY,
        fields: YOUTUBE_FIELDS.CHANNEL_DETAILS,
      }
    });

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    const channel = channelResponse.data.items[0];

    // Build response
    const response = {
      channel: {
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        channelUrl: `https://www.youtube.com/channel/${channel.id}`,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl,
        thumbnailUrl: channel.snippet.thumbnails?.high?.url ||
                     channel.snippet.thumbnails?.medium?.url,
        bannerUrl: channel.brandingSettings?.image?.bannerExternalUrl,
        country: channel.snippet.country,
        publishedAt: channel.snippet.publishedAt,
        subscriberCount: channel.statistics.hiddenSubscriberCount ?
                        0 : parseInt(channel.statistics.subscriberCount || '0'),
        videoCount: parseInt(channel.statistics.videoCount || '0'),
        viewCount: parseInt(channel.statistics.viewCount || '0')
      },
      sourceVideo: videoInfo
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error fetching channel info:', error);

    // Check for specific API errors
    if (error.response?.status === 403) {
      return NextResponse.json(
        { error: 'YouTube API quota exceeded or API key invalid' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch channel information' },
      { status: 500 }
    );
  }
}

// Parse YouTube duration format (PT15M33S) to seconds
function parseDuration(duration: string): number {
  if (!duration) return 0;

  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;

  const hours = match[1] ? parseInt(match[1].slice(0, -1)) : 0;
  const minutes = match[2] ? parseInt(match[2].slice(0, -1)) : 0;
  const seconds = match[3] ? parseInt(match[3].slice(0, -1)) : 0;

  return hours * 3600 + minutes * 60 + seconds;
}