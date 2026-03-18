# Session Context: Segmentation Quality Mission

Last updated: 2026-03-12
Owner context: YouTube Shadowing / Moshi Player

## 1. What We Are Trying To Achieve

Primary objective:

`Bring the YouTube shadowing player as close as possible to a 10/10 experience for meaningful segment-based repetition practice.`

More concrete product goal:

The player should allow users to:
1. take a YouTube video
2. get a transcript
3. segment it into meaningful spoken practice units
4. repeat those units cleanly and reliably

This is not mainly a translation problem, not mainly a UI problem, and not mainly a generic AI problem.

This is mainly a:
- transcript-to-practice-segment problem
- timing-safe loop playback problem

## 2. Current Diagnosis

Current assessment of correspondence between product purpose and implementation:

- video loading: 8/10
- transcript retrieval robustness: 7/10
- meaningful segmentation: 5.5/10
- repeat-loop behavior as a shadowing tool: 8/10
- overall fidelity to feature purpose: 7/10

Weakest point:

`meaningful segmentation`

Interpretation:
- the app is already fairly good at producing playable segments
- it is only moderately reliable at producing linguistically right practice segments

Core distinction:
- a playable segment is safe to loop
- a meaningful segment is safe and useful to learn from

The feature exists for the second one.

## 3. Why This Matters

The current system is strong at answering:

`When should I stop and repeat?`

It is weaker at answering:

`What exactly should I repeat?`

That is the bottleneck.

If segmentation quality remains mediocre:
- transcript extraction success does not fully solve the user problem
- repeat logic can still feel technically correct but pedagogically weak
- the player risks feeling like a sophisticated subtitle looper rather than a true shadowing tool

## 4. What The Current Architecture Looks Like

Current runtime path:
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/lib/transcript/*`
- `src/lib/shadowing/repeat.ts`
- `src/utils/youtubePlayerUtils.ts`

Important implementation truth:
- the current YouTube runtime is page-driven
- `src/components/shadowing/MoshiShadowingPlayer.tsx` is not the active YouTube runtime

Current design bias:
- first make timings safe
- then improve segmentation quality where possible

Desired long-term design bias:
- first identify the best repeatable spoken practice unit
- then preserve or recover timing so that unit can be looped safely

## 5. What We Believe Right Now

1. Transcript extraction is a critical dependency.
   If transcript retrieval fails, the feature fails.

2. AI is not the core runtime requirement.
   AI improves quality, but deterministic fallback must remain usable.

3. The main unsolved problem is not playback mechanics.
   The main unsolved problem is turning messy caption fragments into trustworthy practice units.

4. The current system still treats transcript segments and practice segments as too close to the same thing.
   That is probably the architectural limitation.

5. A likely future direction is an explicit `PracticeSegment` layer.
   This would separate:
   - source transcript timing units
   - learner-facing repeat units

## 6. What Good Research Must Help Us Answer

Every research result should help answer at least one of these:

1. How do we produce better Japanese spoken-unit boundaries from noisy caption text?
2. How do we preserve or recover precise timing after boundaries are improved?
3. What do best-in-class shadowing products appear to do differently?
4. If fully automatic segmentation cannot be perfect, what minimal correction UX closes the gap fastest?

## 7. What Not To Get Distracted By

Avoid wasting cycles on:
- generic subtitle beautification
- general-purpose LLM prompting advice
- translation-first solutions
- passive-reader features
- full editor suites unless they directly help quick segment correction

Do not confuse:
- "looks cleaner"
with
- "is a better repeat-worthy shadowing unit"

## 8. Research Priorities

Priority order:

P0:
1. Japanese segmentation and punctuation restoration
2. Forced alignment and timing refinement
3. Competitive teardown of Miraa and adjacent tools

P1:
4. Subtitle-to-utterance segmentation methods
5. Prosody-aware / pause-aware segmentation
6. Editable fallback UX

## 9. What Counts As A Strong Finding

A strong finding is one that can plausibly improve:
- linguistic completeness of practice units
- trustworthiness of repetition
- loop timing safety
- fit with the current architecture

A weak finding is one that mostly improves:
- transcript cosmetics
- translation polish
- general AI novelty

## 10. Working Hypothesis For A 10/10 Solution

A 10/10 path probably will not be one single tool.

Most likely it will be a stack:
- better Japanese text segmentation or punctuation restoration
- improved grouping into practice segments
- timing refinement or forced alignment where needed
- deterministic fallback for safety
- editable correction for hard edge cases

In other words:
- not pure heuristics only
- not pure AI only
- not pure audio only
- a hybrid system

## 11. How To Evaluate Incoming Agent Reports

For every report, ask:

1. Does this improve the `meaningfulness` of the segment, not just cleanliness?
2. Does it preserve timing or give us a realistic re-alignment story?
3. Can it fit into the current stack without rewriting the whole app?
4. Is it production-credible in cost, latency, and reliability?
5. Does it move us toward a real `PracticeSegment` architecture?

If the answer is mostly no, the finding is not central.

## 12. Likely Next Design Move After Research

After research comes synthesis.

The likely next technical artifact to produce is:

`PracticeSegment Architecture Proposal`

That future document should define:
- what a practice segment is
- how it differs from transcript segments
- how it is generated
- how timing is assigned
- how confidence and fallback work
- how editing overrides are stored

## 13. Resume Point

If resuming later, start here:

1. Read this file.
2. Read `IMPLEMENTATION_ARCHAEOLOGY.md`.
3. Check `TRACKER.md` for finished research outputs.
4. Review outputs in priority order.
5. Synthesize findings into an architecture proposal centered on segmentation quality.

