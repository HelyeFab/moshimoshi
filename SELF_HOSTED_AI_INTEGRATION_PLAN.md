# Self-Hosted AI Integration Plan: Moshimoshi → Sheldon

**Date**: 2025-11-04
**Objective**: Integrate Sheldon's self-hosted AI services (Edge-TTS, Ollama) into Moshimoshi
**Estimated Time**: 2-3 hours total
**Cost Savings**: $70-120/month → $0/month

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Expose Services via Caddy](#phase-1-expose-services-via-caddy)
4. [Phase 2: Edge-TTS Integration](#phase-2-edge-tts-integration)
5. [Phase 3: Ollama LLM Integration](#phase-3-ollama-llm-integration)
6. [Phase 4: Testing & Validation](#phase-4-testing--validation)
7. [Phase 5: Deployment](#phase-5-deployment)
8. [Rollback Plan](#rollback-plan)
9. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Current State Analysis

### Sheldon Infrastructure (Already Running)

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| **Ollama** | 11434 | ✅ Running | LLM inference (5 models) |
| **Edge-TTS** | 8090 | ✅ Healthy | Text-to-speech (100+ voices) |
| **Transcript Service** | 5000 | ✅ Healthy | Japanese transcripts (already integrated!) |
| **Stable Diffusion** | 7860 | ✅ Healthy | Image generation |
| **Whisper ASR** | 8092 | ✅ Healthy | Speech-to-text |
| **Caddy Gateway** | 80/443 | ✅ Running | SSL/reverse proxy |

### Ollama Models Available

```
llama3.2:1b        (1.3GB)  - Fast, lightweight chat
llama3.2:latest    (2GB)    - Balanced chat
deepseek-r1:8b     (5GB)    - Reasoning model
devstral:24b       (14GB)   - Advanced coding/analysis
qwen3-vl:235b      (384GB)  - Vision model (cloud-based)
```

### Moshimoshi Current AI Usage

**Features Using External APIs:**
1. **Grammar Hints** → OpenAI/Claude API
2. **Kanji Explanations** → OpenAI/Claude API
3. **Study Plan Generation** → OpenAI/Claude API
4. **TTS for Vocabulary** → ElevenLabs/OpenAI TTS
5. **Translation Checks** → OpenAI/Claude API

**Current Monthly Cost Estimate:**
- OpenAI GPT-4: $50-100/month
- TTS (ElevenLabs): $22-50/month
- **Total**: ~$70-150/month

---

## Architecture Overview

### Current Architecture
```
Moshimoshi (Vercel)
    ↓
    → OpenAI API ($$$)
    → ElevenLabs TTS ($$$)
    → Claude API ($$$)
```

### Proposed Architecture
```
Moshimoshi (Vercel)
    ↓
    ├─→ https://ai.selfmind.dev (Ollama) [$0]
    ├─→ https://tts.selfmind.dev (Edge-TTS) [$0]
    └─→ https://transcript.selfmind.dev (Already working!) [$0]
         ↓
         Caddy Gateway (Sheldon)
              ↓
              ├─→ ollama:11434
              ├─→ edge-tts:8090
              └─→ transcript:5000
```

### Hybrid Fallback Strategy
```
Moshimoshi Feature Request
    ↓
    Try Sheldon (fast, free)
    ↓ (if fails or slow)
    Fallback to OpenAI/Claude (paid, reliable)
```

---

## Phase 1: Expose Services via Caddy

**Time**: 10 minutes
**Risk**: Low (just adding reverse proxy rules)

### Step 1.1: Update Caddyfile

**File**: `/home/sheldon/ai-gateway/caddy/Caddyfile`

Add these blocks:

```caddy
# Edge-TTS Service
tts.selfmind.dev {
    reverse_proxy 172.19.0.1:8090 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}

# Ollama LLM Service
ai.selfmind.dev {
    reverse_proxy 172.19.0.1:11434 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}

        # Increase timeout for LLM generation
        transport http {
            read_timeout 120s
            write_timeout 120s
        }
    }
}
```

### Step 1.2: Backup Current Config

```bash
ssh sheldon
cd /home/sheldon/ai-gateway/caddy
cp Caddyfile Caddyfile.backup.ai-integration-$(date +%Y%m%d-%H%M)
```

### Step 1.3: Apply and Test

```bash
# Reload Caddy
docker exec ai-gateway-caddy caddy reload --config /etc/caddy/Caddyfile

# Test TTS service
curl https://tts.selfmind.dev/health

# Test Ollama service
curl https://ai.selfmind.dev/api/tags
```

**Expected Results:**
- `tts.selfmind.dev/health` → `{"status":"healthy","service":"edge-tts"}`
- `ai.selfmind.dev/api/tags` → JSON list of available models

### Step 1.4: DNS (if needed)

If subdomains don't exist in Cloudflare yet:

1. Go to Cloudflare DNS settings for `selfmind.dev`
2. Add CNAME records:
   - `tts.selfmind.dev` → CNAME → `selfmind.dev`
   - `ai.selfmind.dev` → CNAME → `selfmind.dev`
3. Set Proxy status: **Proxied** (for SSL)

---

## Phase 2: Edge-TTS Integration

**Time**: 45 minutes
**Risk**: Low (Edge-TTS is very stable)

### Step 2.1: Create TTS Service Wrapper

**File**: `/src/services/tts/edge-tts-client.ts`

```typescript
/**
 * Edge-TTS Client for Self-hosted TTS
 * Uses Sheldon's Edge-TTS service instead of external APIs
 */

interface EdgeTTSOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
}

export class EdgeTTSClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TTS_SERVICE_URL || 'https://tts.selfmind.dev';
  }

  /**
   * Generate Japanese audio from text
   */
  async generateAudio(
    text: string,
    options: EdgeTTSOptions = {}
  ): Promise<Blob> {
    const {
      voice = 'ja-JP-NanamiNeural',  // Default Japanese female voice
      rate = '+0%',
      pitch = '+0Hz'
    } = options;

    const response = await fetch(`${this.baseUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice,
        rate,
        pitch,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status} ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/voices`);
    if (!response.ok) throw new Error('Failed to fetch voices');
    const data = await response.json();
    return data.voices || [];
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### Step 2.2: Create TTS Service with Fallback

**File**: `/src/services/tts/tts-service.ts`

```typescript
import { EdgeTTSClient } from './edge-tts-client';
// Import your existing external TTS client (OpenAI/ElevenLabs)
import { ExternalTTSClient } from './external-tts-client';

export class TTSService {
  private edgeTTS: EdgeTTSClient;
  private externalTTS: ExternalTTSClient;

  constructor() {
    this.edgeTTS = new EdgeTTSClient();
    this.externalTTS = new ExternalTTSClient();
  }

  /**
   * Generate audio with automatic fallback
   * Tries Edge-TTS first (free, fast), falls back to external API if needed
   */
  async generateAudio(
    text: string,
    options: {
      voice?: string;
      language?: 'ja' | 'en';
      preferExternal?: boolean;
    } = {}
  ): Promise<{ audio: Blob; source: 'edge-tts' | 'external' }> {
    const { preferExternal = false } = options;

    // Try external first if explicitly requested
    if (preferExternal) {
      try {
        const audio = await this.externalTTS.generate(text, options);
        return { audio, source: 'external' };
      } catch (error) {
        console.warn('[TTS] External TTS failed, trying Edge-TTS', error);
      }
    }

    // Try Edge-TTS (self-hosted)
    try {
      const audio = await this.edgeTTS.generateAudio(text, {
        voice: options.language === 'ja' ? 'ja-JP-NanamiNeural' : 'en-US-JennyNeural',
      });
      return { audio, source: 'edge-tts' };
    } catch (error) {
      console.warn('[TTS] Edge-TTS failed, falling back to external', error);
    }

    // Fallback to external TTS
    try {
      const audio = await this.externalTTS.generate(text, options);
      return { audio, source: 'external' };
    } catch (error) {
      throw new Error('All TTS services failed');
    }
  }
}
```

### Step 2.3: Update Environment Variables

**File**: `.env.local` (and Vercel environment)

```env
# Self-hosted services
TTS_SERVICE_URL=https://tts.selfmind.dev
AI_SERVICE_URL=https://ai.selfmind.dev
TRANSCRIPT_SERVICE_URL=https://transcript.selfmind.dev

# Fallback to external APIs (optional)
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
```

### Step 2.4: Create API Route for TTS

**File**: `/src/app/api/tts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { TTSService } from '@/services/tts/tts-service';

const ttsService = new TTSService();

export async function POST(request: NextRequest) {
  try {
    const { text, voice, language, preferExternal } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const result = await ttsService.generateAudio(text, {
      voice,
      language,
      preferExternal,
    });

    // Return audio with source info
    return new NextResponse(result.audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-TTS-Source': result.source,
      },
    });
  } catch (error) {
    console.error('[TTS API] Error:', error);
    return NextResponse.json(
      { error: 'TTS generation failed' },
      { status: 500 }
    );
  }
}
```

### Step 2.5: Update Existing Components

Find components that use TTS (e.g., vocabulary practice, kanji readings) and update them:

**Example**: Update vocabulary audio generation

```typescript
// Before
const audio = await openaiTTS.generate(word.reading);

// After
const response = await fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: word.reading,
    language: 'ja',
  }),
});

const audioBlob = await response.blob();
const ttsSource = response.headers.get('X-TTS-Source');
console.log(`Audio generated via: ${ttsSource}`);
```

---

## Phase 3: Ollama LLM Integration

**Time**: 1 hour
**Risk**: Medium (model quality may vary)

### Step 3.1: Create Ollama Client

**File**: `/src/services/ai/ollama-client.ts`

```typescript
/**
 * Ollama Client for Self-hosted LLM inference
 */

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || 'https://ai.selfmind.dev';
  }

  /**
   * Generate completion using Ollama
   */
  async chat(
    messages: OllamaMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    const {
      model = 'llama3.2:1b',  // Default to fastest model
      temperature = 0.7,
    } = options;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama failed: ${response.status}`);
    }

    const data: OllamaResponse = await response.json();
    return data.message.content;
  }

  /**
   * Simple prompt (non-chat interface)
   */
  async generate(
    prompt: string,
    model: string = 'llama3.2:1b'
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### Step 3.2: Create AI Service with Fallback

**File**: `/src/services/ai/ai-service.ts`

```typescript
import { OllamaClient } from './ollama-client';
import { OpenAIClient } from './openai-client'; // Your existing client

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIService {
  private ollama: OllamaClient;
  private openai: OpenAIClient;

  constructor() {
    this.ollama = new OllamaClient();
    this.openai = new OpenAIClient();
  }

  /**
   * Generate AI response with automatic fallback
   * Use cases determine which model to use:
   * - Simple tasks (grammar hints, kanji readings) → Ollama llama3.2:1b (fast, free)
   * - Complex tasks (study plans, analysis) → Ollama devstral:24b (accurate, free)
   * - Premium/critical tasks → OpenAI GPT-4 (paid, highest quality)
   */
  async chat(
    messages: AIMessage[],
    options: {
      complexity?: 'simple' | 'medium' | 'complex';
      preferExternal?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<{ response: string; source: 'ollama' | 'openai'; model: string }> {
    const { complexity = 'simple', preferExternal = false, maxRetries = 1 } = options;

    // Choose model based on complexity
    const ollamaModel = this.selectOllamaModel(complexity);

    // Try external first if explicitly requested
    if (preferExternal) {
      try {
        const response = await this.openai.chat(messages);
        return { response, source: 'openai', model: 'gpt-4' };
      } catch (error) {
        console.warn('[AI] OpenAI failed, trying Ollama', error);
      }
    }

    // Try Ollama (self-hosted)
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.ollama.chat(messages, { model: ollamaModel });
        return { response, source: 'ollama', model: ollamaModel };
      } catch (error) {
        console.warn(`[AI] Ollama attempt ${attempt + 1} failed`, error);
        if (attempt === maxRetries - 1) break;
        await this.sleep(1000 * (attempt + 1)); // Exponential backoff
      }
    }

    // Fallback to OpenAI
    try {
      const response = await this.openai.chat(messages);
      return { response, source: 'openai', model: 'gpt-4' };
    } catch (error) {
      throw new Error('All AI services failed');
    }
  }

  /**
   * Select best Ollama model for task complexity
   */
  private selectOllamaModel(complexity: 'simple' | 'medium' | 'complex'): string {
    switch (complexity) {
      case 'simple':
        return 'llama3.2:1b';     // Fast, lightweight (1.3GB)
      case 'medium':
        return 'llama3.2:latest'; // Balanced (2GB)
      case 'complex':
        return 'devstral:24b';    // Advanced (14GB)
      default:
        return 'llama3.2:1b';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Step 3.3: Create API Route for AI

**File**: `/src/app/api/ai/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/ai/ai-service';

const aiService = new AIService();

export async function POST(request: NextRequest) {
  try {
    const { messages, complexity, preferExternal } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    const result = await aiService.chat(messages, {
      complexity,
      preferExternal,
    });

    return NextResponse.json({
      response: result.response,
      source: result.source,
      model: result.model,
    });
  } catch (error) {
    console.error('[AI API] Error:', error);
    return NextResponse.json(
      { error: 'AI generation failed' },
      { status: 500 }
    );
  }
}
```

### Step 3.4: Update Existing AI Features

**Use Case 1: Grammar Hints** (Simple task → Ollama llama3.2:1b)

```typescript
// Before
const hint = await openai.generate(`Explain this grammar: ${pattern}`);

// After
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      {
        role: 'system',
        content: 'You are a Japanese grammar expert. Provide concise explanations.',
      },
      {
        role: 'user',
        content: `Explain this grammar pattern: ${pattern}`,
      },
    ],
    complexity: 'simple', // Uses llama3.2:1b (fast, free)
  }),
});

const { response: hint, source } = await response.json();
console.log(`Grammar hint from: ${source}`);
```

**Use Case 2: Study Plan Generation** (Complex task → Ollama devstral:24b)

```typescript
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      {
        role: 'system',
        content: 'You are a Japanese learning expert. Create personalized study plans.',
      },
      {
        role: 'user',
        content: `Create a 30-day study plan for JLPT N3 level`,
      },
    ],
    complexity: 'complex', // Uses devstral:24b (accurate, free)
  }),
});
```

**Use Case 3: Premium Feature** (Force external API)

```typescript
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [...],
    preferExternal: true, // Forces OpenAI GPT-4 (paid, highest quality)
  }),
});
```

---

## Phase 4: Testing & Validation

**Time**: 30 minutes

### Step 4.1: Service Health Checks

```bash
# Test all services are accessible
curl https://tts.selfmind.dev/health
curl https://ai.selfmind.dev/api/tags
curl https://transcript.selfmind.dev/health

# Expected: All return 200 OK
```

### Step 4.2: TTS Integration Test

```bash
# Test TTS generation
curl -X POST https://tts.selfmind.dev/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "こんにちは、世界",
    "voice": "ja-JP-NanamiNeural"
  }' \
  --output test.mp3

# Verify audio file
file test.mp3  # Should show: Audio file with ID3 version 2.4.0
```

### Step 4.3: Ollama Integration Test

```bash
# Test Ollama chat
curl -X POST https://ai.selfmind.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "messages": [
      {"role": "user", "content": "Explain the Japanese particle は in one sentence"}
    ],
    "stream": false
  }'

# Expected: JSON response with explanation
```

### Step 4.4: Moshimoshi Integration Tests

Run from moshimoshi dev server:

```typescript
// Test TTS
const audioResponse = await fetch('/api/tts', {
  method: 'POST',
  body: JSON.stringify({ text: '日本語', language: 'ja' }),
});
console.log('TTS Source:', audioResponse.headers.get('X-TTS-Source'));

// Test AI
const aiResponse = await fetch('/api/ai/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Test' }],
    complexity: 'simple',
  }),
});
const data = await aiResponse.json();
console.log('AI Source:', data.source, 'Model:', data.model);
```

### Step 4.5: Performance Benchmarks

Track these metrics:

| Metric | Target | Measurement |
|--------|--------|-------------|
| TTS latency | <1s | Time to generate 100-char audio |
| AI simple task | <2s | Grammar hint generation |
| AI complex task | <5s | Study plan generation |
| Fallback rate | <5% | % of requests falling back to external APIs |

---

## Phase 5: Deployment

**Time**: 20 minutes

### Step 5.1: Environment Variables (Vercel)

Add to Vercel project settings:

```env
TTS_SERVICE_URL=https://tts.selfmind.dev
AI_SERVICE_URL=https://ai.selfmind.dev
TRANSCRIPT_SERVICE_URL=https://transcript.selfmind.dev
```

### Step 5.2: Deploy to Vercel

```bash
cd /home/helye/DevProject/personal/moshimoshi

# Commit changes
git add .
git commit -m "feat: integrate self-hosted AI services (TTS, Ollama, Transcripts)

- Add Edge-TTS client with fallback to external TTS
- Add Ollama client with model selection based on complexity
- Create unified AI and TTS services with automatic fallback
- Update all existing AI features to use new services
- Cost savings: ~$70-120/month → $0/month"

# Push to trigger Vercel deployment
git push origin main
```

### Step 5.3: Verify Production Deployment

```bash
# After Vercel deployment completes
curl https://moshimoshi.vercel.app/api/tts/health
curl https://moshimoshi.vercel.app/api/ai/health

# Test feature in production
# Navigate to vocabulary practice, test audio generation
# Check browser console for source: should show "edge-tts" or "ollama"
```

---

## Rollback Plan

### If Something Goes Wrong:

**Option 1: Quick Rollback (5 minutes)**

```bash
# Revert Caddy config
ssh sheldon
cd /home/sheldon/ai-gateway/caddy
cp Caddyfile.backup.* Caddyfile
docker exec ai-gateway-caddy caddy reload

# Revert Vercel env vars
# In Vercel dashboard, remove:
# - TTS_SERVICE_URL
# - AI_SERVICE_URL
# Services will fallback to external APIs automatically
```

**Option 2: Feature Flag (if implemented)**

```env
# In Vercel, set:
ENABLE_SELF_HOSTED_AI=false

# Code checks this flag and uses external APIs only
```

**Option 3: Code Rollback**

```bash
cd /home/helye/DevProject/personal/moshimoshi
git revert HEAD
git push origin main
```

### Monitoring for Issues:

Watch for these signs:
- ⚠️ High fallback rate (>20% requests using external APIs)
- ⚠️ Increased latency (>5s for simple tasks)
- ⚠️ Error spikes in Vercel logs
- ⚠️ Sheldon server load >80% CPU/RAM

**Immediate Actions:**
1. Check Sheldon services: `ssh sheldon "docker ps"`
2. Check Caddy logs: `ssh sheldon "docker logs ai-gateway-caddy | tail -50"`
3. Check Ollama logs: `ssh sheldon "journalctl -u ollama -n 50"`
4. If critical: Rollback immediately

---

## Monitoring & Maintenance

### Daily Checks (Automated)

Create health check endpoint:

**File**: `/src/app/api/health/ai-services/route.ts`

```typescript
import { EdgeTTSClient } from '@/services/tts/edge-tts-client';
import { OllamaClient } from '@/services/ai/ollama-client';

export async function GET() {
  const tts = new EdgeTTSClient();
  const ai = new OllamaClient();

  const [ttsHealthy, aiHealthy] = await Promise.all([
    tts.healthCheck(),
    ai.healthCheck(),
  ]);

  return Response.json({
    tts: { healthy: ttsHealthy, url: process.env.TTS_SERVICE_URL },
    ai: { healthy: aiHealthy, url: process.env.AI_SERVICE_URL },
    timestamp: new Date().toISOString(),
  });
}
```

### Weekly Tasks

1. **Check Sheldon disk space**: `ssh sheldon "df -h /"`
2. **Review Ollama model usage**: Which models are most used?
3. **Check error rates**: Review Vercel logs for AI/TTS failures
4. **Performance metrics**: Track average response times

### Monthly Tasks

1. **Update Ollama models**: `ssh sheldon "ollama pull llama3.2:latest"`
2. **Review cost savings**: Compare to previous external API costs
3. **Evaluate model quality**: User feedback on AI responses
4. **Consider model upgrades**: New Ollama models available?

### Metrics to Track

**File**: Create a simple tracking sheet

| Date | TTS Requests | TTS Fallback % | AI Requests | AI Fallback % | Cost Saved |
|------|-------------|----------------|-------------|---------------|------------|
| 2025-11-05 | 1,250 | 2% | 850 | 5% | $12.50 |
| 2025-11-12 | 1,480 | 1% | 920 | 3% | $14.20 |

---

## Cost-Benefit Analysis

### Monthly Costs

**Before (External APIs):**
```
OpenAI GPT-4:     $50-100/month
ElevenLabs TTS:   $22-50/month
Total:            $72-150/month
Annual:           $864-1,800/year
```

**After (Self-hosted):**
```
Sheldon server:   $0 (already running)
Bandwidth:        ~$2/month (if heavy usage)
Total:            ~$2/month
Annual:           ~$24/year

Savings:          $840-1,776/year
```

### Performance Comparison

| Task | External API | Self-hosted | Winner |
|------|-------------|-------------|---------|
| Simple grammar hint | 1-2s | 0.5-1s | ✅ Self-hosted |
| Complex analysis | 2-3s | 2-4s | 🟰 Similar |
| TTS generation | 1-2s | 0.3-0.5s | ✅ Self-hosted |
| Quality (simple) | 9/10 | 7-8/10 | External |
| Quality (complex) | 10/10 | 8-9/10 | External |
| Availability | 99.9% | 98% | External |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Sheldon downtime | Medium | High | Automatic fallback to external APIs |
| Poor quality responses | Low | Medium | Use external for premium features |
| High latency | Low | Medium | Monitor and optimize model selection |
| Out of memory | Low | High | Monitor RAM usage, limit concurrent requests |

---

## Success Criteria

### Technical Metrics
- ✅ All services accessible via HTTPS subdomains
- ✅ <5% fallback rate to external APIs
- ✅ <2s average response time for simple tasks
- ✅ No increase in error rates

### Business Metrics
- ✅ $70+ monthly cost savings
- ✅ 2x faster TTS generation
- ✅ No degradation in user experience
- ✅ Reduced dependency on external services

### User Experience
- ✅ No noticeable quality difference for simple tasks
- ✅ Faster audio generation for vocabulary practice
- ✅ Same or better response times overall

---

## Appendices

### Appendix A: Japanese TTS Voices Available

**Edge-TTS Japanese Voices:**
- `ja-JP-NanamiNeural` (Female, natural, recommended)
- `ja-JP-KeitaNeural` (Male, natural)
- `ja-JP-AoiNeural` (Female, young)
- `ja-JP-DaichiNeural` (Male, young)
- `ja-JP-MayuNeural` (Female, calm)
- `ja-JP-NaokiNeural` (Male, energetic)
- `ja-JP-ShioriNeural` (Female, friendly)

### Appendix B: Ollama Model Selection Guide

| Task Type | Recommended Model | Reasoning |
|-----------|------------------|-----------|
| Grammar hints | `llama3.2:1b` | Fast, good enough for simple explanations |
| Kanji readings | `llama3.2:1b` | Straightforward, no complex reasoning needed |
| Vocabulary definitions | `llama3.2:latest` | Better quality, still fast |
| Translation checks | `llama3.2:latest` | Needs bilingual understanding |
| Study plans | `devstral:24b` | Complex reasoning, long-form output |
| Code generation | `devstral:24b` | Specialized coding model |
| Deep analysis | External (GPT-4) | Highest quality for premium features |

### Appendix C: Troubleshooting Guide

**Problem**: TTS service not responding

**Solutions**:
1. Check Edge-TTS container: `ssh sheldon "docker ps | grep edge-tts"`
2. Check Caddy routing: `ssh sheldon "docker logs ai-gateway-caddy | grep tts"`
3. Test directly: `ssh sheldon "curl http://localhost:8090/health"`
4. Restart if needed: `ssh sheldon "docker restart edge-tts"`

**Problem**: Ollama slow or timing out

**Solutions**:
1. Check RAM usage: `ssh sheldon "free -h"`
2. Check running models: `ssh sheldon "curl localhost:11434/api/ps"`
3. Reduce concurrent requests
4. Use smaller model (llama3.2:1b instead of devstral:24b)

**Problem**: High fallback rate

**Solutions**:
1. Check Sheldon server health
2. Review error logs in Vercel
3. Increase timeout limits
4. Consider adding rate limiting

---

## Conclusion

This integration plan provides:

1. **Immediate cost savings** of $70-120/month
2. **Faster performance** for TTS and simple AI tasks
3. **Full fallback capability** to external APIs
4. **Privacy benefits** (data stays on your server)
5. **Scalability** (unlimited usage on Sheldon)

**Recommended Approach:**
- Start with Phase 1-2 (TTS only) - Low risk, high value
- Monitor for 1 week
- Then proceed with Phase 3 (Ollama) - Higher complexity
- Always maintain external API fallbacks

**Timeline:**
- Day 1: Phases 1-2 (TTS integration)
- Day 7: Review metrics, proceed to Phase 3
- Day 14: Full production deployment
- Day 30: Evaluate and optimize

**Total estimated time**: 2-3 hours initial setup + ongoing monitoring

---

**Last Updated**: 2025-11-04
**Status**: Ready for implementation
**Risk Level**: Low (with proper fallbacks)
**ROI**: High ($840-1,776/year savings)
