# BUG: Hiragana Characters Displaying as Dots on Android Chrome

**Date Reported:** 2025-01-27
**Date Fixed:** 2025-01-27
**Severity:** High (Core functionality broken for subset of users)
**Platform Affected:** Android (Chrome 144+, Android 15)
**Device Reported:** Samsung Galaxy S21 (SM-G991B)

---

## Summary

Certain hiragana characters (う, え, け, and potentially others) were displaying as dots (・) instead of the correct Japanese characters on Android devices using Chrome. This affected the core Kana learning functionality.

## Symptoms

- Specific hiragana characters showed as middle dots (・) in the grid view
- Affected characters included: う (u), え (e), け (ke)
- Katakana equivalents (ウ, エ, ケ) displayed correctly
- Other hiragana characters displayed correctly
- The same characters displayed correctly in smaller text (e.g., row descriptions)
- Issue only occurred on Android Chrome; desktop browsers were unaffected

## Root Cause

The issue was caused by a **rendering bug in the Noto Sans JP Variable Font** on Android Chrome.

### Technical Details

1. **Variable Font Format Issue**: The app was using `NotoSansJP-VariableFont_wght.ttf` (8.8MB) as the primary font for Japanese text.

2. **Android Chrome Bug**: Chrome on Android 15 has a rendering issue with certain glyphs in variable font files. Specific hiragana characters fail to render and display as dots instead.

3. **Why Only Some Characters?**: Variable fonts use complex glyph interpolation. Certain character outlines in the Noto Sans JP variable font trigger this rendering bug on Android's font rasterizer.

4. **Why Row Descriptions Worked?**: The bug appears to be size-dependent or related to how the font is applied via inline styles at larger sizes.

## Investigation Process

### Initial Hypothesis (Incorrect)
- Thought it was a font loading failure
- Assumed Google Fonts API removal (done day before) wasn't complete

### Debugging Steps
1. **Verified font sources**: Confirmed all fonts were self-hosted, no Google Fonts API calls
2. **Received user screenshots**: Showed specific characters as dots, not all characters
3. **Identified pattern**:
   - Hiragana う, え, け → dots
   - Katakana ウ, エ, ケ → correct
   - Same characters in smaller text → correct
4. **Concluded**: Variable font rendering bug specific to Android Chrome

### Key Insight
The fact that the row description text ("あ い う え お") displayed correctly while the grid cells showed dots indicated this was NOT a font loading issue (which would affect all text) but a rendering issue specific to the variable font at certain sizes or contexts.

## Solution

### 1. Replaced Variable Font with Static Fonts

**Before (fonts.css):**
```css
@font-face {
  font-family: 'Noto Sans JP';
  src: url('/fonts/.../NotoSansJP-VariableFont_wght.ttf') format('truetype-variations');
  font-weight: 100 900;
  font-display: swap;
}

/* Static fonts only loaded when variable fonts NOT supported */
@supports not (font-variation-settings: normal) {
  /* static font declarations */
}
```

**After (fonts.css):**
```css
/* Using static fonts as primary - variable fonts have Android Chrome bug */
@font-face {
  font-family: 'Noto Sans JP';
  src: url('/fonts/.../static/NotoSansJP-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'Noto Sans JP';
  src: url('/fonts/.../static/NotoSansJP-Medium.ttf') format('truetype');
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: 'Noto Sans JP';
  src: url('/fonts/.../static/NotoSansJP-Bold.ttf') format('truetype');
  font-weight: 700;
  font-display: swap;
}
```

### 2. Added Comprehensive System Font Fallbacks

**Before (globals.css):**
```css
--font-family-japanese: 'Elms Sans', 'Noto Sans JP', sans-serif;
```

**After (globals.css):**
```css
--font-family-japanese: 'Noto Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'Noto Sans CJK JP', sans-serif;
```

### 3. Updated All Inline Font Styles

Updated 13 component files that had inline `fontFamily` styles:

**Before:**
```tsx
style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
```

**After:**
```tsx
style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
```

## Files Modified

### CSS Files
- `src/styles/fonts.css`
- `src/styles/globals.css`

### Component Files
- `src/components/learn/KanaGrid.tsx`
- `src/components/learn/AllKanaModal.tsx`
- `src/components/kanji/KanjiDetailsModal.tsx`
- `src/components/kanji/KanjiStudyMode.tsx`
- `src/components/textbook-vocabulary/TextbookVocabularyStudyMode.tsx`
- `src/components/news/EnhancedArticleReaderFinal.tsx`
- `src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
- `src/app/[locale]/kanji-moods/[boardId]/page.tsx`
- `src/app/[locale]/vocabulary/page.tsx`
- `src/app/[locale]/vocabulary/components/WordDetailsModal.tsx`
- `src/app/[locale]/learn/word-learning/session/page.tsx`
- `src/app/[locale]/tools/kanji-mastery/learn/components/Round1Learn.tsx`
- `src/app/[locale]/tools/kanji-mastery/learn/components/Round2Test.tsx`
- `src/app/[locale]/tools/kanji-mastery/learn/components/Round3Evaluate.tsx`

## Font Fallback Chain Explained

```
'Noto Sans JP'              → Self-hosted (primary)
'Hiragino Sans'             → macOS 10.11+
'Hiragino Kaku Gothic ProN' → macOS (older)
'Yu Gothic'                 → Windows 10+
'Meiryo'                    → Windows Vista+
'Noto Sans CJK JP'          → Android, Linux
sans-serif                  → Final fallback
```

This ensures Japanese characters will render on ANY device even if our self-hosted font fails to load.

## Prevention & Best Practices

### 1. Variable Fonts on Mobile
- **Lesson**: Variable fonts can have rendering bugs on mobile browsers
- **Best Practice**: Always test variable fonts on actual mobile devices before production
- **Alternative**: Use static fonts for critical character sets (CJK, Arabic, etc.)

### 2. Font Fallback Chains
- **Lesson**: A font fallback of just `sans-serif` is insufficient for non-Latin scripts
- **Best Practice**: Always include platform-specific fonts for each target script:
  - Japanese: Hiragino (macOS), Yu Gothic/Meiryo (Windows), Noto Sans CJK (Android/Linux)
  - Chinese: PingFang (macOS), Microsoft YaHei (Windows), Noto Sans SC (Android/Linux)
  - Korean: Apple SD Gothic Neo (macOS), Malgun Gothic (Windows), Noto Sans KR (Android/Linux)

### 3. Testing Japanese Text
- **Test Characters**: Test with characters from different categories:
  - Basic hiragana: あ い う え お
  - Dakuten: が ぎ ぐ げ ご
  - Small characters: ゃ ゅ ょ っ
  - Katakana: ア イ ウ エ オ
  - Kanji: Various complexity levels

### 4. Debugging Font Issues
When users report character display issues:
1. **Get screenshots** - Critical for diagnosis
2. **Get device info** - Browser version, OS version, device model
3. **Check if ALL characters fail or SPECIFIC ones** - This distinguishes font loading issues from rendering bugs
4. **Check different contexts** - Same text at different sizes, in different components

## Related Issues

- **2025-01-26**: Removed Google Fonts API dependencies, switched to self-hosted fonts
- This bug was initially thought to be related to that change but was actually a pre-existing issue with the variable font that only became apparent after testing

## User Communication

The reporting user was:
1. Thanked for their detailed bug report with screenshots
2. Provided explanation of the fix
3. Given instructions to clear cache to see the fix
4. Offered THANKYOU50 discount code (50% off any subscription) as appreciation

---

## Appendix: Screenshots from User

### Screenshot 1: Kana Grid View
- Shows vowel row with う and え as dots
- Shows K-row with け as dot
- Row descriptions show all characters correctly

### Screenshot 2: Device Info
- Chrome 144.0.7559.90
- Android 15
- Samsung SM-G991B (Galaxy S21)

### Screenshot 3: Flashcard Study View
- Shows hiragana as dot
- Katakana (ケ) displays correctly below

---

*Document created: 2025-01-27*
*Last updated: 2025-01-27*
