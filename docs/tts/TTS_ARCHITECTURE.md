# TTS (Text-to-Speech) System Architecture

## Overview
A smart, cache-first TTS system that uses Google TTS for short content and ElevenLabs for longer content, with permanent caching to minimize API calls and costs.

## Core Principles

### 1. Cache-First Approach
- **Every unique text is synthesized only ONCE**
- Audio files stored permanently in Firebase Storage
- Metadata stored in Firestore for fast lookups
- Zero redundant API calls for identical text

### 2. Dual-Provider Strategy
- **Google TTS**: Individual characters (hiragana, katakana, kanji)
- **ElevenLabs**: Words, sentences, paragraphs, articles, stories

### 3. Plug-and-Play Design
- Works as drop-in replacement for existing audio features
- No component refactoring required
- Automatic provider selection based on content length

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Application                   │
├─────────────────────────────────────────────────────────┤
│                      useTTS() Hook                       │
│                   ┌──────────────────┐                   │
│                   │  - Play audio    │                   │
│                   │  - Preload       │                   │
│                   │  - Queue         │                   │
│                   └──────────────────┘                   │
├─────────────────────────────────────────────────────────┤
│                    TTS Service Layer                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │            Cache Check (Firestore)                │  │
│  │                     ↓                             │  │
│  │         [Exists?] → Return URL                    │  │
│  │             ↓                                     │  │
│  │         [Not Exists?] → Provider Selection       │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    Provider Layer                        │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │   Google TTS     │    │   ElevenLabs     │          │
│  │  (< 10 chars)    │    │  (>= 10 chars)   │          │
│  └──────────────────┘    └──────────────────┘          │
├─────────────────────────────────────────────────────────┤
│                    Storage Layer                         │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │ Firebase Storage │    │    Firestore     │          │
│  │   (Audio Files)  │    │    (Metadata)    │          │
│  └──────────────────┘    └──────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

## Technical Decisions

### Audio Format
- **Format**: MP3
- **Bitrate**: 128kbps
- **Sample Rate**: 22050 Hz
- **Channels**: Mono
- **Rationale**: Optimal balance between quality and file size for speech

### Storage Strategy
- **Firebase Storage**: Audio file storage with CDN
- **Firestore**: Metadata and URL caching
- **Path Structure**: `/tts/{provider}/{hash}/{filename}.mp3`
- **Hash**: MD5 of normalized text for deduplication

### Text Processing
- **Normalization**: Remove extra spaces, normalize Unicode
- **Kanji Handling**: Cache kanji version only (no furigana variants)
- **Hash Generation**: MD5(provider + voice + normalized_text)

### Provider Selection Logic
```typescript
if (text.length < 10 || isKanaOrKanji(text)) {
  return 'google';
} else {
  return 'elevenlabs';
}
```

### Offline Support (PWA)
- Service Worker caches common audio files
- IndexedDB stores audio blob data
- Priority list for offline caching:
  1. All hiragana/katakana characters
  2. Common greeting phrases
  3. JLPT N5 vocabulary
  4. User's recent audio history

## API Routes

### `/api/tts/synthesize`
**Method**: POST  
**Purpose**: Generate or retrieve TTS audio
```typescript
{
  text: string;
  options?: {
    provider?: 'google' | 'elevenlabs';
    voice?: string;
    speed?: number;
  }
}
```

### `/api/tts/preload`
**Method**: POST  
**Purpose**: Batch preload multiple texts
```typescript
{
  texts: string[];
  priority?: 'low' | 'normal' | 'high';
}
```

### `/api/tts/cache-status`
**Method**: GET  
**Purpose**: Check cache statistics
```typescript
Response: {
  totalCached: number;
  totalSize: number;
  providers: {
    google: number;
    elevenlabs: number;
  }
}
```

## Database Schema

### Firestore Collection: `tts_cache`
```typescript
{
  id: string;              // MD5 hash
  text: string;            // Original text
  normalizedText: string;  // Processed text
  provider: string;        // 'google' | 'elevenlabs'
  voice: string;           // Voice ID
  audioUrl: string;        // Firebase Storage URL
  storagePath: string;     // Storage path
  duration: number;        // Audio duration in seconds
  size: number;            // File size in bytes
  createdAt: timestamp;    // Creation time
  lastAccessedAt: timestamp; // Last access
  accessCount: number;     // Usage counter
  metadata: {
    type: string;          // 'character' | 'word' | 'sentence' | 'paragraph'
    language: string;      // 'ja'
    context?: string;      // Optional context
  }
}
```

## Cost Optimization

### API Call Minimization
- Permanent caching eliminates duplicate synthesis
- Batch processing for multiple texts
- Queue system with deduplication

### Storage Optimization
- MP3 compression reduces file size by ~90%
- CDN delivery reduces bandwidth costs
- Lazy loading prevents unnecessary downloads

### Estimated Costs
- **Google TTS**: ~$4 per 1 million characters
- **ElevenLabs**: ~$0.30 per 1,000 characters
- **Firebase Storage**: ~$0.026 per GB/month
- **Expected monthly cost**: < $50 for 10,000 active users

## Implementation Phases

### Phase 1: Core Infrastructure
- [x] TypeScript types and interfaces
- [ ] Firebase configuration
- [ ] Basic cache service
- [ ] API route structure

### Phase 2: Provider Integration
- [ ] Google TTS client
- [ ] ElevenLabs client
- [ ] Provider selection logic
- [ ] Error handling

### Phase 3: Caching Layer
- [ ] Firestore cache checks
- [ ] Firebase Storage uploads
- [ ] Deduplication logic
- [ ] Cache statistics

### Phase 4: React Integration
- [ ] useTTS hook
- [ ] Audio player component
- [ ] Preload utilities
- [ ] Queue management

### Phase 5: Offline Support
- [ ] Service Worker integration
- [ ] IndexedDB storage
- [ ] Offline detection
- [ ] Sync on reconnect

### Phase 6: UI Components
- [ ] Speaker icon button
- [ ] Audio controls
- [ ] Loading states
- [ ] Error feedback

## Security Considerations

### API Key Protection
- All API keys stored in environment variables
- Server-side only synthesis (no client-side API calls)
- Rate limiting on API routes

### Content Validation
- Text length limits (max 5000 characters)
- Character whitelist for Japanese content
- XSS prevention in text processing

### Access Control
- Public read access to cached audio
- Write access only through API routes
- Admin-only cache management endpoints

## Monitoring & Analytics

### Metrics to Track
- Cache hit rate
- Synthesis time
- Storage usage
- Provider usage distribution
- Popular content patterns

### Error Tracking
- Provider API failures
- Storage upload failures
- Cache miss reasons
- Synthesis errors

## Testing Strategy

### Unit Tests
- Text normalization
- Provider selection logic
- Cache key generation
- Error handling

### Integration Tests
- API route functionality
- Provider API calls
- Storage operations
- Cache operations

### E2E Tests
- Audio playback
- Offline functionality
- Queue processing
- Error recovery

## Migration Path

### Existing Audio Integration
1. Current state: Static MP3 files in `/data/audio/`
2. Migration: Keep existing files, new content uses TTS
3. Gradual replacement as content is accessed
4. No breaking changes to components

## Future Enhancements

### Planned Features
- [ ] Multiple voice options
- [ ] User voice preferences
- [ ] Speech speed control
- [ ] Pronunciation variants
- [ ] SSML support for emphasis

### Potential Optimizations
- [ ] Edge caching with Cloudflare
- [ ] WebAssembly audio processing
- [ ] Streaming for long content
- [ ] Predictive preloading
- [ ] P2P audio sharing

---

*Last Updated: January 2025*  
*Version: 1.0.0*