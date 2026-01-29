# Blast Mode i18n Updates

## Summary of Changes

Successfully added comprehensive i18n support for the blast-mode feature across all 6 languages (en, ja, de, es, fr, it).

### ✅ Completed: Translation Files Updated

All 6 locale files now have a complete `blastMode` section with ~120 translation keys covering:

1. **Page metadata**: title, description
2. **Features**: fast, adaptive, engaging descriptions
3. **Configuration**: content types, list selection, JLPT levels, kanji picker
4. **Buttons**: start, next, finish, exit, submit, reset, etc.
5. **Errors**: validation messages
6. **Loading states**: default, session, redirecting
7. **Session**: exit confirmation, completion modal
8. **How it works**: step descriptions
9. **Screens**: MCQ hints, reassemble instructions and feedback

### 🔧 Required: Component Updates

The following files need their hardcoded strings replaced with `t()` calls:

#### 1. `/src/app/[locale]/tools/blast-mode/page.tsx`

**Current hardcoded strings to replace:**

| Line | Current String | Replacement |
|------|---------------|-------------|
| 203 | `"Blast Mode"` | `t('blastMode.title')` |
| 204 | `"High-velocity learning flow..."` | `t('blastMode.description')` |
| 205 | `"/dashboard"` | Keep as is |
| 222 | `"Fast & Fun"` | `t('blastMode.features.fast.title')` |
| 223 | `"No typing required"` | `t('blastMode.features.fast.description')` |
| 239 | `"Adaptive"` | `t('blastMode.features.adaptive.title')` |
| 240 | `"Smart question flow"` | `t('blastMode.features.adaptive.description')` |
| 256 | `"Engaging"` | `t('blastMode.features.engaging.title')` |
| 257 | `"6 question types"` | `t('blastMode.features.engaging.description')` |
| 272 | `"Configure Session"` | `t('blastMode.configure.title')` |
| 278 | `"Content Type"` | `t('blastMode.configure.contentType.label')` |
| 289 | `"Kanji"` | `t('blastMode.configure.contentType.kanji')` |
| 299 | `"Vocabulary"` | `t('blastMode.configure.contentType.vocabulary')` |
| 309 | `"Mixed"` | `t('blastMode.configure.contentType.mixed')` |
| 319 | `"Lists"` | `t('blastMode.configure.contentType.lists')` |
| 328 | `"Select List"` | `t('blastMode.configure.selectList.label')` |
| 333 | `"Lists require Premium access."` | `t('blastMode.configure.selectList.requiresPremium')` |
| 337 | `"Loading lists..."` | `t('blastMode.configure.selectList.loading')` |
| 341 | `"No lists found..."` | `t('blastMode.configure.selectList.noLists')` |
| 363, 364 | `"item"`, `"items"` | Use singular/plural properly |
| 377 | `"JLPT Level"` | `t('blastMode.configure.jlptLevel')` |
| 400 | `"Pick Kanji (5–10)"` | `t('blastMode.configure.kanjiPicker.label')` |
| 406 | `"Search kanji..."` | `t('blastMode.configure.kanjiPicker.searchPlaceholder')` |
| 411 | `"Selected:"` | `t('blastMode.configure.kanjiPicker.selected')` |
| 411 | `"/ 10"` | `t('blastMode.configure.kanjiPicker.outOf')` |
| 418 | `"Clear all"` | `t('blastMode.configure.kanjiPicker.clearAll')` |
| 423 | `"Loading kanji..."` | `t('blastMode.configure.kanjiPicker.loading')` |
| 457 | `"Selecting 5–10 kanji..."` | `t('blastMode.configure.kanjiPicker.note')` |
| 465 | `"Items per Session"` | `t('blastMode.configure.sessionSize.label')` |
| 480 | `"items"` | `t('blastMode.configure.sessionSize.items')` |
| 143 | `"Please select a list to practice"` | `t('blastMode.errors.selectList')` |
| 151 | `"Please select between 5 and 10 kanji"` | `t('blastMode.errors.kanjiRange')` |
| 173 | `"Failed to start Blast Mode session"` | `t('blastMode.errors.startFailed')` |
| 512 | `"Starting..."` | `t('blastMode.buttons.starting')` |
| 517 | `"Start Blast Mode"` | `t('blastMode.buttons.start')` |
| 531 | `"How It Works"` | `t('blastMode.howItWorks.title')` |
| 537 | `"Multiple Choice Questions"` | `t('blastMode.howItWorks.step1.title')` |
| 538 | `"Answer meaning..."` | `t('blastMode.howItWorks.step1.description')` |
| 544 | `"Reassemble Tiles"` | `t('blastMode.howItWorks.step2.title')` |
| 545 | `"Build Japanese words..."` | `t('blastMode.howItWorks.step2.description')` |
| 551 | `"Adaptive Flow"` | `t('blastMode.howItWorks.step3.title')` |
| 552 | `"Questions adapt..."` | `t('blastMode.howItWorks.step3.description')` |
| 182, 570 | `"Loading..."` | `t('blastMode.loading.default')` |
| 191 | `"Redirecting..."` | `t('blastMode.loading.redirecting')` |

#### 2. `/src/app/[locale]/tools/blast-mode/learn/page.tsx`

| Line | Current String | Replacement |
|------|---------------|-------------|
| 181 | `"Failed to load session data"` | `t('blastMode.errors.loadFailed')` |
| 195 | `"Loading session..."` | `t('blastMode.loading.session')` |
| 209 | `"Back to Setup"` | `t('blastMode.buttons.backToSetup')` |
| 219, 239 | `"Redirecting..."` | `t('blastMode.loading.redirecting')` |
| 239 | `"Loading..."` | `t('blastMode.loading.default')` |

#### 3. `/src/app/[locale]/tools/blast-mode/learn/BlastSession.tsx`

| Line | Current String | Replacement |
|------|---------------|-------------|
| 58 | `"No steps available for this session."` | `t('blastMode.session.noSteps')` |
| 324 | `"Finish"` | `t('blastMode.buttons.finish')` |
| 324 | `"Next"` | `t('blastMode.buttons.next')` |
| 334 | `"Exit Session?"` | `t('blastMode.session.exitConfirm.title')` |
| 335 | `"Your progress will not be saved..."` | `t('blastMode.session.exitConfirm.message')` |
| 336 | `"Exit"` | `t('blastMode.buttons.exit')` |
| 337 | `"Continue"` | `t('blastMode.buttons.continue')` |
| 371 | `"Session Complete!"` | `t('blastMode.session.completion.title')` |
| 364 | Template message | Use `t('blastMode.session.completion.message', { completedSteps, accuracy })` |
| 373 | `"Done"` | `t('blastMode.buttons.done')` |

#### 4. `/src/components/blast-mode/screens/BaseMcqScreen.tsx`

| Line | Current String | Replacement |
|------|---------------|-------------|
| 148 | `"Press 1-4 or click to select"` | `t('blastMode.screens.mcq.hint')` |

#### 5. `/src/components/blast-mode/screens/JpReassemble.tsx`

| Line | Current String | Replacement |
|------|---------------|-------------|
| 272 | `"Correct!"` | `t('blastMode.screens.reassemble.correct')` |
| 279 | `"Incorrect. Correct answer: ..."` | `t('blastMode.screens.reassemble.incorrect', { answer: correctOrder.join(' ') })` |
| 298 | `"Reset (R)"` | `t('blastMode.buttons.reset')` |
| 306 | `"Submit (Enter)"` | `t('blastMode.buttons.submit')` |
| 312 | `"Drag tiles to reorder..."` | `t('blastMode.screens.reassemble.instructions.reorder')` |
| 313, 319 | `"Press 1-9..."` | `t('blastMode.screens.reassemble.keyboardHints.reorder/pick')` |
| 318 | `"Select tiles in the correct order"` | `t('blastMode.screens.reassemble.instructions.pick')` |
| 324 | `"Select the correct tile"` | `t('blastMode.screens.reassemble.instructions.single')` |

### 📝 Implementation Pattern

For each component:
1. Import `useTranslation` hook: `import { useTranslation } from '@/hooks/useTranslation'`
2. Use in component: `const { t } = useTranslation()`
3. Replace hardcoded strings with `t('blastMode.path.to.string')`
4. For parameterized strings, use: `t('key', { param1: value1, param2: value2 })`

### 🧪 Testing Checklist

After updates, verify:
- [ ] All strings appear in English
- [ ] Language switching works correctly
- [ ] Japanese strings display properly
- [ ] German/Spanish/French/Italian strings display properly
- [ ] Parameterized strings (e.g., completion message) show correct values
- [ ] Pluralization works for "item/items"
- [ ] No console errors about missing keys
- [ ] All buttons, labels, and messages are translated

