# AI Prompts (Story + Book + Comic Generation)

This folder contains the exact prompt templates used when generating stories, books, and comics.

- `story-generation.json`: Prompt templates for story generation (single-shot + multi-step).
  - Source: `src/lib/ai/config/prompts/story-generation.json`
- `book-summary-prompt.md`: Prompt template for condensed narrative book generation.
  - Source: `src/lib/ai/processors/BookSummaryProcessor.ts` (buildPrompt)
- `comic-generation-prompts.md`: Prompt templates for comic generation steps.
  - Source: `src/app/api/admin/comics/generate/route.ts` (prompt builders)
