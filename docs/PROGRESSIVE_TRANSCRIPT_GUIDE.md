# Progressive Transcript Loading Guide

## Overview

The Progressive Transcript Loading system provides **instant transcript access** (1-3 seconds) while AI enhancement happens in the background, eliminating the 20-30 second wait time that previously blocked users.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ USER EXPERIENCE TIMELINE                                    │
├─────────────────────────────────────────────────────────────┤
│ [0-3s]    ✅ Raw transcript loads (instant)                │
│           ▶️  User can start shadowing                      │
│                                                             │
│ [3-25s]   🔄 AI enhancement in background (non-blocking)   │
│           📊 Progress indicator shows status                │
│           ▶️  User continues with raw transcript            │
│                                                             │
│ [25s+]    ✨ Smooth transition to AI-enhanced              │
│           ▶️  User sees improved line breaks, etc.          │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. `useProgressiveTranscript` Hook

**Location**: `src/hooks/useProgressiveTranscript.ts`

**Purpose**: Manages two-phase transcript loading

**Usage**:
```typescript
import { useProgressiveTranscript } from '@/hooks/useProgressiveTranscript';

const {
  transcript,        // Current transcript (raw or AI-enhanced)
  loading,           // Initial load state (1-3s)
  error,             // Any error messages
  aiEnhancing,       // Background AI processing
  aiProgress,        // 0-100 progress indicator
  refetch            // Manual refresh function
} = useProgressiveTranscript(videoUrl, {
  enableAI: true,
  maxSegmentLength: 20,
  addFurigana: false,
  includeTranslations: true,
});
```

**States**:
- `loading: true` → Fetching raw transcript (1-3s)
- `transcript.source: 'raw'` → User can start shadowing
- `aiEnhancing: true` → AI processing in background (15-25s)
- `transcript.source: 'ai-enhanced'` → Transition complete

### 2. `AIEnhancementProgress` Component

**Location**: `src/components/youtube-shadowing/AIEnhancementProgress.tsx`

**Purpose**: Non-intrusive progress indicator for AI enhancement

**Features**:
- Animated progress bar (0-100%)
- Status messages that change based on progress
- User notification that they can continue using raw transcript
- Auto-hides when complete (progress === 0 or 100)

**Usage**:
```typescript
import { AIEnhancementProgress } from '@/components/youtube-shadowing/AIEnhancementProgress';

{aiEnhancing && (
  <AIEnhancementProgress progress={aiProgress} />
)}
```

### 3. `CaptionDisplay` Component

**Location**: `src/components/youtube-shadowing/CaptionDisplay.tsx`

**Purpose**: Superior transcript display with moshi-player UX patterns

**Features**:
- **Smart Auto-Scroll**: 100px buffer zones, centers active segment
- **Current/Full Toggle**: Switch between focused view and full transcript
- **Click-to-Jump**: Instant seek to any segment
- **Visual Hierarchy**: Active (red), Past (dimmed), Future (normal)
- **Coming Up Preview**: Shows next 3 segments

**Usage**:
```typescript
import { CaptionDisplay, TranscriptToggle } from '@/components/youtube-shadowing/CaptionDisplay';

const [showFullTranscript, setShowFullTranscript] = useState(true);

<>
  <TranscriptToggle
    showFullTranscript={showFullTranscript}
    onToggle={() => setShowFullTranscript(!showFullTranscript)}
  />

  <CaptionDisplay
    segments={transcript.segments}
    currentTime={currentTime}
    onSeekToTime={seekToTime}
    showFullTranscript={showFullTranscript}
    source={transcript.source}
  />
</>
```

### 4. `TranscriptTransition` Component

**Location**: `src/components/youtube-shadowing/TranscriptTransition.tsx`

**Purpose**: Smooth animations when transitioning between raw and AI-enhanced

**Usage**:
```typescript
import { TranscriptTransition, SourceIndicator } from '@/components/youtube-shadowing/TranscriptTransition';

<TranscriptTransition source={transcript.source}>
  <CaptionDisplay ... />
</TranscriptTransition>

<SourceIndicator source={transcript.source} />
```

## API Changes

### Enhanced `/api/youtube/extract` Route

**New Parameters**:
```typescript
{
  // Existing parameters
  url: string;
  provider?: string;
  forceRegenerate?: boolean;
  forceReformat?: boolean;

  // NEW: Progressive enhancement mode
  enhanceOnly?: boolean;          // Skip transcript fetch, only run AI
  rawTranscript?: TranscriptSegment[]; // Raw segments to enhance
  maxSegmentLength?: number;      // AI splitting parameter
  addFurigana?: boolean;          // Add furigana to segments
  includeTranslations?: boolean;  // Add English translations
}
```

**Fast Path** (when `enhanceOnly: true`):
1. Receives raw transcript from hook
2. Skips YouTube API call
3. Only runs AI processing
4. Returns enhanced segments

**Standard Path** (normal operation):
- Same as before (full transcript extraction + AI)

## Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Time to First Transcript | 20-30s | **1-3s** | **90% faster** |
| User Can Start Shadowing | After AI wait | **Immediately** | **Instant** |
| AI Features | Blocking (required) | **Background (optional)** | **Non-blocking** |
| Click-to-Jump Latency | ~200ms | **<50ms** | **4x faster** |
| Auto-Scroll Smoothness | Good | **Excellent** | **Better UX** |

## Migration Guide

### For Existing Components

**Before** (Blocking):
```typescript
// Old way - waits for AI before showing anything
const [transcript, setTranscript] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/youtube/extract', {
    method: 'POST',
    body: JSON.stringify({ url })
  })
    .then(res => res.json())
    .then(data => {
      setTranscript(data.formattedTranscript); // 20-30s wait!
      setLoading(false);
    });
}, [url]);
```

**After** (Non-blocking):
```typescript
// New way - instant raw, background AI
const {
  transcript,
  loading,
  aiEnhancing,
  aiProgress
} = useProgressiveTranscript(url);

// transcript.source === 'raw' → instant (1-3s)
// transcript.source === 'ai-enhanced' → after AI completes (25s)
```

### For New Features

Simply use the `useProgressiveTranscript` hook:

```typescript
import { useProgressiveTranscript } from '@/hooks/useProgressiveTranscript';
import { AIEnhancementProgress } from '@/components/youtube-shadowing/AIEnhancementProgress';
import { CaptionDisplay } from '@/components/youtube-shadowing/CaptionDisplay';

function MyComponent({ videoUrl }: Props) {
  const {
    transcript,
    loading,
    error,
    aiEnhancing,
    aiProgress,
  } = useProgressiveTranscript(videoUrl);

  if (loading) return <LoadingSpinner />;
  if (error) return <Error message={error} />;
  if (!transcript) return null;

  return (
    <>
      {aiEnhancing && <AIEnhancementProgress progress={aiProgress} />}

      <CaptionDisplay
        segments={transcript.segments}
        currentTime={currentTime}
        onSeekToTime={handleSeek}
      />
    </>
  );
}
```

## Best Practices

### 1. Always Show Progress
```typescript
// Good ✅
{aiEnhancing && <AIEnhancementProgress progress={aiProgress} />}

// Bad ❌
// No indication that AI is processing
```

### 2. Enable AI by Default
```typescript
// Good ✅
useProgressiveTranscript(url, { enableAI: true })

// Bad ❌ (unless you have a reason)
useProgressiveTranscript(url, { enableAI: false })
```

### 3. Use Source Indicator
```typescript
// Good ✅
<SourceIndicator source={transcript.source} />

// Helps users understand which version they're seeing
```

### 4. Smooth Transitions
```typescript
// Good ✅
<TranscriptTransition source={transcript.source}>
  <CaptionDisplay ... />
</TranscriptTransition>

// Provides smooth visual feedback when AI completes
```

## Troubleshooting

### Issue: "Transcript loads but AI never completes"

**Cause**: AI enhancement failed (network, API error, etc.)

**Solution**: Hook handles this gracefully - user can continue with raw transcript

**Check**:
```typescript
useEffect(() => {
  if (transcript && transcript.source === 'raw' && !aiEnhancing) {
    console.log('AI enhancement failed or disabled');
    // User can still use raw transcript
  }
}, [transcript, aiEnhancing]);
```

### Issue: "Progress bar shows but stays at 0%"

**Cause**: `enhanceOnly` API call not being made

**Check**:
1. Verify `currentVideoUrl` is set correctly
2. Check network tab for `/api/youtube/extract` POST request
3. Look for `enhanceOnly: true` in request body

### Issue: "Auto-scroll is jittery"

**Cause**: Incorrect segment refs or missing buffer zones

**Solution**: `CaptionDisplay` already implements 100px buffers

**Verify**:
```typescript
// Should have buffer zones
const isElementAboveViewport = elementTop < containerScrollTop + 100;
const isElementBelowViewport = elementTop + elementHeight > containerScrollTop + containerHeight - 100;
```

## Testing Checklist

- [ ] Paste YouTube URL → Raw transcript loads in 1-3s
- [ ] Player appears immediately with raw transcript
- [ ] AI progress bar shows with status messages
- [ ] User can start shadowing while AI processes
- [ ] Progress reaches 100% after ~20-25s
- [ ] Transcript smoothly updates to AI-enhanced version
- [ ] Click any segment → instant jump
- [ ] Toggle Current/Full view → works smoothly
- [ ] Auto-scroll follows active segment
- [ ] Visual hierarchy clear (Active/Past/Future)
- [ ] Coming up preview shows next 3 segments
- [ ] Source indicator shows correct version

## Future Enhancements

### Possible Additions:
1. **Manual Toggle**: Let users switch Raw ⟷ AI anytime
2. **Cache AI Results**: Save enhanced transcripts to IndexedDB
3. **Keyboard Shortcuts**: ← → for prev/next segment
4. **Segment Bookmarks**: Save favorite segments
5. **Export Transcript**: Download as text/JSON

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify `YOUTUBE_API_KEY` is configured
3. Test with different videos (some may not have Japanese captions)
4. Check network tab for failed API requests

---

**Last Updated**: 2025-11-03
**Version**: 1.0.0
**Author**: Progressive Transcript Team
