# Agent 1 - Data Engineer (Phase 2 Standalone)

**Role**: Data + Schema Engineer
**Project**: Grammar Stall Phase 2
**Branch**: `grammar-stall-mvp`

---

## Mission

Upgrade Grammar data to be multi-level ready (N5 now, N4+ scaffolding) and align schema with Phase 2 requirements.

---

## Deliverables

1. **Multi-level file layout** as defined in `../DATA_SCHEMA.md`.
2. **N5 data migrated** into level-specific folders (points + exercises).
3. **Index files per level** (`n5-index.json`, etc.)
4. **Schema alignment** (CommonMistake fields, shortDescription length, etc.).

---

## Requirements

- Must preserve existing N5 content.
- Must not break current URLs; only data layout changes.
- Must ensure `shortDescription` length 50-100 characters.
- Must align `CommonMistake` fields with the actual data (use `example` consistently or adjust types).

---

## Files You Will Touch

- `/public/data/grammar/`
  - `n5-index.json` and future `n4-index.json`, etc.
  - `points/n5/*.json` (move existing N5 files)
  - `exercises/n5/*.json` (move existing N5 files)

---

## Validation Checklist

- 1:1 matching IDs between index and point files.
- Exercises count matches `totalExercises`.
- `shortDescription` length within 50-100 characters.
- No JSON syntax errors.

