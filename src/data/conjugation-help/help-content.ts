/**
 * Conjugation Help Content Library
 *
 * This file contains all help content for the smart bubble help system.
 * Content is organized by category and includes triggers for smart error detection.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface HelpExample {
  japanese: string;
  romaji?: string;
  translation?: string;
}

export interface HelpTriggers {
  /** Which conjugation forms this help applies to (e.g., 'past', 'negative', 'te-form') */
  formTypes: string[];

  /** Which word types this help applies to (e.g., 'Ichidan', 'Godan', 'i-adjective') */
  wordTypes: string[];

  /** Regex patterns for detecting specific errors that should trigger this help */
  errorPatterns?: string[];
}

export interface HelpContent {
  /** Unique identifier for this help content */
  id: string;

  /** Category for organization and filtering */
  category: 'verb-type' | 'form' | 'tense' | 'politeness' | 'meaning' | 'conditional' | 'special-case' | 'mnemonic';

  /** Emoji to display with this help */
  emoji: string;

  /** Short title for the help topic */
  title: string;

  /** Brief tooltip text (shows on hover) */
  tooltip: string;

  /** Full explanation (shows in modal) */
  explanation: string;

  /** Example sentences demonstrating the concept */
  examples: HelpExample[];

  /** Optional tip or mnemonic */
  tip?: string;

  /** Triggers that determine when this help is relevant */
  triggers: HelpTriggers;
}

// ============================================================================
// HELP CONTENT LIBRARY
// ============================================================================

export const HELP_CONTENT: HelpContent[] = [
  // -------------------------------------------------------------------------
  // VERB TYPES
  // -------------------------------------------------------------------------
  {
    id: 'ichidan-verbs',
    category: 'verb-type',
    emoji: '💧',
    title: 'Ichidan Verbs (る-verbs)',
    tooltip: 'Easy ones! Just drop る to conjugate.',
    explanation: `Ichidan verbs are the simplest to conjugate. They're sometimes called "る-verbs" because they typically end with る.

**How to identify them:**
- Usually end with える or いる sounds (e.g., 食べる, 見る, 寝る)
- The る is always preceded by an え or い sound in hiragana

**How to conjugate:**
Simply remove the る and add your desired ending!

Examples:
- 食べる → 食べ + ます = 食べます
- 食べる → 食べ + た = 食べた
- 食べる → 食べ + ない = 食べない`,
    examples: [
      { japanese: '食べる', romaji: 'taberu', translation: 'to eat' },
      { japanese: '見る', romaji: 'miru', translation: 'to see' },
      { japanese: '寝る', romaji: 'neru', translation: 'to sleep' }
    ],
    tip: 'If you see える or いる at the end, it\'s probably Ichidan!',
    triggers: {
      formTypes: ['all'],
      wordTypes: ['Ichidan'],
      errorPatterns: [
        'える$',
        'いる$',
        '.*eる',
        '.*iる'
      ]
    }
  },

  {
    id: 'godan-verbs',
    category: 'verb-type',
    emoji: '🔺',
    title: 'Godan Verbs (う-verbs)',
    tooltip: 'Trickier ones — their endings change!',
    explanation: `Godan verbs are more complex because their stem ending changes depending on the conjugation. They're called "う-verbs" because they all end with a u-sound in dictionary form.

**How to identify them:**
- End with う, く, ぐ, す, つ, ぬ, ぶ, む, or る
- NOT preceded by え or い sounds (that would be Ichidan)

**The Godan Vowel Shift:**
The final syllable moves through the Japanese vowel row (a/i/u/e/o) depending on the form.

**Te-form and past tense special rules:**
- う・つ・る → って／った
- く・ぐ → いて／いだ
- ぬ・ぶ・む → んで／んだ
- す → して／した`,
    examples: [
      { japanese: '買う → 買わない、買います、買える', romaji: 'kau', translation: 'to buy' },
      { japanese: '書く → 書いて、書いた', romaji: 'kaku', translation: 'to write' },
      { japanese: '飲む → 飲んで、飲んだ', romaji: 'nomu', translation: 'to drink' }
    ],
    tip: 'Remember the vowel shift: a-i-u-e-o. The stem vowel changes!',
    triggers: {
      formTypes: ['all'],
      wordTypes: ['Godan'],
      errorPatterns: [
        '[うくぐすつぬぶむる]$'
      ]
    }
  },

  {
    id: 'irregular-verbs',
    category: 'verb-type',
    emoji: '⚡',
    title: 'Irregular Verbs',
    tooltip: 'Only two to remember! 🎉',
    explanation: `Great news! Japanese only has TWO truly irregular verbs. You just need to memorize their forms.

**する (suru) - to do:**
- Present: する
- Past: した
- Negative: しない
- Potential: できる (can do)

**来る (kuru) - to come:**
- Present: 来る (くる)
- Past: 来た (きた)
- Negative: 来ない (こない)
- Polite: 来ます (きます)

**Bonus feature:**
する combines with nouns to make new verbs: 勉強する (study), 料理する (cook), etc.`,
    examples: [
      { japanese: 'する → した／しない', romaji: 'suru', translation: 'to do' },
      { japanese: '来る → 来た／来ない', romaji: 'kuru', translation: 'to come' },
      { japanese: '勉強する', romaji: 'benkyou suru', translation: 'to study' }
    ],
    tip: 'These are the ONLY irregular verbs. Memorize them and you\'re good!',
    triggers: {
      formTypes: ['all'],
      wordTypes: ['Irregular'],
      errorPatterns: [
        'する$',
        '来る$',
        'くる$'
      ]
    }
  },

  // -------------------------------------------------------------------------
  // ADJECTIVE TYPES
  // -------------------------------------------------------------------------
  {
    id: 'i-adjectives',
    category: 'verb-type',
    emoji: '🌿',
    title: 'い-Adjectives',
    tooltip: 'End in い and act like tiny verbs!',
    explanation: `い-adjectives end with い and can conjugate on their own, just like verbs!

**How to conjugate:**
Remove the final い and add the appropriate ending:
- Present: 高い (takai - expensive)
- Past: 高かった (takakatta - was expensive)
- Negative: 高くない (takunai - not expensive)
- Te-form: 高くて (takute - expensive and...)

**Special case - いい (good):**
いい is irregular! It uses よ instead of い:
- Past: よかった (NOT いかった!)
- Negative: よくない
- Te-form: よくて`,
    examples: [
      { japanese: '高い → 高かった／高くない', romaji: 'takai', translation: 'expensive' },
      { japanese: '面白い → 面白かった', romaji: 'omoshiroi', translation: 'interesting' },
      { japanese: 'いい → よかった／よくない', romaji: 'ii', translation: 'good' }
    ],
    tip: 'Think of い-adjectives as "living words" that change form like verbs!',
    triggers: {
      formTypes: ['present', 'past', 'negative', 'te-form'],
      wordTypes: ['i-adjective'],
      errorPatterns: [
        'い$',
        'いかった', // Common mistake with いい
      ]
    }
  },

  {
    id: 'na-adjectives',
    category: 'verb-type',
    emoji: '🌸',
    title: 'な-Adjectives',
    tooltip: 'Use な before nouns and だ／です to finish sentences.',
    explanation: `な-adjectives are actually more like nouns! They need helper words to function.

**Before nouns:**
Add な: 静かな部屋 (shizukana heya - quiet room)

**End of sentence:**
Use だ／です: 静かだ (shizuka da - it's quiet)

**Conjugation:**
Because they're noun-like, they conjugate using です:
- Present: 静かです (shizuka desu)
- Past: 静かでした (shizuka deshita)
- Negative: 静かじゃない (shizuka ja nai)
- Past negative: 静かじゃなかった`,
    examples: [
      { japanese: '静か → 静かです／静かじゃない', romaji: 'shizuka', translation: 'quiet' },
      { japanese: '綺麗な花', romaji: 'kireina hana', translation: 'beautiful flower' },
      { japanese: '元気だった', romaji: 'genki datta', translation: 'was healthy' }
    ],
    tip: 'な-adjectives behave like nouns + です. Think "noun-adjectives"!',
    triggers: {
      formTypes: ['present', 'past', 'negative', 'modifying'],
      wordTypes: ['na-adjective'],
      errorPatterns: [
        'だ$',
        'です$'
      ]
    }
  },

  // -------------------------------------------------------------------------
  // TENSES
  // -------------------------------------------------------------------------
  {
    id: 'present-tense',
    category: 'tense',
    emoji: '🔹',
    title: 'Present Tense (Dictionary Form)',
    tooltip: 'Used for general facts or habits.',
    explanation: `The present tense in Japanese is the dictionary form. It's used for:

**1. General facts:**
太陽は東から昇る (The sun rises from the east)

**2. Habitual actions:**
毎日コーヒーを飲む (I drink coffee every day)

**3. Future actions:**
明日行く (I'll go tomorrow)

Yes, Japanese uses the same form for present AND future! Context tells you which it means.`,
    examples: [
      { japanese: '食べる', romaji: 'taberu', translation: 'eat / will eat' },
      { japanese: '買う', romaji: 'kau', translation: 'buy / will buy' },
      { japanese: '高い', romaji: 'takai', translation: 'is expensive' }
    ],
    tip: 'Dictionary form = Present AND Future. Context is key!',
    triggers: {
      formTypes: ['present', 'dictionary'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'],
      errorPatterns: []
    }
  },

  {
    id: 'past-tense',
    category: 'tense',
    emoji: '🔹',
    title: 'Past Tense',
    tooltip: 'Used for completed actions.',
    explanation: `Past tense indicates actions or states that are completed.

**Key markers:**
- Verbs: た／だ sound at the end
- い-adjectives: かった ending
- な-adjectives: だった／でした

**Formation depends on verb type:**
- Ichidan: Drop る, add た (食べる → 食べた)
- Godan: Follows te-form rules (買う → 買った)
- Irregular: Memorize (する → した, 来る → 来た)`,
    examples: [
      { japanese: '食べた', romaji: 'tabeta', translation: 'ate' },
      { japanese: '買った', romaji: 'katta', translation: 'bought' },
      { japanese: '高かった', romaji: 'takakatta', translation: 'was expensive' }
    ],
    tip: 'Look for た／だ sounds — they usually mean past tense!',
    triggers: {
      formTypes: ['past', 'past-polite'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'],
      errorPatterns: [
        'た$',
        'だ$',
        'かった$'
      ]
    }
  },

  {
    id: 'negative',
    category: 'tense',
    emoji: '🔹',
    title: 'Negative Form',
    tooltip: 'Used to say "don\'t / not".',
    explanation: `The negative form expresses "not doing" or "not being."

**Formation:**
- Ichidan: Drop る, add ない (食べる → 食べない)
- Godan: Change to あ-row + ない (買う → 買わない)
- Irregular: する → しない, 来る → 来ない
- い-adjectives: Replace い with くない (高い → 高くない)
- な-adjectives: Add じゃない (静か → 静かじゃない)

**Past negative:**
Add かった to the negative: 食べなかった (didn't eat)`,
    examples: [
      { japanese: '食べない', romaji: 'tabenai', translation: 'don\'t eat' },
      { japanese: '買わない', romaji: 'kawanai', translation: 'don\'t buy' },
      { japanese: '食べなかった', romaji: 'tabenakatta', translation: 'didn\'t eat' }
    ],
    tip: 'ない is your negative marker. Add かった for past negative!',
    triggers: {
      formTypes: ['negative', 'negative-past', 'negative-polite'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'],
      errorPatterns: [
        'ない$',
        'なかった$'
      ]
    }
  },

  // -------------------------------------------------------------------------
  // POLITENESS LEVELS
  // -------------------------------------------------------------------------
  {
    id: 'polite-form',
    category: 'politeness',
    emoji: '🗣️',
    title: 'Polite Form (ます／です)',
    tooltip: 'Safe for all conversations!',
    explanation: `The ます form is your go-to polite verb form. It's safe in almost any situation.

**Formation:**
- Ichidan: Drop る, add ます (食べる → 食べます)
- Godan: Change to い-row, add ます (買う → 買います)
- Irregular: する → します, 来る → 来ます

**Other forms:**
- Past polite: 食べました
- Negative polite: 食べません
- Past negative polite: 食べませんでした

For adjectives, add です:
- 高いです (it's expensive - polite)
- 静かです (it's quiet - polite)`,
    examples: [
      { japanese: '食べます', romaji: 'tabemasu', translation: 'eat (polite)' },
      { japanese: '買います', romaji: 'kaimasu', translation: 'buy (polite)' },
      { japanese: '高いです', romaji: 'takai desu', translation: 'is expensive (polite)' }
    ],
    tip: 'ます form is perfect for N5 learners and making good first impressions!',
    triggers: {
      formTypes: ['polite', 'masu-stem', 'polite-past', 'polite-negative'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'],
      errorPatterns: [
        'ます$',
        'です$'
      ]
    }
  },

  {
    id: 'plain-form',
    category: 'politeness',
    emoji: '🧍‍♀️',
    title: 'Plain Form',
    tooltip: 'Casual! Use with friends or family.',
    explanation: `Plain form is used in casual conversations with friends, family, or people you're close to.

**When to use:**
- Talking to friends
- Family conversations
- Inner thoughts
- Subordinate clauses in sentences

**When NOT to use:**
- First meetings
- Professional settings
- Talking to strangers
- Anyone older or higher status (unless very close)

**Formation:**
Plain form is just the dictionary form plus conjugations without ます／です.`,
    examples: [
      { japanese: '食べる', romaji: 'taberu', translation: 'eat (casual)' },
      { japanese: '買う', romaji: 'kau', translation: 'buy (casual)' },
      { japanese: '高い', romaji: 'takai', translation: 'expensive (casual)' }
    ],
    tip: 'Be careful! Too direct with strangers can seem rude 👀',
    triggers: {
      formTypes: ['dictionary', 'plain', 'present', 'past', 'negative'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'],
      errorPatterns: []
    }
  },

  // -------------------------------------------------------------------------
  // MEANING FORMS
  // -------------------------------------------------------------------------
  {
    id: 'tai-form',
    category: 'meaning',
    emoji: '🍽️',
    title: 'Want to... (たい形)',
    tooltip: 'Easy! Use the stem + たい',
    explanation: `The たい form expresses wanting to do something. It's one of the most useful forms for beginners!

**Formation:**
Use the ます-stem (the part before ます) and add たい:
- 食べる → 食べます → 食べたい (want to eat)
- 買う → 買います → 買いたい (want to buy)
- する → します → したい (want to do)

**Important:**
The たい form behaves like an い-adjective! So you can conjugate it:
- 食べたくない (don't want to eat)
- 食べたかった (wanted to eat)
- 食べたくなかった (didn't want to eat)`,
    examples: [
      { japanese: '食べたい', romaji: 'tabetai', translation: 'want to eat' },
      { japanese: '買いたい', romaji: 'kaitai', translation: 'want to buy' },
      { japanese: '行きたくない', romaji: 'ikitakunai', translation: 'don\'t want to go' }
    ],
    tip: 'たい acts like an い-adjective. Conjugate it as such!',
    triggers: {
      formTypes: ['tai', 'tai-negative', 'tai-past'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular'],
      errorPatterns: [
        'たい$',
        'たくない$',
        'たかった$'
      ]
    }
  },

  {
    id: 'potential-form',
    category: 'meaning',
    emoji: '💪',
    title: 'Can... (Potential Form)',
    tooltip: 'Say what you *can* or *can\'t* do!',
    explanation: `The potential form expresses ability — what you CAN do.

**Formation:**
- Ichidan: Replace る with られる (食べる → 食べられる)
- Godan: Change to え-row + る (買う → 買える)
- Irregular: する → できる, 来る → 来られる

**Spoken shortcut:**
In casual speech, Ichidan often drops ら:
食べられる → 食べれる (called ら-deletion)

**Grammar note:**
The thing you can do takes を or が particle:
日本語が話せる / 日本語を話せる (can speak Japanese)`,
    examples: [
      { japanese: '食べられる', romaji: 'taberareru', translation: 'can eat' },
      { japanese: '買える', romaji: 'kaeru', translation: 'can buy' },
      { japanese: '食べれる', romaji: 'tabereru', translation: 'can eat (casual)' }
    ],
    tip: 'Casual speech often drops ら: 食べれる instead of 食べられる',
    triggers: {
      formTypes: ['potential', 'potential-negative', 'potential-polite'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular'],
      errorPatterns: [
        'られる$',
        'れる$',
        'える$',
        'できる'
      ]
    }
  },

  {
    id: 'passive-form',
    category: 'meaning',
    emoji: '☔',
    title: 'Passive Form',
    tooltip: 'When something happens *to you*',
    explanation: `The passive form expresses actions that happen TO the subject, rather than by the subject.

**Formation:**
- Ichidan: Replace る with られる (食べる → 食べられる)
- Godan: Change to あ-row + れる (買う → 買われる)
- Irregular: する → される, 来る → 来られる

**Note:** Ichidan passive and potential look the same (食べられる)! Context determines meaning.

**Usage:**
The doer is marked with に particle:
猫に魚が食べられた (The fish was eaten by the cat)`,
    examples: [
      { japanese: '食べられた', romaji: 'taberareta', translation: 'was eaten' },
      { japanese: '猫に魚が食べられた', romaji: 'neko ni sakana ga taberareta', translation: 'fish was eaten by cat' },
      { japanese: '褒められた', romaji: 'homerareta', translation: 'was praised' }
    ],
    tip: 'に shows who did the action in passive sentences!',
    triggers: {
      formTypes: ['passive', 'passive-past', 'passive-negative'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular'],
      errorPatterns: [
        'られる$',
        'れる$',
        'される$'
      ]
    }
  },

  {
    id: 'causative-form',
    category: 'meaning',
    emoji: '🎭',
    title: 'Causative Form',
    tooltip: '"Make / let someone do"',
    explanation: `The causative form expresses making or letting someone do something.

**Formation:**
- Ichidan: Replace る with させる (食べる → 食べさせる)
- Godan: Change to あ-row + せる (買う → 買わせる)
- Irregular: する → させる, 来る → 来させる

**Two meanings:**
1. Make someone do: 母は私に野菜を食べさせた (Mom made me eat vegetables)
2. Let someone do: 子供を遊ばせる (let children play)

Context determines which meaning applies!

**Grammar:**
The person being made/allowed uses に particle:
私に食べさせる (make/let me eat)`,
    examples: [
      { japanese: '食べさせる', romaji: 'tabesaseru', translation: 'make/let eat' },
      { japanese: '買わせる', romaji: 'kawaseru', translation: 'make/let buy' },
      { japanese: '母は私に野菜を食べさせた', romaji: 'haha wa watashi ni yasai wo tabesaseta', translation: 'Mom made me eat veggies' }
    ],
    tip: 'Same form for "make" and "let" — context tells you which!',
    triggers: {
      formTypes: ['causative', 'causative-past', 'causative-negative'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular'],
      errorPatterns: [
        'させる$',
        'せる$'
      ]
    }
  },

  {
    id: 'causative-passive',
    category: 'meaning',
    emoji: '😣',
    title: 'Causative-Passive',
    tooltip: '"Be made to do"',
    explanation: `Causative-passive is when you're MADE to do something (against your will or preference).

**Formation:**
Combine causative + passive:
- Ichidan: 食べる → 食べさせられる
- Godan: 買う → 買わせられる (or casual: 買わされる)
- Irregular: する → させられる, 来る → 来させられる

**Meaning:**
Expresses that someone forced you to do something:
野菜を食べさせられた (I was made to eat vegetables 😭)

**Nuance:**
Often implies unwillingness or displeasure about being made to do something.`,
    examples: [
      { japanese: '食べさせられた', romaji: 'tabesaserareta', translation: 'was made to eat' },
      { japanese: '待たされた', romaji: 'matasareta', translation: 'was made to wait' },
      { japanese: '野菜を食べさせられた', romaji: 'yasai wo tabesaserareta', translation: 'was made to eat vegetables' }
    ],
    tip: 'Used when something happens against your will. Often implies mild complaint!',
    triggers: {
      formTypes: ['causative-passive', 'causative-passive-past'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular'],
      errorPatterns: [
        'させられる$',
        'せられる$',
        'される$'
      ]
    }
  },

  {
    id: 'progressive-form',
    category: 'meaning',
    emoji: '🚶',
    title: 'Progressive (〜ている)',
    tooltip: 'Means "is doing" OR "is in a state"',
    explanation: `The ている form has TWO main uses depending on the verb type:

**1. Ongoing action (action verbs):**
食べている (is eating right now)
走っている (is running)

**2. Resulting state (state verbs):**
住んでいる (is living / lives - ongoing state)
知っている (knows - state of knowledge)
結婚している (is married - state)

**Formation:**
Te-form + いる:
- 食べる → 食べて → 食べている
- 買う → 買って → 買っている

The verb type determines which meaning applies!`,
    examples: [
      { japanese: '食べている', romaji: 'tabete iru', translation: 'is eating' },
      { japanese: '住んでいる', romaji: 'sunde iru', translation: 'lives (state)' },
      { japanese: '知っている', romaji: 'shitte iru', translation: 'knows (state)' }
    ],
    tip: 'Action verbs = ongoing, state verbs = result state!',
    triggers: {
      formTypes: ['progressive', 'te-form'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular'],
      errorPatterns: [
        'ている$',
        'てる$',
        'でいる$'
      ]
    }
  },

  // -------------------------------------------------------------------------
  // CONDITIONALS
  // -------------------------------------------------------------------------
  {
    id: 'tara-conditional',
    category: 'conditional',
    emoji: '🌤️',
    title: 'たら Conditional (When / If)',
    tooltip: 'Simple and common "if"',
    explanation: `たら is the most common conditional form, meaning "if" or "when."

**Formation:**
Past tense + ら:
- 食べる → 食べた → 食べたら (if/when eat)
- 買う → 買った → 買ったら (if/when buy)
- 高い → 高かった → 高かったら (if expensive)

**Usage:**
1. Temporal sequence: 帰ったら、電話してね (When you get home, call me)
2. Conditional: 雨が降ったら、行かない (If it rains, I won't go)
3. Discovery: ドアを開けたら、猫がいた (When I opened the door, there was a cat)

**Nuance:**
Often implies that one action follows another.`,
    examples: [
      { japanese: '帰ったら、電話してね', romaji: 'kaettara, denwa shite ne', translation: 'call me when you get home' },
      { japanese: '雨が降ったら、出かけない', romaji: 'ame ga futtara, dekakenai', translation: 'if it rains, won\'t go out' },
      { japanese: '安かったら、買います', romaji: 'yasukattara, kaimasu', translation: 'if it\'s cheap, I\'ll buy it' }
    ],
    tip: 'たら is used for sequence or result. Very natural in conversation!',
    triggers: {
      formTypes: ['conditional', 'tara'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'],
      errorPatterns: [
        'たら$',
        'だら$'
      ]
    }
  },

  {
    id: 'ba-conditional',
    category: 'conditional',
    emoji: '🌧️',
    title: 'ば Conditional (If / Hypothetical)',
    tooltip: 'Used for "if something happens (in theory)"',
    explanation: `ば is a conditional that emphasizes hypothetical "if" situations.

**Formation:**
- Ichidan: Drop る, add れば (食べる → 食べれば)
- Godan: Change to え-row + ば (買う → 買えば)
- Irregular: する → すれば, 来る → 来れば
- い-adjectives: Replace い with ければ (高い → 高ければ)

**Usage:**
Expresses hypothetical conditions:
雨が降れば、出かけない (If it rains, I won't go out)

**Nuance:**
More about possibility/theory rather than specific timing like たら.`,
    examples: [
      { japanese: '食べれば', romaji: 'tabereba', translation: 'if (one) eats' },
      { japanese: '雨が降れば、出かけない', romaji: 'ame ga fureba, dekakenai', translation: 'if it rains, won\'t go' },
      { japanese: '安ければ、買う', romaji: 'yasukereba, kau', translation: 'if cheap, will buy' }
    ],
    tip: 'ば is for possibility/theory, たら is for sequence/timing!',
    triggers: {
      formTypes: ['conditional', 'ba'],
      wordTypes: ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'],
      errorPatterns: [
        'れば$',
        'えば$',
        'ければ$'
      ]
    }
  },

  // -------------------------------------------------------------------------
  // SPECIAL CASES & MNEMONICS
  // -------------------------------------------------------------------------
  {
    id: 'special-iku',
    category: 'special-case',
    emoji: '✨',
    title: '行く (iku) Te-form Exception',
    tooltip: '行く → 行って／行った (not 行いて!)',
    explanation: `行く (iku - to go) is a special Godan verb with an irregular te-form!

**The exception:**
Even though 行く ends with く, it follows the う・つ・る rule instead:
- ❌ 行いて (wrong!)
- ✅ 行って (correct!)
- ✅ 行った (past tense)

This is THE major exception to the Godan te-form rules.

**All other forms are regular:**
- 行かない (negative)
- 行きます (polite)
- 行ける (potential)

Only te-form and past tense are special!`,
    examples: [
      { japanese: '行って', romaji: 'itte', translation: 'go (te-form)' },
      { japanese: '行った', romaji: 'itta', translation: 'went' },
      { japanese: '行ってください', romaji: 'itte kudasai', translation: 'please go' }
    ],
    tip: 'Remember: 行く is the big exception to く conjugation!',
    triggers: {
      formTypes: ['te-form', 'past'],
      wordTypes: ['Godan'],
      errorPatterns: [
        '行いて',
        '行きて',
        '行いた',
        '行きた'
      ]
    }
  },

  {
    id: 'special-ii',
    category: 'special-case',
    emoji: '✨',
    title: 'いい (ii) - "Good" Exception',
    tooltip: 'いい → よかった／よくない',
    explanation: `いい (good) is an irregular い-adjective that uses よ instead of い in most conjugations.

**Conjugations:**
- Present: いい (good) ✓
- Past: よかった (was good) — NOT いかった!
- Negative: よくない (not good) — NOT いくない!
- Te-form: よくて (good and...) — NOT いくて!
- Adverb: よく (well)

**Why?**
Historically, いい comes from よい (yoi), which is still used in formal contexts. The conjugations use the よ stem.`,
    examples: [
      { japanese: 'いい', romaji: 'ii', translation: 'good' },
      { japanese: 'よかった', romaji: 'yokatta', translation: 'was good' },
      { japanese: 'よくない', romaji: 'yokunai', translation: 'not good' }
    ],
    tip: 'Mnemonic: "Good is good, but better is よかった!"',
    triggers: {
      formTypes: ['past', 'negative', 'te-form'],
      wordTypes: ['i-adjective'],
      errorPatterns: [
        'いかった',
        'いくない',
        'いくて'
      ]
    }
  },

  {
    id: 'special-aru',
    category: 'special-case',
    emoji: '✨',
    title: 'ある - No ている Form',
    tooltip: 'ある has no 〜ている form (it\'s already "existing")',
    explanation: `ある (to exist/have) is a special Godan verb that doesn't use the ている form.

**Why?**
Because ある already means "exists" or "is there," it doesn't need ている to express a state of being. It's inherently a state verb.

**Correct usage:**
- ✅ ある (exists)
- ✅ あった (existed)
- ✅ ない (doesn't exist)
- ❌ あっている (doesn't exist!)

**Comparison:**
- いる (animate existence) → いる (exists)
- ある (inanimate existence) → ある (exists)

Neither uses ている for existing!`,
    examples: [
      { japanese: '本がある', romaji: 'hon ga aru', translation: 'there is a book' },
      { japanese: 'お金がない', romaji: 'okane ga nai', translation: 'there is no money' },
      { japanese: '昔、城があった', romaji: 'mukashi, shiro ga atta', translation: 'long ago, there was a castle' }
    ],
    tip: 'ある already means "exists" — no need for ている!',
    triggers: {
      formTypes: ['progressive', 'te-form'],
      wordTypes: ['Godan'],
      errorPatterns: [
        'あっている',
        'あってる'
      ]
    }
  },

  {
    id: 'godan-endings-mnemonic',
    category: 'mnemonic',
    emoji: '🌀',
    title: 'Godan Verb Endings Mnemonic',
    tooltip: 'All 9 Godan endings',
    explanation: `To remember all the Godan verb endings, memorize this sequence:

**U-Ku-Gu-Su-Tsu-Nu-Bu-Mu-Ru (plus U!)**

う (kau - buy)
く (kaku - write)
ぐ (oyogu - swim)
す (hanasu - speak)
つ (matsu - wait)
ぬ (shinu - die)
ぶ (asobu - play)
む (nomu - drink)
る (aru - exist)

**Te-form grouping:**
- う・つ・る → って／った
- く・ぐ → いて／いだ
- ぬ・ぶ・む → んで／んだ
- す → して／した`,
    examples: [
      { japanese: '買う・勝つ・乗る → って', romaji: 'kau/katsu/noru', translation: 'buy/win/ride' },
      { japanese: '書く・泳ぐ → いて', romaji: 'kaku/oyogu', translation: 'write/swim' },
      { japanese: '飲む・遊ぶ・死ぬ → んで', romaji: 'nomu/asobu/shinu', translation: 'drink/play/die' }
    ],
    tip: 'Group them by te-form pattern to make memorization easier!',
    triggers: {
      formTypes: ['te-form', 'past'],
      wordTypes: ['Godan'],
      errorPatterns: []
    }
  },

  {
    id: 'te-form-groups',
    category: 'mnemonic',
    emoji: '🪀',
    title: 'Te-Form Groups',
    tooltip: 'Quick reference for Godan te-forms',
    explanation: `Godan te-form patterns organized by ending sound:

**Group 1: Small っ**
う・つ・る → って／った
- 買う → 買って (kau → katte)
- 待つ → 待って (matsu → matte)
- 乗る → 乗って (noru → notte)

**Group 2: ん sound**
ぬ・ぶ・む → んで／んだ
- 死ぬ → 死んで (shinu → shinde)
- 遊ぶ → 遊んで (asobu → asonde)
- 飲む → 飲んで (nomu → nonde)

**Group 3: い sound**
く・ぐ → いて／いだ
- 書く → 書いて (kaku → kaite)
- 泳ぐ → 泳いで (oyogu → oyoide)

**Group 4: し sound**
す → して／した
- 話す → 話して (hanasu → hanashite)`,
    examples: [
      { japanese: '買って、待って、乗って', romaji: 'katte, matte, notte', translation: 'buy, wait, ride (te-form)' },
      { japanese: '飲んで、遊んで、死んで', romaji: 'nonde, asonde, shinde', translation: 'drink, play, die (te-form)' },
      { japanese: '書いて、泳いで', romaji: 'kaite, oyoide', translation: 'write, swim (te-form)' }
    ],
    tip: 'Listen for the sound: っ、ん、い、or し to identify the group!',
    triggers: {
      formTypes: ['te-form', 'past'],
      wordTypes: ['Godan'],
      errorPatterns: []
    }
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get help content by ID
 */
export function getHelpById(id: string): HelpContent | undefined {
  return HELP_CONTENT.find(help => help.id === id);
}

/**
 * Get all help content for a specific category
 */
export function getHelpByCategory(category: HelpContent['category']): HelpContent[] {
  return HELP_CONTENT.filter(help => help.category === category);
}

/**
 * Get help content relevant to a specific word type
 */
export function getHelpByWordType(wordType: string): HelpContent[] {
  return HELP_CONTENT.filter(help =>
    help.triggers.wordTypes.includes(wordType) ||
    help.triggers.wordTypes.includes('all')
  );
}

/**
 * Get help content relevant to a specific form type
 */
export function getHelpByFormType(formType: string): HelpContent[] {
  return HELP_CONTENT.filter(help =>
    help.triggers.formTypes.includes(formType) ||
    help.triggers.formTypes.includes('all')
  );
}

/**
 * Get help content that matches an error pattern
 */
export function getHelpByErrorPattern(userInput: string): HelpContent[] {
  return HELP_CONTENT.filter(help => {
    if (!help.triggers.errorPatterns) return false;

    return help.triggers.errorPatterns.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(userInput);
    });
  });
}

/**
 * Search help content by keyword
 */
export function searchHelp(keyword: string): HelpContent[] {
  const lowerKeyword = keyword.toLowerCase();

  return HELP_CONTENT.filter(help =>
    help.title.toLowerCase().includes(lowerKeyword) ||
    help.tooltip.toLowerCase().includes(lowerKeyword) ||
    help.explanation.toLowerCase().includes(lowerKeyword) ||
    help.examples.some(ex =>
      ex.japanese.includes(keyword) ||
      ex.romaji?.toLowerCase().includes(lowerKeyword) ||
      ex.translation?.toLowerCase().includes(lowerKeyword)
    )
  );
}
