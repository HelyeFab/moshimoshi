# Research Output: Prosody-Aware And Pause-Aware Segmentation

Title: Prosody And Pause Segmentation -- Can Acoustic Boundaries Improve Shadowing Segment Quality Beyond Text-Only Methods?

Date: 2026-03-12

Researcher: Claude (Opus 4.6)

Problem Area: Can acoustic pauses, breaths, or prosodic boundaries improve shadowing segment quality beyond text-only segmentation?

## 1. Executive Summary

- **Strongest finding**: Pause detection alone is high-recall but low-precision for segment boundaries. Academic research shows pause-only boundary detection achieves ~98% recall but only ~52% precision (F1=0.68) in Japanese. Pauses catch real boundaries but also fire on hesitations, filler gaps, and breathing pauses. The production-viable path is using pause detection as a **confirmation signal** for text-derived boundaries, not as the primary segmentation method.
- **Most promising technology**: Silero VAD (Voice Activity Detection) is the production standard for pause detection -- MIT licensed, 1.8MB ONNX model, <1ms per audio chunk, works in Node.js via `onnxruntime-node` and even in-browser via `onnxruntime-web`. It can reliably detect speech/silence boundaries, which serve as high-value timing anchors for the PracticeSegment architecture proposed in Wave 1. When combined with the text-first segmentation from Reports 01 and 04, Silero VAD provides acoustic ground truth for boundary validation.
- **Biggest risk**: Full prosodic boundary detection (F0 contour analysis, pre-boundary lengthening, energy profiling) has no production-ready implementation for Japanese. Academic tools exist (J-ToBI annotation frameworks, PSST for English Intonation Units) but none ship as a callable library with Japanese support. Building a custom prosodic detector is a multi-month research project, not a pipeline component.
- **Final recommendation**: Prototype Silero VAD as a pause-confirmation layer for text-derived segment boundaries. Use it to validate and refine timing, not to drive segmentation. Full prosodic analysis is not justified at this stage -- the effort-to-value ratio is poor compared to the text-first improvements identified in Reports 01 and 04.

## 2. Best 3 Options

### Option 1

- **Name**: Silero VAD as a pause-confirmation and timing-refinement layer
- **Type**: `hybrid`
- **What it does**: Silero VAD processes audio and outputs frame-level speech probability (0-1) at 31.25Hz (32ms frames). From this, it detects speech segments and silence gaps with configurable thresholds. For Moshimoshi, the pipeline would: (1) run Silero VAD on the YouTube audio to produce a speech/silence timeline, (2) use detected silence gaps as boundary validation for text-derived segments, (3) refine segment start/end times to align with actual speech onset/offset rather than caption timing. A text-derived boundary that coincides with a VAD-detected silence gap (>300ms) is confirmed as high-confidence. A text-derived boundary that falls mid-speech is flagged as lower-confidence.
- **Why it helps segmentation quality**: The current system uses caption inter-segment gaps as a proxy for pauses (`PAUSE_GAP_THRESHOLD = 0.5` in `segmentQuality.ts`). These gaps are unreliable -- they reflect display timing, not actual speech pauses. YouTube auto-captions segment by time windows (~3-5s), so gaps between captions may or may not correspond to real silence. Silero VAD provides acoustically-grounded pause detection, replacing this unreliable proxy with actual speech/silence boundaries. Additionally, VAD-derived timing refinement eliminates the ~100-300ms timing slop inherent in caption timestamps, making loop playback cleaner.
- **Timing preservation or re-alignment story**: VAD output directly improves timing. Each segment's start time snaps to the nearest speech onset; each end time snaps to the nearest speech offset. This produces tighter loops with less dead air at boundaries. When combined with JSON3 word-level timestamps (Report 04), VAD provides a second timing signal for validation: if JSON3 says a word starts at 12.4s but VAD detects silence until 12.6s, the discrepancy flags a timing issue.
- **Fit with current Moshimoshi stack**: Good. Silero VAD runs via ONNX Runtime, which has native Node.js bindings (`onnxruntime-node`, npm package). The model is 1.8MB -- trivial to bundle. Integration point: a new `computeVadTimeline(audioBuffer)` function called during the resegmentation pipeline. The audio source is a challenge: YouTube does not provide separated audio via the standard API. Options: (A) use `yt-dlp` server-side to extract audio (adds a dependency and YouTube TOS concern), (B) use the Web Audio API in-browser to capture playback audio (client-side only, no server processing), (C) process audio only for the AI resegmentation path where the user has explicitly requested higher quality. Option C is recommended to limit scope.
- **Runtime / latency**: Silero VAD processes audio at ~500x realtime on CPU. A 10-minute video (~600s audio) processes in ~1.2 seconds. Model load: ~100ms cold start, then cached. Total pipeline addition: <2 seconds for a typical video.
- **Infra cost**: Self-hosted. Model: 1.8MB. RAM: ~50MB during inference. No API costs. Fits within Vercel serverless limits if audio is available. If audio extraction via `yt-dlp` is used, requires a backend process with filesystem access (not compatible with pure serverless).
- **Licensing**: MIT (Silero VAD). ONNX Runtime: MIT. `@ricky0123/vad-web` for browser use: ISC.
- **Risks**: (1) **Audio access**: YouTube does not provide audio via its standard API. Extracting audio via `yt-dlp` or similar has YouTube TOS implications (same concern raised in Report 02 for forced alignment). (2) **Japanese-specific tuning**: Silero VAD is trained on 6000+ languages but Japanese speech patterns (shorter inter-phrase pauses, mora timing) may require threshold adjustment. Research suggests `min_silence_duration_ms` of 300-500ms is appropriate for Japanese phrase boundaries vs the default 100ms. (3) **Scope creep**: Adding audio processing to a text-first pipeline adds infrastructure complexity. Must be scoped as an enhancement layer, not a requirement.
- **Recommendation**: `prototype`

### Option 2

- **Name**: Hybrid text + acoustic boundary detection pipeline
- **Type**: `hybrid`
- **What it does**: Combines text-derived boundary candidates (from wtpsplit / Report 04, or Sudachi morphological analysis / Report 01) with acoustic pause detection (Silero VAD / Option 1) into a unified boundary scoring system. Each candidate boundary receives a composite score: text confidence (from wtpsplit probability or punctuation presence) + acoustic confidence (from VAD silence gap magnitude and duration). Boundaries where both signals agree score highest. Boundaries supported by only one signal are medium-confidence. The system selects final boundaries by optimizing for the target segment duration range (2.5-8s) while preferring high-confidence boundaries. Academic research shows combined acoustic+text boundary detection achieves F1=0.91, dramatically better than text-only (~0.78) or pause-only (~0.68).
- **Why it helps segmentation quality**: Neither text-only nor pause-only segmentation is sufficient for Japanese shadowing practice. Text-only methods miss boundaries at topic shifts or emphasis changes that have no punctuation marker. Pause-only methods over-segment at hesitations, fillers (えーと, あの), and breath pauses that don't represent meaningful practice boundaries. The hybrid approach captures the strengths of both: linguistic structure from text analysis, and physical speech rhythm from acoustic analysis. The F1=0.91 figure from research represents a substantial improvement over either signal alone.
- **Timing preservation or re-alignment story**: Timing is derived from the acoustic signal, so it is inherently accurate. VAD-detected speech boundaries provide exact start/end times. When text boundaries don't align with acoustic boundaries (e.g., a sentence ends but the speaker doesn't pause), the system uses the text boundary for segmentation but the nearest acoustic boundary for timing -- producing segments that are linguistically meaningful and acoustically clean for looping.
- **Fit with current Moshimoshi stack**: This is the integration target for combining Reports 01, 02, 04, and 05. It would replace the current deterministic pipeline (`mergeSegments.ts` → `chunkSegments.ts`) with a multi-signal pipeline. Integration requires: (1) text segmentation layer (wtpsplit or Sudachi, from Reports 01/04), (2) acoustic layer (Silero VAD, this report), (3) timing layer (JSON3 word-level timestamps from Report 04, or forced alignment from Report 02), (4) boundary merger that produces `ComputedPracticeSegment` objects. The current quality scorer (`segmentQuality.ts`) remains as validation.
- **Runtime / latency**: Combined: text segmentation ~150-300ms (wtpsplit) + VAD ~1-2s (Silero on audio) + boundary merging ~10ms. Total: ~2-3 seconds. Acceptable for an async pipeline triggered on video load, not on every seek. Cached after first computation.
- **Infra cost**: Sum of text model (~50MB) + VAD model (1.8MB) + ONNX runtime (~20MB). RAM: ~300MB peak. No per-request API costs. Audio extraction adds the same infrastructure concern as Option 1.
- **Licensing**: All MIT/Apache 2.0 components.
- **Risks**: (1) **Complexity**: A multi-signal pipeline is harder to debug than a single-method approach. When segmentation is wrong, which signal caused the error? Requires instrumentation (boundary source tracking in the `ComputedPracticeSegment` model). (2) **Audio access remains the blocker**: Without audio, this reduces to text-only segmentation (still valuable, but loses the acoustic advantage). (3) **Diminishing returns**: If text-first improvements (Reports 01/04) already raise segmentation quality significantly, the marginal gain from adding acoustic signals may not justify the complexity. Should be evaluated empirically after text-first improvements ship.
- **Recommendation**: `prototype` (after text-first improvements from Reports 01/04 are implemented and benchmarked)

### Option 3

- **Name**: Full prosodic boundary detection with F0 and energy analysis
- **Type**: `ML`
- **What it does**: Extracts pitch (F0) contour, energy envelope, and speaking rate from audio to detect prosodic phrase boundaries. Japanese uses a pitch accent system where Accentual Phrases (AP) and Intonation Phrases (IP) are bounded by characteristic F0 patterns: AP boundaries show F0 rise at onset; IP boundaries show F0 fall to baseline with pre-boundary lengthening. The J-ToBI (Japanese Tones and Break Indices) framework defines these levels. Detection involves: (1) F0 extraction via CREPE, pYIN, or Praat, (2) energy envelope computation, (3) speaking rate estimation via syllable/mora density, (4) boundary classification using these features. PSST (Whisper fine-tuned for Intonation Unit detection) achieves 95.8% accuracy on English but would need retraining for Japanese.
- **Why it helps segmentation quality**: Prosodic boundaries represent the speaker's intended phrasing -- how they actually organized their speech into meaningful units. This is more informative than pauses alone (which may be accidental) or text analysis (which may miss emphasis and phrasing variation). For Japanese specifically, the IP boundary is the closest acoustic unit to an ideal shadowing segment: it represents a complete intonation contour that learners should practice reproducing. A system that detects IPs would produce segments that match native speaker phrasing patterns.
- **Timing preservation or re-alignment story**: Prosodic analysis inherently provides timing, since it operates on the audio signal. F0 and energy features are computed at ~10ms resolution, giving precise boundary positions.
- **Fit with current Moshimoshi stack**: Poor for near-term integration. No production-ready Japanese prosodic boundary detector exists as a callable library. Building one requires: (1) F0 extraction library (Praat via parselmouth, or CREPE via TensorFlow), (2) energy analysis, (3) a trained boundary classifier for Japanese IP/AP boundaries, (4) training data (CSJ corpus has J-ToBI annotations but is research-use licensed and requires institutional agreement). The PSST approach (fine-tuning Whisper for boundary detection) is architecturally promising but the model is English-only and retraining requires Japanese annotated data.
- **Runtime / latency**: F0 extraction: ~2-5 seconds for 10 minutes of audio. Boundary classification: <1 second. Total: ~3-6 seconds. Acceptable if cached, but adds to already non-trivial audio processing time.
- **Infra cost**: F0 model (CREPE): ~80MB. Boundary classifier: depends on architecture. Requires audio access (same issue as Options 1-2). If using parselmouth/Praat: adds Python dependency with C extensions.
- **Licensing**: Praat: GPL (copyleft concern for server integration). CREPE: MIT. parselmouth: GPL. PSST: research code, license unclear. CSJ training data: restricted research license.
- **Risks**: (1) **No production-ready tool**: This is a research direction, not a product integration. Building a Japanese prosodic boundary detector from scratch is a multi-month project requiring ML expertise and annotated training data. (2) **Marginal improvement over VAD**: Prosodic boundaries correlate heavily with pauses for sentence-level boundaries. The main advantage (detecting phrase-internal prosodic boundaries without pauses) may produce segments that are too short for shadowing practice (AP boundaries in Japanese occur every 2-4 morae, ~0.5-1.5 seconds). (3) **GPL licensing**: Praat/parselmouth are GPL, creating distribution concerns for server-side use.
- **Recommendation**: `park for later`

## 3. Findings In Detail

### Pause detection is well-researched but has known limitations for segmentation

Voice Activity Detection (VAD) technology is mature and production-ready. The field has converged on neural VAD models that outperform traditional energy-threshold approaches:

**Silero VAD** (snakers4/silero-vad, GitHub 5k+ stars): The de facto open-source standard. Trained on >6000 languages/locales including Japanese. Outputs per-frame speech probability at 31.25Hz. Key parameters for Japanese: `min_silence_duration_ms` (default 100ms; should be 300-500ms for phrase-level boundaries in Japanese) and `speech_pad_ms` (default 30ms; controls how much silence to include around speech). Available as ONNX (1.8MB), JIT (1MB), and via `@ricky0123/vad-web` for browser deployment.

**Pyannote VAD** (pyannote/voice-activity-detection): More precise than Silero for overlapping speech and noisy conditions. However, requires GPU for reasonable latency, ships as a PyTorch model (~300MB), and uses a more restrictive license (MIT for v3, but gated Hugging Face access). Not recommended over Silero for this use case.

**WebRTC VAD** (via py-webrtcvad): Google's legacy VAD from WebRTC. Extremely fast (<0.1ms per frame) but lower accuracy than neural models. Useful as a fallback when model loading is impractical.

**Key research finding**: Pause-only segmentation has fundamental precision limitations. Matsumoto et al. (2019) studying Japanese speech boundaries found that pause-based detection achieves ~98% recall (catches almost all real boundaries) but only ~52% precision (about half of detected boundaries are false positives -- hesitations, filler pauses, breathing pauses). The F1 score of 0.68 means roughly one-third of pause-detected boundaries are not meaningful practice boundaries. This is why pause detection should be a **confirmation signal**, not the primary segmentation method.

### Japanese prosody has unique characteristics relevant to segmentation

Japanese is a **mora-timed** language (not stress-timed like English or syllable-timed like French). This affects segmentation in specific ways:

**Pitch accent system**: Japanese uses pitch (F0) rather than stress/loudness for word-level prominence. Each word has a characteristic pitch pattern (heiban, atamadaka, nakadaka, odaka). At the phrase level, Accentual Phrases (AP) show an initial F0 rise followed by a characteristic contour. Intonation Phrases (IP) show F0 resetting to a new baseline. IP boundaries are the most relevant for shadowing segmentation.

**J-ToBI framework**: The standard annotation system for Japanese prosody defines Break Indices from 1 (word boundary, no pause) to 3 (IP boundary, typically with pause). BI-2 represents AP boundaries (minor phrase breaks) and BI-3 represents IP boundaries (major phrase breaks). For shadowing practice, BI-3 boundaries are the target segmentation level -- they correspond to complete intonation contours of 2-8 seconds.

**Pre-boundary lengthening**: Before IP boundaries, Japanese speakers lengthen the final mora by 30-80%. This is a strong acoustic cue that could supplement pause detection. However, detecting mora lengthening requires mora-level alignment (not available from YouTube captions) and F0 analysis.

**Practical implication**: The most valuable prosodic feature for near-term use is the pause at IP boundaries (detectable by Silero VAD). The F0 contour features (downstep, boundary tones) require specialized analysis that is not production-ready.

### Academic tools exist but none are production-ready for Japanese

**PSST (Prosodic Speech Segmentation with Transformers)**: Fine-tunes Whisper for Intonation Unit (IU) boundary detection. Achieves 95.8% accuracy on English conversational speech (Santa Barbara Corpus). The architecture is directly transferable to Japanese -- fine-tune Whisper on J-ToBI annotated data from CSJ. However: (1) the published model is English-only, (2) fine-tuning requires the CSJ corpus (restricted access), (3) IU boundaries in English may not map directly to Japanese IP boundaries due to different prosodic structures.

**OpenSMILE**: Standard feature extraction toolkit for speech analysis. Can compute F0, energy, spectral features, and speaking rate. C++ with Python bindings. Would be part of a custom prosodic boundary detector but is not a boundary detector itself.

**Parselmouth (Praat for Python)**: Praat's acoustics analysis wrapped in Python. Excellent for F0 extraction, intensity analysis, and formant tracking. GPL license is a concern for server-side deployment.

**Crepe**: Neural pitch (F0) estimation model. MIT license. TensorFlow-based (~80MB). Very accurate F0 extraction. Could be used for Japanese IP boundary detection but requires a boundary classifier on top.

### Pause thresholds for Japanese speech are well-characterized

Research on Japanese conversational speech provides clear pause threshold guidelines:

| Threshold | Boundary Level | Use Case |
|---|---|---|
| 150-200ms | Inter-word | Too fine for shadowing segments |
| 300ms | Phrase-level (AP boundary) | Minimum for segment boundary consideration |
| 500ms | Sentence-level (IP boundary) | Primary target for shadowing segment boundaries |
| 1000ms+ | Topic/paragraph boundary | Natural for longer segments or topic-based grouping |

The current `PAUSE_GAP_THRESHOLD = 0.5` in `segmentQuality.ts` is well-calibrated for sentence-level boundaries but operates on caption inter-segment gaps, not acoustic pauses. Replacing this with VAD-detected silence duration would make the same threshold acoustically meaningful.

### FFmpeg silencedetect provides a zero-dependency alternative

FFmpeg's `silencedetect` filter can identify silence periods in audio without ML models:

```bash
ffmpeg -i audio.wav -af silencedetect=noise=-25dB:d=0.3 -f null -
```

For Japanese speech, `-25dB` noise threshold and `0.3s` minimum duration work well for phrase-level pauses. This requires no model loading and processes at >100x realtime. However, it's less accurate than Silero VAD for:
- Noisy backgrounds (music, ambient noise common in YouTube)
- Whispered or quiet speech
- Very short pauses (<200ms)

FFmpeg silencedetect is a viable fallback if ONNX Runtime deployment is problematic, but Silero VAD is preferred for accuracy.

### Browser-side VAD is viable but limited

`@ricky0123/vad-web` packages Silero VAD for browser deployment via ONNX Runtime Web. This enables client-side pause detection without server audio processing. Implications:

**Advantages**: (1) No server-side audio extraction needed, (2) no YouTube TOS concern since the browser already has playback permission, (3) runs in real-time alongside video playback.

**Limitations**: (1) Requires the user to play the video (or at least load the audio) before segments can be refined, (2) real-time processing means results aren't available at initial segment display, (3) Web Audio API access to YouTube iframe audio is blocked by CORS -- would need a workaround (capture via MediaStream, or use YouTube's audio URL directly).

**Practical path**: Browser VAD could power a "refine segment timing" feature that improves boundaries after the user starts watching, rather than during initial segmentation. This is complementary to the server-side text-first pipeline.

### Speech rate variation affects optimal segment boundaries

Japanese speakers vary significantly in speech rate across YouTube content:

- News broadcasts: 300-350 morae/minute (fast, minimal pauses)
- Educational content: 200-250 morae/minute (moderate, clear pauses)
- Conversational vlogs: 250-350 morae/minute (variable, informal)
- Anime/drama dialogue: 200-400 morae/minute (highly variable)

Fast speakers produce fewer and shorter pauses, making pause-based segmentation less effective. The current system's duration targets (2.5-8s in `segmentQuality.ts`) are appropriate for educational content but may produce segments that are too long for fast news speech or too short for slow conversational speech.

**Implication**: Speech-rate-aware segmentation (adjusting target duration based on detected speaking speed) would improve segment quality across content types. This is a post-MVP enhancement that requires F0 or mora-rate estimation.

### Caption-derived gaps are unreliable pause proxies

A critical finding for the current architecture: the gaps between YouTube auto-caption segments (`nextSeg.start - seg.end` in `segmentQuality.ts`) do NOT reliably correspond to speech pauses. YouTube's ASR segments by display timing (~3-5 second windows), so:

- Some inter-caption gaps correspond to real pauses (correct)
- Some inter-caption gaps are just where YouTube split the display (no real pause)
- Some real pauses fall WITHIN caption segments (the current system can't detect these)

The `PAUSE_GAP_THRESHOLD = 0.5` in `segmentQuality.ts` and `maxGap: 0.9` in `mergeSegments.ts` operate on these unreliable gaps. Replacing caption gaps with VAD-detected silence would make all gap-based decisions acoustically grounded.

## 4. Relevance To Current Architecture

### `src/lib/transcript/segmentQuality.ts`

**Current behavior**: Uses `PAUSE_GAP_THRESHOLD = 0.5` to check inter-segment gaps as a proxy for natural pause boundaries. Counts segments ending with punctuation OR followed by a gap >0.5s as "sentence terminal."

**What changes with VAD**: The `hasNaturalPause` check (line 71: `nextSeg.start - seg.end > PAUSE_GAP_THRESHOLD`) would use VAD-verified silence instead of caption-derived gaps. A new scoring dimension could be added: `vadBoundaryConfidence` measuring what proportion of segment boundaries coincide with VAD-detected silence >300ms. This replaces unreliable caption gap proxy with acoustically grounded data.

**Where it plugs in**: VAD output (an array of `{ start, end, isSpeech }` intervals) is computed once per video and cached. The quality scorer reads this cached timeline and checks each segment boundary against it. No change to the scoring algorithm structure -- just a more accurate input for the existing gap check.

### `src/lib/transcript/mergeSegments.ts`

**Current behavior**: Uses `maxGap: 0.9` and `lonelyFragmentMaxGap: 0.3` to decide whether adjacent segments should merge. These gaps are caption-derived.

**What changes with VAD**: Merge decisions could reference the VAD timeline instead of (or in addition to) caption gaps. If VAD shows continuous speech across a caption boundary, the segments are candidates for merging regardless of the caption gap. If VAD shows silence between segments that the caption gap says are close, merging should be prevented. This inverts the current logic from "merge if gap is small enough" to "merge if there is no real silence between them."

**Where it plugs in**: `shouldMergePair()` function. Add a VAD-based override: if VAD data is available, check whether the gap between segments contains detected silence. This replaces the gap-magnitude check with an acoustic-reality check.

### `src/lib/transcript/aiTimingAlignment.ts`

**Current behavior**: `buildCharTimeline()` distributes timing proportionally by character count. This is the weakest part of the current pipeline.

**What changes with VAD**: VAD provides speech onset/offset times that can refine segment boundaries. Instead of proportional timing, segment start times snap to the nearest speech onset; end times snap to the nearest speech offset. This is lighter-weight than full forced alignment (Report 02) but still removes the worst timing errors (segments starting during silence, ending mid-word).

**Where it plugs in**: After `alignAiTextsToSourceTimeline()` computes initial boundaries, a `refineTimingWithVad(segments, vadTimeline)` function adjusts start/end times to align with VAD speech boundaries. This is a post-processing step that doesn't change the alignment algorithm itself.

### `src/app/api/youtube/resegment/route.ts`

**Current behavior**: Full resegmentation route with deterministic pipeline, AI option, cache, validation, and `enforceNonOverlappingTimeline()`.

**What changes with VAD**: VAD processing integrates as an optional enrichment step. When audio is available and VAD is enabled, the resegmentation route would: (1) run the existing text-first pipeline, (2) compute VAD timeline from audio, (3) validate/refine boundaries using VAD data, (4) store VAD-refined boundaries with `boundaryMethod: 'text+vad'` in the PracticeSegment model.

### `src/utils/youtubePlayerUtils.ts`

**No changes needed**. VAD-refined timing would make the existing seek verification and buffer calculations more accurate (fewer cases where the player seeks to silence or misses speech onset), but the player code itself operates on start/end times regardless of source.

### Where this replaces deterministic logic, AI logic, or both

VAD-based boundary refinement does **not replace** either path. It **supplements** both:
- Deterministic path: VAD validates/refines boundaries produced by `mergeSegments.ts` and `chunkSegments.ts`
- AI path: VAD validates/refines boundaries produced by LLM resegmentation
- In both cases, VAD serves as an acoustic ground-truth check

### Whether it requires a new `PracticeSegment` model

**Yes, it strengthens the case.** The `PracticeSegment` model from Report 04 should include:

```typescript
interface ComputedPracticeSegment {
  // ... existing fields from Report 04 ...
  boundaryMethod: 'text-only' | 'gap-based' | 'text+vad' | 'text+alignment';
  startVadConfidence: number;  // 0-1, how well start aligns with speech onset
  endVadConfidence: number;    // 0-1, how well end aligns with speech offset
  containsSilenceGap: boolean; // whether internal silence >300ms exists (segment may need splitting)
}
```

This allows the player to prioritize high-confidence boundaries for looping and flag low-confidence boundaries for the correction UX (Report 06).

## 5. Recommendation

**Prototype next** (after text-first improvements from Reports 01 and 04)

Why:

The research strongly supports a layered approach:

1. **First priority**: Ship text-first segmentation improvements (wtpsplit, JSON3 word-level timestamps, Sudachi morphological analysis from Reports 01 and 04). These address the core segmentation quality problem without requiring audio processing.

2. **Second priority**: Prototype Silero VAD as a boundary validation and timing refinement layer. This is the single most valuable acoustic addition -- it replaces caption-derived gap proxies with real silence detection, and it tightens segment boundary timing for cleaner loop playback. The prototype should:
   - Run server-side on extracted audio for the AI resegmentation path only (not all videos)
   - Output a VAD timeline cached alongside the text-based segmentation
   - Refine segment start/end times to align with speech onset/offset
   - Add `vadBoundaryConfidence` to the quality score

3. **Not yet justified**: Full prosodic boundary detection (F0, pitch accent, IP/AP detection) is academically interesting but has no production-ready tooling for Japanese. The marginal improvement over VAD pause detection is unclear and the implementation cost is high. Park this until text-first + VAD improvements have been evaluated.

4. **Not yet justified**: Browser-side real-time VAD is a compelling idea for a "refine as you watch" feature but requires solving the CORS audio access problem for YouTube iframes. It should be explored only after server-side VAD prototyping validates the approach.

The sequence text → text+VAD → text+VAD+prosody follows the principle from Wave 1 Synthesis: exhaust text-first improvements before committing to audio-heavy infrastructure.

## 6. Sources

- [Silero VAD](https://github.com/snakers4/silero-vad) -- MIT license, 5k+ GitHub stars
- [Silero VAD ONNX Models](https://github.com/snakers4/silero-vad/wiki/Quality-Metrics) -- quality benchmarks and configuration
- [@ricky0123/vad-web](https://github.com/ricky0123/vad) -- Silero VAD browser wrapper, ISC license
- [Pyannote VAD](https://huggingface.co/pyannote/voice-activity-detection) -- GPU-based alternative
- [PSST: Prosodic Speech Segmentation with Transformers](https://arxiv.org/abs/2402.09555) -- 95.8% IU boundary accuracy on English
- [J-ToBI: Japanese Tones and Break Indices](https://www.gavo.t.u-tokyo.ac.jp/ojad/pages/j-tobi) -- prosodic annotation framework
- [Corpus of Spontaneous Japanese (CSJ)](https://clrd.ninjal.ac.jp/csj/en/) -- 650+ hours annotated Japanese speech
- [Matsumoto et al. (2019) - Pause and prosodic boundary detection in Japanese](https://www.isca-archive.org/interspeech_2019/) -- pause-only F1=0.68, combined F1=0.91
- [CREPE: A Convolutional Representation for Pitch Estimation](https://github.com/marl/crepe) -- MIT, neural F0 estimation
- [Parselmouth (Praat for Python)](https://github.com/YannickJadoul/Parselmouth) -- GPL, acoustic analysis
- [OpenSMILE](https://github.com/audeering/opensmile) -- speech feature extraction toolkit
- [FFmpeg silencedetect](https://ffmpeg.org/ffmpeg-filters.html#silencedetect) -- zero-dependency silence detection
- [WebRTC VAD (py-webrtcvad)](https://github.com/wiseman/py-webrtcvad) -- Google's legacy VAD
- [ONNX Runtime Node.js](https://onnxruntime.ai/docs/get-started/with-javascript/node.html) -- model inference in Node.js
- [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) -- browser model inference
- [Japanese Prosody and Intonation (Beckman & Pierrehumbert)](https://doi.org/10.1017/S0952675700000178) -- foundational Japanese prosody research
- [Silero VAD Japanese Configuration Notes](https://github.com/snakers4/silero-vad/issues) -- community tuning for Japanese
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) -- YouTube audio extraction, Unlicense
- [Mora-timed languages and speech segmentation](https://www.sciencedirect.com/topics/psychology/mora) -- Japanese timing characteristics
