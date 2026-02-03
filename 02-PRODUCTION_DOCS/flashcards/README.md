# Flashcards

**Status:** ACTIVE  
**Last Updated:** 2026-02-03

## Overview
Flashcards is a local-first SRS feature with two deck types: user-created decks and Anki imports. User decks use FSRS, Anki decks use SM-2, and media is hydrated at render time from IndexedDB. Premium users can sync user decks via Firebase and back up both deck types to R2.

## Quick Start
1. Read the resident onboarding: `FLASHCARDS_ONBOARDING.md`
2. Start at `src/app/[locale]/flashcards/FlashcardsContent.tsx`
3. Inspect `src/lib/flashcards/FlashcardManager.ts` and `src/lib/anki/AnkiDeckManager.ts`

## Architecture
- User decks stored in `FlashcardDB` (IndexedDB), optional Firebase sync for premium.
- Anki decks stored in `FlashcardDB` only; media in `ankiMediaDB`.
- SRS split: FSRS for user decks, SM-2 for Anki decks.
- Media hydration via `useMediaHydration` and `hydrateAnkiMedia`.
- Premium R2 backup/restore for both deck types.

## Documentation
- [FLASHCARDS_ONBOARDING.md](./FLASHCARDS_ONBOARDING.md) - Condensed resident owner guide

## Key Files
- `src/app/[locale]/flashcards/FlashcardsContent.tsx` - Main flashcards page
- `src/lib/flashcards/FlashcardManager.ts` - User deck CRUD + sync + SRS
- `src/components/flashcards/StudySession.tsx` - User deck study flow
- `src/lib/anki/importer.ts` - Anki import + rules
- `src/lib/anki/AnkiDeckManager.ts` - Anki deck persistence
- `src/lib/anki/AnkiStudyManager.ts` - Anki SM-2 scheduling
- `src/hooks/useMediaHydration.ts` - Media hydration
- `src/lib/r2/R2UploadQueue.ts` - Anki R2 backup
- `src/lib/r2/UserDeckUploadQueue.ts` - User deck R2 backup

