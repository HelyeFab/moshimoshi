# TTS API Reference

## REST API Endpoints

### POST `/api/tts/synthesize`
Generate or retrieve TTS audio for given text.

#### Request
```typescript
{
  text: string;                    // Required: Text to synthesize
  options?: {
    provider?: 'auto' | 'google' | 'elevenlabs';  // Default: 'auto'
    voice?: string;                // Voice ID (provider-specific)
    speed?: number;                // 0.5 to 2.0, default: 1.0
    pitch?: number;                // -20 to 20, default: 0 (Google only)
    volume?: number;               // 0 to 1, default: 1.0
  }
}
```

#### Response
```typescript
{
  success: true;
  data: {
    audioUrl: string;              // Direct URL to audio file
    cached: boolean;               // Was retrieved from cache
    duration?: number;             // Audio duration in seconds
    provider: string;              // Provider used
    cacheKey: string;              // Cache identifier
  }
}

// Error Response
{
  success: false;
  error: {
    code: string;                  // Error code
    message: string;               // User-friendly message
    details?: any;                 // Additional error details
  }
}
```

#### Example
```bash
curl -X POST http://localhost:3000/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "こんにちは",
    "options": {
      "provider": "auto",
      "speed": 1.0
    }
  }'
```

---

### POST `/api/tts/batch`
Synthesize multiple texts in a single request.

#### Request
```typescript
{
  items: Array<{
    id?: string;                   // Optional ID for tracking
    text: string;                  // Text to synthesize
    options?: TTSOptions;          // Same as /synthesize
  }>;
  sequential?: boolean;            // Process in order (default: false)
}
```

#### Response
```typescript
{
  success: true;
  data: {
    results: Array<{
      id?: string;                 // ID from request
      text: string;                // Original text
      audioUrl?: string;           // URL if successful
      error?: string;              // Error if failed
      cached: boolean;             // From cache
    }>;
    stats: {
      total: number;               // Total items
      successful: number;          // Successfully processed
      failed: number;              // Failed items
      cached: number;              // From cache
    }
  }
}
```

---

### POST `/api/tts/preload`
Preload audio for texts without immediate playback.

#### Request
```typescript
{
  texts: string[];                 // Texts to preload
  priority?: 'low' | 'normal' | 'high';  // Queue priority
  options?: TTSOptions;            // Default options for all texts
}
```

#### Response
```typescript
{
  success: true;
  data: {
    queued: number;                // Number queued for processing
    cached: number;                // Already cached
    total: number;                 // Total texts
  }
}
```

---

### GET `/api/tts/cache/check`
Check if text is already cached.

#### Query Parameters
- `text` (required): Text to check
- `provider` (optional): Specific provider
- `voice` (optional): Specific voice

#### Response
```typescript
{
  cached: boolean;
  data?: {
    audioUrl: string;
    provider: string;
    createdAt: string;
    size: number;
    duration: number;
  }
}
```

---

### GET `/api/tts/cache/stats`
Get cache statistics.

#### Response
```typescript
{
  totalEntries: number;
  totalSize: number;               // In bytes
  providers: {
    google: {
      count: number;
      size: number;
    };
    elevenlabs: {
      count: number;
      size: number;
    };
  };
  recent: Array<{
    text: string;
    provider: string;
    accessCount: number;
    lastAccessed: string;
  }>;
  popular: Array<{
    text: string;
    accessCount: number;
  }>;
}
```

---

### DELETE `/api/tts/cache/clear`
Clear TTS cache (Admin only).

#### Request
```typescript
{
  filter?: {
    provider?: string;             // Clear specific provider
    olderThan?: string;           // ISO date string
    pattern?: string;             // Text pattern to match
  }
}
```

#### Response
```typescript
{
  success: true;
  deleted: number;                 // Number of entries deleted
  freedSpace: number;             // Bytes freed
}
```

---

## React Hooks

### `useTTS`
Main hook for TTS functionality.

```typescript
function useTTS(options?: UseTTSOptions): UseTTSReturn;

interface UseTTSOptions {
  autoPlay?: boolean;              // Auto-play on mount
  preloadOnMount?: string[];       // Texts to preload
  cacheFirst?: boolean;            // Check cache before API
  onPlay?: () => void;             // Callback on play
  onEnd?: () => void;              // Callback on end
  onError?: (error: Error) => void; // Error callback
}

interface UseTTSReturn {
  // State
  playing: boolean;                // Currently playing
  loading: boolean;                // Loading audio
  error: Error | null;             // Current error
  
  // Methods
  play: (text: string, options?: TTSOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  preload: (texts: string[], options?: TTSOptions) => Promise<void>;
  queue: (items: QueueItem[]) => void;
  clearQueue: () => void;
  
  // Audio element
  audioRef: React.RefObject<HTMLAudioElement>;
}
```

#### Example
```tsx
function MyComponent() {
  const { play, playing, loading, error } = useTTS({
    onPlay: () => console.log('Started playing'),
    onEnd: () => console.log('Finished playing')
  });
  
  return (
    <button 
      onClick={() => play('こんにちは')}
      disabled={loading || playing}
    >
      {loading ? 'Loading...' : playing ? 'Playing...' : 'Play'}
    </button>
  );
}
```

---

### `useTTSQueue`
Manage a queue of TTS items.

```typescript
function useTTSQueue(options?: QueueOptions): QueueReturn;

interface QueueOptions {
  maxConcurrent?: number;          // Max simultaneous (default: 1)
  autoPlay?: boolean;              // Auto-start queue
  loop?: boolean;                  // Loop queue
  onComplete?: () => void;         // Queue complete callback
}

interface QueueReturn {
  queue: QueueItem[];
  currentIndex: number;
  playing: boolean;
  
  add: (item: QueueItem) => void;
  remove: (index: number) => void;
  clear: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
}
```

---

### `usePreloadTTS`
Preload TTS audio for better performance.

```typescript
function usePreloadTTS(
  texts: string[],
  options?: PreloadOptions
): PreloadReturn;

interface PreloadOptions {
  trigger?: 'mount' | 'hover' | 'focus' | 'manual';
  delay?: number;                  // Delay before preload (ms)
  priority?: 'low' | 'normal' | 'high';
}

interface PreloadReturn {
  loaded: boolean;
  loading: boolean;
  progress: number;                // 0 to 1
  preload: () => Promise<void>;   // Manual trigger
}
```

---

## Components

### `<SpeakerIcon />`
Clickable speaker icon for TTS playback.

```tsx
interface SpeakerIconProps {
  text: string;                    // Text to play
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'filled' | 'ghost';
  disabled?: boolean;
  className?: string;
  options?: TTSOptions;            // TTS options
  onPlay?: () => void;
  onEnd?: () => void;
}
```

---

### `<AudioPlayer />`
Full-featured audio player with controls.

```tsx
interface AudioPlayerProps {
  text: string;
  showControls?: boolean;          // Play/pause/stop
  showProgress?: boolean;          // Progress bar
  showTime?: boolean;              // Current/total time
  showSpeed?: boolean;             // Speed control
  showVolume?: boolean;            // Volume control
  className?: string;
  options?: TTSOptions;
}
```

---

### `<TTSText />`
Text with inline TTS button.

```tsx
interface TTSTextProps {
  children: string;                // Text content
  showIcon?: boolean;              // Show speaker icon
  iconPosition?: 'left' | 'right';
  autoPlay?: boolean;              // Play on mount
  highlightOnPlay?: boolean;       // Highlight during playback
  className?: string;
}
```

---

## TypeScript Types

### Core Types
```typescript
type TTSProvider = 'google' | 'elevenlabs';

interface TTSOptions {
  provider?: TTSProvider | 'auto';
  voice?: string;
  speed?: number;                  // 0.5 to 2.0
  pitch?: number;                  // -20 to 20
  volume?: number;                 // 0 to 1
}

interface TTSResult {
  audioUrl: string;
  cached: boolean;
  duration?: number;
  provider: TTSProvider;
}

interface TTSError {
  code: string;
  message: string;
  provider?: TTSProvider;
  retryable: boolean;
}
```

### Cache Types
```typescript
interface TTSCacheEntry {
  id: string;                      // Cache key (MD5 hash)
  text: string;                    // Original text
  normalizedText: string;          // Processed text
  provider: TTSProvider;
  voice: string;
  audioUrl: string;                // Firebase Storage URL
  storagePath: string;             // Storage path
  duration: number;                // Seconds
  size: number;                    // Bytes
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  metadata: {
    type: 'character' | 'word' | 'sentence' | 'paragraph';
    language: string;
    context?: string;
  };
}
```

### Queue Types
```typescript
interface QueueItem {
  id?: string;
  text: string;
  options?: TTSOptions;
  priority?: 'low' | 'normal' | 'high';
  delay?: number;                  // Delay before play (ms)
  callback?: (result: TTSResult | TTSError) => void;
}
```

---

## Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `PROVIDER_ERROR` | Provider API error | Yes |
| `NETWORK_ERROR` | Network connection error | Yes |
| `QUOTA_EXCEEDED` | API quota exceeded | No |
| `INVALID_TEXT` | Invalid text input | No |
| `INVALID_OPTIONS` | Invalid options | No |
| `CACHE_ERROR` | Cache operation failed | Yes |
| `STORAGE_ERROR` | Storage operation failed | Yes |
| `AUTH_ERROR` | Authentication failed | No |
| `RATE_LIMITED` | Too many requests | Yes |
| `UNSUPPORTED` | Unsupported feature | No |

---

## Rate Limits

### API Endpoints
- `/api/tts/synthesize`: 100 requests/minute per IP
- `/api/tts/batch`: 10 requests/minute per IP
- `/api/tts/preload`: 20 requests/minute per IP

### Provider Limits
- **Google TTS**: 1 million characters/month (free tier)
- **ElevenLabs**: Based on subscription plan

---

## Environment Variables

```bash
# Google Cloud TTS
GOOGLE_CLOUD_PROJECT_ID=project-id
GOOGLE_CLOUD_TTS_API_KEY=api-key

# ElevenLabs
ELEVENLABS_API_KEY=api-key
ELEVENLABS_VOICE_ID=voice-id

# Optional Configuration
TTS_CACHE_TTL=0                   # 0 for permanent
TTS_MAX_TEXT_LENGTH=5000          # Max characters
TTS_DEFAULT_PROVIDER=auto         # auto|google|elevenlabs
TTS_DEBUG=false                   # Enable debug logging
```

---

*Last Updated: January 2025*  
*Version: 1.0.0*