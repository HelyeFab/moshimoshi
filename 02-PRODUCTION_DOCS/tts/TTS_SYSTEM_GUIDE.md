# Moshimoshi TTS System - Developer Onboarding Guide

> **Last Updated:** January 2025
> **Maintainer:** Core Team
> **Status:** Production

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Key Files Reference](#key-files-reference)
4. [Provider Hierarchy](#provider-hierarchy)
5. [Caching Strategy](#caching-strategy)
6. [Using TTS in Components](#using-tts-in-components)
7. [API Routes Reference](#api-routes-reference)
8. [Configuration](#configuration)
9. [Extending to New Components](#extending-to-new-components)
10. [iOS Compatibility](#ios-compatibility)
11. [Troubleshooting](#troubleshooting)
12. [Performance Optimization](#performance-optimization)

---

## System Overview

The Moshimoshi TTS (Text-to-Speech) system is a multi-layered audio generation and playback system designed for Japanese language learning. It provides:

- **High-quality Japanese audio** via VOICEVOX (primary provider)
- **Fallback providers** (ElevenLabs, Web Speech API)
- **Dual-layer caching** (server-side Firebase + client-side IndexedDB)
- **Offline support** with progressive caching
- **iOS compatibility** with specific workarounds
- **Playback speed control** with pitch preservation

### Core Principles

1. **Cache-first**: Always check cache before generating new audio
2. **Graceful degradation**: Multiple fallback layers ensure audio always plays
3. **Offline-ready**: IndexedDB cache enables offline playback
4. **Performance**: Target <100ms for cached audio playback

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (React)                                    │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │   Component     │                                                        │
│  │  (e.g. Article  │                                                        │
│  │   Reader)       │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────────┐  │
│  │    useTTS()     │───▶│  OfflineTTSCache │───▶│  IndexedDB            │  │
│  │    hook         │    │  (client cache)  │    │  - 50MB max           │  │
│  │                 │    │                  │    │  - 7 days TTL         │  │
│  │  - play()       │    │  - get()         │    │  - LRU eviction       │  │
│  │  - pause()      │    │  - set()         │    │  - iOS blob→dataURL   │  │
│  │  - stop()       │    │  - has()         │    │                       │  │
│  │  - preload()    │    │                  │    │                       │  │
│  └────────┬────────┘    └──────────────────┘    └───────────────────────┘  │
│           │                                                                  │
│           │ cache miss                                                       │
└───────────┼──────────────────────────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVER (Next.js API)                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  API Routes                                                          │    │
│  │                                                                      │    │
│  │  POST /api/tts/synthesize      - Main synthesis endpoint            │    │
│  │  POST /api/tts/generate-sentence - Per-article sentence audio       │    │
│  │  POST /api/tts/preload         - Batch preload with priority        │    │
│  │  POST /api/tts/batch           - Batch processing                   │    │
│  │  POST /api/tts/demo            - Playground (no storage)            │    │
│  │  GET  /api/tts/cache/check     - Check cache status                 │    │
│  │  GET  /api/tts/cache/stats     - Cache statistics                   │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                            │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  TTSService (src/lib/tts/service.ts)                                 │   │
│  │                                                                      │   │
│  │  - synthesize(text, options)   → Check cache → Generate → Upload    │   │
│  │  - batchSynthesize(items)      → Process multiple texts             │   │
│  │  - isCached(text, options)     → Check if audio exists              │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                            │
│  ┌──────────────────────────────▼──────────────────────────────────────┐   │
│  │  TTSCacheService (src/lib/tts/cache.ts)                             │   │
│  │                                                                      │   │
│  │  Storage: Firestore collection `tts_cache`                          │   │
│  │  Files: Firebase Storage `tts/{provider}/{year}/{month}/{hash}.mp3` │   │
│  │                                                                      │   │
│  │  - get(text, options)     → Retrieve + update access stats          │   │
│  │  - set(text, options)     → Store new entry                         │   │
│  │  - has(text, options)     → Check existence                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TTS PROVIDERS                                        │
│                                                                              │
│  ┌─────────────────────────┐      ┌─────────────────────────┐               │
│  │  VOICEVOX (Primary)     │      │  ElevenLabs (Fallback)  │               │
│  │                         │      │                         │               │
│  │  Host: Modal.run        │ ───▶ │  Model: multilingual_v2 │               │
│  │  Voice: 23 (energetic)  │ fail │  Voice: configurable    │               │
│  │  Speed: 0.85 default    │      │                         │               │
│  │  Timeout: 60s           │      │                         │               │
│  └─────────────────────────┘      └─────────────────────────┘               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Web Speech API (Browser Fallback)                                   │    │
│  │  - Used when all server providers fail                               │    │
│  │  - Language: ja-JP                                                   │    │
│  │  - Rate: 0.5-2.0 (clamped)                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Core Hook

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/hooks/useTTS.ts` | Main React hook for TTS playback | `useTTS()` |

**Study this file to understand:**
- How audio elements are managed
- Cache lookup flow
- Fallback to Web Speech API
- iOS compatibility handling
- Queue system for multiple texts

### Server-Side Service

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/lib/tts/service.ts` | Orchestrates TTS generation | `TTSService` class |
| `src/lib/tts/cache.ts` | Firestore cache management | `TTSCacheService` class |
| `src/lib/tts/config.ts` | Configuration & defaults | `getTtsConfig()` |
| `src/lib/tts/types.ts` | TypeScript interfaces | `TTSOptions`, `TTSResult`, etc. |
| `src/lib/tts/utils.ts` | Utility functions | `normalizeText()`, `generateCacheKey()` |

### Providers

| File | Purpose | Provider |
|------|---------|----------|
| `src/lib/tts/providers/voicevox.ts` | VOICEVOX via Modal.run | Primary |
| `src/lib/tts/providers/elevenlabs.ts` | ElevenLabs API | Fallback |

### Client-Side Cache

| File | Purpose |
|------|---------|
| `src/lib/tts/offlineCache.ts` | IndexedDB cache for offline playback |
| `src/lib/tts/loadingState.ts` | Global loading state singleton |

### API Routes

| File | Endpoint |
|------|----------|
| `src/app/api/tts/synthesize/route.ts` | `POST /api/tts/synthesize` |
| `src/app/api/tts/generate-sentence/route.ts` | `POST /api/tts/generate-sentence` |
| `src/app/api/tts/preload/route.ts` | `POST /api/tts/preload` |
| `src/app/api/tts/batch/route.ts` | `POST /api/tts/batch` |
| `src/app/api/tts/demo/route.ts` | `POST /api/tts/demo` |
| `src/app/api/tts/cache/check/route.ts` | `GET /api/tts/cache/check` |
| `src/app/api/tts/cache/stats/route.ts` | `GET /api/tts/cache/stats` |

### UI Components

| File | Purpose |
|------|---------|
| `src/components/tts/TTSLoadingOverlay.tsx` | Full-screen loading indicator |
| `src/components/tts/TTSLoadingProvider.tsx` | App-level provider |
| `src/components/ui/TTSText.tsx` | Text wrapper with play button |
| `src/components/ui/AudioButton.tsx` | Standalone audio button |

---

## Provider Hierarchy

The TTS system uses a priority-based fallback chain:

```
Priority 0: Pre-cached Firebase Storage URL
            (Instant playback, no API call needed)
                    ↓ not available
Priority 1: VOICEVOX via Modal.run API
            (High-quality Japanese voice synthesis)
                    ↓ fails/timeout
Priority 2: ElevenLabs API
            (Multilingual fallback)
                    ↓ fails
Priority 3: Web Speech API
            (Browser native, degraded quality)
```

### VOICEVOX Configuration

```typescript
{
  baseUrl: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio',
  apiKey: process.env.MODAL_API_KEY,
  defaultVoice: '23',      // Energetic female
  defaultSpeed: 0.85,      // Slightly slower for learning
  timeout: 60000,          // 60s for cold starts
}
```

**Available Voices:**
| Voice ID | Character | Style |
|----------|-----------|-------|
| 23 | Default | Energetic female |
| 13 | 青山龍星 | Male |
| 11 | 玄野武宏 | Nemo |
| 1 | 四国めたん | Female |
| 3 | ずんだもん | Character |

---

## Caching Strategy

### Server-Side Cache (Firestore)

**Collection:** `tts_cache`

**Cache Key Generation:**
```typescript
// MD5 hash of: provider:voice:speed:pitch:volume:normalizedText
const cacheKey = generateCacheKey(text, options);
```

**Entry Structure:**
```typescript
interface TTSCacheEntry {
  id: string;
  text: string;
  normalizedText: string;
  provider: 'voicevox' | 'elevenlabs';
  voice: string;
  speed: number;
  audioUrl: string;           // Firebase Storage URL
  storagePath: string;        // e.g., tts/voicevox/2025/01/abc123.mp3
  duration: number;           // seconds
  size: number;               // bytes
  createdAt: Timestamp;
  lastAccessedAt: Timestamp;
  accessCount: number;
}
```

### Client-Side Cache (IndexedDB)

**Database:** `moshimoshi-tts-offline`

**Limits:**
- Max size: 50MB
- Max entries: 500
- Max age: 7 days
- Eviction: LRU (Least Recently Used)

**Entry Structure:**
```typescript
interface OfflineTTSCacheEntry {
  id: string;
  textHash: string;
  text: string;
  provider: string;
  voice: string;
  speed: number;
  audioBlob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}
```

---

## Using TTS in Components

### Basic Usage

```typescript
import { useTTS } from '@/hooks/useTTS';

function MyComponent() {
  const {
    play,
    pause,
    stop,
    loading,
    playing,
    error,
  } = useTTS({
    cacheFirst: true,        // Check IndexedDB first
    enableFallback: true,    // Fall back to Web Speech API
    onEnd: () => console.log('Playback finished'),
    onError: (err) => console.error('TTS error:', err),
  });

  const handlePlay = async () => {
    await play('こんにちは', {
      voice: '23',           // VOICEVOX voice ID
      speed: 1.0,            // Playback speed (0.5-2.0)
    });
  };

  return (
    <button onClick={handlePlay} disabled={loading}>
      {playing ? 'Playing...' : 'Play'}
    </button>
  );
}
```

### With Preloading

```typescript
const { play, preload } = useTTS({ cacheFirst: true });

// Preload on mount
useEffect(() => {
  const textsToPreload = ['おはよう', 'こんにちは', 'こんばんは'];
  preload(textsToPreload, { voice: '23', speed: 1.0 });
}, [preload]);
```

### With Queue

```typescript
const { queue, clearQueue } = useTTS();

// Play multiple texts in sequence
const handlePlayAll = () => {
  queue([
    'おはようございます',
    'こんにちは',
    'こんばんは',
  ], {
    voice: '23',
    speed: 0.85,
    delayBetween: 500, // ms between texts
  });
};
```

### Direct Audio Element (for pre-cached URLs)

When you have a pre-cached Firebase Storage URL, you can play directly without the TTS hook:

```typescript
const handlePlayPreCached = async (audioUrl: string, speed: number) => {
  const audio = new Audio(audioUrl);
  audio.preservesPitch = true;    // Keep pitch constant
  audio.playbackRate = speed;     // Apply user's speed setting

  audio.onended = () => {
    console.log('Playback complete');
  };

  audio.onerror = () => {
    console.error('Audio error:', audio.error);
  };

  await audio.play();
};
```

---

## API Routes Reference

### POST /api/tts/synthesize

Main synthesis endpoint with caching.

**Request:**
```typescript
{
  text: string;
  language?: 'ja' | 'en';
  voice?: string;
  speed?: number;
  pitch?: number;
}
```

**Response:**
```typescript
{
  success: true;
  audioUrl: string;      // Firebase Storage URL
  cached: boolean;
  duration: number;
  provider: 'voicevox' | 'elevenlabs';
}
```

### POST /api/tts/generate-sentence

Per-article sentence audio with deduplication.

**Request:**
```typescript
{
  articleId: string;
  sentence: string;
  index: number;
}
```

**Response:**
```typescript
{
  success: true;
  audioUrl: string;
  cached: boolean;
  provider: string;
}
```

### POST /api/tts/preload

Batch preload with priority levels.

**Request:**
```typescript
{
  texts: string[];           // Max 50
  priority: 'low' | 'normal' | 'high';
  voice?: string;
  speed?: number;
}
```

**Response:**
```typescript
{
  success: true;
  queued: number;
  cached: number;
  failed: number;
}
```

---

## Configuration

### Environment Variables

```bash
# Required
MODAL_API_KEY=              # VOICEVOX via Modal.run
ELEVENLABS_API_KEY=         # ElevenLabs fallback
ELEVENLABS_VOICE_ID=        # ElevenLabs voice ID

# Firebase (for caching)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

### Default Configuration

From `src/lib/tts/config.ts`:

```typescript
{
  voicevox: {
    defaultVoice: '23',
    defaultSpeed: 0.85,
    timeout: 60000,
  },
  elevenlabs: {
    modelId: 'eleven_multilingual_v2',
    voiceSettings: {
      stability: 0.5,
      similarityBoost: 0.75,
      useSpeakerBoost: true,
    },
  },
  cache: {
    enabled: true,
    maxSize: 5000,           // MB
    offlineEnabled: true,
    preloadCommon: true,     // Preload hiragana/katakana
  },
}
```

---

## Extending to New Components

### Step 1: Import the Hook

```typescript
import { useTTS } from '@/hooks/useTTS';
```

### Step 2: Configure Options

```typescript
const {
  play,
  pause,
  stop,
  loading,
  playing,
  error,
} = useTTS({
  cacheFirst: true,
  enableFallback: true,
  onEnd: handleAudioEnd,
  onError: handleError,
});
```

### Step 3: Create Play Handler

```typescript
const handlePlayText = async (text: string) => {
  // Stop any current playback
  stop();

  try {
    await play(text, {
      voice: '23',
      speed: playbackSpeed,  // From component state/props
    });
  } catch (error) {
    console.error('Playback failed:', error);
  }
};
```

### Step 4: Add UI Controls

```typescript
<button
  onClick={() => handlePlayText(sentence)}
  disabled={loading}
  className={playing ? 'active' : ''}
>
  {loading ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
</button>
```

### Step 5: Handle Playback Speed (Optional)

If your component needs speed control:

```typescript
// State for speed
const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

// For pre-cached audio (direct Audio element)
const audio = new Audio(url);
audio.preservesPitch = true;
audio.playbackRate = playbackSpeed;

// For TTS hook
await play(text, { speed: playbackSpeed });
```

### Example: Adding TTS to a Vocabulary Card

```typescript
import { useTTS } from '@/hooks/useTTS';
import { Play, Pause, Loader2 } from 'lucide-react';

function VocabularyCard({ word, reading, meaning }) {
  const { play, stop, loading, playing } = useTTS({
    cacheFirst: true,
    onEnd: () => console.log('Finished playing:', word),
  });

  const handlePlay = async () => {
    if (playing) {
      stop();
    } else {
      await play(word, { voice: '23', speed: 0.85 });
    }
  };

  return (
    <div className="vocabulary-card">
      <div className="word">{word}</div>
      <div className="reading">{reading}</div>
      <div className="meaning">{meaning}</div>

      <button onClick={handlePlay} disabled={loading}>
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : playing ? (
          <Pause />
        ) : (
          <Play />
        )}
      </button>
    </div>
  );
}
```

---

## iOS Compatibility

The TTS system includes several iOS-specific workarounds:

### 1. Blob URL to Data URL Conversion

iOS Safari has issues with blob URLs. The offline cache converts them:

```typescript
// In offlineCache.ts
if (isIOS()) {
  // Convert blob to data URL for iOS compatibility
  const dataUrl = await blobToDataUrl(blob);
  return dataUrl;
}
```

### 2. Audio Ready State Polling

iOS requires waiting for audio to be ready:

```typescript
// Poll readyState before playing
const waitForReady = () => {
  return new Promise((resolve) => {
    const check = () => {
      if (audio.readyState >= 2) {
        resolve(true);
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
};
```

### 3. Audio Unlock Gesture

iOS blocks autoplay. First play must be from user gesture:

```typescript
// In useTTS.ts
const unlockAudio = async () => {
  const audio = new Audio();
  audio.src = 'data:audio/mp3;base64,//uQx...'; // Silent audio
  await audio.play();
  audio.pause();
};
```

### 4. CORS Headers

Firebase Storage URLs need proper CORS configuration for iOS:

```typescript
audio.crossOrigin = 'anonymous';
audio.preload = 'metadata';
```

### 5. Audio Element Reuse (iPad/iOS Replay Fix)

iOS Safari has issues when creating new Audio elements on each play. Subsequent plays may fail silently.

**Problem:** Creating `new Audio()` on every click works once but fails on replay.

**Solution:** Reuse a single Audio element stored in a ref:

```typescript
// BAD - Creates new element each time (breaks on iOS after first play)
const handlePlay = async () => {
  const audio = new Audio()
  audio.src = url
  await audio.play()
}

// GOOD - Reuse single element (works on iOS)
const audioRef = useRef<HTMLAudioElement | null>(null)

const handlePlay = async () => {
  if (!audioRef.current) {
    audioRef.current = new Audio()
    audioRef.current.crossOrigin = 'anonymous'
    audioRef.current.preload = 'metadata'
  }

  const audio = audioRef.current

  // Stop and reset before playing new source
  if (!audio.paused) {
    audio.pause()
  }
  audio.currentTime = 0

  // Set new source
  audio.src = url
  audio.load()

  // Wait for loadedmetadata (more reliable than canplaythrough on iOS 17.4+)
  await new Promise((resolve, reject) => {
    const onLoaded = () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      resolve(true)
    }
    audio.addEventListener('loadedmetadata', onLoaded)

    // Check if already loaded
    if (audio.readyState >= 1) onLoaded()
  })

  // Set up ended handler
  audio.onended = () => setIsPlaying(false)

  await audio.play()
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
  }
}, [])
```

**Components using this pattern:**
- `WordExplanationModal.tsx` - Word audio playback (uses `wordAudioRef`)
- `useTTS.ts` hook - Already implements this correctly with `audioRef`

---

## Troubleshooting

### Audio Not Playing

1. **Check browser console** for errors
2. **Verify IndexedDB** is accessible (not in private browsing)
3. **Check network** tab for API failures
4. **iOS**: Ensure first play is from user gesture

### iOS: Audio Plays Once But Not Again

**Symptom:** On iPad/iPhone, audio button works the first time but subsequent clicks do nothing.

**Cause:** Creating `new Audio()` on each click. iOS Safari doesn't properly clean up audio elements.

**Solution:** Reuse a single Audio element stored in a ref. See [Audio Element Reuse](#5-audio-element-reuse-ipadios-replay-fix) in iOS Compatibility section.

**Quick Check:**
```typescript
// If you see this pattern, it will break on iOS:
const handlePlay = () => {
  const audio = new Audio(url)  // ❌ New element each time
  audio.play()
}

// Change to use a ref:
const audioRef = useRef<HTMLAudioElement | null>(null)
// See iOS Compatibility section for full pattern
```

### Slow First Play

1. VOICEVOX cold start can take 10-30s
2. Solution: Preload common content on app init
3. Consider showing loading overlay

### Cache Not Working

```typescript
// Debug: Check offline cache stats
const cache = OfflineTTSCache.getInstance();
const stats = await cache.getCacheStats();
console.log('Cache stats:', stats);
```

### Wrong Speed

1. For pre-cached audio: Ensure `preservesPitch = true`
2. For TTS hook: Pass speed in options
3. Check `playbackSpeedRef` is synced (for callbacks)

### Provider Errors

```typescript
// Check provider status
const response = await fetch('/api/tts/cache/stats');
const stats = await response.json();
console.log('Provider stats:', stats.byProvider);
```

---

## Performance Optimization

### 1. Preload on Mount

```typescript
useEffect(() => {
  const textsToPreload = sentences.slice(0, 5);
  preload(textsToPreload, { voice: '23', speed: 1.0 });
}, [sentences]);
```

### 2. Use Cache-First Strategy

```typescript
const { play } = useTTS({ cacheFirst: true });
```

### 3. Batch Similar Requests

```typescript
// Instead of multiple individual calls
await fetch('/api/tts/batch', {
  method: 'POST',
  body: JSON.stringify({ texts: [...] }),
});
```

### 4. Lazy Load TTS for Non-Critical Content

```typescript
const [ttsEnabled, setTtsEnabled] = useState(false);

// Only initialize TTS when needed
{ttsEnabled && <TTSComponent />}
```

### 5. Monitor Cache Size

```typescript
// Periodically check and clean cache
const cache = OfflineTTSCache.getInstance();
await cache.cleanup(); // Removes old/excess entries
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    TTS QUICK REFERENCE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  IMPORT:     import { useTTS } from '@/hooks/useTTS'        │
│                                                              │
│  BASIC:      const { play, stop, loading } = useTTS()       │
│              await play('こんにちは', { speed: 1.0 })        │
│                                                              │
│  PRELOAD:    preload(['text1', 'text2'], options)           │
│                                                              │
│  SPEED:      audio.preservesPitch = true                    │
│              audio.playbackRate = 0.75                      │
│                                                              │
│  PROVIDERS:  VOICEVOX → ElevenLabs → Web Speech API         │
│                                                              │
│  CACHE:      Server: Firestore + Firebase Storage           │
│              Client: IndexedDB (50MB, 7 days)               │
│                                                              │
│  ENV VARS:   MODAL_API_KEY                                  │
│              ELEVENLABS_API_KEY                             │
│              ELEVENLABS_VOICE_ID                            │
│                                                              │
│  DEBUG:      localStorage.setItem('debug:tts', 'true')      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [Universal Review Engine Deep Dive](/docs/REVIEW_ENGINE_DEEP_DIVE.md)
- [Offline Architecture](/docs/OFFLINE_ARCHITECTURE.md)
- [Firebase Storage Configuration](/docs/FIREBASE_SETUP.md)

---

*For questions or issues, contact the core team or open a GitHub issue.*
