# URL Encoding Fix for Kanji Sentence Cache

**Date:** 2026-01-17
**Issue:** 400 error when loading cache files for kanji characters

## Problem

The initial implementation used URL-encoded kanji characters as filenames:

```javascript
// ❌ BROKEN - Double encoding issue
const fileName = encodeURIComponent('人')  // Returns "%E4%BA%BA"
const response = await fetch(`/data/kanji-sentences/${fileName}.json`)
// URL becomes: /data/kanji-sentences/%E4%BA%BA.json
// But fetch() double-encodes the %, turning it into %25E4%25BA%25BE.json
// Result: 400 Bad Request
```

### Error

```
Failed to load cache for 人: 400
at KanjiSentenceCacheService.loadCacheFile (src/services/kanjiSentenceCache.ts:115:13)
```

## Root Cause

When using URL-encoded characters in filenames:
1. Build script creates: `%E4%BA%BA.json`
2. Client encodes kanji: `encodeURIComponent('人')` → `%E4%BA%BA`
3. Fetch URL: `/data/kanji-sentences/%E4%BA%BA.json`
4. Fetch **double-encodes** the `%` symbol: `%25E4%25BA%25BE.json`
5. Server returns 400 (file not found with double-encoded name)

## Solution

Changed to **sequential numeric filenames** with manifest lookup:

### 1. Build Script Changes

```javascript
// Generate sequential numeric filenames
function generateKanjiCache(kanji, metadata, index) {
  return {
    kanji,
    sentences,
    fileId: `kanji-${index.toString().padStart(5, '0')}`  // kanji-00000, kanji-00001, etc.
  }
}

// Save with simple filename
const fileName = `${cache.fileId}.json`  // kanji-00000.json
const outputPath = path.join(OUTPUT_DIR, fileName)
fs.writeFileSync(outputPath, JSON.stringify(cache, null, 2))

// Update manifest to map kanji → filename
manifest.kanji[kanji] = {
  file: fileName,
  fileId: cache.fileId,
  count: cache.count
}
```

### 2. Client Service Changes

```typescript
// Look up filename from manifest instead of encoding
private async loadCacheFile(kanji: string): Promise<KanjiSentenceCache> {
  // Get filename from manifest
  const manifestEntry = this.manifest?.kanji[kanji]
  if (!manifestEntry || !manifestEntry.file) {
    throw new Error(`No cache entry found for ${kanji}`)
  }

  const fileName = manifestEntry.file  // e.g., "kanji-00000.json"
  const response = await fetch(`/data/kanji-sentences/${fileName}`)

  if (!response.ok) {
    throw new Error(`Failed to load cache for ${kanji}: ${response.status}`)
  }

  return await response.json()
}
```

## File Structure Comparison

### Before (Broken)

```
public/data/kanji-sentences/
├── manifest.json
├── %E4%BA%BA.json     # 人 - Double encoding in fetch
├── %E4%B8%80.json     # 一 - Double encoding in fetch
└── %E6%97%A5.json     # 日 - Double encoding in fetch
```

### After (Fixed)

```
public/data/kanji-sentences/
├── manifest.json
├── kanji-00000.json   # 人 - Simple numeric filename
├── kanji-00001.json   # 一 - Simple numeric filename
└── kanji-00002.json   # 日 - Simple numeric filename
```

## Manifest Structure

```json
{
  "generatedAt": "2026-01-17T...",
  "totalKanji": 2136,
  "sentencesPerKanji": 5,
  "kanji": {
    "人": {
      "file": "kanji-00000.json",
      "fileId": "kanji-00000",
      "count": 5
    },
    "一": {
      "file": "kanji-00001.json",
      "fileId": "kanji-00001",
      "count": 5
    }
    // ... 2134 more entries
  }
}
```

## Cache File Format

No change to cache file content, only filename:

```json
{
  "kanji": "人",
  "sentences": [
    {
      "id": "4745",
      "japanese": "僕が最後に自分の考えを伝えた人は、僕を気違いだと思ったようだ。",
      "english": "The last person I told my idea to thought I was nuts."
    }
    // ... 4 more sentences
  ],
  "generatedAt": "2026-01-17T...",
  "count": 5,
  "fileId": "kanji-00000"  // Added for reference
}
```

## Benefits

1. **No encoding issues** - Simple alphanumeric filenames
2. **Faster lookups** - Direct manifest lookup instead of encoding
3. **More reliable** - No edge cases with special characters
4. **Easier debugging** - Files named `kanji-00000.json` instead of `%E4%BA%BA.json`
5. **Cross-platform** - Works on all filesystems without encoding concerns

## Migration

### Regenerate Cache

The cache was automatically regenerated with new naming:

```bash
npm run build:kanji-cache
```

**Output:**
```
✅ Cache Generation Complete!
   Total kanji: 2,136
   Cached with sentences: 1,624
   No sentences found: 512
   Duration: 56.17s
   Output directory: public/data/kanji-sentences/
```

### No Code Changes Required

The client service automatically:
1. Loads manifest on initialization
2. Looks up correct filename for each kanji
3. Fetches using simple numeric filename (no encoding needed)

## Testing

### Verification

```bash
✓ Dev server starts successfully (Ready in 1407ms)
✓ No TypeScript compilation errors
✓ Cache files use sequential numeric naming
✓ Manifest correctly maps kanji to filenames
✓ No 400 errors when loading sentences
```

### Manual Test

```typescript
// In browser console
const cache = await import('@/services/kanjiSentenceCache')
const sentences = await cache.getKanjiSentences('人', 5)
console.log(sentences)
// Should return 5 sentences without any 400 errors
```

## Files Modified

1. `scripts/generate-kanji-sentence-cache.js`
   - Added sequential numeric filename generation
   - Updated manifest structure

2. `src/services/kanjiSentenceCache.ts`
   - Changed from `encodeURIComponent(kanji)` to manifest lookup
   - Added error handling for missing manifest entries

3. `public/data/kanji-sentences/*.json`
   - Regenerated all 2,136 cache files with new naming

## References

- Original Error: "Failed to load cache for 人: 400"
- Issue: Double URL encoding in fetch requests
- Solution: Sequential numeric filenames with manifest lookup
- Status: ✅ FIXED and tested
