# Wave 1 Synthesis

Last updated: 2026-03-12
Scope: synthesis of completed Wave 1 research

Reviewed outputs:
- `outputs/01-japanese-segmentation-REPORT.md`
- `outputs/02-forced-alignment-REPORT.md`
- `outputs/03-competitive-teardown-REPORT.md`

## 1. Bottom Line

Wave 1 confirms the current diagnosis:

- the main bottleneck is meaningful segmentation
- the best path is a hybrid system, not a single silver-bullet technology
- the current architecture can absorb major improvements without a total rewrite

The strongest near-term direction is:

1. improve Japanese segmentation quality with better punctuation and morphological awareness
2. add a stronger timing-recovery layer when segmentation changes boundaries materially
3. expose lightweight correction UX in the player for the remaining bad cases

## 2. Strongest Findings Across All Three Reports

### 2.1 Text-first segmentation can improve significantly before full audio reprocessing

Report 01 strongly suggests that the current pipeline is underpowered because it lacks real Japanese linguistic analysis.

Most actionable findings:
- punctuation restoration is a high-leverage improvement
- Sudachi WASM is a practical Node-friendly path for morphological awareness
- clause- or bunsetsu-informed segmentation is much closer to a true practice-segment pipeline than the current regex and character-count approach

Interpretation:
- the system likely has substantial upside without immediately abandoning the existing caption-based architecture

### 2.2 Acoustic alignment is the right upgrade path when text boundaries improve

Report 02 confirms that the current proportional timing approach is structurally weak once transcript text is re-shaped.

Most actionable findings:
- stable-ts is the best practical candidate
- Whisper API is a reasonable fallback path
- acoustic alignment should replace or supplement character-proportional re-timing on harder videos

Interpretation:
- better segmentation and better timing should be treated as separate layers
- once text improves, timing recovery becomes the next real bottleneck

### 2.3 Product differentiation is not “perfect automation”; it is “good automation plus correction”

Report 03 is the most important product-level finding.

Most actionable findings:
- competitors either pass through bad segments, hide the issue behind curated content, or push correction into clumsy external editing flows
- no strong product appears to combine automatic regrouping with lightweight in-practice boundary correction

Interpretation:
- the best opportunity is not just a better pipeline
- it is a better workflow for when the pipeline is still wrong

## 3. What This Means For The Architecture

Wave 1 strengthens the case for a `PracticeSegment` architecture.

Current system assumption:
- cleaned transcript segments are effectively the same thing as learner-facing repeat units

Wave 1 implication:
- they should be separated

Recommended conceptual model:

1. `SourceTranscriptSegment`
- raw timed subtitle or transcript unit from YouTube or transcript provider

2. `ComputedPracticeSegment`
- regrouped learner-facing candidate unit produced by deterministic or AI logic

3. `FinalPracticeSegment`
- what the player actually loops
- may include timing refinement and user edits

This split would make it much easier to:
- improve segment semantics independently from timing
- add acoustic alignment later
- persist user overrides cleanly
- expose confidence for difficult segments

## 4. Highest-Value Near-Term Moves

### 4.1 Pursue now

These have the best effort-to-value ratio:

1. Improve the current AI resegmentation prompt to focus specifically on Japanese punctuation restoration and clause-aware regrouping.
2. Integrate Sudachi WASM into the deterministic segmentation layer.
3. Design a lightweight inline boundary correction UX in the player.

These three together directly target the weakest point of the feature.

### 4.2 Prototype next

1. stable-ts as an acoustic timing refinement layer for hard videos or accepted AI resegmentations
2. transcribe-first path on a limited benchmark set, not as the default architecture yet
3. GiNZA or other heavier Japanese clause tools only if Sudachi + punctuation restoration plateaus

### 4.3 Not yet justified as the main path

1. full ASR-first architecture for all videos
2. prosody-heavy or audio-first redesign before text-first improvements are exhausted
3. broad UX expansion unrelated to segmentation quality

## 5. Main Risks Exposed By Wave 1

### 5.1 Technical risk

If punctuation restoration modifies text too aggressively, alignment quality can drop.

Implication:
- any LLM punctuation path must preserve original lexical content strictly
- alignment validation remains essential

### 5.2 Operational risk

Audio-based alignment or transcription introduces infrastructure, latency, and possibly YouTube policy risk.

Implication:
- do not make acoustic processing the mandatory default path too early

### 5.3 Product risk

Trying to fully automate segmentation perfection may be lower leverage than combining good automation with fast correction.

Implication:
- correction UX should be treated as a core reliability feature, not a last-resort admin tool

## 6. Recommended Next Artifact

The next design document should be:

`PracticeSegment Architecture Proposal`

That document should define:
- the new data model
- deterministic segmentation responsibilities
- AI segmentation responsibilities
- timing refinement responsibilities
- confidence and fallback rules
- edit override storage model

## 7. Recommended Next Execution Order

1. Complete Wave 2 research for prosody, broader segmentation methods, and correction UX.
2. Produce `PracticeSegment Architecture Proposal`.
3. Produce a benchmark-driven implementation plan for:
   - punctuation restoration
   - Sudachi-based segmentation
   - inline boundary correction
4. Only then decide whether stable-ts becomes:
   - premium path
   - hard-video fallback
   - or general alignment layer

## 8. Final Conclusion

Wave 1 does not suggest rewriting the whole feature.

It suggests that the best path is:
- keep the current runtime shape
- strengthen the segmentation layer substantially
- separate practice units from raw transcript units
- add acoustic timing refinement selectively
- give users a correction path inside the player

That combination is the clearest path from the current ~5.5/10 segmentation quality toward something that could credibly approach 10/10.

