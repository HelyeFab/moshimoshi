# Research Output: Competitive Teardown Of Miraa And Adjacent Tools

Title: Competitive Teardown -- Segmentation and Repeatable Practice Units

Date: 2026-03-12

Researcher: Claude (Opus 4.6)

Problem Area: How do the strongest shadowing or transcript-based language products appear to handle segmentation and repeatable practice units?

## 1. Executive Summary

- **Strongest finding**: No product in the market combines AI-based segment re-grouping with user-facing boundary adjustment in the practice UI. Every tool either accepts bad segments silently (Language Reactor, Migaku), hides them behind curated content (FluentU), or exposes editing in a separate interface divorced from the practice experience (LingQ, Miraa). This is the primary product gap.
- **Most promising product pattern**: Miraa's transcribe-first approach (generate your own segments from audio rather than consuming subtitle cues) paired with editable segments is the strongest architecture observed. It sidesteps the entire "bad subtitle segmentation" problem at the source.
- **Biggest risk**: Over-engineering segmentation quality when the market shows that "good enough + user correction" is a viable pattern. Trancy's independent review confirms that even imperfect AI re-segmentation makes practice "workable" -- the bar is not perfection.
- **Final recommendation**: Adopt a hybrid approach -- AI re-segmentation of caption text (not raw subtitle passthrough) with lightweight inline boundary adjustment for correction. This is what no competitor does well.

## 2. Best 3 Options

### Option 1

- **Name**: Transcribe-first segmentation (Miraa pattern)
- **Type**: `product pattern`
- **What it does**: Instead of consuming raw YouTube subtitle cues as practice units, generate segments independently from audio using an ASR model (Whisper or equivalent). This produces sentence-level segments with punctuation from the ASR model's own language model, bypassing the subtitle fragmentation problem entirely. Expose an in-app editing interface for users to correct transcription errors.
- **Why it helps segmentation quality**: YouTube auto-captions are time-aligned fragments, not sentences. They are optimized for display timing, not linguistic meaning. By generating an independent transcription, segment boundaries are determined by the ASR model's sentence detection, which naturally produces complete sentences with punctuation. Miraa demonstrates this approach works at scale for Japanese content.
- **Timing preservation or re-alignment story**: ASR models (Whisper large-v3, Kotoba-Whisper v2.2) produce word-level or segment-level timestamps alongside transcription. These timestamps are independently derived from audio, so they may differ from YouTube's subtitle timing. For looping purposes, the ASR timestamps are often MORE accurate than subtitle timing because they are aligned to actual speech rather than display formatting. However, a forced alignment step may be needed to refine timestamps to sub-100ms accuracy for clean looping.
- **Fit with current Moshimoshi stack**: Moderate-to-difficult. The current pipeline in `transcript/[videoId]/route.ts` is built around consuming Innertube.js subtitle cues. A transcribe-first approach would require: (1) audio extraction from YouTube (legal/ToS considerations), (2) ASR processing (compute cost), (3) a parallel pipeline path. This is a larger architectural change than improving the existing pipeline.
- **Runtime / latency**: Whisper large-v3: ~10-30s per 10-minute video on GPU. Kotoba-Whisper v2.2: ~2-5s for 10 minutes (ReazonSpeech-optimized). Cloud ASR APIs (Google, AWS): real-time to 2x real-time. All require either GPU infrastructure or API costs.
- **Infra cost**: GPU inference: $0.01-0.10 per video (depending on provider). Cloud ASR API: $0.006-0.024 per minute of audio. For a 10-minute video: $0.06-0.24.
- **Licensing**: Whisper: MIT. Kotoba-Whisper: Apache 2.0. Cloud APIs: commercial terms.
- **Risks**: (1) YouTube ToS may restrict audio extraction for server-side processing. (2) ASR quality on noisy/musical content is lower than on clean speech. (3) Compute cost scales linearly with usage. (4) Requires significant architectural investment compared to improving the existing caption pipeline.
- **Recommendation**: `prototype`

### Option 2

- **Name**: NLP re-segmentation with inline boundary editing (hybrid of Trancy + Miraa)
- **Type**: `hybrid` (NLP re-segmentation + product UX pattern)
- **What it does**: Take existing YouTube caption cues, apply NLP-based sentence boundary detection to merge fragmented cues into complete sentences, and present the re-segmented text as practice units. Where automatic re-segmentation produces imperfect results, expose a lightweight inline boundary adjustment control (e.g., drag handles between segments, or tap to merge/split) directly in the practice UI -- not buried in a separate editor.
- **Why it helps segmentation quality**: This directly addresses the core problem identified across all competitors. Language Reactor and Migaku pass through raw subtitle cues without modification. LingQ tries AI re-splitting but the result is unreliable for Japanese. Trancy applies NLP re-segmentation but independent review confirms it still produces bad boundaries ("that sentence isn't a sentence. It's 2 and a half sentences"). No product combines automatic re-segmentation with an ergonomic correction path in the practice view. This would be a genuine differentiator.
- **Timing preservation or re-alignment story**: Re-segmentation by merging adjacent subtitle cues preserves original timing -- the merged segment starts at the first cue's start time and ends at the last cue's end time. Splitting a cue requires proportional time distribution (already implemented in `chunkSegments.ts`). User boundary adjustments would need a simple "snap to nearest original cue boundary" behavior to maintain timing safety.
- **Fit with current Moshimoshi stack**: Excellent. The deterministic pipeline already merges segments (`mergeSegments.ts`) and chunks them (`chunkSegments.ts`). Improving the merge logic to use punctuation/clause-based rules (from Report 01 findings) directly improves re-segmentation quality. The inline boundary editor is a UI addition to the existing player page (`youtube-shadowing/page.tsx`). No new backend infrastructure required.
- **Runtime / latency**: NLP re-segmentation: <100ms (deterministic rules on already-fetched transcript). Boundary editing: client-side only, instant.
- **Infra cost**: Zero for the NLP path (deterministic rules). Zero for boundary editing (client-side).
- **Licensing**: N/A -- this is application logic, not a third-party dependency.
- **Risks**: (1) Inline boundary editing adds UI complexity to the player -- must be non-intrusive for users who don't need it. (2) User edits need to be persisted (per-video overrides in Firestore or local storage). (3) "Snap to cue boundary" may not always align with the user's desired split point -- may need free-form timing adjustment as a power feature.
- **Recommendation**: `pursue`

### Option 3

- **Name**: Display mode switching for multi-purpose practice (Migaku pattern)
- **Type**: `product pattern`
- **What it does**: Transform what a segment means for practice by offering multiple display/interaction modes on the same underlying segments: (1) **Normal mode**: subtitles visible, audio plays, user shadows along. (2) **Reading mode**: video pauses at the start of each segment, user reads the text first, then presses play to hear it. (3) **Recall mode**: subtitle text is hidden until segment audio finishes playing, testing listening comprehension. (4) **Hidden mode**: subtitles only appear when video is manually paused. These modes change the practice experience without changing segment boundaries.
- **Why it helps segmentation quality**: It doesn't directly improve segmentation -- but it compensates for imperfect segmentation by giving users different ways to engage with segments. A segment that is too long for shadowing might be perfect for reading comprehension. A segment that is too short for meaningful shadowing might work well for recall testing. By offering modes, imperfect segments become useful for at least one practice type. This buys time while the automatic segmentation improves.
- **Timing preservation or re-alignment story**: No timing changes -- same segments, different interaction patterns.
- **Fit with current Moshimoshi stack**: Excellent. The repeat state machine in `repeat.ts` already manages segment progression with clean separation of concerns. Adding modes requires: (1) a mode selector UI control, (2) conditional visibility/pause logic in the player page, (3) mode state in the player context. The underlying segment data and timing are unchanged.
- **Runtime / latency**: Zero -- purely client-side state changes.
- **Infra cost**: Zero.
- **Licensing**: N/A.
- **Risks**: (1) Feature bloat risk -- four modes may confuse new users. Mitigated by defaulting to Normal and tucking other modes behind a "Study Modes" toggle. (2) Recall mode requires precise timing to know when segment audio ends -- the existing buffer calculation system supports this. (3) Reading mode requires reliable segment text display before audio -- the existing auto-pause-like behavior could be adapted.
- **Recommendation**: `pursue`

## 3. Findings In Detail

### Product-by-product analysis

#### Miraa (miraa.app)

**Confirmed behaviors:**
- Transcribes its own audio rather than consuming YouTube/Netflix subtitles. Uses a proprietary AI engine.
- Practice unit = one transcribed sentence. Users repeat one sentence endlessly via the "Echo Method" (Listen → Understand → Imitate → Compare).
- Exposes subtitle editing for user correction. App Store reviews confirm: "Sometimes AI use wrong characters. But I can edit them easily."
- Japanese-specific parsing engine called "Gaya" (upgraded in v1.12.0). Technical details not publicly documented.
- Bilingual subtitles with furigana/romaji layers.
- SRT export capability.

**Inferences:**
- Gaya likely handles Japanese sentence boundary detection and furigana generation. The dedicated naming suggests significant Japanese-specific NLP investment.
- The Echo Method's four-step structure enforces a complete practice cycle per segment, which may mask individual segment quality issues by keeping users focused on the process rather than the content boundaries.

**Confidence level:** Medium. Many specifics from marketing copy and App Store reviews. No in-depth technical analysis available.

#### Language Reactor (languagereactor.com)

**Confirmed behaviors:**
- Raw subtitle cue passthrough. One subtitle cue = one navigable unit. No re-segmentation.
- Keyboard shortcuts (S/A/D/Q) for rapid navigation between cues.
- Auto-pause after each subtitle line (toggleable with Q).
- Dual subtitle display (target + native language). Hover-to-translate word popup.
- No A-B loop feature. Only full-subtitle-cue replay (S key).
- No segment boundary editing or correction.
- No Japanese-specific handling -- entirely language-agnostic in segmentation.

**Confirmed problems:**
- On YouTube with auto-generated captions, users get fragmented, unpunctuated cues with no workaround.
- Subtitles can be out of sync or ahead of audio (reported in forums), with no user-facing fix.
- Product appears stagnant as of 2025-2026. Developer communication is minimal. "Hardly any replies from developers" on forum bug reports.

**Confidence level:** High. Well-documented across reviews, JALT academic publication, and user forum reports.

#### Migaku (migaku.com)

**Confirmed behaviors:**
- Raw subtitle cue passthrough from Netflix/YouTube/Disney+.
- No re-segmentation. Subtitle Browser sidebar shows one cue per line.
- Users can select multiple adjacent subtitle lines and export as one Anki flashcard (manual merge at export level, not playback level).
- Four display modes: Default, Reading, Recall, Hidden. These transform the practice experience without changing segments.
- Japanese-specific features are best-in-class: furigana (4 modes), pitch accent coloring, word frequency ratings (0-5 stars), word status tracking with color coding.
- Popup dictionary on Shift+hover.
- Subtitle retiming: global millisecond offset (shift all subtitles forward/backward).
- No per-segment boundary editing.

**Inferences:**
- Migaku's strategy is to make raw subtitle cues maximally useful rather than trying to fix them. Display modes, word annotations, and card export flexibility compensate for imperfect segmentation.
- The multi-line selection for Anki export is the closest any product comes to user-controlled segment merging, but it only affects cards, not playback.

**Confidence level:** High. Legacy Migaku manual documents features explicitly. Multiple independent guides confirm behavior.

#### LingQ

**Confirmed behaviors:**
- Subtitle cue passthrough for YouTube imports. Sentence Mode shows "only the part of the subtitles that are shown in the video at that particular second."
- AI "Re-split text" feature exists. Attempts to re-segment imported text into proper sentences. Mixed results reported.
- Manual sentence editing: users can click individual sentences and edit text, translations, notes, and timestamps.
- Known Japanese-specific bugs: re-splitting corrupts Japanese quote marks (converts 「」 to western quotes). Kanji names incorrectly split into individual characters.

**Confirmed problems:**
- Forum thread titled "Imported Videos from YouTube In Sentence Mode -- Wrong Sentences -- Is There A Fix?" documents the core problem extensively, with staff responses acknowledging the limitation.
- Power users resort to regex workarounds in Notepad++ to rejoin split subtitle lines.
- Sentence looping is NOT native -- requires a community-developed browser extension.

**Confidence level:** High. Forum discussions with staff responses document issues extensively.

#### Trancy (trancy.org)

**Confirmed behaviors:**
- Claims "Intelligent Sentence Segmentation" using NLP to reorganize subtitles into coherent sentences.
- Auto-generates five exercise types from each segment: Speaking, Listening, Selection, Filling, Dictation.
- Theater Mode vs. Reading Mode display options.

**Confirmed problems:**
- Independent reviewer (multilingualmastery.com): "that sentence isn't a sentence. It's 2 and a half sentences" and users need to "deal with funky practice, or you go in and manually shift your sentences around."
- Saved words use "robot voice" rather than original audio.
- Exercise features "aren't amazing yet."

**Confidence level:** Mixed. Marketing claim of intelligent segmentation confirmed. Independent review confirms it still fails.

#### Japanese-first shadowing products

**Ganbatte Shadowing** (International University of Japan): User-selectable segmentation mode -- "segmented by punctuation or as a natural flow as spoken." Pre-authored content with waveform comparison for pronunciation feedback. Does not handle user-supplied video.

**FluentU, Lingopie**: Curate content with professionally-authored subtitles. Avoid the segmentation problem entirely by controlling input quality. FluentU offers three toggleable Japanese subtitle layers (kanji/furigana/English).

**asbplayer** (open-source): Notable for its audio clip boundary slider -- users can widen/narrow the audio capture around a subtitle cue during card export. This is a lightweight boundary adjustment tool at the export level.

### What seems production-credible vs academic-only

**Production-credible patterns:**
- Transcribe-first (Miraa) -- proven at scale
- NLP re-segmentation (Trancy) -- commercially viable but imperfect
- Display mode switching (Migaku) -- minimal implementation cost, high practice value
- Keyboard-first navigation (Language Reactor) -- proven UX pattern for power users
- Editable segments (Miraa, LingQ) -- users expect and need this
- Multi-line selection for export (Migaku) -- pragmatic workaround

**Not production-credible for Moshimoshi:**
- Curated-content-only approach (FluentU, Lingopie) -- does not scale to user-supplied YouTube videos
- Community-developed browser extensions as workarounds (LingQ sentence loop) -- fragile, poor UX
- Regex workarounds for segmentation (LingQ community) -- not user-facing

### What looks overkill for current needs

- Waveform comparison for pronunciation (Ganbatte, JapanesePod101) -- valuable feature but orthogonal to the segmentation quality problem
- Five auto-generated exercise types per segment (Trancy) -- interesting but increases scope significantly
- Pitch accent coloring (Migaku) -- desirable long-term but not related to segmentation quality

## 4. Relevance To Current Architecture

### Where product patterns plug in

#### Pattern: NLP re-segmentation (Option 2)
**Plugs into**: `src/lib/transcript/mergeSegments.ts` and `src/lib/transcript/chunkSegments.ts`

The current merge logic uses hardcoded thresholds (character count <4, duration <0.6s, gap <0.9s) and a particle regex. Trancy's approach and Report 01 findings suggest replacing these with punctuation-aware and clause-aware merge/split rules. Specifically:
- Merge adjacent cues when the first cue does not end with sentence-ending punctuation (after punctuation restoration from Report 01)
- Split merged results at clause boundaries detected by morphological analysis
- This replaces the current character-count-driven chunking with linguistically-informed chunking

#### Pattern: Inline boundary editing (Option 2)
**Plugs into**: `src/app/[locale]/youtube-shadowing/page.tsx` (UI) and a new persistence layer

The player page currently displays segments as fixed units. Adding boundary adjustment requires:
- A toggle to enter "edit boundaries" mode (non-intrusive by default)
- Visual boundary markers between segments (thin lines or handles)
- Tap/drag to merge adjacent segments or split within a segment
- Persist overrides: `{ videoId, segmentOverrides: [{ originalIndices: [3,4], mergedText, startTime, endTime }] }`
- Storage: Firestore per-user per-video, or IndexedDB for offline-first

#### Pattern: Display mode switching (Option 3)
**Plugs into**: `src/app/[locale]/youtube-shadowing/page.tsx` (UI) and `src/lib/shadowing/repeat.ts` (logic)

The repeat state machine's `nextOnSegmentEnd` and `onRepeatCountChange` functions are pure and mode-agnostic. Adding modes requires:
- A mode state variable: `'normal' | 'reading' | 'recall' | 'hidden'`
- Conditional rendering in the player UI:
  - Reading: pause at segment start, show text, wait for user action to play audio
  - Recall: hide text, play audio, reveal text on completion
  - Hidden: hide text unless manually paused
- Buffer calculation in `src/utils/youtubePlayerUtils.ts` remains unchanged for all modes

### Whether these replace deterministic logic, AI logic, or both

- **Option 2 (NLP re-segmentation)**: Improves deterministic logic. The merge/chunk rules become smarter. AI path (resegment/route.ts) continues to provide an additional quality layer.
- **Option 2 (boundary editing)**: Adds a user correction layer that operates AFTER both deterministic and AI processing. Does not replace either.
- **Option 3 (display modes)**: Does not touch segmentation logic at all. Purely a presentation layer change.

### Whether this requires a new `PracticeSegment` model

**Yes, for Option 2's boundary editing feature.** If users can override segment boundaries, the system needs to distinguish between:
- **Source segments**: Raw caption cues with original timing (immutable)
- **Computed segments**: Result of the merge/chunk/AI pipeline (deterministic, regeneratable)
- **Practice segments**: Final segments presented to the user, potentially with user overrides (mutable)

This naturally leads to the `PracticeSegment` architecture described in SESSION_CONTEXT.md:

```typescript
interface PracticeSegment {
  id: string;
  videoId: string;
  text: string;           // Possibly punctuation-restored
  startTime: number;
  endTime: number;
  sourceSegmentIds: string[];  // Which raw caption cues this came from
  boundaryConfidence: number;  // How confident the pipeline is in this boundary
  isUserEdited: boolean;       // Whether the user manually adjusted this
  originalText?: string;       // Pre-restoration text for alignment verification
}
```

For Options 2 (NLP re-segmentation without editing) and Option 3 (display modes), the existing `TranscriptSegment` type is sufficient.

## 5. Recommendation

**Pursue now**

Why:

The competitive landscape reveals a clear product gap: no tool combines automatic re-segmentation with inline boundary correction. The market is split between products that accept bad segmentation silently (Language Reactor, Migaku) and products that expose correction in clunky separate editors (LingQ). Moshimoshi is already architecturally positioned to close this gap because the existing pipeline has merge/chunk/quality-score layers that can be improved incrementally.

**Recommended implementation priority:**

1. **NLP re-segmentation** (Option 2, segmentation part): Implement improved merge/chunk rules using findings from Report 01 (punctuation restoration + morphological analysis). This is the highest-impact, lowest-cost improvement. No competitor does this well for Japanese YouTube content.

2. **Display mode switching** (Option 3): Add Reading and Recall modes to the existing player. Minimal implementation cost. Compensates for remaining segmentation imperfections by making segments useful for multiple practice types. Migaku validates this pattern.

3. **Inline boundary editing** (Option 2, editing part): Add a lightweight boundary adjustment UI to the player. This is the key differentiator -- no competitor offers this in the practice view. Implement after re-segmentation quality is measured, so the editing handles the remaining ~10-20% of imperfect boundaries rather than being the primary correction mechanism.

4. **Transcribe-first** (Option 1): Prototype with Kotoba-Whisper or Whisper large-v3 on a subset of videos. If the quality uplift justifies the infrastructure cost, consider as a premium/optional path. This is a longer-term architectural investment.

## 6. Sources

- [Miraa - App Store listing](https://apps.apple.com/us/app/miraa-ai-transcribe-shadow/id6462883096)
- [Miraa - Official site](https://miraa.app/)
- [Miraa review - Skywork AI](https://skywork.ai/skypage/en/Miraa-AI-An-In-Depth-Review-of-Your-AI-Language-Companion/1976538891109986304)
- [Miraa - WaniKani Community discussion](https://community.wanikani.com/t/miraa-ai-app/67665)
- [Language Reactor - Help documentation](https://www.languagereactor.com/help/basic)
- [Language Reactor review - LTL School](https://ltl-school.com/language-reactor/)
- [Language Reactor review - Skywork](https://skywork.ai/blog/ai-agent/language-reactor-review/)
- [Language Reactor - JALT academic publication](https://jalt-publications.org/articles/28605-enhancing-functionality-youtube-and-netflix-language-reactor)
- [Language Reactor forum - machine translation issues](https://forum.languagelearningwithnetflix.com/t/machine-translation-is-incorrect/21342)
- [Migaku - Legacy browser extension manual](https://legacy.migaku.io/tools-guides/migaku-browser-extension/manual/)
- [Migaku - Japanese-specific features](https://migaku.com/blog/youtube/japanese-specific-features-migaku-browser-extension)
- [Migaku - Card creation from video](https://migaku.com/blog/youtube/card-creation-from-video-content-migaku-browser-extension)
- [Migaku sentence mining guide - BritVSJapan](https://www.britvsjapan.com/sentence-mining-languages-with-migaku-and-anki-full-guide-to-migaku/)
- [Migaku sentence mining guide - antoine.fi](https://antoine.fi/sentence-mining-with-migaku)
- [LingQ forum - Wrong sentences in Sentence Mode](https://forum.lingq.com/t/imported-videos-from-youtube-in-sentence-mode-wrong-sentences-is-there-a-fix/287016)
- [LingQ forum - Timestamp editing](https://forum.lingq.com/t/is-there-a-way-to-edit-timestamps/2578716)
- [LingQ forum - Re-split with AI](https://forum.lingq.com/t/options-for-regenerate-lesson-re-split-with-ai-translations-how-are-they-connected-to-each-other/516537)
- [LingQ forum - Japanese re-split bug](https://forum.lingq.com/t/bug-japanese-re-split-modifies-sentence-quotes/412810)
- [LingQ forum - Migaku/Language Reactor features request](https://forum.lingq.com/t/bringing-migakulanguagereactor-style-features-to-lingq/2036672)
- [LingQ forum - Sentence loop extension](https://forum.lingq.com/t/simple-sentence-loop-on-lingq-with-one-button/2577054)
- [Trancy - Official site](https://www.trancy.org/)
- [Trancy review - Multilingual Mastery](https://multilingualmastery.com/trancy-review/)
- [Trancy vs Language Reactor comparison](https://creati.ai/ai-tools/trancy/alternatives/trancy-vs-language-reactor-language-learning-platform-comparison/)
- [Ganbatte Shadowing - Google Play](https://play.google.com/store/apps/details?id=jp.ac.iuj.shadowingapp&hl=en)
- [asbplayer - GitHub](https://github.com/killergerbah/asbplayer)
- [asbplayer documentation](https://docs.asbplayer.dev/docs/intro/)
- [FluentU Japanese review - NihongoShark](https://www.nihongoshark.com/post/fluentu-japanese-review-free-access-codes)
- [Lingopie - Deep dive to tools](https://lingopie.com/blog/a-deep-dive-to-lingopie-tools/)
- [Lingopie - Sentence Wizard launch](https://lingopie.com/blog/lingopie-launches-sentence-wizard/)
- [Japanese shadowing apps overview - Yui's Japan Lab](https://yuisjapanlab.com/japanese-shadowing-apps/)
- [Whisper sentence segmentation discussion](https://github.com/openai/whisper/discussions/1243)
- [Japanese sentence mining options - Art by Lucas](https://lucas.art/blog/japanese-immersion-options-for-entence-mining/)
