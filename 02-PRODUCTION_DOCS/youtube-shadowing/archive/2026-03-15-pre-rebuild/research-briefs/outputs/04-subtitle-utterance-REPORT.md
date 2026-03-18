# Research Output: Subtitle-To-Utterance Segmentation Research

Title: Subtitle-To-Utterance Segmentation -- Methods for Transforming Caption Fragments into Spoken Practice Units

Date: 2026-03-12

Researcher: Claude (Opus 4.6)

Problem Area: What research or production methods exist for transforming subtitle fragments into spoken utterance units suitable for repetition practice?

## 1. Executive Summary

- **Strongest finding**: wtpsplit / Segment Any Text (EMNLP 2024) is a production-ready, MIT-licensed sentence segmentation model supporting 85 languages including Japanese. It is robust to missing punctuation -- the exact condition of YouTube auto-captions -- and offers domain-specific LoRA adapters including one trained on TED talks (ASR-style transcribed speech). It can run in Node.js via ONNX Runtime or as a lightweight Python microservice.
- **Most promising technology**: A two-stage pipeline combining YouTube's JSON3 word-level timestamps with wtpsplit text re-segmentation. JSON3 provides per-word timing that survives re-segmentation, making timing recovery trivial. This eliminates the current system's reliance on proportional character-to-time distribution.
- **Biggest risk**: The current pipeline does not extract YouTube's JSON3/SRV3 word-level timing data. Without word-level timestamps, any text re-segmentation requires proportional time interpolation, which is inherently imprecise. Extracting richer caption formats is a prerequisite for accurate timing after re-segmentation.
- **Final recommendation**: Pursue a text-first re-segmentation pipeline using wtpsplit with the TED LoRA adapter, backed by JSON3 word-level timestamp extraction for timing recovery. This addresses the core problem (subtitle fragments → utterance units) with production-grade tooling and minimal architectural disruption.

## 2. Best 3 Options

### Option 1

- **Name**: wtpsplit / Segment Any Text (SaT) with TED LoRA adapter
- **Type**: `ML`
- **What it does**: A universal sentence segmentation model trained on 85 languages. Takes raw, unpunctuated text and predicts sentence boundaries using a fine-tuned transformer. The TED LoRA adapter specifically handles ASR-style transcribed speech -- text that lacks punctuation and has informal structure, matching YouTube auto-caption characteristics exactly. Input: concatenated subtitle text. Output: array of sentence boundary positions.
- **Why it helps segmentation quality**: The current pipeline's `chunkSegments.ts` splits at punctuation (`/[。！？!?]$/`) or at a 45-character hard limit. YouTube auto-captions rarely contain punctuation, so nearly all splits are character-count driven. wtpsplit identifies sentence boundaries WITHOUT relying on punctuation marks. It was specifically benchmarked as "robust to missing punctuation" in the EMNLP 2024 paper. The TED adapter is trained on transcribed spoken language, matching the YouTube caption domain. Japanese is explicitly supported as one of the 85 languages.
- **Timing preservation or re-alignment story**: wtpsplit operates on text only and returns character-offset boundaries. Timing recovery requires mapping these offsets back to source timing. Three approaches in order of accuracy: (1) **JSON3 word-level timestamps** (best): map each new segment to the start time of its first word and end time of its last word. (2) **Source cue boundary snapping**: snap new boundaries to the nearest original cue boundary. (3) **Proportional interpolation**: distribute time by character ratio (current fallback, least accurate). Option 1 is strongly recommended and is a prerequisite investment.
- **Fit with current Moshimoshi stack**: Good. Two integration paths: (A) **ONNX Runtime in Node.js**: wtpsplit-lite provides minimal-dependency ONNX inference (huggingface-hub, numpy, onnxruntime). ONNX Runtime has a Node.js binding (`onnxruntime-node`), so the model could run directly in an API route. (B) **Python microservice**: More straightforward deployment using the wtpsplit Python package. Either path integrates as a new step between transcript retrieval (`transcript/[videoId]/route.ts`) and the existing merge/chunk pipeline. The existing pipeline becomes post-processing (enforcing timing safety, quality scoring) rather than the primary segmentation logic.
- **Runtime / latency**: sat-3l (recommended): ~150ms per page of text (~3000 characters). For a typical 10-minute YouTube transcript (~2000-5000 characters), expect 100-300ms total. Cached after first segmentation.
- **Infra cost**: Self-hosted. Model size: sat-3l is ~50MB. ONNX version is smaller. No API costs. RAM: ~200MB loaded. Fits within Vercel serverless function limits.
- **Licensing**: MIT. Fully permissive.
- **Risks**: (1) Japanese performance may be lower than English -- the paper benchmarks are aggregated across languages. Mitigated by testing on a sample of Japanese YouTube transcripts before committing. (2) The TED adapter is trained on English TED talks; Japanese caption text may need a custom LoRA adapter. Mitigated by evaluating the base model's Japanese performance first, then fine-tuning if needed (LoRA training requires only a few hundred examples). (3) ONNX Runtime in Node.js adds ~50MB to deployment. Mitigated by Python microservice alternative.
- **Recommendation**: `pursue`

### Option 2

- **Name**: JSON3 word-level timestamp extraction + rule-based utterance grouping
- **Type**: `hybrid`
- **What it does**: YouTube provides captions in JSON3 format with per-word timestamps and confidence scores (0-255). This option extracts the richer JSON3 data instead of the current SRT/VTT cue-level data, then applies rule-based utterance grouping using timing gaps as the primary segmentation signal. Words separated by gaps >300ms are tentatively split. Tentative boundaries are then validated against linguistic rules: (1) do not split within a bunsetsu (using Sudachi WASM POS tags from Report 01), (2) prefer splits at clause-connective particles, (3) merge segments shorter than 1.5 seconds with their neighbors.
- **Why it helps segmentation quality**: The fundamental problem is that YouTube auto-captions are segmented by display timing (~3-5 second intervals), not by linguistic boundaries. JSON3 word-level data lets the system access the raw word stream with precise timing, bypassing YouTube's arbitrary cue boundaries entirely. Timing gaps between words directly reflect speech pauses -- a natural utterance boundary signal. Combined with the morphological analysis from Report 01 (Sudachi WASM), this creates segments that align with both acoustic pauses and linguistic structure. This approach is deterministic and requires no ML model for segmentation itself.
- **Timing preservation or re-alignment story**: **Timing is natively preserved.** Each word has its own timestamp from YouTube's ASR. New segment boundaries are defined by selecting specific word boundaries as split points, so each segment's start/end time is exact (start of first word, end of last word). No interpolation or forced alignment needed. This is a major improvement over the current proportional character-to-time distribution.
- **Fit with current Moshimoshi stack**: Requires modification to `transcript/[videoId]/route.ts` to fetch JSON3 format instead of (or in addition to) the current format. The Innertube.js library used for transcript retrieval may already support JSON3/SRV3 -- needs verification. If not, `youtube-transcript-api` (Python) or direct HTTP requests to YouTube's timedtext endpoint can extract JSON3. The rest of the pipeline (`mergeSegments.ts`, `chunkSegments.ts`) would be replaced by the new word-level grouping logic, with the existing quality scorer and timeline enforcer remaining as validation.
- **Runtime / latency**: <50ms for the grouping algorithm (iterating over word-level data). Sudachi WASM tokenization: <1ms per segment. Total pipeline: <100ms. No external API calls.
- **Infra cost**: Zero. All processing is local. JSON3 data is fetched alongside the regular transcript with no additional API cost.
- **Licensing**: N/A -- application logic. YouTube data access subject to YouTube Terms of Service.
- **Risks**: (1) JSON3 format availability: not all YouTube videos may expose JSON3 data. Manual captions and some auto-captions may only be available in VTT/SRT. Requires fallback to current pipeline for these cases. (2) Innertube.js may not support JSON3 extraction natively -- may need library modification or alternative extraction method. (3) Timing gaps alone are not always reliable boundary signals: fast speakers have minimal gaps, while slow speakers have gaps mid-sentence. The linguistic validation layer (Sudachi POS) mitigates this but adds complexity. (4) YouTube may change the JSON3 format without notice.
- **Recommendation**: `pursue`

### Option 3

- **Name**: Unsupervised subtitle segmentation with masked language models (ACL 2023 method)
- **Type**: `ML`
- **What it does**: Uses a pretrained masked language model (BERT, RoBERTa, or for Japanese: BERT-base-japanese) to predict subtitle break points. The method masks candidate break positions and measures the model's predicted probability of sentence-ending punctuation at each position. High punctuation probability = likely sentence boundary. The approach requires no fine-tuning -- it works zero-shot with any pretrained MLM. Published at ACL 2023 Short Papers (Ponce, Etchegoyhen & Ruiz).
- **Why it helps segmentation quality**: Unlike supervised models that require training data for each language/domain, this method leverages the implicit sentence structure knowledge already in pretrained language models. For Japanese, BERT-base-japanese (trained on Japanese Wikipedia) has strong sentence boundary knowledge. The method is language-agnostic by design -- switch the MLM, switch the language. It also naturally handles the subtitle domain because it works on raw text without requiring punctuation, spaces, or specific formatting. It could serve as a complement to wtpsplit (Option 1) for cases where the TED adapter underperforms on Japanese.
- **Timing preservation or re-alignment story**: Same as Option 1 -- operates on text only, returns character-offset boundaries. Requires JSON3 word-level timestamps (Option 2) or proportional interpolation for timing recovery.
- **Fit with current Moshimoshi stack**: Moderate. Requires loading a BERT-base-japanese model (~400MB) either in ONNX format for Node.js or via a Python microservice. The inference is simple (masked prediction at candidate positions), so the code footprint is small even if the model is large. Integrates at the same point as Option 1: between transcript retrieval and merge/chunk.
- **Runtime / latency**: ~200-500ms per transcript depending on text length and number of candidate break positions evaluated. Each candidate requires one forward pass through the model. Can be optimized by batching candidates.
- **Infra cost**: Self-hosted. Model size: ~400MB (BERT-base-japanese). RAM: ~500MB loaded. May exceed Vercel serverless limits. Better suited for a dedicated microservice.
- **Licensing**: The method is described in an academic paper (open access). BERT-base-japanese: Apache 2.0. Implementation would be custom code.
- **Risks**: (1) Higher latency than wtpsplit due to multiple forward passes. (2) Larger model size than wtpsplit. (3) No production-ready library -- requires implementing the paper's algorithm. (4) The paper evaluates on European languages; Japanese performance is theoretically sound but unverified. (5) May produce different boundary quality than wtpsplit -- comparative evaluation needed.
- **Recommendation**: `prototype`

## 3. Findings In Detail

### The subtitle-to-utterance gap is well-documented in research

Multiple academic papers confirm that subtitle segmentation is fundamentally different from linguistic segmentation:

**"Inter-Sentence Segmentation of YouTube Subtitles Using LSTM"** (Song & Kim, 2019, Applied Sciences): Directly addresses this problem. Builds an LSTM-RNN to predict sentence boundaries in YouTube subtitle text, achieving 70.84% accuracy on Stanford lecture subtitles. The paper explicitly notes that "YouTube subtitles are divided into time-unit-based segments rather than sentence-unit-based segments." This validates the problem diagnosis in SESSION_CONTEXT.md.

**Netflix Timed Text Style Guide**: Netflix subtitle guidelines prioritize display readability (max 42 chars/line, 20-25 chars/second reading speed, min 5/6 second duration) over linguistic completeness. Subtitle breaks are driven by character count and reading speed, only secondarily by grammar. This confirms that even professional subtitles are display-optimized, not practice-optimized.

**"SBAAM! Eliminating Transcript Dependency in Automatic Subtitling"** (Gaido et al., ACL 2024): Demonstrates that end-to-end speech-to-subtitle models can produce better segmentation than cascade (ASR→text→segmentation) systems because they can leverage prosodic cues. This suggests that the long-term optimal path may include audio analysis (Report 05 territory), but text-first approaches remain the practical starting point.

### Utterance vs sentence: the right unit for shadowing

For shadowing practice, the target unit is the **utterance**, not the sentence:

- A **sentence** is a grammatically complete written unit. Japanese: "彼は毎日公園で運動をしています。"
- An **utterance** is a stretch of speech by one speaker, bounded by silence or speaker change. An utterance may be a complete sentence, a fragment, a filler, or multiple sentences run together.
- An **Inter-Pausal Unit (IPU)** is a segment of speech bounded by pauses >150-300ms. IPUs are the atomic units below utterances.

For shadowing, the utterance is the natural practice unit because:
1. It matches what the speaker actually said in one breath/turn
2. It has natural prosodic contour (rise/fall of pitch)
3. It is bounded by real silence, so looping is clean
4. It may be grammatically incomplete but is still meaningful for imitation practice

The current system treats segments as quasi-sentences (split at punctuation or character limit). Shifting to utterance-based segments would better serve the shadowing use case.

### The Corpus of Spontaneous Japanese (CSJ) validates the utterance approach

The CSJ (650+ hours of annotated spontaneous Japanese) uses IPU-based segmentation with three hierarchical levels: IPU, clause, and intonational phrase. Research on CSJ demonstrates that Japanese spoken language has identifiable utterance boundaries that differ from written sentence boundaries. The clause-level annotation in CSJ maps closely to what would be ideal shadowing segments: complete clauses with natural prosodic boundaries, typically 2-8 seconds in duration.

### Production-ready vs academic-only findings

**Production-ready:**
- wtpsplit/SaT: MIT license, ONNX support, 85 languages, actively maintained (EMNLP 2024)
- 1-800-BAD-CODE punct_cap_seg_47_language: Trained on OpenSubtitles data (domain-relevant), 47 languages including Japanese
- BudouX: Google-maintained, npm package, 15KB, Japanese phrase segmentation
- Silero VAD: Enterprise-grade, MIT license, <1ms latency, 6000+ languages
- subtitle.js: TypeScript SRT/VTT parser, npm package

**Academic-only (replicable but no production library):**
- LSTM YouTube subtitle segmentation (Song & Kim 2019): 70.84% accuracy, English-only training
- Unsupervised MLM subtitle segmentation (ACL 2023): Zero-shot approach, no implementation available
- CRF subtitle segmentation (Speech Communication 2017): Good results but no maintained library
- SBAAM end-to-end subtitling (ACL 2024): Code available but requires significant infrastructure

**Overkill for current needs:**
- Full ASR re-transcription (Kotoba-Whisper, ReazonSpeech): Solves the problem by bypassing subtitles entirely, but adds massive compute cost
- NeMo Forced Aligner: GPU-required, overkill when JSON3 word-level timestamps are available
- JESC corpus (3.2M parallel subtitle sentences): Useful for training but not for runtime segmentation

### Key insight: YouTube JSON3 is an underexploited resource

YouTube's JSON3 caption format provides per-word timestamps and confidence scores. This data is far richer than the SRT/VTT cue-level data the current pipeline uses. With word-level timing:

1. **Re-segmentation becomes a text-only problem**: Once you have word-level timestamps, you can re-arrange words into any segment grouping and derive exact timing from the word boundaries.
2. **Timing gaps become a segmentation signal**: Gaps between consecutive words reflect speech pauses. Gaps >300ms are strong utterance boundary candidates.
3. **Confidence scores indicate ASR uncertainty**: Low-confidence words may indicate noisy segments where deterministic fallback is safer.

Extracting JSON3 data is the single highest-leverage infrastructure change for improving segmentation quality.

## 4. Relevance To Current Architecture

Reference files analyzed (from Wave 1 codebase inspection):

### `src/app/api/youtube/transcript/[videoId]/route.ts`

**Current behavior**: Fetches transcript via Innertube.js, producing an array of `{ text, start, duration }` objects at cue level. Each cue is a display-timing unit (~3-5 seconds), not a linguistic unit.

**Where Option 1 (wtpsplit) plugs in**: After transcript retrieval, concatenate all cue texts into a single string. Run wtpsplit to identify sentence boundaries. Map boundaries back to cue-level timing (or word-level timing if JSON3 is available). Replace the downstream merge/chunk pipeline with the re-segmented output.

**Where Option 2 (JSON3 extraction) plugs in**: Modify the transcript retrieval to fetch JSON3 format (YouTube timedtext endpoint with `fmt=json3`). Parse the richer format to extract word-level `{ text, startMs, durationMs, confidence }` objects. This becomes the foundation for all downstream segmentation.

**Integration approach**: Add a new function `fetchWordLevelTranscript(videoId)` alongside the existing `fetchTranscript(videoId)`. When word-level data is available, use the new segmentation pipeline. When not available (manual captions, some languages), fall back to the existing cue-level pipeline.

### `src/lib/transcript/chunkSegments.ts`

**Current behavior**: Splits at punctuation or 45-character limit. Uses `Intl.Segmenter` for word boundaries. Distributes timing proportionally.

**What changes**: With Option 1 or Option 2, `chunkSegments` shifts from being the primary segmentation logic to being a **fallback and safety net**. It would only activate when:
1. The new pipeline fails or is unavailable
2. Segments from the new pipeline exceed maximum duration (>10s)
3. Quality validation rejects the new pipeline's output

The existing `healBrokenWordBoundaries()` and `rebalanceContinuationBoundaries()` functions remain valuable as post-processing on the new pipeline's output.

### `src/lib/transcript/mergeSegments.ts`

**Current behavior**: Merges tiny segments (<4 chars, <0.6s), lonely fragments, and cues without sentence-ending punctuation.

**What changes**: With word-level data (Option 2), the merge logic shifts from character/duration heuristics to gap-based grouping. Words with gaps <300ms are grouped into the same segment by default. The existing `shouldMergeTranscriptSegments()` function becomes a fallback for cue-level data.

### `src/lib/transcript/segmentQuality.ts`

**What changes**: The quality scorer's "sentence terminal ratio" dimension becomes more meaningful after re-segmentation, since segments will actually end at sentence/utterance boundaries. The "duration distribution" and "text length distribution" dimensions remain relevant as-is. Consider adding a new dimension: "boundary confidence" based on wtpsplit's probability output or JSON3 timing gap magnitude.

### `src/lib/transcript/aiTimingAlignment.ts`

**What changes**: With JSON3 word-level timestamps (Option 2), this module becomes less critical. Currently it uses substring matching to map AI-generated text back to source timing -- a fragile process. Word-level timestamps make timing assignment exact, bypassing the alignment problem entirely. The module remains relevant as a fallback for the AI resegmentation path (Report 01, Option 1).

### `src/utils/youtubePlayerUtils.ts`

**No changes needed**. Buffer calculation and seek verification operate on segment start/end times regardless of how those times were determined. The improved timing accuracy from word-level timestamps would actually make the existing buffer calculations more effective.

### Where this replaces deterministic logic, AI logic, or both

- **Option 1 (wtpsplit)**: Replaces the deterministic chunking logic in `chunkSegments.ts` with ML-based sentence boundary detection. The AI resegmentation path in `resegment/route.ts` becomes complementary (LLM for punctuation restoration from Report 01, wtpsplit for boundary detection).
- **Option 2 (JSON3 + rules)**: Replaces both the merge logic (`mergeSegments.ts`) and chunk logic (`chunkSegments.ts`) with a new word-level grouping pipeline. Deterministic, no ML required. The AI path remains for additional quality improvement.
- **Option 3 (MLM segmentation)**: Replaces chunking logic, similar to Option 1 but with a different model architecture.

### Whether it requires a new `PracticeSegment` model

**Yes, and the word-level data makes the case stronger.** With JSON3 word-level timestamps, there is now a clear three-tier data model:

```typescript
// Tier 1: Raw word-level data from YouTube
interface TranscriptWord {
  text: string;
  startMs: number;
  durationMs: number;
  confidence: number;  // 0-255 from JSON3
}

// Tier 2: Computed segments from the segmentation pipeline
interface ComputedSegment {
  text: string;
  startTime: number;
  endTime: number;
  words: TranscriptWord[];       // Source words comprising this segment
  boundaryMethod: 'wtpsplit' | 'gap-based' | 'punctuation' | 'character-limit';
  boundaryConfidence: number;    // 0-1, from model probability or gap magnitude
}

// Tier 3: Practice segments presented to the user
interface PracticeSegment {
  id: string;
  videoId: string;
  text: string;
  startTime: number;
  endTime: number;
  words: TranscriptWord[];
  boundaryConfidence: number;
  isUserEdited: boolean;
  qualityScore: number;          // From segmentQuality.ts
}
```

This separates concerns cleanly: Tier 1 is immutable source data, Tier 2 is regeneratable pipeline output, Tier 3 includes user overrides and is the runtime unit for the player.

## 5. Recommendation

**Pursue now**

Why:

The subtitle-to-utterance transformation is the core unsolved problem identified in SESSION_CONTEXT.md. Two of the three options require no new external infrastructure (Option 2 is pure Node.js; Option 1 can run via ONNX in Node.js). The combination of Options 1 and 2 produces a pipeline where:

1. JSON3 word-level data provides exact timing (no interpolation)
2. Timing gaps provide acoustic boundary candidates
3. wtpsplit provides linguistic boundary detection for unpunctuated text
4. Boundaries from both signals are merged (prefer boundaries where gap AND linguistic signals agree)
5. Sudachi WASM (Report 01) validates that boundaries do not split mid-bunsetsu
6. The existing quality scorer validates the final output

This is a substantial improvement over character-count chunking, achievable with production-grade tooling, and architecturally compatible with the existing codebase.

**Recommended implementation order:**

1. **Week 1**: Extract JSON3 word-level timestamps from YouTube. Add `fetchWordLevelTranscript()` to the transcript retrieval API. Verify availability across a sample of 50+ Japanese YouTube videos.

2. **Week 2**: Implement gap-based utterance grouping on word-level data (Option 2). Set initial gap threshold at 300ms. Combine with Sudachi WASM POS validation (from Report 01) to prevent mid-bunsetsu splits. Measure quality improvement via `segmentQuality.ts`.

3. **Week 3**: Integrate wtpsplit (Option 1) as a second boundary signal. Deploy sat-3l model via ONNX Runtime in Node.js or as a Python microservice. Evaluate Japanese performance on the test set. If base model underperforms, evaluate the TED LoRA adapter or consider custom fine-tuning.

4. **Week 4**: Merge boundary signals (gap-based + wtpsplit). Implement the `PracticeSegment` model. Evaluate end-to-end quality against the current pipeline on the test set.

## 6. Sources

- [wtpsplit / Segment Any Text (EMNLP 2024)](https://aclanthology.org/2024.emnlp-main.665/)
- [wtpsplit GitHub](https://github.com/segment-any-text/wtpsplit) -- MIT license
- [wtpsplit-lite (ONNX inference)](https://github.com/superlinear-ai/wtpsplit-lite)
- [SaT sat-3l on Hugging Face](https://huggingface.co/segment-any-text/sat-3l)
- [Inter-Sentence Segmentation of YouTube Subtitles Using LSTM (Song & Kim, 2019)](https://www.mdpi.com/2076-3417/9/7/1504/htm)
- [Unsupervised Subtitle Segmentation with Masked Language Models (ACL 2023)](https://aclanthology.org/2023.acl-short.67/)
- [SBAAM! Eliminating Transcript Dependency in Automatic Subtitling (ACL 2024)](https://arxiv.org/abs/2405.10741)
- [Point Break: Surfing Heterogeneous Data for Subtitle Segmentation (CLiC-it 2020)](https://books.openedition.org/aaccademia/8620?lang=en)
- [Improving subtitle segmentation through CRF (Speech Communication, 2017)](https://www.sciencedirect.com/science/article/abs/pii/S0167639316300127)
- [Direct Speech Translation for Automatic Subtitling (TACL, 2024)](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00607/118115)
- [Netflix Timed Text Style Guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements)
- [Netflix Subtitle Timing Guidelines](https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines)
- [1-800-BAD-CODE punct_cap_seg_47_language](https://huggingface.co/1-800-BAD-CODE/punct_cap_seg_47_language)
- [SBD-SCD Pipeline (WWW 2021)](https://dl.acm.org/doi/fullHtml/10.1145/3442442.3451894) -- [GitHub](https://github.com/doGregor/SBD-SCD-pipeline)
- [Silero VAD](https://github.com/snakers4/silero-vad) -- MIT license
- [BudouX](https://github.com/google/budoux) -- Apache 2.0
- [subtitle.js](https://github.com/gsantiago/subtitle.js) -- MIT, TypeScript SRT/VTT parser
- [Corpus of Spontaneous Japanese (CSJ)](https://clrd.ninjal.ac.jp/csj/en/)
- [ReazonSpeech](https://github.com/reazon-research/ReazonSpeech)
- [JESC (Japanese-English Subtitle Corpus)](https://nlp.stanford.edu/projects/jesc/)
- [Kotoba-Whisper v2.2](https://huggingface.co/kotoba-tech/kotoba-whisper-v2.2)
- [Construction of a Large-scale Japanese ASR Corpus (ICASSP 2021)](https://arxiv.org/abs/2103.14736)
- [WhisperX](https://github.com/m-bain/whisperX)
- [Stable-ts](https://github.com/jianfch/stable-ts)
- [ffsubsync](https://github.com/smacke/ffsubsync) -- MIT license
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
- [GiNZA](https://github.com/megagonlabs/ginza) -- MIT license
- [Bunkai](https://github.com/megagonlabs/bunkai) -- Apache 2.0
- [Fast-bunkai](https://github.com/hotchpotch/fast-bunkai) -- Apache 2.0
- [MuST-Cinema Corpus (LREC 2020)](https://aclanthology.org/2020.lrec-1.460/)
- [Evaluating Subtitle Segmentation (LREC 2022)](https://aclanthology.org/2022.lrec-1.328/)
- [Punctuation-Restoration-For-Youtube-Transcript](https://github.com/shashank2123/Punctuation-Restoration-For-Youtube-Transcript)
- [ONNX Runtime Web / Node.js](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
- [Awesome Japanese NLP Resources](https://github.com/taishi-i/awesome-japanese-nlp-resources)
