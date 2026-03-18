# Research Output: Japanese Segmentation And Punctuation Restoration

Title: Japanese Segmentation and Punctuation Restoration for Shadowing Practice Units

Date: 2026-03-12

Researcher: Claude (Opus 4.6)

Problem Area: How can we convert noisy Japanese YouTube captions or ASR transcript fragments into meaningful shadowing practice segments?

## 1. Executive Summary

- **Strongest finding**: GiNZA (spaCy-based Japanese NLP) provides production-grade bunsetsu and experimental clause recognition APIs that can identify natural Japanese phrase and clause boundaries from morphologically analyzed text. This is the most linguistically grounded approach available.
- **Most promising technology**: A hybrid pipeline combining Sudachi WASM (Node.js-native morphological analysis) with LLM-based punctuation restoration, validated by rule-based clause boundary detection. This gives the best balance of quality, latency, and architectural fit.
- **Biggest risk**: The current pipeline has no Japanese linguistic analysis at all -- segmentation is purely regex/character-count driven. Adding any linguistic layer requires either a Python microservice (GiNZA) or relying on LLM API latency for real-time processing.
- **Final recommendation**: Pursue a two-phase approach. Phase 1: LLM-based punctuation restoration via the existing AI path in `resegment/route.ts` with a specialized Japanese prompt (days, not weeks). Phase 2: Sudachi WASM integration for morphological awareness in the deterministic pipeline, preventing mid-word and mid-particle splits.

## 2. Best 3 Options

### Option 1

- **Name**: LLM-based punctuation restoration + clause boundary insertion
- **Type**: `hybrid` (LLM + rule-based post-processing)
- **What it does**: Sends raw/unpunctuated Japanese caption text to GPT-4o-mini or Claude with a specialized prompt that instructs: (1) restore sentence-ending punctuation (。！？), (2) insert clause-level punctuation (、) at natural spoken boundaries (て-form, ので, から, etc.), (3) preserve all original words exactly. The LLM output is then split at restored punctuation marks using deterministic rules.
- **Why it helps segmentation quality**: The current pipeline's weakest point is that YouTube auto-captions arrive without Japanese punctuation. The regex `/[。！？!?]$/` in `chunkSegments.ts` finds nothing to split on. Punctuation restoration directly enables the existing pipeline to produce sentence-level segments instead of arbitrary character-count chunks. LLMs have excellent Japanese clause boundary understanding, including colloquial and informal speech patterns that rule-based systems miss.
- **Timing preservation or re-alignment story**: Does NOT preserve timing directly. Requires re-alignment via the existing `alignAiTextsToSourceTimeline()` function in `aiTimingAlignment.ts`, which uses substring matching to map restored text back to source timing. The current 95% match ratio requirement may need relaxation to ~90% since punctuation insertion changes character count. Alternatively, punctuation can be inserted as metadata (boundary markers) rather than modifying the text, preserving exact substring matching.
- **Fit with current Moshimoshi stack**: Excellent. The `resegment/route.ts` API already calls `AIService.processTranscript()` with `splitForShadowing: true`. This option requires only a better prompt and relaxed alignment matching -- no new infrastructure. The existing feature flag `AI_RESEGMENTATION` controls the path.
- **Runtime / latency**: 500ms-2s per transcript batch via API. Can be batched (current system already batches ~120 chunks). Cached after first call.
- **Infra cost**: ~$0.002-0.01 per transcript (GPT-4o-mini pricing). Negligible at current scale.
- **Licensing**: API terms of OpenAI/Anthropic. No self-hosting concerns.
- **Risks**: (1) LLM may occasionally paraphrase instead of just inserting punctuation, breaking alignment. Mitigated by strict prompt + alignment validation. (2) API latency adds ~1-3s to first load. Mitigated by caching. (3) LLM may insert punctuation at non-ideal boundaries for shadowing (e.g., splitting a compound sentence that works as one practice unit). Mitigated by post-processing rules that merge short resulting segments.
- **Recommendation**: `pursue`

### Option 2

- **Name**: Sudachi WASM morphological analysis integration
- **Type**: `hybrid` (ML morphological model + rule-based boundary detection)
- **What it does**: Sudachi WASM (`npm install sudachi`) runs directly in Node.js without native dependencies. It tokenizes Japanese text into morphemes with part-of-speech tags. Using these POS tags, a rule layer detects clause boundaries by identifying: (1) sentence-ending particles (。/！/？ or verbal endings in terminal form 終止形), (2) clause-connective patterns (て-form verbs, conjunctive particles like から/ので/けど/が), (3) quotative markers (と/って). Segments are then split at these linguistically-informed boundaries instead of at arbitrary character counts.
- **Why it helps segmentation quality**: The current `chunkSegments.ts` uses `Intl.Segmenter` for word boundaries and a 45-character hard limit. It has no understanding of Japanese grammar. Sudachi Mode C preserves compound words (e.g., "東京都" stays as one token, not "東京" + "都"), and POS tags reveal where clauses actually end. This prevents the current failure case where a segment ends mid-particle or mid-clause (e.g., splitting "好きな理由は" from "だから好きです"). The orphan particle detection in `mergeSegments.ts` (regex for ね|よ|な|か) could be replaced with proper POS-based detection.
- **Timing preservation or re-alignment story**: Operates on text only but does NOT modify text content -- it adds boundary markers between existing characters. Timing from source segments is preserved exactly because the text is unchanged. Proportional character-to-time distribution (already in `chunkSegments.ts`) would apply to linguistically-informed chunks instead of arbitrary ones, producing more natural timing.
- **Fit with current Moshimoshi stack**: Good. Sudachi WASM runs natively in Node.js API routes. Dictionary load (~1.7s with Core dictionary) can be cached at module level in the serverless function. Tokenization averages ~0.5ms per call. Plugs directly into `chunkSegments.ts` as a replacement for the `Intl.Segmenter` + character-limit logic. No Python microservice needed.
- **Runtime / latency**: ~1.7s initial dictionary load (cached across requests in warm serverless instances), <1ms per segment tokenization. Total pipeline impact: negligible after warmup.
- **Infra cost**: Zero. Self-hosted WASM binary. Core dictionary is ~207MB (loaded into memory once). Full dictionary is ~500MB. Vercel serverless functions have 1GB memory limit by default -- Core dictionary fits comfortably.
- **Licensing**: Apache 2.0 (Sudachi core + dictionary). Fully permissive.
- **Risks**: (1) 207MB dictionary in serverless memory may cause cold start latency (~1.7s). Mitigated by keeping functions warm or pre-loading. (2) Mode C compound preservation may over-group in some cases (e.g., treating "食べている" as one unit when "食べて" + "いる" would be a better clause break). Mitigated by combining with clause boundary rules on the POS output. (3) Does not handle punctuation restoration -- still needs Option 1 for unpunctuated text.
- **Recommendation**: `pursue`

### Option 3

- **Name**: GiNZA bunsetsu + clause segmentation (Python microservice)
- **Type**: `ML` (spaCy-based dependency parsing with Japanese-specific extensions)
- **What it does**: GiNZA provides three APIs relevant to this problem: (1) `bunsetu_spans()` returns bunsetsu (文節) phrase boundaries -- the natural phrasal units of Japanese, (2) `bunsetu_heads()` identifies the grammatical head of each bunsetsu, and (3) experimental `ClauseHead` attribute (v5.2) identifies clause boundaries using dependency parsing. A Python microservice exposes these as an HTTP endpoint. Input: raw Japanese text. Output: array of clause/bunsetsu boundaries with character offsets.
- **Why it helps segmentation quality**: Bunsetsu segmentation is the gold standard for Japanese text segmentation. Bunsetsu boundaries correspond to natural phrase breaks in spoken Japanese -- exactly where a shadowing learner would naturally pause. GiNZA's bunsetsu head accuracy is ~96% when morphological analysis is correct. The experimental clause recognition goes further by identifying sentence-level boundaries that span multiple bunsetsu units, producing segments that are complete clauses rather than just phrases. This is the only approach that can reliably identify segment boundaries like "彼は毎日 | 公園で | 運動をしています" (three bunsetsu) and group them into a meaningful practice unit "彼は毎日公園で運動をしています" (one clause).
- **Timing preservation or re-alignment story**: Like Option 2, operates on text only and does not modify content. Boundary offsets map directly to character positions in the original text, so timing can be derived from existing proportional distribution. For higher accuracy, boundaries could be cross-referenced with source segment gaps (>0.5s pauses that already exist in the caption timing) to prefer boundaries that align with actual speech pauses.
- **Fit with current Moshimoshi stack**: Moderate. Requires a Python microservice (Flask/FastAPI) running alongside the Next.js app. Could be deployed as a separate Vercel serverless function (Python runtime), a Docker sidecar, or an external API. The `resegment/route.ts` API would call this microservice as an additional step between transcript retrieval and the existing merge/chunk pipeline. Architecturally similar to how the app already calls external AI services.
- **Runtime / latency**: 10-50ms per sentence (`ja_ginza` model). Full transcript of 200 sentences: ~2-10s. `ja_ginza_electra` is more accurate but requires 16GB+ RAM and is slower. For a serverless deployment, `ja_ginza` (smaller model) is recommended.
- **Infra cost**: Moderate. Python runtime with spaCy + GiNZA model (~500MB RAM for `ja_ginza`). If deployed on Vercel serverless Python, within free tier for moderate usage. If deployed separately, ~$5-20/month for a small instance.
- **Licensing**: MIT (GiNZA). Apache 2.0 (SudachiPy dependency). Fully permissive.
- **Risks**: (1) Adds a Python microservice to an otherwise pure Node.js/TypeScript stack. Increases operational complexity. (2) Clause recognition API is labeled "experimental" in GiNZA v5.2 -- may have edge cases. Mitigated by using bunsetsu boundaries as fallback when clause detection fails. (3) Cold start latency for model loading (~5-10s). Mitigated by keeping the microservice warm. (4) 16GB+ RAM requirement for the ELECTRA model variant makes it unsuitable for serverless -- must use the smaller `ja_ginza` model.
- **Recommendation**: `prototype`

## 3. Findings In Detail

### Production-credible tools for Node.js integration

**Sudachi WASM** is the standout finding for direct Node.js integration. It provides morphological analysis with part-of-speech tagging, runs as a pure WASM binary (`npm install sudachi`), and its Mode C compound word preservation is specifically useful for identifying natural Japanese word boundaries. Benchmarks show ~0.5ms per tokenization call after dictionary warmup. The Core dictionary (207MB) is sufficient for production use.

**Lindera WASM** is a lighter alternative (13MB embedded dictionary, MIT license) but provides less rich morphological output and lacks Sudachi's three-granularity-mode system.

**kuromoji.js** is the legacy pure-JS option (~116K weekly npm downloads) but is effectively unmaintained. A fork `@patdx/kuromoji` exists with more recent updates. Only consider if Sudachi WASM proves too heavy for the deployment target.

**BudouX** (Google, Apache 2.0, `npm install budoux`, ~15KB) provides phrase-level segmentation optimized for line-breaking. It is NOT suitable for sentence/clause boundary detection, but could supplement display formatting of subtitle text.

**sentence-splitter** (`npm install sentence-splitter`, MIT) provides rule-based sentence boundary detection for already-punctuated Japanese text. Useful as the final splitting step after punctuation restoration.

### Punctuation restoration models

**punct_cap_seg_47_language** (HuggingFace, 1-800-BAD-CODE) is the most directly applicable standalone model. It handles Japanese punctuation natively (。、？！・) and performs both punctuation restoration and sentence boundary detection on unpunctuated text. Requires Python/PyTorch. Expect 50-200ms per segment on GPU.

**bobfromjapan/bert_japanese_punctuation** is a BERT-based model trained on literary Japanese (Natsume Soseki). Apache 2.0, but limited training data makes it unreliable for colloquial/spoken Japanese.

**LLM-based restoration** (GPT-4o-mini, Claude) is the most pragmatic approach for production. LLMs have excellent understanding of spoken Japanese patterns and can be prompted to preserve text exactly while inserting punctuation. The trade-off is API latency and cost, but both are manageable for a cached pipeline.

### Dependency parsing and clause detection

**GiNZA** is the clear leader for Japanese-specific NLP in Python. Its bunsetsu recognition (~96% accuracy) and experimental clause detection (v5.2) are unmatched by any other available tool. Maintained by Megagon Labs (Recruit Holdings), MIT licensed.

**CaboCha** is the legacy standard for Japanese dependency parsing but is unmaintained and not based on Universal Dependencies. Do not adopt for new projects.

**spaCy Japanese models** (without GiNZA) provide basic dependency parsing but GiNZA's Japanese-specific extensions (bunsetsu, clause) are significantly better for this use case.

### What looks overkill for current needs

**Full ASR re-transcription** (Whisper, Kotoba-Whisper, Qwen3-ASR, NVIDIA Parakeet). Re-transcribing YouTube videos from audio would give better punctuation and segmentation, but adds massive computational cost and complexity. The current transcript retrieval pipeline (Innertube.js) already works at 7/10. Re-transcription is a future option if punctuation restoration proves insufficient.

**Prosody-aware segmentation** (audio-based pause detection, pitch contour analysis). Valuable for future iterations but requires audio processing infrastructure not currently in the stack. Park for Wave 2 research.

**Academic clause boundary detection** (CBAP from Kyoto University/NAIST). >97% accuracy on the Corpus of Spontaneous Japanese, but not packaged for production use. The approach (morphological analysis + SVM classification of potential boundaries) validates the direction of Option 2 (Sudachi + rule-based boundaries).

### Relevant recent developments

**wtpsplit / Segment Any Text** (EMNLP 2024): Universal sentence segmentation for 85 languages including Japanese. Production-ready Python library. Could serve as an alternative to GiNZA for sentence-level (not clause-level) segmentation.

**Qwen3-ForcedAligner** (2026): Open-source forced alignment model from Alibaba that produces word-level timestamps for 52 languages including Japanese. Relevant for timing recovery (Report 02 territory) rather than segmentation.

**ja-senter-benchmark**: Benchmark suite for comparing Japanese sentence segmentation tools. Useful for evaluating options before committing to one.

## 4. Relevance To Current Architecture

Reference files inspected:

### `src/app/[locale]/youtube-shadowing/page.tsx`
The main YouTube shadowing page. Drives the player runtime. Fetches transcript via API, passes segments to the player for looping. Does not perform segmentation itself.

### `src/app/api/youtube/transcript/[videoId]/route.ts`
Transcript retrieval API. Fetches via Innertube.js, then runs the full deterministic pipeline: `removeTinyAdjacentTextOverlap()` → `mergeTranscriptSegments()` → `chunkTranscriptSegments()` → `healBrokenWordBoundaries()` → `rebalanceContinuationBoundaries()` → `enforceNonOverlappingTimeline()` → `computeSegmentQuality()`. Caches results keyed by `videoId:modelVersion:pipelineVersion`. This is the primary integration point for all three options.

### `src/app/api/youtube/resegment/route.ts`
AI resegmentation API. Feature-flagged (`AI_RESEGMENTATION`). Calls `AIService.processTranscript()` with `splitForShadowing: true`. Uses `alignAiTextsToSourceTimeline()` to map AI output back to source timing. Falls back to deterministic on any failure. **This is where Option 1 (LLM punctuation restoration) would plug in** -- the infrastructure exists, it just needs a better prompt and potentially relaxed alignment matching.

### `src/lib/transcript/chunkSegments.ts`
The core chunking logic. Uses `Intl.Segmenter` for Japanese word boundaries. Splits at sentence-ending punctuation (regex `/[。！？!?]$/`) when found, otherwise at character limit (45 chars). Distributes timing proportionally by character count. **This is where Option 2 (Sudachi WASM) would plug in** -- replacing `Intl.Segmenter` with Sudachi tokenization and adding POS-based boundary detection instead of character-count splitting.

### `src/lib/transcript/mergeSegments.ts`
Merging logic. `shouldMergeTranscriptSegments()` checks: tiny segments (<4 chars, <0.6s), lonely fragments (<5 chars), missing punctuation with small gap. Has an orphan particle regex (`ね|よ|な|か|さ|ぞ|ぜ|わ`). **Option 2 (Sudachi) would improve this** by replacing the hardcoded particle regex with actual POS-tag-based particle detection, and replacing character-count thresholds with linguistically-informed merge decisions.

### `src/lib/transcript/segmentQuality.ts`
Quality scoring. Three dimensions: sentence terminal ratio, duration distribution (2.5-8s ideal), text length distribution (15-80 chars). **All three options would improve the sentence terminal ratio** -- currently low because YouTube auto-captions lack punctuation. After punctuation restoration, this metric becomes meaningful.

### `src/lib/transcript/aiTimingAlignment.ts`
AI timing re-alignment. Uses substring matching (indexOf) to find AI-generated text within source text. Requires 95% match ratio. **Critical for Option 1** -- if the LLM inserts punctuation characters, the match ratio may drop below 95% because the text is now longer. Two mitigations: (1) strip punctuation before matching, (2) lower threshold to ~85%.

### Where each option plugs in

| Option | Primary integration point | Replaces | Requires new infra |
|--------|--------------------------|----------|-------------------|
| 1. LLM punctuation | `resegment/route.ts` | Current AI prompt | No (existing AI path) |
| 2. Sudachi WASM | `chunkSegments.ts`, `mergeSegments.ts` | `Intl.Segmenter` + regex | No (npm package) |
| 3. GiNZA microservice | New middleware between transcript retrieval and merge/chunk | Character-count chunking | Yes (Python service) |

### Whether it replaces deterministic logic, AI logic, or both

- **Option 1** replaces the current AI resegmentation prompt (AI logic). Deterministic fallback remains unchanged.
- **Option 2** replaces the deterministic chunking and merge logic. AI path remains unchanged. These are complementary.
- **Option 3** adds a new layer between retrieval and the existing pipeline. Could replace both the merge and chunk deterministic logic, or serve as a pre-processing step that informs them.

### Whether it requires a new `PracticeSegment` model

Not immediately. Options 1 and 2 improve the existing `TranscriptSegment` pipeline without requiring a new abstraction. However, the SESSION_CONTEXT.md vision of separating source transcript timing units from learner-facing repeat units would benefit from a `PracticeSegment` model that:
- Stores the original caption timing + text
- Stores the linguistically-corrected text + boundary markers
- Stores timing adjustments from re-alignment
- Stores a confidence score for the boundary quality
- Stores user edits (if correction UX is added later)

This model would naturally emerge from combining Options 1+2 -- the "source" is the raw caption, the "practice" is the punctuated/clause-segmented version.

## 5. Recommendation

**Pursue now**

Why:

The current system's segmentation quality is rated 5.5/10 and is the diagnosed bottleneck. The two recommended options (LLM punctuation restoration + Sudachi WASM morphological analysis) are complementary, require no new infrastructure beyond an npm package, and plug into existing integration points with minimal refactoring.

**Recommended implementation order:**

1. **Week 1**: Improve the AI resegmentation prompt in `resegment/route.ts` to focus specifically on Japanese punctuation restoration (。、！？) rather than generic "split for shadowing." Add a pre-processing step that strips punctuation before alignment matching to preserve the 95% match ratio. Enable the `AI_RESEGMENTATION` feature flag for testing.

2. **Week 2**: Integrate Sudachi WASM into `chunkSegments.ts`. Replace `Intl.Segmenter` word boundary detection with Sudachi Mode C tokenization. Add POS-based clause boundary detection rules (split at terminal verb forms, clause-connective particles). Replace the orphan particle regex in `mergeSegments.ts` with POS-tag-based detection.

3. **Week 3**: Evaluate quality improvement via `segmentQuality.ts` metrics on a test set of 20+ YouTube videos (mix of news, conversational, lecture content). If sentence terminal ratio improves from current ~40-60% to >80%, the pipeline is working.

4. **Future**: If quality plateau is reached with Options 1+2, prototype Option 3 (GiNZA microservice) for dependency-informed clause segmentation on hard cases.

## 6. Sources

- [Sudachi (Rust/WASM)](https://github.com/WorksApplications/sudachi.rs) - Apache 2.0, active maintenance
- [sudachi npm package](https://www.npmjs.com/package/sudachi) - WASM distribution for Node.js
- [GiNZA](https://github.com/megagonlabs/ginza) - MIT, bunsetsu + clause APIs, v5.2
- [punct_cap_seg_47_language](https://huggingface.co/1-800-BAD-CODE/punct_cap_seg_47_language) - 47-language punctuation restoration
- [sentence-splitter (npm)](https://github.com/textlint-rule/sentence-splitter) - MIT, rule-based Japanese sentence splitting
- [BudouX (Google)](https://github.com/google/budoux) - Apache 2.0, phrase-level segmentation
- [Lindera WASM](https://github.com/lindera/lindera-wasm) - MIT, lightweight alternative to Sudachi
- [kuromoji.js](https://github.com/takuyaa/kuromoji.js) - Apache 2.0, legacy pure-JS morphological analyzer
- [fugashi](https://github.com/polm/fugashi) - MIT, fast Python MeCab wrapper
- [bunkai (Megagon Labs)](https://github.com/megagonlabs/bunkai) - Apache 2.0, sentence boundary disambiguation
- [fast-bunkai](https://github.com/hotchpotch/fast-bunkai) - Apache 2.0, Rust-accelerated bunkai
- [wtpsplit / Segment Any Text (EMNLP 2024)](https://aclanthology.org/2024.emnlp-main.665/) - Universal sentence segmentation
- [ja-senter-benchmark](https://github.com/hkiyomaru/ja-senter-benchmark) - Benchmark suite for Japanese sentence segmenters
- [Benchmarks for Japanese Morphological Analyzers in WASM/Node.js](https://anila.me/en/blog/benchmarks-and-trade-offs-for-japanese-morphological-analyzer)
- [Sentence Boundary Detection on Line Breaks in Japanese (W-NUT 2020)](https://aclanthology.org/2020.wnut-1.10.pdf)
- [Efficient Adaptation of Multilingual Models for Japanese ASR (Dec 2024)](https://arxiv.org/html/2412.10705v1)
- [bobfromjapan/bert_japanese_punctuation](https://huggingface.co/bobfromjapan/bert_japanese_punctuation) - Apache 2.0, BERT-based
- [FunASR / ct-punc](https://github.com/modelscope/FunASR) - MIT, primarily Chinese punctuation
- [whisper-punctuator](https://github.com/jumon/whisper-punctuator) - Zero-shot Whisper-based, requires audio
- [Google Cloud Speech-to-Text automatic punctuation](https://cloud.google.com/speech-to-text/docs/automatic-punctuation)
- [Amazon Transcribe](https://aws.amazon.com/transcribe/features/) - Automatic punctuation for Japanese
- [awesome-japanese-nlp-resources](https://github.com/taishi-i/awesome-japanese-nlp-resources)
