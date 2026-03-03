# Conjugation Usage Notes: Coverage Status and Authoring Guide

**Status:** Full reviewed coverage implemented (104/104); use this as a maintenance/editing guide
**Last updated:** 2026-02-26

## Purpose

This document tracks the runtime coverage of the `🧠 When it's used` notes shown in the drill Rules modal and provides authoring guidance for improving/reviewing entries.

Runtime source files:

- `src/lib/conjugation/usage/conjugation-usage-notes.ts`
- `src/lib/conjugation/usage/getConjugationUsageNote.ts`
- `src/lib/conjugation/usage/schema.ts`

## Current Coverage

- Total `ExtendedConjugationForms` keys: `104`
- Runtime coverage in `CONJUGATION_USAGE_NOTES`: `104 / 104`
- Explicit entries in `RAW_USAGE_NOTES`: `104 / 104`
- Hand-reviewed entries (`reviewed: true`): `104`
- Placeholder-style entries pending review (`reviewed: false`): `0`

## Original Seed Notes (25)

- `present`
- `past`
- `negative`
- `pastNegative`
- `polite`
- `politePast`
- `politeNegative`
- `politePastNegative`
- `teForm`
- `naiDeForm`
- `volitional`
- `provisional`
- `conditional`
- `potential`
- `potentialNegative`
- `potentialPast`
- `potentialPastNegative`
- `passive`
- `passivePolite`
- `causative`
- `causativePassive`
- `taiForm`
- `taiFormNegative`
- `progressive`
- `request`

## Runtime Behavior (current)

The runtime dataset guarantees that every `ExtendedConjugationForms` key has a usage note, and the source file explicitly contains all entries:

- Curated entries come from `RAW_USAGE_NOTES` in `src/lib/conjugation/usage/conjugation-usage-notes.ts`
- `RAW_USAGE_NOTES` contains all `104` keys and all are currently marked `reviewed: true`
- Runtime generation helpers remain in the module for future extensions, but are not used for current form coverage
- `getConjugationUsageNote(...)` reads from the complete dataset (no UI-side missing state)

### Hand-patched semantic fixes (2026-02-26)

These edge cases received additional semantic fixes during the expansion:

- `negativeTeForm` (avoid conflating with `naiDeForm`)
- `politeNegative` (avoid implying potential meaning)
- `volitionalNegative` (avoid misleading “let’s not” default)
- `taiObjective` (correctly describe `〜たさ` as nominalized desire)
- `colloquialPast` (mark as possible same-as-past/app variant)

## Recommended Maintenance Order (practical)

If you want to improve wording quality further (even though all notes are reviewed), prioritize:

1. `classical*`, `formalNegative`, `presumptive*` (recognition-focused advanced forms)
2. Helper/stem forms (`*Stem`, `taiAdjectiveStem`)
3. Complex families (`causative*`, `causativePassive*`)
4. “Connector” variants (`*TeForm`, `adverbialNegative`)
5. Politeness nuance tuning (`requestPolite`, polite passive/causative variants)

## Copy/Paste Template (manual curated entry)

Add/replace entries in `RAW_USAGE_NOTES` inside `src/lib/conjugation/usage/conjugation-usage-notes.ts` using this shape:

```ts
FORM_KEY_HERE: {
  default: {
    key: 'FORM_KEY_HERE',
    title: 'Human Title',
    summary: 'One short sentence explaining when this form is used.',
    useCases: [
      'Use case 1',
      'Use case 2',
      'Use case 3',
    ],
    nuance: 'Optional nuance/caution.',
    register: 'neutral', // neutral | casual | polite | written | spoken | mixed
    level: 'beginner',   // beginner | intermediate
    reviewed: true,
    version: 1,
  },
},
```

## Authoring Guidelines (keep consistent)

- Keep `summary` short and functional (when/why used, not how to form it)
- `useCases`: 2-4 short bullets
- Avoid mixing mechanical transformation rules into usage notes
- Avoid overclaiming one single meaning for forms like `teForm` / `progressive`
- Prefer learner-friendly wording first; nuance can go in `nuance`
