# NHK Audio Priority Implementation Plan

## Overview

Update the article reader to use NHK's original professional audio as the primary source for full article playback, falling back to VOICEVOX TTS only when unavailable.

---

## Current State

### Data Available (per article in Firestore)

```typescript
{
  nhkAudioUrl?: string;              // NHK's official m3u8 HLS stream (NEW)
  generatedContentAudioUrl?: string; // VOICEVOX TTS fallback
  generatedTitleAudioUrl?: string;   // VOICEVOX TTS for title
  generatedSummaryAudioUrl?: string; // VOICEVOX TTS for summary
}
```

### Current Audio Flow

```
User clicks "Play Article"
    ↓
Uses generatedContentAudioUrl (VOICEVOX TTS)
    ↓
Falls back to on-demand TTS if not cached
```

### Target Audio Flow

```
User clicks "Play Article"
    ↓
Check nhkAudioUrl exists?
    ├── YES → Play NHK HLS stream (professional narrator)
    └── NO  → Use generatedContentAudioUrl (VOICEVOX TTS)
                  ↓
              Falls back to on-demand TTS if not cached
```

---

## Implementation Steps

### Step 1: Add nhkAudioUrl to Article Types

**File:** `src/types/news.ts` or inline in component

```typescript
interface NewsArticle {
  // ... existing fields
  nhkAudioUrl?: string // NHK's official HLS audio stream
}
```

**File:** `src/app/api/news/article/[id]/route.ts`

Ensure `nhkAudioUrl` is returned from the API.

---

### Step 2: Install HLS.js for m3u8 Playback

NHK audio uses HLS (HTTP Live Streaming) format which requires special handling.

```bash
npm install hls.js
```

**Why:** Native `<audio>` element doesn't support m3u8 on all browsers. HLS.js provides cross-browser support.

---

### Step 3: Create NHK Audio Player Hook

**File:** `src/hooks/useNhkAudio.ts`

```typescript
import Hls from 'hls.js'
import { useRef, useEffect, useState } from 'react'

export function useNhkAudio(nhkAudioUrl?: string) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!nhkAudioUrl || !audioRef.current) return

    // Check if HLS is supported
    if (Hls.isSupported()) {
      const hls = new Hls()
      hlsRef.current = hls

      hls.loadSource(nhkAudioUrl)
      hls.attachMedia(audioRef.current)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsReady(true)
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError('Failed to load NHK audio')
        }
      })

      return () => {
        hls.destroy()
      }
    }
    // Native HLS support (Safari)
    else if (audioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      audioRef.current.src = nhkAudioUrl
      setIsReady(true)
    }
  }, [nhkAudioUrl])

  return { audioRef, isReady, error }
}
```

---

### Step 4: Update EnhancedArticleReaderFinal.tsx

**Location:** `src/components/news/EnhancedArticleReaderFinal.tsx`

#### 4a. Add nhkAudioUrl to props/state

```typescript
// In the component props or article type
interface Article {
  // ... existing
  nhkAudioUrl?: string
}
```

#### 4b. Update full article audio playback logic

Find the section that handles full article audio playback and update:

```typescript
// Priority chain for full article audio
const getArticleAudioUrl = () => {
  // Priority 1: NHK original audio (professional narrator)
  if (article.nhkAudioUrl) {
    return { url: article.nhkAudioUrl, type: 'hls', source: 'nhk' }
  }

  // Priority 2: Pre-generated VOICEVOX TTS
  if (article.generatedContentAudioUrl) {
    return { url: article.generatedContentAudioUrl, type: 'mp3', source: 'voicevox' }
  }

  // Priority 3: On-demand TTS (will be generated)
  return { url: null, type: 'generate', source: 'voicevox' }
}
```

#### 4c. Conditional audio player rendering

```typescript
{articleAudio.type === 'hls' ? (
  <NhkAudioPlayer
    url={articleAudio.url}
    onEnded={handleAudioEnded}
  />
) : (
  <StandardAudioPlayer
    url={articleAudio.url}
    onEnded={handleAudioEnded}
  />
)}
```

---

### Step 5: Create NHK Audio Player Component

**File:** `src/components/audio/NhkAudioPlayer.tsx`

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface NhkAudioPlayerProps {
  url: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  autoPlay?: boolean;
}

export function NhkAudioPlayer({
  url,
  onPlay,
  onPause,
  onEnded,
  onError,
  autoPlay = false,
}: NhkAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!url || !audioRef.current) return;

    setIsLoading(true);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(audioRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (autoPlay) {
          audioRef.current?.play();
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          onError?.('Failed to load NHK audio stream');
          setIsLoading(false);
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (audioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      audioRef.current.src = url;
      setIsLoading(false);
    } else {
      onError?.('HLS not supported in this browser');
      setIsLoading(false);
    }
  }, [url, autoPlay, onError]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      onPause?.();
    } else {
      audioRef.current.play();
      onPlay?.();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    onEnded?.();
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  return (
    <div className="nhk-audio-player">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Player UI */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="p-2 rounded-full bg-primary-500 text-white"
        >
          {isLoading ? '...' : isPlaying ? '⏸' : '▶'}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <span className="text-sm text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* NHK badge */}
        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
          NHK
        </span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

---

### Step 6: Update Article API Route

**File:** `src/app/api/news/article/[id]/route.ts`

Ensure `nhkAudioUrl` is included in the response:

```typescript
return NextResponse.json({
  // ... existing fields
  nhkAudioUrl: article.nhkAudioUrl || null,
})
```

---

### Step 7: Update newsService.ts

**File:** `src/services/newsService.ts`

Add `nhkAudioUrl` to the article interface and fetching logic.

---

## Testing Checklist

- [ ] NHK audio plays correctly on Chrome (using HLS.js)
- [ ] NHK audio plays correctly on Safari (native HLS)
- [ ] Fallback to VOICEVOX works when `nhkAudioUrl` is missing
- [ ] Audio controls (play/pause/seek) work correctly
- [ ] Error handling when NHK stream fails
- [ ] Progress bar shows correct duration
- [ ] "NHK" badge displays when using original audio

---

## UI/UX Considerations

1. **Visual Indicator**: Show "NHK Original" badge when using official audio
2. **Quality Note**: Consider tooltip: "Professional NHK narrator"
3. **Fallback Message**: If NHK audio fails, show "Switching to TTS..."
4. **Loading State**: HLS may take a moment to buffer

---

## Sentence-by-Sentence Playback

NHK audio is for the **full article only**. Sentence-by-sentence playback should continue using VOICEVOX TTS:

```
Full Article → NHK audio (priority) or VOICEVOX
Per-Sentence → VOICEVOX TTS (always)
```

This is because NHK doesn't provide timestamps for individual sentences.

---

## Cost Savings

With this implementation:

- **Full article audio**: FREE (NHK stream)
- **Title audio**: VOICEVOX (~small text)
- **Summary audio**: VOICEVOX (~small text)
- **Sentence TTS**: VOICEVOX (on-demand)

Estimated savings: **~80% reduction** in TTS API calls for NHK articles.

---

## Files to Modify

| File                                                 | Action                     |
| ---------------------------------------------------- | -------------------------- |
| `package.json`                                       | Add `hls.js` dependency    |
| `src/types/news.ts`                                  | Add `nhkAudioUrl` to types |
| `src/hooks/useNhkAudio.ts`                           | New hook for HLS playback  |
| `src/components/audio/NhkAudioPlayer.tsx`            | New component              |
| `src/components/news/EnhancedArticleReaderFinal.tsx` | Update audio logic         |
| `src/app/api/news/article/[id]/route.ts`             | Include `nhkAudioUrl`      |
| `src/services/newsService.ts`                        | Update article interface   |

---

## Timeline Estimate

| Task                              | Time             |
| --------------------------------- | ---------------- |
| Install hls.js, create hook       | 15 min           |
| Create NhkAudioPlayer component   | 30 min           |
| Update EnhancedArticleReaderFinal | 45 min           |
| Update API route + service        | 15 min           |
| Testing & debugging               | 30 min           |
| **Total**                         | **~2-2.5 hours** |

---

## Rollback Plan

If issues arise:

1. NHK audio is optional - existing VOICEVOX fallback works
2. Can disable by not passing `nhkAudioUrl` to component
3. No database migration needed - new field is additive
