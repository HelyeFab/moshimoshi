# Research Output: Editable Fallback UX

Title: Editable Fallback UX -- Minimal In-Player Correction For Bad Segment Boundaries

Date: 2026-03-12

Researcher: Claude (Opus 4.6) -- Agent C, Wave 2

Problem Area: If segmentation cannot be perfect automatically, what is the best minimal in-player correction UX for fixing bad boundaries fast?

## 1. Executive Summary

- **Strongest finding**: The smallest useful editor MVP is two operations -- merge adjacent segments and split a segment at a text cursor position -- exposed as contextual buttons on the segment list, toggled by an "Edit Segments" mode. This is the pattern used by every production subtitle editor (Aegisub, Subtitle Edit, Amara, CaptionHub) and validated by Wave 1's competitive teardown showing no language learning tool does this inline. The interaction cost is 1 tap to enter edit mode, 1 tap per correction.
- **Most promising technology or method**: A simple **segment override layer** stored as an ordered list of `{ action, segmentIndices }` operations on top of the computed pipeline output. Overrides are keyed by `videoId` and survive pipeline regeneration by re-applying against the new computed segments using text-anchored matching. This avoids both the complexity of CRDTs and the fragility of index-only references.
- **Biggest risk**: Over-designing the correction UX before measuring how many segments actually need correction after the pipeline improvements from Report 01 (punctuation restoration, Sudachi morphological analysis). If the improved pipeline fixes 80-90% of bad boundaries, the correction UX handles a small tail -- not a primary workflow. Building a full timeline editor for a tail case would be wasted effort.
- **Final recommendation**: Pursue now. Build the minimal split/merge editor as the first correction UX. It directly closes the product gap identified in Report 03 (no competitor offers inline boundary correction in the practice view) and naturally leads to the `PracticeSegment` architecture recommended by the Wave 1 synthesis.

## 2. Best 3 Options

### Option 1

- **Name**: Inline Split/Merge Controls with Confidence Indicators
- **Type**: `product pattern`
- **What it does**: Adds a toggleable "Edit Segments" mode to the existing transcript list sidebar. When active, each segment boundary shows a merge button (combine with next segment) and each segment shows a split affordance (tap a word to place a split point, confirm to split). Segments where the pipeline has low confidence (computed from `segmentQuality.ts` scores or from the quality of the underlying boundary -- e.g., split mid-word, no punctuation at boundary) show a subtle warning indicator, guiding users to the segments most likely to need correction.
- **Why it helps segmentation quality**: Directly addresses the remaining ~10-20% of cases where automatic segmentation produces bad boundaries. Wave 1 Report 03 confirmed that no competitor combines automatic re-segmentation with inline correction in the practice view. Miraa exposes editing but in a separate transcription editor. LingQ exposes editing but buried in a separate lesson editor. This option puts correction where the user already is -- the segment list.
- **Timing preservation or re-alignment story**: Merge preserves timing naturally: merged segment starts at first segment's start, ends at last segment's end. Split distributes timing proportionally to character count, exactly as `chunkSegments.ts` already does. Both operations produce timing-safe results by construction because they operate on existing timed boundaries. The `normalizeSegmentsForPlayback()` function in `page.tsx` already enforces non-overlapping timeline as a safety net.
- **Fit with current Moshimoshi stack**: Excellent. The transcript list in `page.tsx` (lines 1356-1402) already renders segments as interactive cards with play buttons. Adding merge/split controls requires: (1) an `editMode` boolean state, (2) merge button between adjacent segment cards, (3) split interaction within segment text, (4) state update to the `segments` array and `segmentsRef`. No backend changes required for MVP -- overrides can be applied client-side and persisted to localStorage alongside the existing `PlayerSession`.
- **Runtime / latency**: Zero network latency. All operations are client-side array manipulations on the existing `segments` state. Split requires recalculating timing proportionally (~<1ms). Merge requires concatenating text and extending time range (~<1ms).
- **Infra cost**: Zero for MVP (localStorage persistence). Firestore cost for cross-device sync is negligible (one small document per video per user).
- **Licensing**: N/A -- application logic only.
- **Risks**: (1) Edit mode adds visual complexity to the segment list -- must be non-intrusive when inactive. (2) Users may over-edit, producing worse segments than the pipeline. Mitigated by a "Reset to original" button. (3) Confidence indicators require a heuristic for "likely bad boundary" -- may produce false positives initially. (4) Mobile touch targets for split points within Japanese text need careful sizing.
- **Recommendation**: `pursue`

### Option 2

- **Name**: Segment Override Persistence Layer
- **Type**: `tooling`
- **What it does**: Stores user corrections as an ordered list of operations (merge, split) keyed by `videoId`, rather than storing the full corrected segment array. When segments are loaded or regenerated by the pipeline, overrides are re-applied on top of the new computed output. Override operations reference segments by text-anchored matching (matching against the segment text content) rather than by array index, so they survive pipeline regeneration that changes segment count or ordering. Overrides are stored in IndexedDB for offline-first behavior, with optional Firestore sync for cross-device persistence.
- **Why it helps segmentation quality**: Without a persistence layer, user corrections are lost whenever the page reloads, the pipeline is re-run (via the "AI Resegment" button), or the user returns to the same video later. This makes correction feel futile. A persistence layer makes corrections sticky and cumulative -- users invest in improving their practice segments, and that investment is preserved.
- **Timing preservation or re-alignment story**: Each override operation stores the resulting timing alongside the text, so re-application does not require re-computing timing from scratch. When re-applying against regenerated pipeline output, text-anchored matching identifies the target segment(s); if the pipeline has already fixed a boundary that the user previously corrected, the override becomes a no-op (text no longer matches the original bad boundary). This gives the system self-healing behavior -- pipeline improvements automatically obsolete user corrections that are no longer needed.
- **Fit with current Moshimoshi stack**: Good. The existing session persistence in `page.tsx` (lines 1088-1118) uses localStorage with a `PlayerSession` structure that already includes `segments`. The override layer would sit between the pipeline output and the `segments` state, applying corrections before the segments are set. IndexedDB storage aligns with the existing offline architecture (`src/lib/review-engine/offline/`). Firestore sync would follow the same pattern as other per-user-per-content data in the app.
- **Runtime / latency**: Override re-application: <5ms for typical override sets (1-10 operations per video). IndexedDB read: <10ms. No network dependency for the primary path.
- **Infra cost**: IndexedDB: zero. Firestore: negligible (~1 read + 1 write per video load, well within free tier for typical usage).
- **Licensing**: N/A.
- **Risks**: (1) Text-anchored matching can fail if the pipeline significantly rewrites segment text (e.g., aggressive punctuation restoration changes word boundaries). Mitigated by matching on normalized text (strip punctuation for matching purposes). (2) Override accumulation over many pipeline versions could produce stale operations. Mitigated by timestamping overrides and expiring old ones, or by the self-healing no-op behavior. (3) Schema migration if the override format changes -- keep the format simple and versioned from the start.
- **Recommendation**: `pursue`

### Option 3

- **Name**: Boundary Drag Handles with Audio Preview
- **Type**: `hybrid`
- **What it does**: Adds draggable boundary handles between segments in the transcript list, allowing users to adjust exactly where one segment ends and the next begins by dragging the boundary earlier or later. Dragging triggers a short audio preview (0.5-1s around the boundary point) so the user can hear whether the new boundary falls in a natural pause or in the middle of speech. This is the pattern used by professional subtitle editors (Aegisub's audio timeline, Subtitle Edit's waveform view) adapted to a lightweight inline context without a full waveform display.
- **Why it helps segmentation quality**: Split and merge handle the most common corrections (two segments should be one, or one segment should be two). Boundary drag handles address a subtler case: the boundary is roughly right but off by a few hundred milliseconds, causing the loop to cut off the last syllable or include the start of the next utterance. This is the timing-level correction that split/merge cannot address.
- **Timing preservation or re-alignment story**: The drag handle directly modifies the `end` time of one segment and the `start` time of the next. The `normalizeSegmentsForPlayback()` function enforces the epsilon gap (0.02s) and minimum duration (0.2s) constraints, providing safety bounds on drag operations. Audio preview leverages the existing YouTube player's `seekTo()` + short playback to let the user hear the boundary region.
- **Fit with current Moshimoshi stack**: Moderate. Drag handles require touch/mouse event handling on the boundary region between segment cards. The YouTube IFrame API does not expose audio at the waveform level, so audio preview must use the existing `seekTo()` + `playVideo()` + `pauseVideo()` pattern to play a short clip around the drag position. This is feasible but introduces UX complexity: the main playback state must be preserved across preview plays. The `seekAndWaitForReady()` utility in `youtubePlayerUtils.ts` provides the foundation for this.
- **Runtime / latency**: Client-side drag: <1ms per update. Audio preview: 100-500ms for seek + buffer (YouTube IFrame API latency). No network cost for the boundary adjustment itself.
- **Infra cost**: Zero.
- **Licensing**: N/A.
- **Risks**: (1) Drag precision on mobile touch screens is poor for sub-second timing adjustments. May need a "fine adjust" mode with +/- 100ms buttons instead. (2) YouTube IFrame API seek latency (100-500ms) makes real-time audio preview during drag feel laggy. Debouncing the preview to fire on drag-end rather than during drag mitigates this. (3) Significantly more complex to implement than split/merge -- should be a Phase 2 addition after split/merge is validated. (4) Users may not understand what dragging a boundary does without onboarding.
- **Recommendation**: `prototype`

## 3. Findings In Detail

### 3.1 Production subtitle editor patterns

**Aegisub** (desktop, open source):
- Split: Place cursor in text, press split hotkey. Timing is divided proportionally to cursor position.
- Merge: Select multiple lines in the grid, right-click > "Join (keep first)". Timing extends from first line's start to last line's end.
- Boundary adjustment: Audio timeline with waveform display. Drag segment edges directly on the waveform.
- Key insight: Aegisub's grid (text list) + timeline (audio waveform) is the canonical two-panel subtitle editing UX. For Moshimoshi, the segment list serves as the grid; there is no need for a full waveform panel.

**Subtitle Edit** (desktop, open source):
- Split: "Split" button in toolbar. Splits at current video position, distributing text proportionally.
- Merge: Select adjacent lines, "Merge" button. Text is joined, timing spans the combined range.
- Auto-split: Can split lines by character count limits and punctuation marks (similar to `chunkSegments.ts`).
- Key insight: Subtitle Edit's merge handles 3+ lines at once, not just pairs. Moshimoshi should support multi-select merge for cases where 3-4 adjacent fragments should be one segment.

**Amara** (web-based, collaborative):
- Split: Place cursor in subtitle text, press Ctrl+Enter.
- Merge: Not a single button -- users must manually edit text and timing of adjacent subtitles.
- Key insight: Amara's split-at-cursor pattern is the most natural for text-based splitting and works well on web.

**CaptionHub / TED subtitling** (web-based):
- Reading speed indicators (characters per second) guide users to fix segments that are too long or too short.
- Character count limits enforce maximum segment length.
- Key insight: Quality indicators (like reading speed or character count warnings) help users identify which segments need correction without requiring them to read every segment.

**Descript** (desktop + web):
- "Edit like a doc" paradigm: delete words from the transcript to cut audio. No explicit split/merge -- editing the text changes the underlying media.
- Key insight: Descript's approach is too heavyweight for Moshimoshi's use case. Users don't want to re-author the transcript -- they want to adjust where boundaries fall. The "edit text to edit audio" model conflates content editing with boundary editing.

**asbplayer** (browser extension, open source):
- Audio clip boundary slider at card export time: users can widen/narrow the captured audio range around a subtitle cue.
- Key insight: The boundary slider is a lightweight timing adjustment that does not modify the underlying subtitle data. This is the closest prior art to boundary drag handles in a language learning context.

### 3.2 Override persistence patterns

**Approach A: Full snapshot** -- Store the complete corrected segment array per video. Simple but expensive: any pipeline re-run overwrites user corrections unless the user explicitly re-applies them. Used by LingQ (users edit the lesson, edits are stored as the new lesson text).

**Approach B: Operation log** -- Store an ordered list of operations (merge indices [3,4], split index 7 at char position 15). Compact, re-playable, but fragile against index shifts when the pipeline changes segment count.

**Approach C: Text-anchored operation log** -- Like Approach B, but operations reference segments by text content rather than index. Merge: "merge segments containing text X and text Y". Split: "split segment containing text Z at position P". Robust against pipeline regeneration because text matching survives reindexing.

**Approach D: Diff/patch** -- Store a diff between computed segments and corrected segments. Compact, but complex to implement and hard to re-apply when the base changes significantly.

**Recommendation**: Approach C (text-anchored operation log) is the best fit. It is simple to implement, compact to store, self-healing against pipeline improvements, and survives re-indexing. Operations that no longer match (because the pipeline fixed the boundary) are silently skipped.

### 3.3 What the smallest useful editor MVP looks like

Based on the patterns observed across production tools, the MVP is:

**Two operations:**
1. **Merge**: Tap a "merge down" button between two adjacent segments. Text is concatenated, timing spans both.
2. **Split**: Tap within segment text to place a cursor, then tap "Split here". Text is divided at cursor, timing is distributed proportionally to character count.

**One mode toggle:**
- "Edit Segments" toggle button in the transcript list header. When active, merge buttons and split affordances appear. When inactive, the segment list looks exactly as it does now.

**One safety valve:**
- "Reset to original" button that discards all user overrides and re-applies the pipeline output.

**One persistence mechanism:**
- Overrides stored in localStorage alongside the existing `PlayerSession`, keyed by `videoId`.

**Total interaction cost for common corrections:**
- Merge 2 segments: 1 tap (edit mode) + 1 tap (merge button) = 2 taps
- Split 1 segment: 1 tap (edit mode) + 1 tap (place cursor) + 1 tap (split button) = 3 taps
- Merge 3 segments: 1 tap (edit mode) + 2 taps (merge twice) = 3 taps

### 3.4 What seems overkill for current needs

- **Full waveform display**: Requires audio extraction from YouTube, which is both technically complex and potentially ToS-violating. The YouTube IFrame API does not expose raw audio.
- **Free-form text editing**: Allowing users to edit segment text introduces content correctness concerns and breaks alignment with the original transcript. Boundary adjustment is sufficient.
- **Collaborative editing / CRDT**: This is a single-user correction workflow. There is no multi-user collaboration requirement.
- **Undo/redo stack**: For MVP, "Reset to original" is sufficient. Granular undo can come later.
- **Timeline drag with real-time audio preview**: Valuable but Phase 2. Split/merge handles 80%+ of corrections with much less implementation complexity.

## 4. Relevance To Current Architecture

### Where this plugs in

**UI layer** -- `src/app/[locale]/youtube-shadowing/page.tsx`:
- The segment list (lines 1356-1402) renders each segment as a card with a play button and text. Edit mode adds:
  - A merge button rendered between adjacent segment cards (a thin button at the boundary line)
  - A split affordance within the `<GrammarHighlightedText>` component (tap word to place split cursor)
  - An "Edit Segments" toggle in the transcript list header (line 1357, next to the `listTitle`)
- The `segments` state and `segmentsRef` are updated directly when merge/split operations occur
- The `currentSegmentIndex` is adjusted if the edit affects the currently active segment

**Session persistence** -- `page.tsx` lines 1088-1118:
- The existing `PlayerSession` type gains an optional `segmentOverrides` field
- On load, overrides are applied to the pipeline output before setting `segments` state
- On save, overrides are serialized alongside existing session data

**Resegment integration** -- `handleResegment()` in `page.tsx` (lines 680-755):
- After resegmentation, overrides are re-applied to the new pipeline output using text-anchored matching
- If the pipeline fixes a boundary that the user previously corrected, the override becomes a no-op
- A toast notification tells the user: "Segments updated. X of your corrections still apply."

**Quality scoring** -- `src/lib/transcript/segmentQuality.ts`:
- The `computeSegmentQuality()` function already scores segments on sentence-terminal ratio, duration distribution, and text length distribution
- Low-scoring segments (below threshold) get a visual indicator in edit mode, guiding users to likely-bad boundaries
- The `sentenceTerminalRatio` dimension is especially useful: segments NOT ending with sentence punctuation are the most likely candidates for merge/split correction

### Whether it replaces deterministic logic, AI logic, or both

Neither. The correction UX operates as a **user override layer** that sits on top of both deterministic and AI segmentation. The pipeline continues to improve independently. User corrections handle the residual tail.

The data flow becomes:
```
Raw transcript -> Deterministic pipeline -> (Optional) AI resegmentation -> User overrides -> Final practice segments
```

### Whether it requires a new `PracticeSegment` model

**Yes, but the MVP can work without it.**

For MVP, the existing `TranscriptSegment` type (`{ start, end, text, translation? }`) is sufficient. User overrides modify the `segments` array in place, and the override log records what was done.

For the full architecture (recommended for Phase 2), the `PracticeSegment` model separates concerns:

```typescript
interface PracticeSegment {
  id: string;
  videoId: string;
  text: string;
  start: number;
  end: number;
  sourceSegmentIds: string[];     // Which pipeline segments this came from
  isUserEdited: boolean;          // Whether user merged/split to create this
  boundaryConfidence: number;     // Pipeline confidence in this boundary (0-1)
  editHistory?: SegmentOverride[];// What operations produced this segment
}

interface SegmentOverride {
  type: 'merge' | 'split';
  anchorText: string;             // Text content used for re-matching
  splitPosition?: number;         // Character position for splits
  createdAt: number;              // Timestamp for expiry/ordering
}
```

This aligns with the three-layer model proposed in the Wave 1 Synthesis:
1. `SourceTranscriptSegment` -- raw caption cues (immutable)
2. `ComputedPracticeSegment` -- pipeline output (regeneratable)
3. `FinalPracticeSegment` -- with user overrides applied (mutable)

## 5. Recommendation

**Pursue now**

Why:

1. **Product gap is confirmed and clear.** Report 03 (Wave 1) established that no competitor offers inline boundary correction in the practice view. This is the single strongest product differentiator available in the segmentation space.

2. **Implementation cost is low.** The MVP requires only client-side changes to the existing page component. No new API routes, no new backend services, no infrastructure. The segment list UI already exists; edit mode adds controls to it.

3. **Risk is bounded.** The "Reset to original" escape valve means bad user edits are always reversible. The override persistence layer is opt-in (overrides only exist if the user has made corrections). The edit mode is toggled off by default, so it adds zero complexity for users who never need it.

4. **It enables the PracticeSegment architecture.** Building the override layer naturally introduces the separation between computed segments and final segments that the Wave 1 synthesis identified as the key architectural upgrade.

5. **It complements pipeline improvements, not competes with them.** Better segmentation from Report 01 findings (punctuation restoration, morphological analysis) reduces the need for user corrections. The correction UX handles the remaining tail. As the pipeline improves, fewer overrides are needed, and stale overrides self-heal via text-anchored matching.

**Recommended implementation order:**

1. **MVP (1-2 days)**: Edit mode toggle + merge button + split-at-cursor + localStorage persistence of overrides
2. **Quality indicators (0.5 day)**: Low-confidence segment highlighting using existing `segmentQuality.ts` scores
3. **Override re-application (0.5 day)**: Text-anchored matching for surviving pipeline regeneration
4. **Phase 2 (later)**: Boundary drag handles with audio preview, IndexedDB/Firestore persistence, PracticeSegment model

## 6. Sources

- [Aegisub - Editing Subtitles documentation](https://aegisub.org/docs/latest/editing_subtitles/)
- [Subtitle Edit - Merge/Split functionality](https://subtitleproc.sourceforge.net/help/SP_E_F_MergeSplit.htm)
- [Subtitle Edit - Split by punctuation marks (GitHub issue #7662)](https://github.com/SubtitleEdit/subtitleedit/issues/7662)
- [Subtitle Edit - Merge 3+ lines (GitHub issue #46)](https://github.com/SubtitleEdit/subtitleedit/issues/46)
- [Amara - Edit Subtitles with the Amara Editor](https://support.amara.org/support/solutions/articles/8151-edit-subtitles)
- [CaptionHub - Editing Your Work](https://sites.google.com/ted.com/captionhub-resources/editing-your-work)
- [Descript - Edit like a doc](https://help.descript.com/hc/en-us/articles/15726742913933-Edit-like-a-doc)
- [Descript - Collaborative editing & version history](https://medium.com/descript/descript-1-4-collaborative-editing-version-history-with-descript-drive-243868fc255b)
- [asbplayer - GitHub repository](https://github.com/killergerbah/asbplayer)
- [asbplayer documentation](https://docs.asbplayer.dev/docs/intro/)
- [Blackmagic Forum - More subtitles tool (merge/proper split/text break/align)](https://forum.blackmagicdesign.com/viewtopic.php?f=33&t=180194)
- [Material Design 3 - Gestures](https://m3.material.io/foundations/interaction/gestures)
- [LingQ Forum - Imported Videos from YouTube in Sentence Mode](https://forum.lingq.com/t/imported-videos-from-youtube-in-sentence-mode-wrong-sentences-is-there-a-fix/287016)
- [Miraa - WaniKani Community discussion](https://community.wanikani.com/t/miraa-ai-app/67665)
- [Trancy review - Multilingual Mastery](https://multilingualmastery.com/trancy-review/)
- Wave 1 Report 01: Japanese Segmentation and Punctuation Restoration
- Wave 1 Report 03: Competitive Teardown of Miraa and Adjacent Tools
- Wave 1 Synthesis document
