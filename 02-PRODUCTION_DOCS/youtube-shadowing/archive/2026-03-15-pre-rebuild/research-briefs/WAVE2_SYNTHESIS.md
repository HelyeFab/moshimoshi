# Wave 2 Synthesis

Last updated: 2026-03-13
Scope: synthesis of completed Wave 2 research

Reviewed outputs:
- `outputs/04-subtitle-utterance-REPORT.md`
- `outputs/05-prosody-pause-REPORT.md`
- `outputs/06-editable-fallback-ux-REPORT.md`

## 1. Bottom Line

Wave 2 sharpens the Wave 1 conclusion instead of overturning it.

The feature should move toward:
- better text-first segmentation
- better timing recovery
- lightweight in-player correction

Wave 2 adds three important clarifications:

1. subtitle-to-utterance segmentation is now a concrete implementation path, not just a vague idea
2. prosody and pause signals are useful mainly as validation and refinement, not the primary segmentation driver
3. inline correction UX is not optional polish; it is part of the strongest product differentiation path

## 2. Strongest Findings

### 2.1 Word-level timing is a major leverage point

Report 04 introduces the most important new infrastructure insight:

- YouTube JSON3 word-level timing may let the app escape the current proportional character-to-time fallback

If word-level caption timing is available reliably enough, then:
- re-segmentation becomes much safer
- timing assignment becomes simpler
- the need for heavier forced alignment decreases on easy and medium videos

This is a major architectural opportunity.

### 2.2 wtpsplit is a strong candidate for text-first re-segmentation

Report 04 makes the text-first path more concrete:
- wtpsplit is production-credible
- it is designed for messy, punctuation-poor text
- it can operate as a dedicated segmentation layer before downstream timing and validation

This aligns well with the current diagnosis that segmentation quality is still the weakest spot.

### 2.3 Pause detection is useful, but only as a secondary signal

Report 05 is useful mainly because it narrows the scope:
- pause-only segmentation is too noisy
- full prosodic analysis is not worth the complexity right now
- VAD-style pause detection should be treated as a confidence/refinement layer

That is a strong de-risking result.

It means the team should not prematurely pivot to an audio-first architecture.

### 2.4 Correction UX is a core product layer, not an edge-case tool

Report 06 reinforces the product opportunity found in Wave 1:
- minimal split/merge editing in the practice view is enough for an MVP
- this is where the product can differentiate
- a lightweight override layer makes the system more trustworthy even before segmentation reaches near-perfect quality

This is highly actionable.

## 3. What Changes From Wave 1

Wave 1 told us:
- use a hybrid system
- separate practice units from transcript units
- pursue better segmentation, timing refinement, and correction UX

Wave 2 adds:

1. A clearer sequencing of technical investment
- first: word-level timing and text-first segmentation
- second: selective timing refinement
- third: inline correction UX

2. A narrower role for audio analysis
- use VAD/pause data for boundary confirmation and timing cleanup
- do not treat it as the primary segmentation engine yet

3. A stronger architectural basis for `PracticeSegment`
- word-level timing
- boundary confidence
- user override state
- boundary method metadata

## 4. Recommended Updated Strategy

### 4.1 Pursue now

Highest-value next moves:

1. Investigate and validate JSON3 word-level caption timing extraction on real Japanese YouTube videos.
2. Design the `PracticeSegment` model around:
   - source words or source transcript anchors
   - computed boundary method
   - boundary confidence
   - user override state
3. Plan a text-first segmentation pipeline using:
   - punctuation restoration
   - Sudachi or equivalent morphological awareness
   - wtpsplit or equivalent utterance segmentation
4. Design the minimal inline split/merge correction UX and override persistence layer.

### 4.2 Prototype next

1. stable-ts or comparable acoustic alignment on harder videos
2. Silero VAD as timing/boundary validation
3. boundary confidence instrumentation and QA reporting

### 4.3 Defer

1. full prosodic boundary detection
2. full ASR-first architecture as the default path
3. heavyweight timeline editors or waveform-first UX

## 5. Revised Architectural Direction

The likely future architecture now looks like this:

1. Retrieve transcript at the richest timing granularity available
   - ideally word-level timing

2. Build `SourceTranscriptWord` or equivalent low-level units

3. Generate `ComputedPracticeSegment` using:
   - Japanese-aware text segmentation
   - punctuation restoration
   - utterance boundary detection

4. Refine timing using:
   - word-level caption timings when available
   - acoustic alignment or VAD only when needed

5. Present `FinalPracticeSegment` in the player
   - with optional user overrides

6. Persist override operations separately from generated segments

This is much cleaner than continuing to overload a single transcript segment abstraction.

## 6. Main Risks To Watch

### 6.1 JSON3 availability risk

Wave 2 strongly depends on the promise of richer caption timing.
If JSON3 is unavailable or inconsistent on too many target videos, the architecture must lean more heavily on alignment fallback.

### 6.2 Integration complexity risk

If the pipeline adds too many models at once, it becomes hard to debug.

That is why the order matters:
- start with the best text-first signals
- add timing refinement selectively
- keep each layer measurable

### 6.3 UX overreach risk

Correction UX should remain lightweight.

The MVP is:
- edit mode
- merge
- split
- reset
- override persistence

Anything beyond that should prove its value first.

## 7. Final Conclusion

Wave 2 does not weaken the existing direction.
It makes it more precise.

The strongest combined path is now:

1. richer timing input
2. better text-first segmentation
3. selective acoustic refinement
4. inline correction UX

That combination is the best current path toward a shadowing player that actually fulfills its reason for existing:

`turn a video into meaningful, repeat-worthy, timing-safe spoken practice units`

