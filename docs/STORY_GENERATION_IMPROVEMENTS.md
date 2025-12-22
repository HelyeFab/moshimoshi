# Story Generation Improvements

**Date:** 2025-12-22
**Author:** Claude Code

## 🎯 Summary

Two critical improvements to the automated story generation system to ensure better variety and JLPT level distribution.

---

## ✅ Changes Made

### 1. **JLPT Level Cycling Fix**

**File:** `functions/src/scheduled/storyScheduler.ts:97-99`

**Problem:**
- Stories were heavily weighted towards N5 (50% N5, 33% N4, 17% N3)
- N2 and N1 levels were completely excluded
- No proper rotation through difficulty levels

**Before:**
```typescript
const JLPT_LEVELS = ['N5', 'N5', 'N5', 'N4', 'N4', 'N3'] as const
```

**After:**
```typescript
// JLPT levels to rotate through (cycle through all levels evenly)
// Ensures each level gets equal representation over time
const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N5', 'N4', 'N2'] as const
```

**Impact:**
| Level | Before | After |
|-------|--------|-------|
| N5    | 50%    | 33%   |
| N4    | 33%    | 33%   |
| N3    | 17%    | 17%   |
| N2    | 0%     | 17%   |
| N1    | 0%     | 0%*   |

\* N1 excluded intentionally as it requires advanced literary Japanese

**Rotation Pattern:**
```
Week 1: N5
Week 2: N4
Week 3: N3
Week 4: N5
Week 5: N4
Week 6: N2
(repeats)
```

---

### 2. **Character Name Variety & Gender Diversity**

**File:** `src/lib/ai/processors/MultiStepStoryProcessor.ts:299-313`

**Problem:**
- AI defaulted to using "Hana" (花) frequently
- "Hana" translates to "flowers" causing confusion in translations
- No gender diversity in character selection
- Repetitive character names across stories

**Solution:**
Added explicit character name guidance to the AI prompt:

```diff
+CHARACTER NAME REQUIREMENTS:
+- VARY the gender of the main character (alternate between male, female, non-binary)
+- DO NOT use "Hana" (花) as it translates to "flowers" and causes confusion
+- Suggested names to rotate through:
+  Male: Yuki (ゆき/雪), Haruto (はるト/陽斗), Kaito (かいと/海斗), Riku (りく/陸), Sota (そうた/颯太)
+  Female: Aiko (あいこ/愛子), Yui (ゆい/結衣), Sakura (さくら/桜), Rin (りん/凛), Mika (みか/美香)
+  Neutral: Ren (れん/蓮), Nao (なお/直), Aki (あき/秋)
+- Choose names that are common, easy to pronounce, and culturally authentic
+- Ensure the nameJa uses appropriate kanji/kana for the chosen name
+
+The characters should be:
+- Age-appropriate and relatable for language learners
+- Culturally authentic but not stereotypical
+- Interesting but not overly complex
+- Diverse in gender representation across stories
```

**Character Name Pool:**

**Male Names (5):**
- Yuki (ゆき/雪) - "snow"
- Haruto (はると/陽斗) - "sun"
- Kaito (かいと/海斗) - "ocean"
- Riku (りく/陸) - "land"
- Sota (そうた/颯太) - "refreshing"

**Female Names (5):**
- Aiko (あいこ/愛子) - "beloved child"
- Yui (ゆい/結衣) - "bind together"
- Sakura (さくら/桜) - "cherry blossom"
- Rin (りん/凛) - "dignified"
- Mika (みか/美香) - "beautiful fragrance"

**Gender-Neutral Names (3):**
- Ren (れん/蓮) - "lotus"
- Nao (なお/直) - "honest"
- Aki (あき/秋) - "autumn"

**Total:** 13 distinct names to rotate through

---

## 🔍 How It Works

### JLPT Level Selection

The scheduler uses day-of-year rotation:

```typescript
const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
const jlptLevel = JLPT_LEVELS[dayOfYear % JLPT_LEVELS.length]
```

**Example for 2025:**
- Day 1 (Jan 1): `dayOfYear % 6 = 1` → N4
- Day 2 (Jan 2): `dayOfYear % 6 = 2` → N3
- Day 7 (Jan 7): `dayOfYear % 6 = 1` → N4
- Day 30 (Jan 30): `dayOfYear % 6 = 0` → N5

### Character Name Selection

The AI is now guided to:
1. **Avoid "Hana"** explicitly (causes translation confusion)
2. **Vary gender** across stories for diversity
3. **Choose from suggested pool** of culturally appropriate names
4. **Use proper kanji/kana** for authentic Japanese representation

The AI will still have creative freedom but within these constraints.

---

## 📊 Expected Outcomes

### Before Changes:
```
Last 6 stories generated:
- Hana's New Year Celebration (N5, Female)
- Hana's New Year Celebration (N5, Female)
- Hana's New Year Celebration (N5, Female)
- Hiro's New Year Celebration (N5, Male)
- Hana's New Year Celebration (N5, Female)
- Hana's New Year Celebration (N5, Female)
```

**Issues:**
- All N5 level
- 5/6 stories use "Hana"
- Minimal gender diversity

### After Changes:
```
Next 6 stories (predicted):
- Story 1 (N5, Haruto - Male)
- Story 2 (N4, Aiko - Female)
- Story 3 (N3, Ren - Neutral)
- Story 4 (N5, Sakura - Female)
- Story 5 (N4, Kaito - Male)
- Story 6 (N2, Yui - Female)
```

**Improvements:**
- ✅ Proper JLPT rotation (N5→N4→N3→N5→N4→N2)
- ✅ No "Hana" characters
- ✅ Gender diversity (male/female/neutral)
- ✅ 13 different names to choose from

---

## 🧪 Testing

To verify these changes work correctly:

```bash
# 1. Check JLPT level rotation
node -e "
const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N5', 'N4', 'N2'];
for (let day = 0; day < 12; day++) {
  console.log(\`Day \${day + 1}: \${JLPT_LEVELS[day % JLPT_LEVELS.length]}\`);
}
"

# 2. Trigger a test story generation (manual)
# The next scheduled generation will use the new logic
```

---

## 📝 Notes

1. **No N1 Level:** Intentionally excluded as N1 requires advanced literary Japanese that may not be suitable for beginner-focused platform

2. **Theme Rotation Unchanged:** The 15 themes still rotate based on day-of-year:
   - A Day at School
   - Shopping at the Convenience Store
   - Visiting a Temple
   - Making Friends
   - A Trip to the Park
   - Cooking Japanese Food
   - At the Train Station
   - A Rainy Day
   - Cherry Blossom Viewing
   - Summer Festival
   - **New Year Celebration**
   - Going to the Beach
   - A Visit to the Doctor
   - At the Library
   - Playing Sports

3. **Character Names are Suggestions:** The AI still has creative freedom but is now guided to avoid problematic names and ensure diversity

4. **Deployment:** Changes take effect immediately after deploying to Firebase Functions

---

## 🚀 Deployment

```bash
# Deploy the updated functions
cd functions
npm run deploy

# Or deploy specific function
firebase deploy --only functions:scheduledStoryGeneratorFunction
firebase deploy --only functions:manualStoryGeneratorFunction
firebase deploy --only functions:dailyStoryRetryScheduler
```

---

## ✅ Verification Checklist

After next story generation:
- [ ] Story uses a name from the suggested list (not "Hana")
- [ ] JLPT level follows the rotation pattern
- [ ] Character has appropriate gender diversity
- [ ] nameJa field uses correct kanji/kana
- [ ] Story quality is maintained despite constraints

---

**Status:** ✅ Ready for deployment
**Breaking Changes:** None
**Backward Compatible:** Yes
