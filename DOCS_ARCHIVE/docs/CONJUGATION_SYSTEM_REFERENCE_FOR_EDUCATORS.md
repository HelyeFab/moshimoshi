# Japanese Conjugation System - Educator's Reference Guide

**Last Updated**: 2025-01-10
**Purpose**: Technical reference for creating user-friendly conjugation explanations
**Audience**: Japanese language educators and content writers

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Word Type Classification](#word-type-classification)
3. [Verb Types](#verb-types)
4. [Adjective Types](#adjective-types)
5. [Conjugation Forms by Category](#conjugation-forms-by-category)
6. [Special Cases and Exceptions](#special-cases-and-exceptions)
7. [Display Organization](#display-organization)
8. [Example Conjugations](#example-conjugations)
9. [Pedagogical Notes](#pedagogical-notes)

---

## System Overview

Our conjugation system generates **100+ different forms** for Japanese verbs and adjectives. The system is organized into:

- **3 Verb Types**: Ichidan (ru-verbs), Godan (u-verbs), Irregular
- **2 Adjective Types**: i-adjectives, na-adjectives
- **18 Form Categories**: From basic forms to advanced grammatical constructions

### How It Works

1. **Word Type Detection**: System analyzes the word to determine if it's Godan, Ichidan, etc.
2. **Form Generation**: Creates all applicable conjugation forms
3. **Display Grouping**: Organizes forms into learner-friendly categories
4. **Progressive Disclosure**: Shows basic forms first, advanced forms can be expanded

---

## Word Type Classification

### Detection Methods

The system uses three methods to identify word types (in priority order):

1. **JMDict POS Tags** (Most Reliable)
   - Professional dictionary part-of-speech tags
   - Examples: `v5u` (Godan う), `v1` (Ichidan), `adj-i` (i-adjective)

2. **Pattern Recognition** (Fallback)
   - Analyzes word endings (る, う, く, す, etc.)
   - Uses linguistic patterns (e.g., e-sound + る → likely Ichidan)

3. **Context Enhancement** (Additional)
   - Uses word meaning to improve confidence
   - Helps with ambiguous cases

### Confidence Levels

- **High**: Dictionary confirmed or clear pattern match
- **Medium**: Pattern match with some ambiguity
- **Low**: Uncertain, may need manual verification

---

## Verb Types

### 1. Ichidan Verbs (一段動詞) - "ru-verbs"

**Identification**: Ends in る with e-sound or i-sound before it

**Examples**:
- 食べる (taberu) - to eat
- 見る (miru) - to see
- 起きる (okiru) - to wake up
- 寝る (neru) - to sleep

**Stem Formation**: Remove final る
- 食べる → 食べ (stem)
- 見る → 見 (stem)

**Number of Forms Generated**: 95+ forms

---

### 2. Godan Verbs (五段動詞) - "u-verbs"

**Identification**: Ends in one of 9 possible consonants + う sound

**The 9 Endings**:

| Ending | Reading | Example | Meaning |
|--------|---------|---------|---------|
| う | u | 買う (kau) | to buy |
| く | ku | 書く (kaku) | to write |
| ぐ | gu | 泳ぐ (oyogu) | to swim |
| す | su | 話す (hanasu) | to speak |
| つ | tsu | 待つ (matsu) | to wait |
| ぬ | nu | 死ぬ (shinu) | to die |
| ぶ | bu | 遊ぶ (asobu) | to play |
| む | mu | 飲む (nomu) | to drink |
| る | ru | 帰る (kaeru) | to return |

**Important**: Not all る-ending verbs are Ichidan! Words like 帰る, 切る, 知る are Godan.

**Stem Formation**: Complex, changes based on conjugation
- a-stem (あ段): 買わない (negative)
- i-stem (い段): 買います (polite)
- u-stem (う段): 買う (dictionary form)
- e-stem (え段): 買える (potential)
- o-stem (お段): 買おう (volitional)

**Number of Forms Generated**: 95+ forms

**Special Pattern Groups**:

1. **う・つ・る Group**: Past/te-form use って/った
   - 買う → 買った (past), 買って (te-form)
   - 待つ → 待った (past), 待って (te-form)
   - 帰る → 帰った (past), 帰って (te-form)

2. **く・ぐ Group**: Past/te-form use いて/いた or いで/いだ
   - 書く → 書いた (past), 書いて (te-form)
   - 泳ぐ → 泳いだ (past), 泳いで (te-form)

3. **す Group**: Past/te-form use した/して
   - 話す → 話した (past), 話して (te-form)

4. **ぬ・ぶ・む Group**: Past/te-form use んだ/んで
   - 死ぬ → 死んだ (past), 死んで (te-form)
   - 遊ぶ → 遊んだ (past), 遊んで (te-form)
   - 飲む → 飲んだ (past), 飲んで (te-form)

---

### 3. Irregular Verbs (不規則動詞)

Only **2 main irregular verbs** in Japanese (+ compounds):

#### する (suru) - "to do"

**Characteristics**:
- Completely unique conjugation patterns
- Forms countless compound verbs (勉強する, 運動する, etc.)

**Key Forms**:
- Present: する
- Past: した
- Negative: しない
- Te-form: して
- Potential: できる (special form!)

**Compound する Verbs**:
- 勉強する (benkyou suru) - to study
- 料理する (ryouri suru) - to cook
- 散歩する (sanpo suru) - to walk/stroll

The noun part stays unchanged: 勉強した, 料理しない, 散歩して

#### 来る (kuru) - "to come"

**Characteristics**:
- Uses special stems: 来 (ki), 来 (ko), 来 (ku)
- Cannot form compounds like する

**Key Forms**:
- Present: 来る (くる)
- Past: 来た (きた)
- Negative: 来ない (こない)
- Te-form: 来て (きて)
- Masu-form: 来ます (きます)
- Potential: 来られる (こられる)

**Number of Forms Generated**: 90+ forms each

---

## Adjective Types

### 1. I-Adjectives (い形容詞)

**Identification**: Ends in い (with rare exceptions)

**Examples**:
- 高い (takai) - expensive, tall
- 新しい (atarashii) - new
- 美しい (utsukushii) - beautiful
- 楽しい (tanoshii) - fun

**Stem Formation**: Remove final い
- 高い → 高 (stem)
- For conjugations, often use く (adverbial) stem: 高く

**Key Conjugation Pattern**:
```
Present:   高い
Past:      高かった  (stem + かった)
Negative:  高くない  (stem + くない)
Past Neg:  高くなかった  (stem + くなかった)
Te-form:   高くて  (stem + くて)
```

**Number of Forms Generated**: ~25 forms

**Special Cases**:
- いい (ii)/良い (yoi) - "good"
  - Uses よ stem for all conjugations except dictionary form
  - Present: いい
  - Past: よかった (NOT いかった)
  - Negative: よくない (NOT いくない)

---

### 2. Na-Adjectives (な形容詞)

**Identification**: Requires な when modifying nouns directly

**Examples**:
- 綺麗（な）(kirei na) - pretty, clean
- 静か（な）(shizuka na) - quiet
- 便利（な）(benri na) - convenient
- 好き（な）(suki na) - likeable

**Conjugation Pattern**: Uses だ copula
```
Present:   綺麗だ
Past:      綺麗だった
Negative:  綺麗じゃない (or 綺麗ではない)
Past Neg:  綺麗じゃなかった
Te-form:   綺麗で
```

**Number of Forms Generated**: ~20 forms

**Note**: Na-adjectives conjugate like nouns with だ/です

---

## Conjugation Forms by Category

### Category 1: Stems (語幹)

These are the building blocks for other forms.

| Form | Japanese | Purpose | Example (買う) |
|------|----------|---------|----------------|
| Masu Stem | ます形の語幹 | Base for polite forms | 買い |
| Negative Stem | 否定形の語幹 | Base for negative forms | 買わ |
| Te-form | て形 | Connects sentences, requests | 買って |
| Negative Te-form | 否定て形 | Negative connections | 買わなくて |
| Adverbial Negative | 副詞的否定形 | Modifies other verbs | 買わなく |

**Teaching Note**: Stems are fundamental but advanced. Beginners may not need explicit stem terminology.

---

### Category 2: Plain Forms (普通形)

Basic conversational forms, casual speech.

| Form | Japanese | Usage | Example (食べる) | Example (買う) |
|------|----------|-------|------------------|----------------|
| Present | 現在形 | Dictionary form, casual present | 食べる | 買う |
| Past | 過去形 | Casual past | 食べた | 買った |
| Negative | 否定形 | Casual negative | 食べない | 買わない |
| Past Negative | 過去否定形 | Casual past negative | 食べなかった | 買わなかった |
| Presumptive | 意向形 | "Let's..." suggestion | 食べよう | 買おう |

**Teaching Note**: Start here for beginners. These are the most common forms.

---

### Category 3: Polite Forms (丁寧形)

Formal speech, using ます/です.

| Form | Japanese | Usage | Example (食べる) | Example (買う) |
|------|----------|-------|------------------|----------------|
| Polite | 丁寧形現在 | です/ます form | 食べます | 買います |
| Polite Past | 丁寧形過去 | Polite past | 食べました | 買いました |
| Polite Negative | 丁寧形否定 | Polite negative | 食べません | 買いません |
| Polite Past Negative | 丁寧形過去否定 | Polite past negative | 食べませんでした | 買いませんでした |
| Polite Volitional | 丁寧意向形 | Polite "let's" | 食べましょう | 買いましょう |

**Teaching Note**: Essential for N5/N4 learners. These are the first "polite" forms students learn.

---

### Category 4: Tai Form (たい形) - Desiderative

Expresses desire: "want to..."

| Form | Usage | Example (食べる) | Example (買う) |
|------|-------|------------------|----------------|
| Want to (Present) | I want to | 食べたい | 買いたい |
| Want to (Negative) | I don't want to | 食べたくない | 買いたくない |
| Want to (Past) | I wanted to | 食べたかった | 買いたかった |
| Want to (Past Negative) | I didn't want to | 食べたくなかった | 買いたくなかった |

**Teaching Note**: Tai-form conjugates like an i-adjective after forming.
**System Generates**: 13 forms total (includes conditional, te-form, etc.)

---

### Category 5: Imperative Forms (命令形)

Commands and orders.

| Form | Politeness | Example (食べる) | Example (買う) |
|------|-----------|------------------|----------------|
| Plain Command | Casual/blunt | 食べろ | 買え |
| Polite Command | Polite request | 食べなさい | 買いなさい |
| Negative Command | "Don't..." | 食べるな | 買うな |

**Teaching Note**: Use with caution. Explain cultural context (plain form is very direct/rude).

---

### Category 6: Conditional Forms (条件形)

"If..." conditions.

#### Provisional (ば形)

Hypothetical conditions.

| Form | Usage | Example (食べる) | Example (買う) |
|------|-------|------------------|----------------|
| Provisional | If... (hypothetical) | 食べれば | 買えば |
| Provisional Negative | If not... | 食べなければ | 買わなければ |
| Provisional Negative (Short) | If not... (casual) | 食べなきゃ | 買わなきゃ |

#### Conditional (たら形)

General/temporal conditions.

| Form | Usage | Example (食べる) | Example (買う) |
|------|-------|------------------|----------------|
| Conditional | If/when... | 食べたら | 買ったら |
| Conditional Negative | If/when not... | 食べなかったら | 買わなかったら |

**Teaching Note**: ば vs たら is subtle. ば = hypothetical focus, たら = temporal/general.

---

### Category 7: Potential Form (可能形)

Expresses ability: "can do"

**System Generates**: Full conjugation set (7 plain + 4 polite forms = 11 forms)

| Form | Example (食べる) | Example (買う) |
|------|------------------|----------------|
| Can (Present) | 食べられる | 買える |
| Can't (Present) | 食べられない | 買えない |
| Could (Past) | 食べられた | 買えた |
| Couldn't (Past) | 食べられなかった | 買えなかった |
| Can (Polite) | 食べられます | 買えます |

**Teaching Note**:
- Ichidan: Add られる (食べる → 食べられる)
- Godan: Change to e-stem + る (買う → 買える)
- Casual speech often drops ら: 食べれる (called ら抜き言葉)

---

### Category 8: Passive Form (受身形)

Someone/something receives action.

**System Generates**: Full conjugation set (7 plain + 4 polite forms = 11 forms)

| Form | Example (食べる) | Example (買う) |
|------|------------------|----------------|
| Passive (Present) | 食べられる | 買われる |
| Passive (Negative) | 食べられない | 買われない |
| Passive (Past) | 食べられた | 買われた |
| Passive (Polite) | 食べられます | 買われます |

**Teaching Note**:
- Direct passive: 私は先生に褒められた (I was praised by teacher)
- Adversative passive: 雨に降られた (I suffered from rain falling)

---

### Category 9: Causative Form (使役形)

"Make/let someone do"

**System Generates**: Full conjugation set (7 plain + 4 polite forms = 11 forms)

| Form | Example (食べる) | Example (買う) |
|------|------------------|----------------|
| Causative (Present) | 食べさせる | 買わせる |
| Causative (Negative) | 食べさせない | 買わせない |
| Causative (Past) | 食べさせた | 買わせた |
| Causative (Polite) | 食べさせます | 買わせます |

**Teaching Note**:
- Can mean "make someone do" (forceful)
- Can mean "let someone do" (permissive)
- Context determines meaning

---

### Category 10: Causative-Passive Form (使役受身形)

"Be made to do" - combination of causative + passive

**System Generates**: Full conjugation set (7 plain + 4 polite forms = 11 forms)

| Form | Example (食べる) | Example (買う) |
|------|------------------|----------------|
| Causative-Passive | 食べさせられる | 買わせられる |
| Causative-Passive Negative | 食べさせられない | 買わせられない |
| Causative-Passive Past | 食べさせられた | 買わせられた |

**Teaching Note**: Advanced form. Expresses unwilling obligation.
Example: 野菜を食べさせられた (I was made to eat vegetables)

---

### Category 11: Progressive Form (進行形)

Ongoing/continuous action: "is doing"

**System Generates**: 8 forms (present, past, negative combinations + polite)

| Form | Example (食べる) | Example (買う) |
|------|------------------|----------------|
| Progressive (Present) | 食べている | 買っている |
| Progressive (Negative) | 食べていない | 買っていない |
| Progressive (Past) | 食べていた | 買っていた |
| Progressive (Polite) | 食べています | 買っています |

**Teaching Note**: Formed by て-form + いる
Can also mean state/result depending on verb type.

---

### Category 12: Special Negative Forms

Classical and colloquial variants.

| Form | Japanese | Example (買う) | Notes |
|------|----------|----------------|-------|
| Colloquial Negative | 口語否定形 | 買わん | Casual, masculine |
| Formal Negative | 文語否定形 | 買わず | Literary, formal writing |
| Classical Negative (ぬ) | 古語否定形 | 買わぬ | Classical Japanese |
| Classical Negative (ざる) | 古語否定形 | 買わざる | Classical modifier |

**Teaching Note**: These are for advanced students or classical text reading.

---

## Special Cases and Exceptions

### 1. 行く (iku) - "to go"

**Special Exception**: Te-form and past use って/った (not いて/いた)

```
Expected (wrong):  行いて、行いた
Actual (correct):  行って、行った
```

**Why**: Historical phonological change. This is the ONLY く-verb with this pattern.

**System Handling**: Hardcoded special case check for 行く

---

### 2. いい/良い (ii/yoi) - "good"

**Special Exception**: Uses よ stem for all conjugations except dictionary form.

```
Dictionary form:  いい / 良い
Past:            よかった  (NOT いかった)
Negative:        よくない  (NOT いくない)
Te-form:         よくて    (NOT いくて)
```

**Why**: いい is colloquial contraction of よい. Conjugations preserve original stem.

**System Handling**: Checks for いい/良い and uses よ stem automatically.

---

### 3. ある (aru) - "to exist (inanimate)"

**Special Exception**: No progressive form (ている form doesn't exist)

**Why**: State verbs don't have progressive aspect in Japanese.

**System Handling**: Generates the form but it's not used in practice.

---

### 4. Compound する Verbs

**Pattern**: Noun + する

Examples:
- 勉強する (study), 料理する (cook), 掃除する (clean)

**Conjugation**: The noun stays constant, only する conjugates

```
勉強する → 勉強した (past)
勉強する → 勉強しない (negative)
勉強する → 勉強して (te-form)
```

**Potential Form Special**: Can become "noun + できる"
```
勉強する → 勉強できる (can study)
```

**System Handling**: Detects compounds, separates noun from する for conjugation.

---

### 5. Polite Requests vs Commands

**Different Forms**:
- ～てください (polite request): 食べてください
- ～なさい (polite command): 食べなさい
- Plain command: 食べろ (very direct)
- Negative command: 食べるな (prohibition)

**System Generates**: Both commands and request forms separately.

---

## Display Organization

### How Forms Are Grouped in the UI

Our system organizes 100+ forms into **18 collapsible categories** for progressive disclosure:

#### **Always Expanded** (Core forms - shown by default):

1. **Stems** - Building blocks
2. **Plain Form** - Basic conversational
3. **Polite Form** - Formal speech
4. **Provisional Form** - ば conditionals
5. **Conditional Form** - たら conditionals

#### **Collapsible** (Advanced forms - hidden by default):

6. **Tai Form** (13 forms) - Want to...
7. **Imperative Forms** (2 forms) - Commands
8. **Alternative Form** (1 form) - たり form
9. **Potential Plain Form** (7 forms) - Can do
10. **Potential Polite Form** (4 forms) - Can do (polite)
11. **Passive Plain Form** (7 forms) - Receive action
12. **Passive Polite Form** (4 forms) - Receive action (polite)
13. **Causative Plain Form** (7 forms) - Make/let do
14. **Causative Polite Form** (4 forms) - Make/let do (polite)
15. **Causative Passive Plain Form** (7 forms) - Be made to do
16. **Causative Passive Polite Form** (4 forms) - Be made to do (polite)
17. **Colloquial Form** (1 form) - Casual negative
18. **Formal/Classical Forms** (3 forms) - Literary

### Adjective Organization (Simplified)

**Always Expanded**:
1. **Basic Forms** - Present, past, negative, te-form
2. **Polite Forms** - です forms
3. **Conditional Forms** - ば and たら

**Collapsible**:
4. **Presumptive Forms** - Probably... (だろう)

---

## Example Conjugations

### Complete Example: 食べる (taberu) - Ichidan Verb

```
STEMS:
├─ Masu stem: 食べ
├─ Negative stem: 食べ
├─ Te-form: 食べて
├─ Negative te-form: 食べなくて
└─ Adverbial negative: 食べなく

PLAIN FORM:
├─ Present: 食べる
├─ Past: 食べた
├─ Negative: 食べない
├─ Past negative: 食べなかった
└─ Presumptive: 食べよう

POLITE FORM:
├─ Polite: 食べます
├─ Polite past: 食べました
├─ Polite negative: 食べません
├─ Polite past negative: 食べませんでした
└─ Polite volitional: 食べましょう

TAI FORM (Want to...):
├─ Want to: 食べたい
├─ Don't want to: 食べたくない
├─ Wanted to: 食べたかった
├─ Didn't want to: 食べたくなかった
├─ Te-form: 食べたくて
└─ [+ 8 more conditional/polite forms]

POTENTIAL (Can...):
├─ Can eat: 食べられる
├─ Can't eat: 食べられない
├─ Could eat: 食べられた
├─ Couldn't eat: 食べられなかった
└─ [+ 7 more forms]

PASSIVE (Be eaten):
├─ Is eaten: 食べられる
├─ Isn't eaten: 食べられない
└─ [+ 9 more forms]

CAUSATIVE (Make/let eat):
├─ Make eat: 食べさせる
├─ Don't make eat: 食べさせない
└─ [+ 9 more forms]

PROGRESSIVE (Eating):
├─ Is eating: 食べている
├─ Isn't eating: 食べていない
├─ Was eating: 食べていた
└─ [+ 5 more forms]

[+ Additional advanced forms...]
```

**Total for 食べる**: 95 forms generated

---

### Complete Example: 買う (kau) - Godan Verb

```
STEMS:
├─ Masu stem: 買い
├─ Negative stem: 買わ
├─ Te-form: 買って ← Note: っ sound
├─ Negative te-form: 買わなくて
└─ Adverbial negative: 買わなく

PLAIN FORM:
├─ Present: 買う
├─ Past: 買った ← Note: っ sound
├─ Negative: 買わない
├─ Past negative: 買わなかった
└─ Presumptive: 買おう

POLITE FORM:
├─ Polite: 買います
├─ Polite past: 買いました
├─ Polite negative: 買いません
├─ Polite past negative: 買いませんでした
└─ Polite volitional: 買いましょう

POTENTIAL (Can...):
├─ Can buy: 買える ← Different from Ichidan!
├─ Can't buy: 買えない
└─ [+ 9 more forms]

[Rest follows same structure as Ichidan...]
```

**Total for 買う**: 95 forms generated

**Key Difference**: Godan potential is 買える (e-stem + る), not 買われる

---

### Complete Example: する (suru) - Irregular Verb

```
BASIC FORMS:
├─ Present: する
├─ Past: した
├─ Negative: しない
├─ Past negative: しなかった
├─ Te-form: して

POLITE FORMS:
├─ Polite: します
├─ Polite past: しました
├─ Polite negative: しません
└─ Polite past negative: しませんでした

POTENTIAL (Special!):
├─ Can do: できる ← Completely different word!
├─ Can't do: できない
└─ [Conjugates as Ichidan from here]

PASSIVE:
├─ Is done: される
└─ [Conjugates as Ichidan]

CAUSATIVE:
├─ Make do: させる
└─ [Conjugates as Ichidan]

[All derived forms conjugate as Ichidan verbs]
```

**Special Note**: する's potential form is the completely different verb できる, not ～できる.

---

### Complete Example: 高い (takai) - I-Adjective

```
BASIC FORMS:
├─ Present: 高い
├─ Past: 高かった ← Stem + かった
├─ Negative: 高くない ← Stem + くない
├─ Past negative: 高くなかった
├─ Te-form: 高くて ← Stem + くて
└─ Negative te-form: 高くなくて

POLITE FORMS:
├─ Polite: 高いです
├─ Polite past: 高かったです
├─ Polite negative: 高くないです
└─ Polite past negative: 高くなかったです

CONDITIONAL FORMS:
├─ Provisional: 高ければ ← Stem + ければ
├─ Provisional negative: 高くなければ
├─ Conditional: 高かったら ← Past + ら
└─ Conditional negative: 高くなかったら

PRESUMPTIVE FORMS:
├─ Presumptive: 高いだろう
├─ Presumptive negative: 高くないだろう
└─ [Polite versions with でしょう]

ADVERBIAL FORM:
└─ Adverbial: 高く ← Used to modify verbs
```

**Total for 高い**: 25 forms generated

**Teaching Note**: Much simpler than verbs. Focus on く-stem transformations.

---

### Complete Example: 綺麗 (kirei) - Na-Adjective

```
BASIC FORMS:
├─ Present: 綺麗だ
├─ Past: 綺麗だった
├─ Negative: 綺麗じゃない (or 綺麗ではない)
├─ Past negative: 綺麗じゃなかった
└─ Te-form: 綺麗で

POLITE FORMS:
├─ Polite: 綺麗です
├─ Polite past: 綺麗でした
├─ Polite negative: 綺麗じゃありません
└─ Polite past negative: 綺麗じゃありませんでした

CONDITIONAL FORMS:
├─ Conditional: 綺麗だったら
├─ Conditional negative: 綺麗じゃなかったら
└─ [Similar to noun + だ conjugation]
```

**Total for 綺麗**: 20 forms generated

**Teaching Note**: Na-adjectives conjugate like nouns with だ/です copula.

---

## Pedagogical Notes

### Suggested Teaching Order

#### Beginner (N5-N4):
1. **Start with Polite Forms** (ます/です)
   - Easier for absolute beginners
   - More practical in real conversations
   - Less exceptions to explain

2. **Introduce Plain Forms** (dictionary form, た, ない)
   - After students comfortable with polite
   - Needed for many grammar patterns

3. **Add Te-Form**
   - Essential connector
   - Needed for ~ている, ~てください, etc.

4. **Basic Conditionals** (たら first, then ば)

5. **Tai-Form** (want to...)
   - Motivating for students (personal desires)
   - Conjugates like i-adjective (reinforcement)

#### Intermediate (N3-N2):
6. **Potential Form** (can do)
7. **Passive Form** (is done)
8. **Causative Form** (make/let do)
9. **Volitional Form** (let's do)
10. **Alternative conditionals** (ば vs たら vs と vs なら)

#### Advanced (N2-N1):
11. **Causative-Passive** (be made to do)
12. **Classical forms** (literary Japanese)
13. **Regional/dialectal variants**
14. **Formal written forms**

---

### Common Student Confusion Points

#### 1. **Potential vs Passive for Ichidan Verbs**
Both are 食べられる - context determines meaning:
- Potential: 私は魚が食べられる (I can eat fish)
- Passive: 魚が猫に食べられた (Fish was eaten by cat)

**Teaching Tip**: Show particle usage (が for potential, に for passive agent)

---

#### 2. **Ichidan vs Godan る-verbs**

| Word | Reading | Type | Why |
|------|---------|------|-----|
| 食べる | taberu | Ichidan | e-sound before る |
| 見る | miru | Ichidan | i-sound before る |
| 帰る | kaeru | Godan | a-sound before る |
| 走る | hashiru | Godan | i-sound but not e/i-column |
| 切る | kiru | Godan | i-sound but irregular (exception) |

**Teaching Tip**:
- If verb has kanji + る: probably Godan
- If verb is hiragana + る with e/i before it: probably Ichidan
- Memorize common exceptions: 帰る, 走る, 切る, 知る, 入る

---

#### 3. **When to Use ば vs たら**

**ば (Provisional)**:
- Hypothetical conditions
- General truths
- "If/when [condition], then [result]"
- Example: 春になれば、花が咲く (When spring comes, flowers bloom)

**たら (Conditional)**:
- Specific one-time events
- Sequential actions
- "After/when [action], then [result]"
- Example: 家に帰ったら、電話してね (When you get home, call me)

**Teaching Tip**: For beginners, start with たら (more versatile).

---

#### 4. **Causative Meaning: Make vs Let**

Same form 食べさせる can mean:
- **Make**: 母は私に野菜を食べさせた (Mother made me eat vegetables) - forceful
- **Let**: 子供に好きなものを食べさせた (Let child eat what they like) - permissive

**Teaching Tip**: Context and particles (に vs を) help determine meaning.

---

#### 5. **Progressive vs Result State**

~ている has two meanings:

**Progressive** (Action verbs):
- 食べている (is eating - ongoing action)
- 走っている (is running - ongoing action)

**Result State** (Change-of-state verbs):
- 知っている (knows - result of learning)
- 住んでいる (lives - result of moving there)
- 持っている (has - result of obtaining)

**Teaching Tip**: Explain verb types. Change-of-state verbs focus on resulting state.

---

### Cultural Context to Include

1. **Politeness Levels Matter**
   - Plain form with strangers = rude
   - Polite form with close friends = distant
   - Explain situational usage

2. **Commands are Strong**
   - ～なさい: parent to child, teacher to student
   - Plain command: very direct, can be rude
   - Prefer ~てください for requests

3. **Written vs Spoken**
   - Some forms only in books (formal negatives)
   - Colloquial forms vary by region
   - Classical forms for historical texts

4. **Gender Differences** (Decreasing)
   - Colloquial わん/へん: masculine/casual
   - Modern: gender-neutral speech increasing
   - Don't overemphasize outdated stereotypes

---

### Useful Mnemonics for Students

1. **Godan Endings**: "Uk-Gu-Su-Tsu-Nu-Bu-Mu-Ru (plus U at the start)"

2. **Te-form Groups**:
   - "Small tsu-boys": う・つ・る → って/った
   - "Knee-bend boys": ぬ・ぶ・む → んで/んだ
   - "Write-swim boys": く・ぐ → いて/いだ
   - "Talk boy": す → して/した

3. **Potential Formation**:
   - Ichidan: "Add られる" (like becoming able to be eaten)
   - Godan: "Change to e-line and add る" (a-i-u-e-o → e!)

4. **いい Exception**: "Good is good, but better is よかった" (よ-stem memory)

---

### Assessment Ideas

#### Beginner:
- Fill in the blank: ___ます form → plain form
- Multiple choice: Is this Godan or Ichidan?
- Conjugation drill: Change to te-form

#### Intermediate:
- Sentence transformation: Positive → negative, plain → polite
- Error correction: Find wrong conjugation
- Context selection: Choose appropriate form for situation

#### Advanced:
- Natural production: Write paragraph using various forms
- Nuance distinction: Explain difference between similar forms
- Reading comprehension: Identify forms in authentic texts

---

### Example User-Facing Explanations (Templates)

#### Template 1: "What is...?" Format

**Example: What is Te-Form?**

> Te-form (て形) is one of the most useful conjugations in Japanese! Think of it as the "connector form" - it's like saying "and then" or "and" between actions.
>
> **You'll use te-form for:**
> - Connecting actions: 朝起きて、シャワーを浴びます (Wake up AND THEN take a shower)
> - Making requests: 食べてください (Please eat)
> - Ongoing actions: 食べています (Am eating)
> - Many grammar patterns: ~てもいい, ~てはいけない, ~ている
>
> **How to form it:**
> - Ichidan verbs (ru-verbs): Drop る, add て
>   - 食べる → 食べて
> - Godan verbs (u-verbs): Depends on ending! [Link to detailed guide]
> - Irregular verbs: Memorize these special cases
>   - する → して
>   - 来る → 来て (きて)

---

#### Template 2: "How do I...?" Format

**Example: How do I say "I want to..." in Japanese?**

> Use the tai-form (たい形)! It's super easy and works just like an i-adjective.
>
> **Formation:**
> 1. Start with the masu-stem (the part before ます)
> 2. Add たい
>
> **Examples:**
> - 食べる → 食べ + たい = 食べたい (want to eat)
> - 買う → 買い + たい = 買いたい (want to buy)
> - する → し + たい = したい (want to do)
>
> **Conjugation:** (works like any i-adjective!)
> - Present: 食べたい (want to eat)
> - Negative: 食べたくない (don't want to eat)
> - Past: 食べたかった (wanted to eat)
> - Polite: 食べたいです (want to eat - polite)
>
> **Usage tip:** This is about YOUR desires. For offering things to others, use different patterns!

---

#### Template 3: "Common Mistakes" Format

**Example: Potential vs Passive - Don't Mix Them Up!**

> For Ichidan verbs, potential and passive look identical: 食べられる
>
> **How to tell them apart:**
>
> **Potential (Can eat):**
> - Particle: が (marks what you CAN do)
> - Example: 私は魚が食べられる (I can eat fish)
> - Focus: Your ability
>
> **Passive (Is eaten):**
> - Particle: に (marks who DOES the action)
> - Example: 魚が猫に食べられた (Fish was eaten by the cat)
> - Focus: What happens to the subject
>
> **Quick tip:** If you see ～が～られる, it's probably potential. If you see ～に～られる, it's probably passive!

---

## Technical Implementation Notes

### For Reference Only (Not for User Documentation)

**Word Type Detection**:
- File: `src/lib/conjugation/wordTypeDetector.ts`
- Uses JMDict POS tags + pattern recognition + context
- Confidence scoring: high/medium/low

**Conjugation Engine**:
- File: `src/lib/conjugation/engine.ts`
- Class: `ExtendedConjugationEngine`
- Method: `ExtendedConjugationEngine.conjugate(word)`
- Returns: `ExtendedConjugationForms` object with 100+ properties

**Display Structure**:
- File: `src/lib/conjugation/display-structure.ts`
- Defines 18 collapsible categories
- Controls default expanded/collapsed state

**Caching**:
- Results are cached automatically
- Same word called twice returns cached result
- Improves performance by 50-90%

**Validation**:
- Engine validates input before processing
- Returns empty forms for non-conjugatable words
- Logs warnings for debugging

---

## Appendix: Form Name Reference

### Japanese Terms

| English | Japanese | Romaji |
|---------|----------|--------|
| Dictionary form | 辞書形 | jisho-kei |
| Masu-form | ます形 | masu-kei |
| Te-form | て形 | te-kei |
| Ta-form | た形 | ta-kei |
| Nai-form | ない形 | nai-kei |
| Potential form | 可能形 | kanou-kei |
| Passive form | 受身形 | ukemi-kei |
| Causative form | 使役形 | shieki-kei |
| Imperative form | 命令形 | meirei-kei |
| Volitional form | 意向形 | ikou-kei |
| Conditional form | 条件形 | jouken-kei |
| Provisional form | 仮定形 | katei-kei |

---

## Questions for Content Creation

When writing user-facing explanations, consider:

1. **Audience Level**: Is this N5 beginner or N1 advanced?
2. **Learning Goal**: Quick reference or deep understanding?
3. **Use Case**: Conversation, reading, exam prep?
4. **Cognitive Load**: How many forms to introduce at once?
5. **Practice Opportunity**: Where can they practice this?
6. **Common Errors**: What mistakes should we warn about?
7. **Cultural Context**: Any social implications?
8. **Motivation**: Why does this matter to the learner?

---

## Summary for Quick Reference

**Total System Capabilities**:
- **3 Verb Types**: Ichidan, Godan, Irregular
- **2 Adjective Types**: I-adjective, Na-adjective
- **95+ Verb Forms**: Per conjugatable verb
- **25 I-Adjective Forms**: Per i-adjective
- **20 Na-Adjective Forms**: Per na-adjective
- **18 Display Categories**: Organized for progressive learning
- **Special Cases**: 行く (iku), いい (ii), する/来る compounds
- **Performance**: Cached results, instant conjugation

**Recommended Teaching Progression**:
1. Polite forms (ます/です) → Foundation
2. Plain forms → Necessary for grammar
3. Te-form → Essential connector
4. Tai-form → Student motivation
5. Conditionals → Practical communication
6. Potential → Expressing ability
7. Passive/Causative → Advanced grammar
8. Classical/Formal → Academic reading

---

**End of Reference Document**

Last Updated: 2025-01-10
For technical questions: Refer to source code in `/src/lib/conjugation/`
For pedagogical questions: Use this document as foundation for user-friendly content

