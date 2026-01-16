# Grammar Stall MVP Specification

**Project**: Moshimoshi Grammar Guide Stall
**Version**: 1.0.0
**Timeline**: 2 weeks
**Branch**: `grammar-stall-mvp`
**Status**: Planning Phase
**Last Updated**: 2026-01-16

---

## 🎯 Executive Summary

Build a standalone grammar learning stall for Moshimoshi that provides **N5 level Japanese grammar points** (~80 points) with explanations, examples, and interactive exercises. This MVP is intentionally **NOT integrated with the Universal Review Engine (URE)** to keep scope simple and focused.

---

## 📋 Project Goals

### Primary Objectives
1. ✅ Provide comprehensive N5 grammar coverage (~80 grammar points)
2. ✅ Clear, beginner-friendly explanations in English
3. ✅ Interactive exercises for practice (multiple choice, fill-in-blank)
4. ✅ Accessible via `/learn/grammar` route
5. ✅ Offline-capable (static JSON data)

### Non-Goals (Explicitly Out of Scope for MVP)
- ❌ Universal Review Engine (URE) integration
- ❌ Progress tracking or user state persistence
- ❌ SRS (Spaced Repetition System)
- ❌ Search/filter functionality
- ❌ Learning Village UI integration (grid display)
- ❌ Admin panel for content management
- ❌ N4/N3/N2/N1 content (only N5)

---

## 🎨 User Experience Flow

```
User navigates to /learn/grammar
    ↓
Sees grid of N5 grammar points (80 cards)
    ↓
Clicks on a grammar point (e.g., "XはYです")
    ↓
Views:
  - Grammar explanation
  - Structure breakdown
  - Example sentences with translations
  - Related grammar points
    ↓
Clicks "Practice Exercises"
    ↓
Completes interactive exercises:
  - Multiple choice (choose correct particle)
  - Fill-in-blank (conjugate verb)
  - Sentence matching
    ↓
Gets immediate feedback (correct/incorrect)
    ↓
Returns to grammar point or browse other points
```

---

## 📦 MVP Features

### Feature 1: Grammar Point Browser (Priority: CRITICAL)

**User Story**: As a learner, I want to browse all N5 grammar points so I can choose what to study.

**Acceptance Criteria**:
- [ ] Grid layout displaying all 80 N5 grammar points
- [ ] Each card shows:
  - Grammar title (Japanese + English)
  - JLPT level badge (N5)
  - Brief one-line description
- [ ] Mobile responsive (2-column on mobile, 3-4 columns on desktop)
- [ ] Click card to view details

**Technical Requirements**:
- Route: `/app/[locale]/learn/grammar/page.tsx`
- Data source: `/public/data/grammar/n5-index.json`
- Component: `GrammarPointGrid.tsx`

---

### Feature 2: Grammar Point Detail View (Priority: CRITICAL)

**User Story**: As a learner, I want to read detailed explanations of grammar points so I can understand how to use them.

**Acceptance Criteria**:
- [ ] Display grammar point details:
  - Title (Japanese + Romaji + English)
  - JLPT level
  - Full explanation in beginner-friendly English
  - Grammar structure diagram
  - 3-5 example sentences with:
    - Japanese text
    - Romaji
    - English translation
    - Word-by-word breakdown
  - Related grammar points (linked)
- [ ] "Practice Exercises" button at bottom
- [ ] "Back to All Grammar" navigation
- [ ] Furigana toggle for kanji

**Technical Requirements**:
- Route: `/app/[locale]/learn/grammar/[pointId]/page.tsx`
- Data source: `/public/data/grammar/points/[pointId].json`
- Components: `GrammarPointDetail.tsx`, `ExampleSentence.tsx`

---

### Feature 3: Interactive Exercises (Priority: CRITICAL)

**User Story**: As a learner, I want to practice grammar through exercises so I can test my understanding.

**Acceptance Criteria**:
- [ ] Exercise types supported:
  - **Multiple Choice**: Select correct particle/verb form
  - **Fill-in-Blank**: Type missing word
  - **Sentence Matching**: Match Japanese to English
- [ ] Each grammar point has 5-10 exercises
- [ ] Immediate feedback after each answer:
  - ✅ Correct: "Correct! [Explanation]"
  - ❌ Incorrect: "Not quite. The correct answer is X because..."
- [ ] Progress indicator (Question 3/10)
- [ ] No score tracking (MVP simplification)

**Technical Requirements**:
- Route: `/app/[locale]/learn/grammar/[pointId]/practice/page.tsx`
- Data source: `/public/data/grammar/exercises/[pointId].json`
- Components: `ExerciseContainer.tsx`, `MultipleChoice.tsx`, `FillInBlank.tsx`
- Answer validation: Client-side JavaScript (exact match + common variations)

---

## 🗂️ Data Structure

### N5 Grammar Points Coverage

**Total**: ~80 grammar points across 12 categories

#### Categories:
1. **Basic Sentence Structure** (5 points)
   - XはYです (X is Y)
   - XはYではありません (X is not Y)
   - これ/それ/あれ (this/that)
   - Basic word order
   - Sentence-ending particles

2. **Particles** (15 points)
   - は (topic marker)
   - が (subject marker)
   - を (object marker)
   - に (location, time, indirect object)
   - で (location of action, means)
   - へ (direction)
   - と (and, with)
   - の (possessive)
   - か (question)
   - ね、よ (sentence endings)

3. **Verbs** (20 points)
   - Verb groups (う、る、irregular)
   - ます form (present/future)
   - ません form (negative)
   - ました form (past)
   - ませんでした (past negative)
   - て form basics
   - ～ている (continuous)
   - ～てください (please do)
   - ～たい (want to)
   - ～ましょう (let's)

4. **Adjectives** (10 points)
   - い-adjectives (present)
   - い-adjectives (past)
   - い-adjectives (negative)
   - な-adjectives (present)
   - な-adjectives (past)
   - な-adjectives (negative)

5. **Time Expressions** (8 points)
   - Time particles (に、まで、から)
   - Before/after (前に、後で)
   - Frequency (いつも、時々)
   - Duration (間)

6. **Existence** (5 points)
   - いる/ある (animate/inanimate existence)
   - います/あります (polite)
   - Location expressions (に)

7. **Comparisons** (4 points)
   - より (than)
   - ～方が～ (more than)
   - 一番 (most)

8. **Questions** (6 points)
   - Question words (何、誰、どこ、いつ、なぜ、どう)
   - ～か (question particle)

9. **Numbers & Counters** (5 points)
   - Basic counters (つ、人、本、枚)
   - Age (歳)
   - Time counters

10. **Necessity & Ability** (4 points)
    - ～なければならない (must)
    - ～てもいい (may)
    - ～ことができる (can)

11. **Giving & Receiving** (3 points)
    - あげる (give to)
    - くれる (give to me)
    - もらう (receive)

12. **Miscellaneous** (5 points)
    - ～から (because)
    - ～けど (but)
    - ～ので (so)
    - も (also, too)
    - だけ (only)

---

## 🏗️ File Structure

```
/src/app/[locale]/learn/grammar/
  ├── page.tsx                          # Grammar point grid (main page)
  ├── [pointId]/
  │   ├── page.tsx                      # Grammar point detail
  │   └── practice/
  │       └── page.tsx                  # Exercise mode
  └── layout.tsx                        # Shared layout (back button, etc.)

/src/components/grammar/
  ├── GrammarPointGrid.tsx              # Grid of grammar cards
  ├── GrammarPointCard.tsx              # Individual card
  ├── GrammarPointDetail.tsx            # Detail view
  ├── ExampleSentence.tsx               # Example with breakdown
  ├── ExerciseContainer.tsx             # Exercise wrapper
  ├── MultipleChoiceExercise.tsx        # Multiple choice UI
  ├── FillInBlankExercise.tsx           # Fill-in-blank UI
  └── SentenceMatchingExercise.tsx      # Matching UI

/src/lib/grammar/
  ├── grammarService.ts                 # Load grammar data
  ├── exerciseValidator.ts              # Validate answers
  └── types.ts                          # TypeScript interfaces

/public/data/grammar/
  ├── n5-index.json                     # List of all N5 points
  ├── points/
  │   ├── x-wa-y-desu.json             # Individual grammar point
  │   ├── particles-wa.json
  │   └── ... (80 files)
  └── exercises/
      ├── x-wa-y-desu.json             # Exercises for point
      ├── particles-wa.json
      └── ... (80 files)
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15.5.2 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Components**: React Server Components (default)
- **Client Interactivity**: Client Components (`'use client'`) for exercises

### Data Layer
- **Storage**: Static JSON files in `/public/data/grammar/`
- **Loading**: Server-side for grammar points, client-side for exercises
- **No database**: Keep it simple for MVP

### State Management
- **Local State**: React `useState` for exercise state
- **No Global State**: No Zustand/Redux needed for MVP
- **No Persistence**: Answers not saved (MVP simplification)

---

## 📅 Development Timeline (2 Weeks)

### Week 1: Foundation & Content

**Days 1-2**: Data Schema & Content Creation
- [ ] Define JSON schemas
- [ ] Create TypeScript interfaces
- [ ] Generate 80 grammar point JSON files
- [ ] Create sample exercises (10 points with full exercises)
- **Deliverable**: Complete data structure + 10 sample points

**Days 3-4**: Core UI Components
- [ ] `GrammarPointGrid` component
- [ ] `GrammarPointCard` component
- [ ] `GrammarPointDetail` component
- [ ] `ExampleSentence` component
- [ ] Basic routing setup
- **Deliverable**: Working grammar browser (read-only)

**Day 5**: Code Review & Integration
- [ ] Technical lead reviews Agent 1 & 2 work
- [ ] Merge data + UI
- [ ] Test on mobile/desktop
- **Deliverable**: Functional grammar point browser

---

### Week 2: Exercises & Polish

**Days 6-8**: Exercise Engine
- [ ] `ExerciseContainer` component
- [ ] `MultipleChoiceExercise` component
- [ ] `FillInBlankExercise` component
- [ ] Answer validation logic
- [ ] Feedback system
- **Deliverable**: Working exercise system for 10 points

**Days 9-10**: Content Completion
- [ ] Create exercises for remaining 70 grammar points
- [ ] Quality check all content
- [ ] Fix any data errors
- **Deliverable**: All 80 points with exercises

**Days 11-12**: Testing & Polish
- [ ] Mobile responsive testing
- [ ] Accessibility audit (keyboard nav, screen readers)
- [ ] Performance optimization
- [ ] Bug fixes
- **Deliverable**: Production-ready grammar stall

**Days 13-14**: Buffer & Documentation
- [ ] User acceptance testing
- [ ] Final bug fixes
- [ ] Update documentation
- [ ] Prepare for merge to main
- **Deliverable**: Ready for deployment

---

## ✅ Acceptance Criteria

### Functional Requirements
- [ ] 80 N5 grammar points available
- [ ] Each point has explanation + 3-5 examples
- [ ] Each point has 5-10 exercises
- [ ] All three exercise types work correctly
- [ ] Immediate answer feedback
- [ ] Mobile responsive (works on phone/tablet/desktop)
- [ ] Accessible via `/learn/grammar` route
- [ ] Offline capable (static JSON)

### Quality Requirements
- [ ] TypeScript strict mode (no `any` types)
- [ ] All components properly typed
- [ ] Responsive design (mobile-first)
- [ ] Accessible (WCAG AA compliance)
- [ ] Fast page loads (<3 seconds on 3G)
- [ ] No runtime errors in console
- [ ] Works in Chrome, Firefox, Safari

### Content Quality
- [ ] Grammar explanations are beginner-friendly
- [ ] No Japanese grammar jargon (or explained if used)
- [ ] Examples use vocabulary appropriate for N5 level
- [ ] Exercises test understanding, not memorization
- [ ] Feedback explains WHY answer is correct/incorrect

---

## 🚫 Out of Scope (Post-MVP)

These features are intentionally excluded to ship in 2 weeks:

1. **Universal Review Engine Integration**
   - No SRS scheduling
   - No review sessions
   - No mastery tracking

2. **Progress Tracking**
   - No user accounts needed
   - No saving exercise results
   - No completion badges

3. **Advanced Features**
   - No search/filter
   - No bookmarking
   - No custom study lists
   - No grammar comparison tool

4. **Content Beyond N5**
   - No N4, N3, N2, N1 (future phases)

5. **Admin Features**
   - No CMS for editing content
   - No analytics dashboard

---

## 🎯 Success Metrics

Since this is MVP without analytics, success is defined by:

1. **Completeness**: All 80 N5 grammar points present
2. **Functionality**: All exercise types work correctly
3. **Quality**: No critical bugs, works on mobile
4. **Timeline**: Delivered within 2 weeks

**Post-Launch** (if we add analytics later):
- Time on grammar detail pages
- Exercise completion rate
- Mobile vs desktop usage
- Most viewed grammar points

---

## 🔐 Security & Privacy

- **No User Data**: No login, no tracking, no cookies
- **Static Content**: All grammar data is public
- **No PII**: No personally identifiable information collected
- **Client-Side Only**: Exercises run entirely in browser

---

## 📚 Content Sources (Legal)

All content must be **original** or from **permissively licensed sources**:

1. **Tae Kim's Guide to Japanese** - CC BY-NC-SA
2. **Imabi** - Freely available grammar reference
3. **Wiktionary** - CC-licensed example sentences
4. **Original Content** - Created by team

**Prohibited Sources**:
- ❌ Genki textbook (copyrighted by Japan Times)
- ❌ Any copyrighted textbooks
- ❌ Copied content from commercial sites

---

## 🤝 Team Structure

- **Technical Lead** (1 agent): Architecture oversight, code review, integration
- **Agent 1 - Data**: JSON schema, grammar point content, exercises
- **Agent 2 - UI**: React components, styling, responsive design
- **Agent 3 - Logic**: Exercise engine, answer validation, feedback system

All agents work in parallel with daily syncs coordinated by Technical Lead.

---

## 📝 Next Steps

1. ✅ Review this MVP spec (YOU ARE HERE)
2. ⏳ Read `TECHNICAL_DESIGN.md` for implementation details
3. ⏳ Review `DATA_SCHEMA.md` for JSON structure
4. ⏳ Agents read their respective prompt files in `/AGENT_PROMPTS/`
5. ⏳ Technical Lead kicks off Week 1 work

---

## 📞 Questions or Clarifications?

Contact: Project Owner (beano)

**Document Version**: 1.0.0
**Last Updated**: 2026-01-16
**Status**: Ready for Development
