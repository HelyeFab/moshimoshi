# Grammar Stall - JLPT Levels Expansion Guide (Next: N4)

This guide documents the exact steps to add a new JLPT level
to the Grammar Stall. The next target level is **N4**.

---

## 0) Pre-Checklist

- N5 is the current active level.
- New level must be **non-breaking** for N5.
- Practice page must remain **multi-level safe**.
- URE + XP + persistence should work without change.

---

## 1) Add Data Files for N4

### Folder structure (mirror N5)

Create new folders:

- `public/data/grammar/points/n4/`
- `public/data/grammar/exercises/n4/`

Add:
- `public/data/grammar/n4-index.json`
- `public/data/grammar/points/n4/{pointId}.json`
- `public/data/grammar/exercises/n4/{pointId}.json`

Match the existing N5 schema exactly:
- `GrammarPoint`, `ExerciseFile`, `Exercise` in `src/lib/grammar/types.ts`.

---

## 2) Update Level Index + Point Map

### 2.1 `n4-index.json`

Add all N4 points to the index with correct ordering.
Use the same shape as N5.

### 2.2 `points-index.json`

This map resolves pointId -> level quickly.

Add each new point:

```
{
  "points": {
    "201-n4-point-id": "n4",
    "202-n4-point-id": "n4"
  }
}
```

File:
`public/data/grammar/points-index.json`

---

## 3) Generate Lite Exercise Files

Lite files are used to render a fast shell on practice.

Run:

```
npm run grammar:lite
```

This will generate:
`public/data/grammar/exercises/n4/{pointId}.lite.json`

---

## 4) Validate JSON

Quick schema validation:

```
for f in public/data/grammar/points/n4/*.json public/data/grammar/exercises/n4/*.json public/data/grammar/n4-index.json; do
  jq '.' "$f" >/dev/null || echo "BAD $f"
done
```

---

## 5) Wire UI Level Selection (When Ready)

Currently the grammar list page is pinned to N5 in:
`src/app/[locale]/learn/grammar/page.tsx`

When you want N4 to be user-selectable:

- Add a level selector in `GrammarPageClient`.
- Pass selected level into `getGrammarIndex(level)`.
- Update SEO metadata to reflect the selected level.

---

## 6) Update SEO (Important)

The grammar list page currently advertises **N5** in:
`src/app/[locale]/learn/grammar/page.tsx`

When adding N4:
- Update titles/description in metadata.
- Update schema `educationalLevel`, `courseCode`, `hasPart`.

---

## 7) Practice Page Behavior (Already Multi-Level Safe)

Practice uses:
- `public/data/grammar/points-index.json` to resolve level.
- Fallback probing `n5 -> n1`.
- Lite file prefetch, full file fetch.

Nothing required as long as you add the map entries + data.

---

## 8) Admin + URE

No changes are required. URE adapters and progress manager are
level-agnostic. Just ensure the new points/exercises are valid.

---

## 9) Release Checklist for N4

- All N4 JSON validates.
- Lite files generated.
- points-index updated.
- Lighthouse run on at least one N4 practice point.
- Admin page still works.

---

**Last Updated**: 2026-01-17
