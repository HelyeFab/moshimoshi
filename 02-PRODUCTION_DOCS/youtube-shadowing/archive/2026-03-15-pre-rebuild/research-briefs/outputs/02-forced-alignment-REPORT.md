# Forced Alignment And Timing Refinement

Title: Forced Alignment And Timing Refinement For Japanese YouTube Shadowing

Date: 2026-03-12

Researcher: Agent 2 (Claude)

Problem Area: If we improve transcript text boundaries, how can we recover precise Japanese timing for loop-safe playback?

## 1. Executive Summary

- **Strongest finding**: stable-ts (Whisper-based re-transcription with timestamp refinement) is the most practical path for Moshimoshi. It can re-transcribe or align existing text to audio with word-level Japanese timestamps (~50-100ms precision), runs on CPU with faster-whisper backend, integrates as a Python microservice, and directly replaces the current `aiTimingAlignment.ts` character-proportional approach with acoustic-grounded timing.

- **Most promising technology**: stable-ts with faster-whisper backend (for per-video alignment), supplemented by the OpenAI Whisper API (for zero-infrastructure fallback). Both produce word-level timestamps for Japanese without requiring GPU infrastructure.

- **Biggest risk**: No forced alignment tool has perfect Japanese support. Japanese is a language without spaces, so "word-level" timestamps for Japanese actually produce character-level or morpheme-level boundaries depending on the tool. The current `aiTimingAlignment.ts` distributes timing proportionally by character count — any acoustic alignment tool will be strictly better than this, but imperfect.

- **Final recommendation**: **Pursue** stable-ts as the primary alignment layer; **prototype** the Whisper API as a cloud fallback; **park** WhisperX and MFA for later evaluation. The current `aiTimingAlignment.ts` should be replaced with acoustic-grounded alignment, either via a self-hosted stable-ts microservice or via the Whisper API with `timestamp_granularities[]=word`.

## 2. Best 3 Options

### Option 1: stable-ts + faster-whisper (Self-Hosted Microservice)

- **Name**: stable-ts with faster-whisper backend
- **Type**: `ML` (Whisper-based with CTC refinement)
- **What it does**: Re-transcribes audio using Whisper while refining timestamps through multiple passes (silence suppression, cross-attention refinement, dynamic time warping). Can also align existing text to audio via its `align()` method — given a transcript and audio, it produces word-level timestamps without needing to re-transcribe.
- **Why it helps segmentation quality**: After Agent 1 improves text boundaries (punctuation restoration, sentence segmentation), stable-ts recovers precise acoustic timing for each new segment boundary. The key capability is `align(audio, text, language='ja')` which takes re-segmented text and maps it back to the audio timeline with acoustic precision, not character-proportional guessing.
- **Timing preservation or re-alignment story**: Two modes: (a) **Re-transcription mode**: runs Whisper on the audio and produces its own transcript with word-level timestamps; these can be matched to improved segments via text alignment. (b) **Align mode**: takes existing text and audio, produces timestamps using Whisper's cross-attention mechanism. Mode (b) is ideal for our use case — take the re-segmented text from the deterministic/AI pipeline and align it acoustically.
- **Fit with current Moshimoshi stack**: Excellent. Replaces `aiTimingAlignment.ts`'s character-proportional distribution with acoustic-grounded timestamps. Would run as a Python microservice called from the `/api/youtube/resegment` route or a new `/api/youtube/align` endpoint. The output format (segments with start/end times) maps directly to the existing `TimedTextSegment` interface.
- **Runtime / latency**: faster-whisper on CPU processes ~10x real-time with `base` model (a 5-minute video aligns in ~30 seconds). With `tiny` model, ~20x real-time (~15 seconds for 5 minutes). GPU (T4 or better) achieves 50-70x real-time. Alignment-only mode (no transcription) is faster since it uses only the cross-attention mechanism.
- **Infra cost**: Self-hosted Python service. CPU-only deployment on a $5-20/mo VPS is viable for moderate traffic. GPU deployment (e.g., Railway GPU, RunPod) at $0.20-0.50/hr for burst usage. Can be deployed as a sidecar to the existing infrastructure.
- **Licensing**: MIT license (stable-ts). faster-whisper is MIT. Whisper models are MIT.
- **Risks**: (1) Adds a Python dependency to a Node.js stack — requires a microservice architecture. (2) Audio extraction from YouTube required server-side (TOS gray area, same as current transcript extraction). (3) Japanese word boundaries are morpheme-level, not always matching human intuition. (4) Alignment quality degrades if the text diverges significantly from what's actually spoken.
- **Recommendation**: `pursue`

### Option 2: OpenAI Whisper API with word_timestamps

- **Name**: OpenAI Whisper API (`/v1/audio/transcriptions` with `timestamp_granularities[]=word`)
- **Type**: `ML` (cloud API)
- **What it does**: Re-transcribes audio via OpenAI's hosted Whisper model and returns word-level timestamps in the response. Uses `response_format=verbose_json` to get per-word start/end times.
- **Why it helps segmentation quality**: Provides word-level Japanese timestamps with no infrastructure to manage. The re-transcription can be text-matched against improved segments to assign acoustic timing. While it doesn't directly align existing text, the word-level timestamps from re-transcription can be mapped to re-segmented text using the same character-anchoring approach already in `aiTimingAlignment.ts` — but with acoustically-grounded source timestamps instead of proportional ones.
- **Timing preservation or re-alignment story**: Re-transcribe → get word timestamps → anchor re-segmented text against these word timestamps. This is a "re-transcribe then re-anchor" approach rather than direct forced alignment of existing text. The current `alignAiTextsToSourceTimeline()` function already does character-level anchoring; it just needs better source timestamps, which this provides.
- **Fit with current Moshimoshi stack**: Excellent fit as a cloud fallback. The app already uses OpenAI for AI resegmentation (`gpt-4o-mini`). Adding a Whisper API call is minimal code. Output feeds directly into the existing `alignAiTextsToSourceTimeline()` function in `aiTimingAlignment.ts`, replacing the character-proportional `buildCharTimeline()` with acoustically-grounded word timestamps.
- **Runtime / latency**: ~10-30 seconds for a 5-minute audio file. Subject to API latency and queue times. 25MB file size limit (sufficient for most YouTube videos).
- **Infra cost**: ~$0.006 per minute of audio. A 10-minute video costs ~$0.06. At 1,000 videos/month = ~$60/month. Competitive with self-hosted GPU costs.
- **Licensing**: Commercial API, pay-per-use. No model licensing concerns.
- **Risks**: (1) Cannot directly align existing text — must re-transcribe and then anchor. (2) Re-transcription may differ from YouTube captions, introducing alignment gaps. (3) Requires audio extraction server-side. (4) API rate limits and latency spikes during peak usage. (5) 25MB file limit may exclude very long videos.
- **Recommendation**: `prototype`

### Option 3: WhisperX (Self-Hosted, wav2vec2 Alignment)

- **Name**: WhisperX with `jonatasgrosman/wav2vec2-large-xlsr-53-japanese`
- **Type**: `ML` (Whisper + wav2vec2 CTC alignment)
- **What it does**: Transcribes audio with Whisper, then performs forced alignment using a wav2vec2 phoneme model to produce word-level timestamps. The alignment step uses CTC (Connectionist Temporal Classification) to map transcribed phonemes to audio frames.
- **Why it helps segmentation quality**: Theoretically provides the most precise timestamps because it uses a dedicated phoneme alignment model rather than Whisper's cross-attention. The wav2vec2 alignment model was specifically trained for phoneme recognition, giving frame-level (~20ms) timing precision.
- **Timing preservation or re-alignment story**: WhisperX has a `whisperx.align()` function that can take pre-existing segments and align them to audio. This is the closest to a pure forced alignment workflow — take re-segmented text and get acoustic timestamps without re-transcription.
- **Fit with current Moshimoshi stack**: Moderate. Same Python microservice requirement as stable-ts. The `whisperx.align()` function maps to the use case, but Japanese-specific issues reduce reliability.
- **Runtime / latency**: Claims ~70x real-time with batched inference on GPU. The alignment step alone (without re-transcription) is fast — a few seconds for a 5-minute audio. However, requires GPU for practical speeds.
- **Infra cost**: Requires GPU with 8GB+ VRAM for practical use. Self-hosted GPU at ~$0.20-0.50/hr or dedicated GPU instance.
- **Licensing**: BSD-4-Clause. Alignment model (jonatasgrosman) is Apache-2.0.
- **Risks**: **Significant Japanese-specific issues documented:**
  - Character dictionary mismatch errors: "no characters in this segment found in model dictionary" reported for Japanese segments (GitHub Issue #84).
  - Word segmentation returns individual characters instead of words for Japanese (the `LANGUAGES_WITHOUT_SPACES` handling produces character-level, not word-level, output).
  - Model loading failures reported for `jonatasgrosman/wav2vec2-large-xlsr-53-japanese` (Issues #897, #1219).
  - The Japanese wav2vec2 model has lower accuracy than the English equivalents — trained on limited Japanese data.
  - Active maintenance (v3.3.4, March 2026) but Japanese alignment issues remain open.
- **Recommendation**: `prototype` (only if stable-ts proves insufficient; the Japanese-specific bugs make this risky for production without significant testing)

## 3. Findings In Detail

### 3.1 Forced Alignment Landscape for Japanese

The forced alignment problem for Japanese is fundamentally harder than for English because:
1. **No word boundaries**: Japanese text has no spaces, so "word-level" alignment is ambiguous. Tools either produce character-level timestamps or rely on a tokenizer (MeCab, Intl.Segmenter) to define word boundaries.
2. **Multiple scripts**: Kanji, hiragana, katakana, and romaji can all appear in the same sentence.
3. **Phoneme models are undertrained**: Japanese wav2vec2 models have significantly less training data than English equivalents.

### 3.2 Tools Evaluated

#### WhisperX (m-bain/whisperX)
- **Version**: 3.3.4 (March 2026), actively maintained
- **License**: BSD-4-Clause
- **Japanese model**: `jonatasgrosman/wav2vec2-large-xlsr-53-japanese` (wav2vec2-large-xlsr-53 fine-tuned on Japanese speech)
- **Alignment**: CTC forced alignment via wav2vec2 phoneme model
- **Japanese handling**: Listed in `LANGUAGES_WITHOUT_SPACES` — produces character-level timestamps rather than word-level
- **Known issues**: Multiple open GitHub issues for Japanese alignment failures (#84, #897, #1219)
- **Key capability**: `whisperx.align(segments, model, audio)` can align pre-existing transcript segments to audio
- **Verdict**: Theoretically best precision, but Japanese support is unreliable in practice

#### Montreal Forced Aligner (MFA)
- **Version**: 3.3.9 (Feb 2026), actively maintained
- **License**: MIT
- **Japanese support**: Pretrained Japanese acoustic model v3.0.0, Japanese MFA dictionary, sudachipy tokenizer, Katakana G2P model
- **Training data**: Japanese model trained on ~30 hours (JVS corpus) vs ~3,000+ hours for English — significantly less mature
- **Alignment precision** (English benchmarks): 41.6% of boundaries within 10ms, 72.8% within 25ms, 89.4% within 50ms. Median boundary deviation: 12.5ms. No Japanese-specific benchmarks published.
- **Output format**: Praat TextGrid with both word-level and phoneme-level tiers
- **Architecture**: Kaldi-based (v3 uses Kalpy backend), CPU-only, no GPU needed
- **Runtime**: v3 introduced `mfa align_one` for single-file alignment — estimated 30s-2min for a 5-10 minute file with pretrained model
- **Key advantage**: Purpose-built for forced alignment (not transcription + alignment like Whisper-based tools). Can align arbitrary text to audio. Best linguistic precision.
- **Key disadvantage**: CLI-oriented, not designed as a service (no built-in REST API — must build wrapper). Japanese model has limited training data. Requires G2P preprocessing. YouTube-quality audio with noise/BGM may degrade alignment.
- **Verdict**: Best for linguistic precision; impractical for per-video production use due to integration complexity, but worth evaluating if precision is paramount

#### torchaudio CTC Forced Alignment
- **What**: PyTorch's `torchaudio.functional.forced_align()` — low-level CTC alignment
- **Models**: Can use any CTC model. Multilingual tutorial uses MMS (Massively Multilingual Speech) model which supports Japanese
- **Precision**: Frame-level (~20ms at 50fps CTC output)
- **Key capability**: Pure alignment function — takes audio + text + model, returns frame-level timestamps
- **Japanese handling**: The MMS model supports Japanese via romanized text. Requires text romanization (hiragana → romaji) as preprocessing.
- **Runtime**: Very fast — alignment-only (no transcription) runs in seconds on CPU
- **Integration**: Python/PyTorch dependency
- **Verdict**: Lightweight and fast, but requires significant preprocessing (romanization, tokenization) for Japanese

#### MahmoudAshraf97/ctc-forced-aligner
- **What**: Higher-level wrapper around CTC alignment using Meta MMS/wav2vec2 models
- **Japanese support**: Yes — language code `"jpn"`, auto-uses character splitting for Japanese
- **Key advantage**: Simplest standalone aligner — pip installable, CLI + Python API, no Whisper needed
- **Usage**: `ctc-forced-aligner --audio_path "audio.wav" --text_path "transcript.txt" --language "jpn"`
- **Model**: MMS-300M (~300MB), pre-trained on 23,000 hours across 1,100+ languages
- **Runtime**: Single forward pass — 3-10 seconds for a 5-minute file on CPU
- **License**: MIT
- **Verdict**: **Strong contender** as the lightest-weight alignment option. If stable-ts is overkill, this is the minimal viable alignment tool

#### Julius / pyJuliusAlign (Japanese-Specific)
- **What**: Purpose-built Japanese speech recognition and forced alignment engine, developed since 1997
- **Architecture**: Viterbi alignment with Japanese acoustic models, 60k-word vocabulary
- **Key advantage**: Battle-tested for Japanese — this is what Japanese phonetics researchers use
- **Alignment precision**: Phoneme-level Viterbi alignment — among the most precise for Japanese
- **Integration**: Server mode available with control API; pyJuliusAlign provides "one-button-press forced aligner for Japanese"
- **License**: Open-source (BSD-like)
- **Runtime**: Very fast for Japanese — 2-5 seconds for a 5-minute file
- **Risks**: Older codebase, smaller community than Whisper-based tools. Primarily academic tool.
- **Verdict**: Worth prototyping if Japanese alignment precision proves critical. Best-in-class for Japanese phoneme boundaries but higher integration effort

#### rinna/japanese-wav2vec2-base
- **What**: Japanese wav2vec2 model trained on ~19,000 hours of ReazonSpeech v1
- **Architecture**: 12 transformer layers, 768-dim features
- **Performance**: CER 6.46% when fine-tuned on Common Voice (vs jonatasgrosman's 20.16% CER)
- **License**: Apache-2.0
- **Significance**: This is a dramatically better Japanese acoustic model than jonatasgrosman's, but not integrated into WhisperX by default. Could be used with ctc-forced-aligner or custom torchaudio pipeline.
- **Verdict**: If building a custom CTC alignment pipeline, use this model instead of jonatasgrosman's

#### stable-ts (jianfch/stable-ts)
- **What**: Whisper-based transcription with enhanced timestamp stability
- **Key capability**: `align()` method that takes existing text + audio and produces word-level timestamps using Whisper's cross-attention mechanism. Also has `refine()` method that iteratively mutes audio portions to find tightest possible timestamps.
- **Japanese support**: Full Whisper language support including Japanese. **Kotoba-Whisper** (kotoba-tech/kotoba-whisper-v1.1) — a production Japanese Whisper model — explicitly integrates stable-ts for timestamp improvement, confirming stable-ts works well with Japanese.
- **Backend**: Can use OpenAI Whisper, faster-whisper, or Hugging Face Whisper
- **Timestamp refinement**: Uses silence suppression, cross-attention refinement, and dynamic time warping for more stable timestamps than raw Whisper
- **CPU viable**: With faster-whisper backend, runs efficiently on CPU (~10-20x real-time)
- **License**: MIT
- **Verdict**: Best balance of capability, reliability, and integration simplicity for this use case. The Kotoba-Whisper integration proves Japanese production viability.

#### Whisper's Internal Word Aligner (2025 paper)
- A 2025 paper (arxiv 2509.09987) discovered that Whisper has internal attention heads that capture accurate word alignments. Character-level alignment produces finer timestamps than wordpiece-level. Precision: 20-100ms tolerance in strict evaluation.
- This is what stable-ts and whisper-timestamped leverage under the hood.

#### Cloud APIs
| Service | Japanese Support | Word Timestamps | Precision | Cost/min | Align Existing Text? |
|---------|-----------------|-----------------|-----------|----------|---------------------|
| Google Cloud STT (Chirp 3) | Yes | Yes | 100ms increments | ~$0.016/min | No (transcription only) |
| AWS Transcribe | Yes | Yes | ~100ms | ~$0.024/min | No |
| Azure Speech | Yes | Yes | ~100ms | ~$0.016/min | No |
| OpenAI Whisper API | Yes | Yes (`verbose_json`) | ~50-100ms | ~$0.006/min | No (re-transcription) |
| Deepgram | Limited Japanese | Yes | ~50ms | ~$0.015/min | No |
| AssemblyAI | Limited Japanese | Yes | ~50ms | ~$0.006/min | No |
| ElevenLabs | Yes (forced alignment) | Yes | High | Higher tier pricing | Yes (purpose-built) |

**Key insight**: Only **ElevenLabs** offers true forced alignment of existing text for Japanese via cloud API. All other cloud APIs re-transcribe only. ElevenLabs Forced Alignment accepts audio + transcript and returns word-level timestamps (max 10 hours / 3GB per file). For all other providers, the only way to align pre-existing text to audio is to re-transcribe with word timestamps and then text-match.

#### Julius (Japanese-specific)
- Open-source Japanese speech recognition engine
- Can do forced alignment with Japanese text
- Old but battle-tested for Japanese phoneme alignment
- Primarily an academic/research tool, not production-ready for web services
- Would require significant wrapping to use as a service

### 3.3 The Re-Transcription vs. Forced Alignment Tradeoff

For Moshimoshi's use case, there are two fundamental approaches:

**Approach A: Re-transcribe with timestamps, then text-match**
- Run Whisper (or a cloud API) on the audio → get word-level timestamps
- Match the re-segmented text against the timestamped words
- Works even if re-segmented text differs from original captions
- This is what the current `aiTimingAlignment.ts` does, but with character-proportional source timestamps instead of acoustic ones

**Approach B: Forced alignment of existing text**
- Take the re-segmented text and the audio
- Use a forced alignment tool to map the text directly to the audio
- More precise when text matches speech closely
- Fails or degrades when text differs from what's spoken (common with YouTube auto-captions)

**Recommendation**: Approach A is more robust for YouTube content because:
- YouTube captions (especially auto-generated) often differ from actual speech
- Re-segmentation further modifies the text
- Re-transcription with Whisper produces a fresh, accurate transcript with acoustic timestamps
- Text-matching (already implemented in `aiTimingAlignment.ts`) bridges the gap

### 3.4 Audio Extraction Consideration

All forced alignment approaches require audio access. For YouTube:
- Audio must be extracted server-side (yt-dlp or similar)
- YouTube TOS **explicitly prohibit** downloading content without a provided download button
- YouTube Developer Policies prohibit "allowing users to download videos for offline play outside of the YT Premium experience"
- Enforcement is tightening: account bans are increasingly common
- The app already extracts transcripts via youtubei.js — audio extraction is a comparable TOS risk but escalates it
- Audio can be extracted as opus/webm at ~50kbps, keeping file sizes small (~3MB for 10 minutes)

**TOS-safer alternatives:**
1. Use YouTube's iframe API for playback + extract existing caption tracks via the captions API (no download)
2. Process audio in the browser during playback via Web Audio API (no server-side download)
3. User-initiated processing where the user's browser handles the audio (similar to browser extensions)

**Practical reality:** The hybrid approach — use existing YouTube caption timestamps as the coarse timeline, and only fall back to audio-based alignment when caption quality is insufficient — reduces the need for audio extraction to a minority of cases.

### 3.5 What "Production-Credible" Means Here

For Moshimoshi's architecture:
- Alignment runs **once per video** (not per playback)
- Results are **cached** (the resegmentation cache already exists)
- Latency budget: 10-30 seconds is acceptable (already have 15s AI timeout for resegmentation)
- Cost budget: $0.01-0.10 per video is acceptable (already spending ~$0.002 on GPT-4o-mini for AI resegmentation)

## 4. Relevance To Current Architecture

### Where This Plugs In

The alignment layer slots into the resegmentation pipeline, specifically replacing or supplementing the character-proportional timing in `aiTimingAlignment.ts`:

```
Current flow:
  YouTube captions → merge/chunk → [AI resegment] → aiTimingAlignment (proportional) → playback

Proposed flow:
  YouTube captions → merge/chunk → [AI resegment] → ACOUSTIC ALIGNMENT → playback
```

### Specific Code Touch Points

1. **`src/lib/transcript/aiTimingAlignment.ts`** — The `buildCharTimeline()` function (line 21-39) distributes timing proportionally by character count. This is the primary replacement target. Instead of proportional distribution, use acoustically-grounded word timestamps from stable-ts or the Whisper API.

2. **`src/app/api/youtube/resegment/route.ts`** — The `enforceNonOverlappingTimeline()` function (line 68-109) and the final timing safety pass (line 407-427) remain necessary regardless of alignment method. Acoustic alignment produces better initial timestamps, but timeline normalization is still needed as a safety net.

3. **`src/lib/transcript/segmentQuality.ts`** — The `computeSegmentQuality()` scorer (line 48-102) uses duration ranges (2.5-8s) that are based on segment timing. Better aligned timing improves the accuracy of quality scoring.

4. **`src/app/api/youtube/transcript/[videoId]/route.ts`** — The transcript retrieval route already uses `alignAiTextsToSourceTimeline()`. The alignment improvement would happen here or in a new `/api/youtube/align` endpoint.

5. **`src/utils/youtubePlayerUtils.ts`** — The `verifySeekLanding()` function (line 161-230) compensates for YouTube seek imprecision (±150ms). Better segment timing from acoustic alignment reduces the gap between intended seek position and actual audio boundary, improving perceived loop precision.

### Does It Replace Deterministic Logic, AI Logic, or Both?

It **supplements** both:
- The deterministic merge/chunk pipeline (`mergeSegments.ts`, `chunkSegments.ts`) handles text segmentation. Acoustic alignment handles timing recovery after segmentation changes text boundaries.
- The AI resegmentation path produces improved text segments. Acoustic alignment assigns precise timing to those segments.
- The character-proportional `aiTimingAlignment.ts` is **replaced** by acoustic alignment as the timing source.

### Does It Require a New PracticeSegment Model?

**Yes, this motivates the PracticeSegment architecture.** The alignment layer produces a clear separation between:
- **Transcript segments**: Raw caption timing from YouTube (what we get today)
- **Practice segments**: Re-segmented text with acoustically-recovered timing (what we should produce)

A `PracticeSegment` type would include:
```typescript
interface PracticeSegment {
  text: string;
  start: number;      // Acoustically-aligned start time
  end: number;        // Acoustically-aligned end time
  confidence: number; // Alignment confidence (0-1)
  source: 'acoustic' | 'proportional' | 'original';
  originalSegmentIds: string[]; // Which transcript segments contributed
}
```

## 5. Recommendation

**Pursue now**: stable-ts with faster-whisper backend as a Python microservice

**Why**:
1. It solves the exact problem: recovering precise timing after text boundary changes.
2. It has the best practical fit: MIT license, CPU-viable, can align existing text or re-transcribe.
3. It's architecturally clean: replaces the weakest part of the pipeline (`buildCharTimeline()` proportional distribution) with acoustic-grounded timestamps.
4. It's production-credible: runs once per video, results are cached, 15-30s latency is within budget.
5. It directly enables the PracticeSegment architecture that the session context identifies as the likely next design move.

**Prototype next**: OpenAI Whisper API as a zero-infrastructure fallback for the alignment layer.

**Park for later**: WhisperX (Japanese bugs need resolution), MFA (too heavy for per-video use), raw torchaudio CTC alignment (too low-level).

**Concrete next step**: Build a Python microservice that exposes:
```
POST /align
Body: { audio_url: string, segments: [{text, start, end}], language: "ja" }
Response: { aligned_segments: [{text, start, end, confidence}] }
```

Call this from the resegmentation pipeline after AI/deterministic text segmentation to recover acoustic timing.

## 6. Sources

- [WhisperX GitHub](https://github.com/m-bain/whisperX) — v3.3.4, BSD-4 license
- [WhisperX Japanese alignment issue #84](https://github.com/m-bain/whisperX/issues/84) — "Failed to align segment for Japanese"
- [WhisperX model loading issue #897](https://github.com/m-bain/whisperX/issues/897) — Japanese model loading failures
- [WhisperX forced alignment issue #1308](https://github.com/m-bain/whisperX/issues/1308) — Aligning with fixed transcript
- [WhisperX paper (arxiv 2303.00747)](https://www.robots.ox.ac.uk/~vgg/publications/2023/Bain23/bain23.pdf) — "WhisperX: Time-Accurate Speech Transcription of Long-Form Audio"
- [jonatasgrosman/wav2vec2-large-xlsr-53-japanese](https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-japanese) — WhisperX's default Japanese alignment model
- [stable-ts GitHub](https://github.com/jianfch/stable-ts) — MIT license, align() method for existing text
- [stable-ts PyPI](https://pypi.org/project/stable-ts/) — Installation and version info
- [faster-whisper GitHub](https://github.com/SYSTRAN/faster-whisper) — MIT license, CTranslate2 backend
- [Montreal Forced Aligner docs](https://montreal-forced-aligner.readthedocs.io/) — v3.x, Japanese model v3.0.0
- [MFA Japanese acoustic model v3.0.0](https://mfa-models.readthedocs.io/) — Pretrained Japanese model details
- [torchaudio CTC forced alignment tutorial](https://docs.pytorch.org/audio/stable/tutorials/ctc_forced_alignment_api_tutorial.html)
- [torchaudio multilingual forced alignment](https://docs.pytorch.org/audio/stable/tutorials/forced_alignment_for_multilingual_data_tutorial.html) — MMS model
- [MahmoudAshraf97/ctc-forced-aligner](https://github.com/MahmoudAshraf97/ctc-forced-aligner) — Higher-level CTC alignment wrapper
- [Whisper internal word aligner paper (arxiv 2509.09987)](https://arxiv.org/html/2509.09987v1) — 2025 discovery of internal alignment heads
- [OpenAI Whisper API docs](https://platform.openai.com/docs/guides/speech-to-text) — word_timestamps, verbose_json
- [Google Cloud Speech-to-Text Chirp 3](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3) — Word timestamps for Japanese
- [Julius speech recognition](https://github.com/julius-speech/julius) — Japanese-specific alignment tool
- [ElevenLabs forced alignment docs](https://elevenlabs.io/docs/overview/capabilities/forced-alignment) — Commercial forced alignment API
- [NTQAI/wav2vec2-large-japanese](https://huggingface.co/NTQAI/wav2vec2-large-japanese) — Alternative Japanese wav2vec2 model
- [rinna/japanese-wav2vec2-base](https://huggingface.co/rinna/japanese-wav2vec2-base) — Japanese wav2vec2 by rinna
- [whisper-timestamped (linto-ai)](https://github.com/linto-ai/whisper-timestamped) — Alternative Whisper timestamp refinement
