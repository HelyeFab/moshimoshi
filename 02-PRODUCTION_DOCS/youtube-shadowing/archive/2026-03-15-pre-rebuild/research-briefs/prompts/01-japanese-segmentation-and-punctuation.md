# Prompt 01: Japanese Segmentation And Punctuation Restoration

Research this exact problem:

`How can we convert noisy Japanese YouTube captions or ASR transcript fragments into meaningful shadowing practice segments?`

Context:
- The current app already has a YouTube shadowing player.
- It can load transcripts and loop segments.
- Its weakest point is meaningful segmentation quality.
- We do not want a broad AI survey.
- We want technologies, models, libraries, or methods that specifically improve Japanese sentence, clause, or utterance segmentation from noisy captions.

Focus on:
- Japanese sentence boundary detection
- punctuation restoration for spoken Japanese / ASR text
- clause segmentation
- bunsetsu or dependency-informed segmentation
- subtitle cleanup that improves repeat-worthy segments
- production-usable libraries, APIs, or models

Do not focus on:
- translation quality
- full subtitle editors
- general chatbot prompting

Deliver output using `../OUTPUT_TEMPLATE.md`.

Be explicit about:
- whether the option is good enough for production
- whether it is self-hostable
- whether it preserves timing or requires later re-alignment
- whether it could fit into:
  - `src/app/api/youtube/transcript/[videoId]/route.ts`
  - `src/app/api/youtube/resegment/route.ts`
  - a future `PracticeSegment` generation layer

