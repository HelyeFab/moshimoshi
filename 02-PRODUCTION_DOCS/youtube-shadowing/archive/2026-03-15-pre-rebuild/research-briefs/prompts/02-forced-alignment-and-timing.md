# Prompt 02: Forced Alignment And Timing Refinement

Research this exact problem:

`If we improve transcript text boundaries, how can we recover precise Japanese timing for loop-safe playback?`

Context:
- The app currently relies on transcript timing to control segment repeats.
- Better segmentation often changes text boundaries.
- The system needs timing-safe, loop-safe segments after any regrouping.

Focus on:
- forced alignment for Japanese
- subtitle re-alignment
- WhisperX
- Montreal Forced Aligner
- wav2vec or CTC alignment approaches
- acoustic alignment tools that can align Japanese text to audio
- production tradeoffs for aligning YouTube-derived audio

Deliver output using `../OUTPUT_TEMPLATE.md`.

Be explicit about:
- timing precision
- runtime and infra cost
- whether the option can run per video or only offline
- whether it is practical for an app like this
- whether it can replace or improve `src/lib/transcript/aiTimingAlignment.ts`

