# YouTube Shadowing Feature - API Configuration

This document explains the API keys and environment variables needed for the YouTube shadowing feature to work properly.

## Required Environment Variables

Add these to your `.env.local` file:

### OpenAI API (Required for AI Formatting)
```env
OPENAI_API_KEY=sk-...
```
**Purpose**: Used for AI-powered transcript formatting and splitting Japanese text into optimal shadowing segments.
**Get it**: https://platform.openai.com/api-keys
**Cost**: Pay-per-use, approximately $0.01-0.02 per video transcript

### YouTube Data API v3 (Optional but Recommended)
```env
YOUTUBE_API_KEY=AIza...
# OR
GOOGLE_API_KEY=AIza...
```
**Purpose**: Fetches video metadata (title, description, thumbnails, duration) to enhance the user experience.
**Get it**:
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable "YouTube Data API v3"
4. Create credentials > API Key
5. Restrict the key to YouTube Data API v3

**Cost**: Free tier with 10,000 quota units per day (100 video metadata requests)

### SupaData API (Optional - Premium Service)
```env
SUPA_YOUTUBE_API_KEY=your_supa_key_here
```
**Purpose**: High-quality transcript extraction service with better Japanese language support.
**Get it**: https://supadata.ai/
**Cost**: Paid service - check their pricing for current rates

### YouTube-Transcript.io API (Optional)
```env
YOUTUBE_TRANSCRIPT_IO_API_KEY=your_key_here
```
**Purpose**: Alternative transcript extraction service.
**Get it**: https://youtube-transcript.io/
**Cost**: Free tier available, paid plans for higher usage

### SearchAPI (Optional - Fallback Service)
```env
SEARCH_API=your_search_api_key
```
**Purpose**: Fallback transcript extraction service.
**Get it**: https://www.searchapi.io/
**Cost**: Pay-per-use

## How the System Works

The YouTube extraction system uses multiple fallback methods in this order:

1. **Cache Check**: First checks if transcript is already cached in Firestore
2. **YouTube-Transcript.io**: If provider is specifically requested
3. **SupaData AI**: Premium service with high-quality Japanese transcripts
4. **YouTube Captions Scraper**: Free library that extracts publicly available captions
5. **Fallback Services**: SearchAPI and other methods if primary methods fail

## Minimum Setup (Free)

For basic functionality without any API costs:

1. **OpenAI API** (Required): ~$0.01-0.02 per video for AI formatting
2. **YouTube Data API** (Optional): Free tier for video metadata

The system will work with just these two APIs, using the free `youtube-captions-scraper` for transcript extraction.

## Recommended Setup

For production use with better reliability:

1. **OpenAI API**: AI formatting and transcript optimization
2. **YouTube Data API**: Video metadata
3. **SupaData API**: High-quality transcript extraction for Japanese content

## API Usage Logging

The system automatically logs API usage to Firestore collection `apiUsageLogs` for monitoring and debugging:

```typescript
{
  api: 'supadata' | 'youtube-transcript-io' | 'searchapi' | 'youtube-captions-scraper',
  success: boolean,
  error?: string,
  metadata: {
    videoId: string,
    attempt?: number,
    status?: number
  },
  timestamp: Timestamp
}
```

## Error Handling

The system gracefully handles:
- API rate limits (429 errors)
- Authentication failures (401/403 errors)
- Service unavailability (5xx errors)
- Network timeouts
- No captions available (404 errors)

## Testing

To test the YouTube extraction system:

1. Ensure at least `OPENAI_API_KEY` is set
2. Use a popular Japanese YouTube video with captions
3. Check the browser console for detailed logging
4. Monitor Firestore for API usage logs

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Consider using different API keys for development/production
- Monitor API usage to prevent unexpected costs
- Restrict YouTube API key to specific APIs and domains in production