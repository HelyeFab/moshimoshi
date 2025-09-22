# TTS Implementation Guide

## Quick Start

### 1. Environment Setup
Add these to your `.env.local`:
```bash
# Google Cloud TTS
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_TTS_API_KEY=your-api-key

# ElevenLabs
ELEVENLABS_API_KEY=your-api-key
ELEVENLABS_VOICE_ID=your-voice-id

# Firebase (already configured)
# Uses existing Firebase Admin setup
```

### 2. Basic Usage

#### Simple TTS Hook
```tsx
import { useTTS } from '@/hooks/useTTS';

function MyComponent() {
  const { play, loading, error } = useTTS();
  
  return (
    <button onClick={() => play('こんにちは')}>
      Play Audio
    </button>
  );
}
```

#### With Options
```tsx
const { play, preload, queue } = useTTS({
  autoPlay: false,
  preloadOnMount: true,
  cacheFirst: true
});

// Preload audio
await preload(['おはよう', 'こんにちは', 'こんばんは']);

// Queue multiple items
queue([
  { text: 'これは', delay: 0 },
  { text: 'テストです', delay: 500 }
]);
```

## Component Integration

### Speaker Icon Button
```tsx
import { SpeakerIcon } from '@/components/ui/SpeakerIcon';

<SpeakerIcon 
  text="日本語"
  size="small"
  disabled={false}
  onPlay={() => console.log('Playing')}
  onEnd={() => console.log('Ended')}
/>
```

### Audio Player with Controls
```tsx
import { AudioPlayer } from '@/components/ui/AudioPlayer';

<AudioPlayer
  text="長い文章やストーリー"
  showControls={true}
  showProgress={true}
  showSpeed={true}
/>
```

### Inline TTS
```tsx
import { TTSText } from '@/components/ui/TTSText';

<TTSText>
  これは自動的に音声ボタンが付きます
</TTSText>
```

## API Usage

### Direct API Call
```typescript
// Client-side
const response = await fetch('/api/tts/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '日本語のテキスト',
    options: {
      provider: 'auto', // or 'google' | 'elevenlabs'
      speed: 1.0
    }
  })
});

const { audioUrl, cached } = await response.json();
```

### Batch Preloading
```typescript
await fetch('/api/tts/preload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    texts: ['あ', 'い', 'う', 'え', 'お'],
    priority: 'high'
  })
});
```

## Provider Selection

### Automatic Selection (Default)
The system automatically chooses the optimal provider:
- **Google TTS**: Text < 10 characters OR single kana/kanji
- **ElevenLabs**: Text >= 10 characters

### Manual Override
```typescript
const { play } = useTTS();

// Force Google TTS
play('長い文章でもGoogleを使う', { provider: 'google' });

// Force ElevenLabs
play('あ', { provider: 'elevenlabs' });
```

## Caching Behavior

### Cache Check Flow
1. Generate cache key from text + options
2. Check Firestore for existing entry
3. If found, return cached URL immediately
4. If not found, synthesize and cache

### Cache Key Generation
```typescript
function getCacheKey(text: string, options: TTSOptions): string {
  const normalized = normalizeText(text);
  const provider = options.provider || getAutoProvider(text);
  const voice = options.voice || getDefaultVoice(provider);
  
  return md5(`${provider}:${voice}:${normalized}`);
}
```

### Manual Cache Management
```typescript
import { ttsCache } from '@/lib/tts/cache';

// Check if cached
const isCached = await ttsCache.has('こんにちは');

// Get cache entry
const entry = await ttsCache.get('こんにちは');

// Clear specific entry
await ttsCache.delete('こんにちは');

// Get cache stats
const stats = await ttsCache.getStats();
```

## Offline Support

### Service Worker Registration
```javascript
// In your service worker
import { ttsOfflineHandler } from '@/lib/tts/offline';

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/tts/')) {
    event.respondWith(ttsOfflineHandler(event.request));
  }
});
```

### Preload for Offline
```typescript
import { preloadForOffline } from '@/lib/tts/offline';

// Preload essential audio
await preloadForOffline({
  hiragana: true,      // All hiragana characters
  katakana: true,      // All katakana characters
  n5Vocab: true,       // JLPT N5 vocabulary
  common: true         // Common phrases
});
```

## Error Handling

### Common Errors
```typescript
const { play, error } = useTTS();

if (error) {
  switch (error.code) {
    case 'PROVIDER_ERROR':
      // API call failed
      break;
    case 'NETWORK_ERROR':
      // No internet connection
      break;
    case 'QUOTA_EXCEEDED':
      // API limits reached
      break;
    case 'INVALID_TEXT':
      // Text validation failed
      break;
  }
}
```

### Retry Logic
```typescript
const { play, retry } = useTTS({
  maxRetries: 3,
  retryDelay: 1000
});

// Manual retry
if (error && error.retryable) {
  retry();
}
```

## Performance Tips

### 1. Preload Strategic Content
```typescript
// Preload on component mount
useEffect(() => {
  const texts = getLessonVocabulary();
  preload(texts, { priority: 'high' });
}, []);
```

### 2. Use Intersection Observer
```typescript
// Preload when element comes into view
const ref = useIntersectionPreload('音声テキスト');

<div ref={ref}>音声テキスト</div>
```

### 3. Queue Management
```typescript
// Process queue efficiently
const queue = useTTSQueue({
  maxConcurrent: 3,
  priorityOrder: true
});

queue.add('高優先度', { priority: 'high' });
queue.add('低優先度', { priority: 'low' });
```

## Testing

### Mock TTS in Tests
```typescript
// __mocks__/tts.ts
export const mockTTS = {
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  stop: jest.fn(),
  preload: jest.fn(() => Promise.resolve())
};

// In your test
jest.mock('@/hooks/useTTS', () => ({
  useTTS: () => mockTTS
}));
```

### Test Audio Playback
```typescript
import { render, fireEvent, waitFor } from '@testing-library/react';

test('plays audio on click', async () => {
  const { getByRole } = render(<SpeakerIcon text="テスト" />);
  
  fireEvent.click(getByRole('button'));
  
  await waitFor(() => {
    expect(mockTTS.play).toHaveBeenCalledWith('テスト');
  });
});
```

## Migration from Static Audio

### Current System
```typescript
// Old way - static files
const audio = new Audio('/data/audio/hiragana/ka.mp3');
audio.play();
```

### New System
```typescript
// New way - dynamic TTS
const { play } = useTTS();
play('か');
```

### Gradual Migration
```typescript
// Hybrid approach during migration
async function playAudio(text: string) {
  // Check for legacy static file first
  const staticPath = `/data/audio/${text}.mp3`;
  if (await fileExists(staticPath)) {
    return playStaticAudio(staticPath);
  }
  
  // Fall back to TTS
  return play(text);
}
```

## Debugging

### Enable Debug Mode
```typescript
// In development
localStorage.setItem('tts-debug', 'true');

// Will log:
// - Cache hits/misses
// - Provider selection
// - API calls
// - Performance metrics
```

### Check Cache Status
```javascript
// Browser console
const stats = await fetch('/api/tts/cache-status').then(r => r.json());
console.table(stats);
```

### Clear Cache
```javascript
// Clear all TTS cache (admin only)
await fetch('/api/tts/cache/clear', { 
  method: 'POST',
  headers: { 'Authorization': 'Bearer <admin-token>' }
});
```

## Best Practices

### DO ✅
- Preload audio during idle time
- Cache aggressively (it's permanent!)
- Use automatic provider selection
- Handle errors gracefully
- Provide visual feedback while loading

### DON'T ❌
- Don't synthesize in client-side code
- Don't skip text normalization
- Don't ignore offline users
- Don't synthesize very long texts (> 5000 chars)
- Don't play multiple audio simultaneously

## Common Patterns

### Lesson Audio
```tsx
function LessonComponent({ vocabulary }) {
  const { play, preload } = useTTS();
  
  useEffect(() => {
    // Preload all vocabulary
    preload(vocabulary.map(v => v.japanese));
  }, [vocabulary]);
  
  return vocabulary.map(item => (
    <div key={item.id}>
      <span>{item.japanese}</span>
      <SpeakerIcon text={item.japanese} />
    </div>
  ));
}
```

### Story Reader
```tsx
function StoryReader({ paragraphs }) {
  const { queue, playing, pause, resume } = useTTS();
  
  const playStory = () => {
    queue(paragraphs.map((p, i) => ({
      text: p,
      delay: i * 1000
    })));
  };
  
  return (
    <div>
      <button onClick={playing ? pause : resume}>
        {playing ? 'Pause' : 'Play'} Story
      </button>
      {paragraphs.map(p => <p>{p}</p>)}
    </div>
  );
}
```

### Flashcard Audio
```tsx
function Flashcard({ front, back }) {
  const { play } = useTTS();
  const [flipped, setFlipped] = useState(false);
  
  const handleFlip = () => {
    setFlipped(!flipped);
    play(flipped ? front : back);
  };
  
  return (
    <div onClick={handleFlip}>
      {flipped ? back : front}
    </div>
  );
}
```

---

*Last Updated: January 2025*  
*Version: 1.0.0*