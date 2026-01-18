# N4 Grammar Data Normalization

This directory contains scripts used for normalizing N4 grammar data to match the runtime schema.

## Scripts Overview

### 1. fix-n4-related-points.js
**Purpose**: Converts relatedPoints references from titles to IDs in N4 grammar point files.

**What it does**:
- Reads `n4-index.json` to build a title → ID mapping
- Processes all files in `public/data/grammar/points/n4/`
- Replaces title-based relatedPoints with ID-based references
- Reports unmapped references that couldn't be converted

**Usage**:
```bash
node scripts/grammar/fix-n4-related-points.js
```

**Example output**:
```
📚 Starting N4 relatedPoints normalization...
Step 1: Building title → ID mapping from n4-index.json...
  ✓ Built mapping for 370 title variations → 124 IDs
Step 2: Processing N4 point files...
✅ Normalization complete!
  Files processed: 124
  Files updated: 124
  Related points fixed: 267
```

### 2. update-points-index.js
**Purpose**: Updates `points-index.json` to add all N4 point IDs with level mapping.

**What it does**:
- Reads all point IDs from `n4-index.json`
- Updates `public/data/grammar/points-index.json`
- Adds each N4 ID with value `"n4"`
- Updates lastUpdated timestamp

**Usage**:
```bash
node scripts/grammar/update-points-index.js
```

**Example output**:
```
📚 Updating points-index.json with N4 mappings...
Step 1: Reading N4 point IDs from n4-index.json...
  ✓ Found 124 N4 points
✅ Update complete!
  Total points: 204
  N5 points: 80
  N4 points: 124
```

## Complete N4 Normalization Workflow

### Prerequisites
- N4 content exists in `public/data/grammar/n4-index.gpt.json`
- N4 point files exist in `public/data/grammar/points/n4-gpt/`

### Step-by-Step Process

```bash
# 1. Copy N4 index to runtime location
cp public/data/grammar/n4-index.gpt.json public/data/grammar/n4-index.json

# 2. Create runtime points directory and copy all N4 point files
mkdir -p public/data/grammar/points/n4
cp -r public/data/grammar/points/n4-gpt/* public/data/grammar/points/n4/

# 3. Fix relatedPoints references (titles → IDs)
node scripts/grammar/fix-n4-related-points.js

# 4. Update points-index.json with N4 mappings
node scripts/grammar/update-points-index.js

# 5. Verify the changes
ls -lh public/data/grammar/n4-index.json
ls -1 public/data/grammar/points/n4/ | wc -l  # Should show 124
grep -c '"n4"' public/data/grammar/points-index.json  # Should show 124
```

## Verification Commands

```bash
# Check a sample N4 point can be loaded
cat public/data/grammar/points/n4/201-n4-point-1.json | jq '.relatedPoints'

# Verify points-index mapping
grep '"201-n4-point-1"' public/data/grammar/points-index.json

# Count total points by level
cat public/data/grammar/points-index.json | jq '.points | to_entries | group_by(.value) | map({level: .[0].value, count: length})'
```

## File Structure After Normalization

```
public/data/grammar/
├── n4-index.json              # Runtime N4 index (copied from n4-index.gpt.json)
├── n4-index.gpt.json          # Original source (preserved)
├── n5-index.json              # N5 index
├── points-index.json          # Level mapping for all points (N5 + N4)
└── points/
    ├── n4/                    # Runtime N4 points (124 files)
    │   ├── 201-n4-point-1.json
    │   ├── 202-n4-point-2.json
    │   └── ...
    ├── n4-gpt/                # Original source (preserved)
    └── n5/                    # N5 points (80 files)
        ├── 001-x-wa-y-desu.json
        └── ...
```

## Notes

### RelatedPoints Mapping
- **Mapped**: 267 title references successfully converted to IDs
- **Unmapped**: 63 references removed (generic terms, N5 cross-refs, non-existent points)
- Unmapped references are safe to ignore - the UI handles empty relatedPoints arrays

### Backwards Compatibility
- All N5 data remains unchanged
- Existing N5 routes and IDs preserved
- Multi-level support ready for N3/N2/N1

### Future Use
These scripts can be reused for normalizing N3/N2/N1 data:
1. Replace `n4` with target level in file paths
2. Update the index file paths in scripts
3. Run the same workflow

## Last Run
- **Date**: 2026-01-18
- **N4 Points**: 124
- **Total Points**: 204 (80 N5 + 124 N4)
- **Agent**: Agent 01 - Data Normalization & Mapping
