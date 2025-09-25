import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
}

function parseYouTubeUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Handle youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }

    // Handle youtu.be/VIDEO_ID
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1);
    }

    return null;
  } catch {
    return null;
  }
}

function parseDuration(duration: string): number {
  // Parse ISO 8601 duration format (e.g., PT4M13S)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
}

export async function GET(req: NextRequest) {
  try {
    // Check for API key
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: 'YouTube API key not configured' },
        { status: 500 }
      );
    }

    // Get URL from query params
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get('url');

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Missing video URL' },
        { status: 400 }
      );
    }

    // Extract video ID
    const videoId = parseYouTubeUrl(videoUrl);

    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    // Fetch video info from YouTube API
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${YOUTUBE_API_KEY}`,
      {
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const video = data.items[0];
    const videoInfo: YouTubeVideoInfo = {
      videoId: video.id,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      description: video.snippet.description,
      thumbnailUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
      duration: video.contentDetails.duration,
      publishedAt: video.snippet.publishedAt
    };

    // Convert duration to seconds
    const durationInSeconds = parseDuration(video.contentDetails.duration);

    return NextResponse.json({
      success: true,
      video: {
        ...videoInfo,
        durationInSeconds,
        videoUrl
      }
    });
  } catch (error: any) {
    console.error('Error fetching YouTube video info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video information' },
      { status: 500 }
    );
  }
}