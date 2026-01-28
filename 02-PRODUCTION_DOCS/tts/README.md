# Text-to-Speech (TTS) System

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview

Moshimoshi's TTS system provides high-quality Japanese audio playback using a multi-provider architecture with dual-layer caching. It prioritizes VOICEVOX for natural Japanese speech, falls back to ElevenLabs for premium quality, and uses Web Speech API as a final fallback.

## Quick Start

1. **Read system guide**: See `TTS_SYSTEM_GUIDE.md` for complete documentation
2. **Use in components**: Import and use `useTTS` hook
3. **Cache management**: Dual-layer caching (Firestore + IndexedDB)
4. **iOS compatibility**: Special handling for iOS audio playback
5. **Playback speed**: Adjustable speed with pitch preservation

## Documentation

| Document | Description |
|----------|-------------|
| [TTS_SYSTEM_GUIDE.md](./TTS_SYSTEM_GUIDE.md) | Complete developer onboarding guide for the TTS system |

## Key Topics

- **Multi-provider architecture** - VOICEVOX → ElevenLabs → Web Speech API
- **Dual-layer caching** - Firestore (server) + IndexedDB (client)
- **useTTS hook** - React hook for easy integration
- **API routes** - `/api/tts/*` endpoints
- **iOS workarounds** - Touch-initiated playback for Safari
- **Playback speed** - Adjustable with pitch preservation
- **Performance optimization** - Preloading and caching strategies

## Architecture

```
TTS System
├── Provider Chain
│   ├── 1. VOICEVOX (Primary - Natural Japanese)
│   ├── 2. ElevenLabs (Premium - High quality)
│   └── 3. Web Speech API (Fallback - Built-in)
├── Caching Strategy
│   ├── Server: Firestore (permanent cache)
│   ├── Client: IndexedDB (offline playback)
│   └── Memory: Session cache (quick access)
├── React Integration
│   ├── useTTS hook (component integration)
│   ├── Audio player component
│   └── Preload utilities
└── API Layer
    ├── /api/tts/generate (Audio generation)
    ├── /api/tts/cache (Cache management)
    └── /api/tts/status (Provider health)
```

## Key Files

- `src/hooks/useTTS.ts:89` - Main React hook for TTS
- `src/lib/tts/service.ts:156` - Server-side orchestration
- `src/lib/tts/providers/voicevox.ts:67` - VOICEVOX provider
- `src/lib/tts/providers/elevenlabs.ts:78` - ElevenLabs provider
- `src/lib/tts/offlineCache.ts:45` - IndexedDB cache manager
- `src/app/api/tts/generate/route.ts:34` - Audio generation API

## Using the useTTS Hook

```typescript
import { useTTS } from '@/hooks/useTTS';

function MyComponent() {
  const { play, isPlaying, isLoading } = useTTS();

  const handlePlay = async () => {
    await play('こんにちは', { speed: 1.0 });
  };

  return (
    <button onClick={handlePlay} disabled={isPlaying}>
      {isPlaying ? 'Playing...' : 'Play Audio'}
    </button>
  );
}
```

## Provider Selection

The system automatically selects providers in this order:

1. **VOICEVOX** (Primary)
   - Most natural Japanese pronunciation
   - Free and fast
   - Local deployment option
   - Best for: General Japanese text

2. **ElevenLabs** (Premium)
   - Highest audio quality
   - Emotional expression
   - Costs per character
   - Best for: Premium users, dialogue

3. **Web Speech API** (Fallback)
   - Browser built-in
   - No cost, always available
   - Lower quality
   - Best for: Emergency fallback

## Caching Strategy

### Server Cache (Firestore)
- Permanent storage
- Shared across all users
- Reduces API calls
- Indexed by text hash

### Client Cache (IndexedDB)
- Offline playback support
- Per-device storage
- Automatic cleanup (30 day expiry)
- Quick access for repeated plays

### Memory Cache (Session)
- In-memory for current session
- Fastest access
- Cleared on page reload
- Used for frequently played audio

## iOS Compatibility

iOS requires special handling:
- Audio must be initiated by user touch event
- Preload on mount, play on first interaction
- Use `AudioContext` with unlock pattern
- Handle audio session interruptions

See `TTS_SYSTEM_GUIDE.md` for implementation details.

## Playback Speed

Supports speed adjustment (0.5x - 2.0x):
- Preserves pitch using playbackRate API
- Fallback to time-stretch algorithm
- Speed stored in user preferences
- Consistent across all providers

## Performance Optimization

- **Preloading**: Load audio before user action
- **Batch requests**: Generate multiple audio files together
- **Progressive loading**: Start playback while downloading
- **Connection pooling**: Reuse provider connections
- **Lazy loading**: Load TTS only when needed

## API Endpoints

### POST /api/tts/generate
Generate audio for text:
```typescript
{
  text: string;
  options?: {
    provider?: 'voicevox' | 'elevenlabs' | 'webspeech';
    speed?: number;
    voice?: string;
  }
}
```

### GET /api/tts/cache/:hash
Retrieve cached audio by hash

### DELETE /api/tts/cache/:hash
Clear specific cached audio

### GET /api/tts/status
Check provider health and availability

## Extending to New Components

1. Import `useTTS` hook
2. Call `play()` with Japanese text
3. Handle loading and error states
4. Consider preloading for better UX
5. Test on iOS devices

See [TTS_SYSTEM_GUIDE.md](./TTS_SYSTEM_GUIDE.md) for detailed examples.

## Troubleshooting

### Audio not playing on iOS
- Ensure play() is called from touch event
- Check audio session is unlocked
- Verify user gesture requirement

### Poor audio quality
- Check provider selection order
- Verify VOICEVOX is available
- Consider upgrading to ElevenLabs

### Slow playback
- Enable preloading
- Check cache hit rate
- Verify network connection

---

*For complete implementation guide, see [TTS_SYSTEM_GUIDE.md](./TTS_SYSTEM_GUIDE.md)*
