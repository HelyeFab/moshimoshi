import type { ExtendedConjugationForms } from '@/types/conjugation'
import type { WordType } from '@/types/drill'
import type { ConjugationUsageByType, ConjugationUsageNote } from './schema'
import { ConjugationUsageByTypeSchema, ConjugationUsageNoteSchema } from './schema'

type ConjugationFormKey = keyof ExtendedConjugationForms

// Curated notes (full coverage): all forms explicitly defined for review/editing.
const RAW_USAGE_NOTES: Partial<Record<ConjugationFormKey, ConjugationUsageByType>> = {
  "present": {
    "default": {
      "key": "present",
      "title": "Present (Dictionary Form)",
      "summary": "Used to state the plain dictionary form of a verb or adjective.",
      "useCases": [
        "Dictionary/citation form",
        "Plain non-past statements",
        "Clause chaining in dictionaries/grammar explanations"
      ],
      "nuance": "For verbs, this can mean present or future depending on context.",
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "masuStem": {
    "default": {
      "key": "masuStem",
      "title": "Masu Stem",
      "summary": "Used as a structural stem to build polite and compound expressions.",
      "useCases": [
        "Building polite verb patterns",
        "Attaching helper expressions (e.g. 〜たい, 〜に行く)",
        "Studying conjugation building blocks"
      ],
      "nuance": "This is mainly a helper/base form and is not usually used as a standalone sentence form.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "negativeStem": {
    "default": {
      "key": "negativeStem",
      "title": "Negative Stem",
      "summary": "Used as a structural base for negative-related forms and compound patterns.",
      "useCases": [
        "Building negative-related variants",
        "Attaching negative helper patterns",
        "Studying conjugation building blocks"
      ],
      "nuance": "This is mainly a helper/base form and is not usually used as a standalone sentence form.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "past": {
    "default": {
      "key": "past",
      "title": "Past",
      "summary": "Used to say something happened or was true in the past.",
      "useCases": [
        "Completed actions",
        "Past states",
        "Simple past narration"
      ],
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "negative": {
    "default": {
      "key": "negative",
      "title": "Negative",
      "summary": "Used to say something does not happen or is not true.",
      "useCases": [
        "Negating actions",
        "Negating states",
        "Plain-style statements"
      ],
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "pastNegative": {
    "default": {
      "key": "pastNegative",
      "title": "Past Negative",
      "summary": "Used to say something did not happen or was not true in the past.",
      "useCases": [
        "Past non-events",
        "Past negative states",
        "Plain-style narration"
      ],
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "polite": {
    "default": {
      "key": "polite",
      "title": "Polite",
      "summary": "Used for polite non-past statements in everyday respectful conversation.",
      "useCases": [
        "Speaking politely to strangers",
        "Customer/service interactions",
        "Classroom or workplace speech"
      ],
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "politePast": {
    "default": {
      "key": "politePast",
      "title": "Polite Past",
      "summary": "Used for polite statements about past actions or states.",
      "useCases": [
        "Polite past narration",
        "Reporting completed actions politely",
        "Service/workplace conversations"
      ],
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "politeNegative": {
    "default": {
      "key": "politeNegative",
      "title": "Polite Negative",
      "summary": "Used to politely say something does not happen or is not the case.",
      "useCases": [
        "Polite negation",
        "Formal denial/correction",
        "Customer-facing speech"
      ],
      "nuance": "This is general polite negation; ability/impossibility meanings belong to potential forms or context-specific verbs.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "politePastNegative": {
    "default": {
      "key": "politePastNegative",
      "title": "Polite Past Negative",
      "summary": "Used for polite statements that something did not happen in the past.",
      "useCases": [
        "Polite past denial",
        "Reporting something did not occur",
        "Formal conversation"
      ],
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "politeVolitional": {
    "default": {
      "key": "politeVolitional",
      "title": "Polite Volitional (〜ましょう)",
      "summary": "Used to politely propose doing something together (“let’s…”).",
      "useCases": [
        "Polite suggestions",
        "Inviting someone to act together",
        "Guiding a group politely"
      ],
      "nuance": "Common in classrooms, service settings, and polite everyday speech.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "teForm": {
    "default": {
      "key": "teForm",
      "title": "Te-form",
      "summary": "A connector form used to link actions, make requests, and build many grammar patterns.",
      "useCases": [
        "Linking actions",
        "Progressive forms (〜ている)",
        "Requests (〜てください)"
      ],
      "nuance": "The te-form itself is structural; its meaning depends on the full pattern.",
      "register": "mixed",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "negativeTeForm": {
    "default": {
      "key": "negativeTeForm",
      "title": "Negative Te Form",
      "summary": "Used to connect negative clauses and to give reasons/background for something not happening.",
      "useCases": [
        "Linking a negative action/state to another clause",
        "Giving a reason or cause in the negative",
        "Connecting two negative descriptions"
      ],
      "nuance": "Often means “not ... and / so ...”; “without doing” is more commonly associated with 〜ないで in many contexts.",
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "naiDeForm": {
    "default": {
      "key": "naiDeForm",
      "title": "Naide Form",
      "summary": "Used to say “without doing” or to make negative requests in patterns.",
      "useCases": [
        "Without doing X",
        "Negative requests (〜ないでください)",
        "Contrasting actions"
      ],
      "register": "mixed",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "adverbialNegative": {
    "default": {
      "key": "adverbialNegative",
      "title": "Adverbial Negative",
      "summary": "Used to connect a negative clause in an adverbial way, often in more structured or written expressions.",
      "useCases": [
        "Linking a negative clause to another statement",
        "Written or formal clause connection",
        "Recognizing advanced negative connectors"
      ],
      "nuance": "Less common in casual conversation than simpler negative patterns.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "volitional": {
    "default": {
      "key": "volitional",
      "title": "Volitional",
      "summary": "Used to express intention (“I will...”) or invitation (“let’s...”).",
      "useCases": [
        "Speaker intention",
        "Suggestions/invitations",
        "Planning actions"
      ],
      "register": "casual",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "volitionalNegative": {
    "default": {
      "key": "volitionalNegative",
      "title": "Negative Volitional",
      "summary": "Used for a strong intention not to do something, often in formal or literary-style expressions.",
      "useCases": [
        "Declaring intention not to do something",
        "Formal/literary negative resolve",
        "Recognizing advanced negative intention patterns"
      ],
      "nuance": "Not the common everyday way to say “let’s not”; often feels stronger or more literary.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "imperativePlain": {
    "default": {
      "key": "imperativePlain",
      "title": "Plain Imperative",
      "summary": "Used to give strong direct commands.",
      "useCases": [
        "Urgent instructions",
        "Strong orders",
        "Set phrases and dramatic speech"
      ],
      "nuance": "Very strong and can sound rude in everyday conversation; use carefully.",
      "register": "casual",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "imperativePolite": {
    "default": {
      "key": "imperativePolite",
      "title": "Polite Command",
      "summary": "Used for directive speech in a softer or more polite form (exact pattern depends on the form used).",
      "useCases": [
        "Polite instructions",
        "Service or workplace guidance",
        "Directed requests with softened tone"
      ],
      "nuance": "Politer than plain imperative, but still directive.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "imperativeNegative": {
    "default": {
      "key": "imperativeNegative",
      "title": "Negative Command",
      "summary": "Used to tell someone not to do something.",
      "useCases": [
        "Warnings",
        "Stopping an action",
        "Direct prohibitions"
      ],
      "nuance": "Can sound forceful; tone and context matter a lot.",
      "register": "casual",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "provisional": {
    "default": {
      "key": "provisional",
      "title": "Provisional (ba-form)",
      "summary": "Used to express “if” conditions, often with a conditional relationship.",
      "useCases": [
        "If/when conditions",
        "Advice patterns",
        "Hypothetical outcomes"
      ],
      "nuance": "Often focuses on condition -> result logic rather than sequence.",
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "provisionalNegative": {
    "default": {
      "key": "provisionalNegative",
      "title": "Provisional Negative (〜なければ)",
      "summary": "Used to express “if not …” as a condition, often in rules, advice, or necessity-related patterns.",
      "useCases": [
        "If-not conditions",
        "Rules and requirements",
        "Advice or consequences"
      ],
      "nuance": "Common in obligation expressions depending on the full pattern.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "provisionalNegativeColloquial": {
    "default": {
      "key": "provisionalNegativeColloquial",
      "title": "Provisional Negative Colloquial (〜なきゃ)",
      "summary": "Used in casual speech as a shortened “if not …” form, often with an implied “have to…”.",
      "useCases": [
        "Casual spoken Japanese",
        "Implied obligation",
        "Quick informal conditions"
      ],
      "nuance": "Informal spoken form; avoid in formal writing.",
      "register": "spoken",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "conditional": {
    "default": {
      "key": "conditional",
      "title": "Conditional (tara-form)",
      "summary": "Used for “if/when” conditions and natural sequence (“after doing”).",
      "useCases": [
        "If/when something happens",
        "Future conditions",
        "Sequence (“after X, then Y”)"
      ],
      "nuance": "Very common in conversation because it is flexible and natural.",
      "register": "mixed",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "conditionalNegative": {
    "default": {
      "key": "conditionalNegative",
      "title": "Conditional Negative (〜なかったら)",
      "summary": "Used to express a specific “if/when … not” condition in real situations.",
      "useCases": [
        "Specific if-not situations",
        "Warnings and consequences",
        "Planning based on what may not happen"
      ],
      "nuance": "Feels more situational and conversational than broad rule-like conditionals.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "alternativeForm": {
    "default": {
      "key": "alternativeForm",
      "title": "Alternative (〜たり)",
      "summary": "Used to list example actions (“do things like X and Y”).",
      "useCases": [
        "Listing example actions",
        "Describing non-exhaustive activities",
        "Talking about varied behavior"
      ],
      "nuance": "Implies “among other things”; not a complete list.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "alternativeNegative": {
    "default": {
      "key": "alternativeNegative",
      "title": "Alternative Negative (〜なかったり)",
      "summary": "Used to list example actions that did not happen, often in mixed or irregular situations.",
      "useCases": [
        "Examples of things not done",
        "Mixed do/don’t behavior",
        "Non-exhaustive negative listing"
      ],
      "nuance": "Often used when describing inconsistent patterns or varied situations.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "potential": {
    "default": {
      "key": "potential",
      "title": "Potential",
      "summary": "Used to say someone can do something or something is possible.",
      "useCases": [
        "Ability",
        "Possibility",
        "Opportunity/availability"
      ],
      "register": "neutral",
      "level": "beginner",
      "aliases": [
        "can do",
        "be able to"
      ],
      "reviewed": true,
      "version": 1
    }
  },
  "potentialNegative": {
    "default": {
      "key": "potentialNegative",
      "title": "Potential Negative",
      "summary": "Used to say someone cannot do something or something is not possible.",
      "useCases": [
        "Lack of ability",
        "Lack of opportunity",
        "Impossibility"
      ],
      "register": "neutral",
      "level": "beginner",
      "aliases": [
        "cannot",
        "not able to"
      ],
      "reviewed": true,
      "version": 1
    }
  },
  "potentialPast": {
    "default": {
      "key": "potentialPast",
      "title": "Potential Past",
      "summary": "Used to say someone was able to do something in the past.",
      "useCases": [
        "Past ability",
        "Successful possibility",
        "Something became possible and happened"
      ],
      "register": "neutral",
      "level": "beginner",
      "aliases": [
        "could",
        "was able to"
      ],
      "reviewed": true,
      "version": 1
    }
  },
  "potentialPastNegative": {
    "default": {
      "key": "potentialPastNegative",
      "title": "Potential Past Negative",
      "summary": "Used to say someone was not able to do something in the past.",
      "useCases": [
        "Lack of ability",
        "Lack of opportunity",
        "Something did not happen because it was not possible"
      ],
      "nuance": "Often translated as “could not” or “was not able to.”",
      "register": "neutral",
      "level": "beginner",
      "aliases": [
        "could not",
        "was not able to"
      ],
      "reviewed": true,
      "version": 1
    }
  },
  "potentialMasuStem": {
    "default": {
      "key": "potentialMasuStem",
      "title": "Potential Masu Stem",
      "summary": "Used as a structural base for polite or compound expressions built from the potential form.",
      "useCases": [
        "Building polite potential variants",
        "Attaching helper expressions",
        "Studying potential-form structure"
      ],
      "nuance": "Helper/base form; not usually used alone.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "potentialTeForm": {
    "default": {
      "key": "potentialTeForm",
      "title": "Potential Te Form",
      "summary": "Used to connect clauses involving ability or possibility.",
      "useCases": [
        "Linking ability-related clauses",
        "Giving reasons tied to what is possible",
        "Building longer patterns from potential"
      ],
      "nuance": "Usually appears as part of a longer expression.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "potentialNegativeTeForm": {
    "default": {
      "key": "potentialNegativeTeForm",
      "title": "Potential Negative Te Form",
      "summary": "Used to connect clauses involving inability (“not being able to do …”).",
      "useCases": [
        "Explaining inability before another clause",
        "Linking negative ability statements",
        "Reason/background for not doing something"
      ],
      "nuance": "Can express limitation or frustration depending on context.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "potentialPolite": {
    "default": {
      "key": "potentialPolite",
      "title": "Polite Potential",
      "summary": "Used to politely express ability or possibility.",
      "useCases": [
        "Polite conversation",
        "Work and customer interactions",
        "Safe polite statements of ability"
      ],
      "nuance": "A common and socially safe way to talk about ability.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "potentialPoliteNegative": {
    "default": {
      "key": "potentialPoliteNegative",
      "title": "Polite Potential Negative",
      "summary": "Used to politely say someone cannot do something.",
      "useCases": [
        "Polite refusal via limitation",
        "Explaining inability politely",
        "Customer/workplace communication"
      ],
      "nuance": "Often softens refusal by framing it as inability.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "potentialPolitePast": {
    "default": {
      "key": "potentialPolitePast",
      "title": "Polite Potential Past",
      "summary": "Used to politely say someone was able to do something.",
      "useCases": [
        "Polite reporting of success",
        "Describing past ability",
        "Formal explanations"
      ],
      "nuance": "Neutral and respectful in tone.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "potentialPolitePastNegative": {
    "default": {
      "key": "potentialPolitePastNegative",
      "title": "Polite Potential Past Negative",
      "summary": "Used to politely say someone was not able to do something in the past.",
      "useCases": [
        "Polite apologies/explanations",
        "Describing past inability",
        "Professional communication"
      ],
      "nuance": "Common in careful explanations and apologies.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "passive": {
    "default": {
      "key": "passive",
      "title": "Passive",
      "summary": "Used when the subject receives an action rather than performs it.",
      "useCases": [
        "Receiving an action",
        "Unknown/unstated actor",
        "Perspective shift (focus on receiver)"
      ],
      "nuance": "Japanese passive can also carry an affected/annoyed nuance in some contexts.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passiveNegative": {
    "default": {
      "key": "passiveNegative",
      "title": "Passive Negative",
      "summary": "Used to say something is not done to the subject in passive perspective.",
      "useCases": [
        "Denying a passive event",
        "Objective/neutral reporting",
        "Correcting assumptions about what was done"
      ],
      "nuance": "Often appears in factual or formal explanations.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passivePast": {
    "default": {
      "key": "passivePast",
      "title": "Passive Past",
      "summary": "Used to say something was done to the subject in the past.",
      "useCases": [
        "Reporting passive events",
        "Describing being affected",
        "Formal or objective narration"
      ],
      "nuance": "May imply inconvenience/affected nuance depending on context.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passivePastNegative": {
    "default": {
      "key": "passivePastNegative",
      "title": "Passive Past Negative",
      "summary": "Used to say something was not done to the subject in the past.",
      "useCases": [
        "Reporting a non-event",
        "Correcting a past assumption",
        "Formal explanation"
      ],
      "nuance": "Common in careful factual clarification.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passiveMasuStem": {
    "default": {
      "key": "passiveMasuStem",
      "title": "Passive Masu Stem",
      "summary": "Used as a structural base for polite or compound passive expressions.",
      "useCases": [
        "Building polite passive variants",
        "Attaching helper expressions",
        "Studying passive-form structure"
      ],
      "nuance": "Helper/base form; not usually used alone.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passiveTeForm": {
    "default": {
      "key": "passiveTeForm",
      "title": "Passive Te Form",
      "summary": "Used to connect clauses involving passive meaning or to build patterns from passive forms.",
      "useCases": [
        "Linking passive clauses",
        "Building longer passive patterns",
        "Formal/structured explanations"
      ],
      "nuance": "More common in structured speech/writing than casual chat.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passiveNegativeTeForm": {
    "default": {
      "key": "passiveNegativeTeForm",
      "title": "Passive Negative Te Form",
      "summary": "Used to connect clauses involving passive negative meaning (“not being done to …”).",
      "useCases": [
        "Linking passive negative clauses",
        "Reason/background in passive negative context",
        "Formal explanation"
      ],
      "nuance": "Often seen in careful written or formal speech contexts.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passivePolite": {
    "default": {
      "key": "passivePolite",
      "title": "Passive Polite",
      "summary": "Polite form of the passive, used when speaking respectfully about receiving an action.",
      "useCases": [
        "Polite passive statements",
        "Formal reporting",
        "Professional/service contexts"
      ],
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passivePoliteNegative": {
    "default": {
      "key": "passivePoliteNegative",
      "title": "Passive Negative (Polite)",
      "summary": "Used to politely say something is not done to the subject.",
      "useCases": [
        "Polite reporting",
        "Formal clarification",
        "Customer/service explanations"
      ],
      "nuance": "Useful for objective and polite wording.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passivePolitePast": {
    "default": {
      "key": "passivePolitePast",
      "title": "Passive Past (Polite)",
      "summary": "Used to politely report that something was done to the subject in the past.",
      "useCases": [
        "Business or formal reporting",
        "Polite event descriptions",
        "Professional explanations"
      ],
      "nuance": "Common in formal reports and announcements.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "passivePolitePastNegative": {
    "default": {
      "key": "passivePolitePastNegative",
      "title": "Passive Past Negative (Polite)",
      "summary": "Used to politely say something was not done to the subject in the past.",
      "useCases": [
        "Polite correction",
        "Formal denial",
        "Careful clarification"
      ],
      "nuance": "Helpful for respectful factual corrections.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causative": {
    "default": {
      "key": "causative",
      "title": "Causative",
      "summary": "Used to say someone makes or lets another person do something.",
      "useCases": [
        "Making someone do something",
        "Letting/allowing someone do something",
        "Authority/permission situations"
      ],
      "nuance": "Whether it feels like “make” or “let” depends on context.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativeNegative": {
    "default": {
      "key": "causativeNegative",
      "title": "Causative Negative",
      "summary": "Used to say someone does not make or let someone do something.",
      "useCases": [
        "Denying permission",
        "Refusing to allow an action",
        "Explaining rules or limits"
      ],
      "nuance": "Context still decides “make” vs “let”.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePast": {
    "default": {
      "key": "causativePast",
      "title": "Causative Past",
      "summary": "Used to say someone made or let someone do something in the past.",
      "useCases": [
        "Reporting permission in the past",
        "Reporting forced actions in the past",
        "Describing past control/authority decisions"
      ],
      "nuance": "Context decides whether it means “made” or “let”.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePastNegative": {
    "default": {
      "key": "causativePastNegative",
      "title": "Causative Past Negative",
      "summary": "Used to say someone did not make or let someone do something in the past.",
      "useCases": [
        "Explaining past restrictions",
        "Withheld permission in the past",
        "Correcting assumptions"
      ],
      "nuance": "Often appears in explanations of rules/decisions.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativeMasuStem": {
    "default": {
      "key": "causativeMasuStem",
      "title": "Causative Masu Stem",
      "summary": "Used as a structural base for polite or compound causative expressions.",
      "useCases": [
        "Building polite causative variants",
        "Attaching helper expressions",
        "Studying causative-form structure"
      ],
      "nuance": "Helper/base form; not usually used alone.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativeTeForm": {
    "default": {
      "key": "causativeTeForm",
      "title": "Causative Te Form",
      "summary": "Used to connect clauses involving making/letting someone do something.",
      "useCases": [
        "Linking causative clauses",
        "Building longer causative patterns",
        "Structured explanations of permission/control"
      ],
      "nuance": "More common in careful or structured speech/writing.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativeNegativeTeForm": {
    "default": {
      "key": "causativeNegativeTeForm",
      "title": "Causative Negative Te Form",
      "summary": "Used to connect clauses involving not making/letting someone do something.",
      "useCases": [
        "Linking causative negative clauses",
        "Reasons/background for restrictions",
        "Formal or structured explanations"
      ],
      "nuance": "Often appears in explanatory contexts.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePolite": {
    "default": {
      "key": "causativePolite",
      "title": "Causative (Polite)",
      "summary": "Used to politely express making or letting someone do something.",
      "useCases": [
        "Workplace explanations",
        "Formal permission/control statements",
        "Polite reporting involving authority"
      ],
      "nuance": "Can sound authoritative; context can soften it.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePoliteNegative": {
    "default": {
      "key": "causativePoliteNegative",
      "title": "Causative Negative (Polite)",
      "summary": "Used to politely say someone does not make or let someone do something.",
      "useCases": [
        "Polite restriction statements",
        "Policy explanations",
        "Formal refusals of permission"
      ],
      "nuance": "Often used when explaining rules politely.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePolitePast": {
    "default": {
      "key": "causativePolitePast",
      "title": "Causative Past (Polite)",
      "summary": "Used to politely say someone made or let someone do something in the past.",
      "useCases": [
        "Formal reporting",
        "Workplace explanations",
        "Polite narrative about permission/control"
      ],
      "nuance": "Context decides “make” vs “let”.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePolitePastNegative": {
    "default": {
      "key": "causativePolitePastNegative",
      "title": "Causative Past Negative (Polite)",
      "summary": "Used to politely say someone did not make or let someone do something in the past.",
      "useCases": [
        "Polite clarification",
        "Explaining past policy",
        "Formal denial"
      ],
      "nuance": "Useful for respectful factual corrections.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassive": {
    "default": {
      "key": "causativePassive",
      "title": "Causative-Passive",
      "summary": "Used to say someone was made to do something.",
      "useCases": [
        "Forced actions",
        "Unwanted obligations",
        "Being made to do something by another person"
      ],
      "nuance": "Often carries inconvenience, burden, or lack of control.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassiveNegative": {
    "default": {
      "key": "causativePassiveNegative",
      "title": "Causative-Passive Negative",
      "summary": "Used to say someone is not made to do something.",
      "useCases": [
        "Denying imposed action",
        "Clarifying that an obligation was not forced",
        "Explaining responsibility"
      ],
      "nuance": "Often used in careful explanations.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassivePast": {
    "default": {
      "key": "causativePassivePast",
      "title": "Causative-Passive Past",
      "summary": "Used to say someone was made to do something in the past.",
      "useCases": [
        "Complaints about forced actions",
        "Reporting imposed actions",
        "Describing past obligation"
      ],
      "nuance": "Often carries burden/inconvenience nuance.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassivePastNegative": {
    "default": {
      "key": "causativePassivePastNegative",
      "title": "Causative-Passive Past Negative",
      "summary": "Used to say someone was not made to do something in the past.",
      "useCases": [
        "Clarifying absence of obligation",
        "Correcting assumptions",
        "Formal explanation"
      ],
      "nuance": "More common in careful explanations than casual chat.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassiveMasuStem": {
    "default": {
      "key": "causativePassiveMasuStem",
      "title": "Causative-Passive Masu Stem",
      "summary": "Used as a structural base for polite or compound causative-passive expressions.",
      "useCases": [
        "Building polite variants",
        "Attaching helper expressions",
        "Studying advanced conjugation structure"
      ],
      "nuance": "Helper/base form; not usually used alone.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassiveTeForm": {
    "default": {
      "key": "causativePassiveTeForm",
      "title": "Causative-Passive Te Form",
      "summary": "Used to connect clauses involving “being made to do” meaning.",
      "useCases": [
        "Linking causative-passive clauses",
        "Building longer patterns",
        "Formal/structured explanations"
      ],
      "nuance": "More common in structured speech/writing.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassiveNegativeTeForm": {
    "default": {
      "key": "causativePassiveNegativeTeForm",
      "title": "Causative-Passive Negative Te Form",
      "summary": "Used to connect clauses involving “not being made to do” meaning.",
      "useCases": [
        "Linking negative causative-passive clauses",
        "Reason/background for lack of imposed action",
        "Formal explanation"
      ],
      "nuance": "Often appears in careful writing or formal speech.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassivePolite": {
    "default": {
      "key": "causativePassivePolite",
      "title": "Causative-Passive (Polite)",
      "summary": "Used to politely express being made to do something.",
      "useCases": [
        "Polite reporting",
        "Workplace explanations",
        "Formal descriptions of obligation"
      ],
      "nuance": "Emotion depends on context; may sound neutral or burdened.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassivePoliteNegative": {
    "default": {
      "key": "causativePassivePoliteNegative",
      "title": "Causative-Passive Negative (Polite)",
      "summary": "Used to politely say someone is not made to do something.",
      "useCases": [
        "Polite clarification",
        "Formal denial of imposed obligation",
        "Professional explanations"
      ],
      "nuance": "Useful for careful responsibility clarification.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassivePolitePast": {
    "default": {
      "key": "causativePassivePolitePast",
      "title": "Causative-Passive Past (Polite)",
      "summary": "Used to politely say someone was made to do something in the past.",
      "useCases": [
        "Formal reporting",
        "Professional explanation",
        "Polite complaint/report"
      ],
      "nuance": "Often used in careful reporting contexts.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "causativePassivePolitePastNegative": {
    "default": {
      "key": "causativePassivePolitePastNegative",
      "title": "Causative-Passive Past Negative (Polite)",
      "summary": "Used to politely say someone was not made to do something in the past.",
      "useCases": [
        "Polite correction",
        "Formal clarification",
        "Professional reporting"
      ],
      "nuance": "Good for respectful factual clarifications.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiForm": {
    "default": {
      "key": "taiForm",
      "title": "Tai-form (Want to)",
      "summary": "Used to express the speaker’s desire to do something.",
      "useCases": [
        "Personal desire",
        "Asking about another person’s desire (carefully)",
        "Planning around what you want to do"
      ],
      "nuance": "Most natural for first person; second/third person often need context.",
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "taiFormNegative": {
    "default": {
      "key": "taiFormNegative",
      "title": "Tai-form Negative",
      "summary": "Used to say someone does not want to do something.",
      "useCases": [
        "Lack of desire",
        "Preference against an action",
        "Polite indirect refusal (with context)"
      ],
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "taiFormPast": {
    "default": {
      "key": "taiFormPast",
      "title": "たい Past",
      "summary": "Used to say you wanted to do something in the past.",
      "useCases": [
        "Past desire",
        "Explaining past motivation",
        "Reflecting on what you wanted"
      ],
      "nuance": "This does not by itself mean the action was done.",
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "taiFormPastNegative": {
    "default": {
      "key": "taiFormPastNegative",
      "title": "たい Past Negative",
      "summary": "Used to say you did not want to do something in the past.",
      "useCases": [
        "Past reluctance",
        "Explaining resistance",
        "Narrating a past refusal of desire"
      ],
      "nuance": "Often expresses emotional reluctance rather than inability.",
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "taiAdjectiveStem": {
    "default": {
      "key": "taiAdjectiveStem",
      "title": "たい Adjective Stem",
      "summary": "Used as a structural base to attach adjective-style endings to たい forms.",
      "useCases": [
        "Building たくて / たかった / たくない forms",
        "Studying たい-form structure",
        "Connecting desire expressions"
      ],
      "nuance": "Helper/base form; not usually used alone.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiTeForm": {
    "default": {
      "key": "taiTeForm",
      "title": "たい Te Form (たくて)",
      "summary": "Used to connect clauses involving desire (“wanting to…”).",
      "useCases": [
        "Giving reasons based on desire",
        "Linking desire to another clause",
        "Expressing motivation"
      ],
      "nuance": "Often ties desire to a following result or explanation.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiNegativeTeForm": {
    "default": {
      "key": "taiNegativeTeForm",
      "title": "たい Negative Te Form (たくなくて)",
      "summary": "Used to connect clauses involving not wanting to do something.",
      "useCases": [
        "Explaining avoidance due to reluctance",
        "Linking negative desire to another clause",
        "Giving reasons for not acting"
      ],
      "nuance": "Often reflects reluctance rather than inability.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiAdverbial": {
    "default": {
      "key": "taiAdverbial",
      "title": "たい Adverbial (たく)",
      "summary": "Used in a connecting/adverbial role for desire expressions, mainly in structured patterns.",
      "useCases": [
        "Linking desire to another expression",
        "Recognizing written/structured patterns",
        "Studying たい-form variants"
      ],
      "nuance": "More structural/advanced than everyday standalone usage.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiProvisional": {
    "default": {
      "key": "taiProvisional",
      "title": "たい Provisional (たければ)",
      "summary": "Used to express “if someone wants to…” as a condition.",
      "useCases": [
        "Offering options",
        "Advice based on the listener’s desire",
        "Soft suggestions"
      ],
      "nuance": "Useful for non-pushy phrasing because it leaves choice open.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiProvisionalNegative": {
    "default": {
      "key": "taiProvisionalNegative",
      "title": "たい Provisional Negative (たくなければ)",
      "summary": "Used to express “if someone does not want to…” as a condition.",
      "useCases": [
        "Offering alternatives",
        "Respectful non-pushy suggestions",
        "Conditional advice"
      ],
      "nuance": "Useful for giving options while respecting preference.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiConditional": {
    "default": {
      "key": "taiConditional",
      "title": "たい Conditional (たかったら)",
      "summary": "Used to express “if you want to…” in a specific or situational context.",
      "useCases": [
        "Invitations and offers",
        "Situational conditions based on desire",
        "Soft suggestions"
      ],
      "nuance": "Common in casual speech for giving choices.",
      "register": "spoken",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiConditionalNegative": {
    "default": {
      "key": "taiConditionalNegative",
      "title": "たい Conditional Negative (たくなかったら)",
      "summary": "Used to express “if you do not want to…” in a specific situation.",
      "useCases": [
        "Offering alternatives",
        "Situational choice",
        "Soft refusal framing"
      ],
      "nuance": "Useful for considerate, non-forceful suggestions.",
      "register": "spoken",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "taiObjective": {
    "default": {
      "key": "taiObjective",
      "title": "たい Objective (〜たさ)",
      "summary": "Used to nominalize desire as a quality or degree (the feeling/strength of wanting to do something).",
      "useCases": [
        "Talking about the degree of desire",
        "Describing motivation as a noun-like concept",
        "More abstract discussion of wanting"
      ],
      "nuance": "This is not the same as directly saying “want to do”; it turns desire into a noun-like idea.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "progressive": {
    "default": {
      "key": "progressive",
      "title": "Progressive",
      "summary": "Used for ongoing actions and some continuing states/results.",
      "useCases": [
        "Action in progress",
        "Habitual/repeated action",
        "Resulting state (depends on verb)"
      ],
      "nuance": "Japanese 〜ている can mean ongoing action or resulting state depending on the verb.",
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "progressiveNegative": {
    "default": {
      "key": "progressiveNegative",
      "title": "Progressive Negative (〜ていない)",
      "summary": "Used to say an action is not in progress or a continuing state is not true.",
      "useCases": [
        "Not doing something now",
        "Denying a continuing state",
        "Correcting current assumptions"
      ],
      "nuance": "Depending on context, it may also be interpreted like “has not …” with some verbs.",
      "register": "neutral",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "progressivePast": {
    "default": {
      "key": "progressivePast",
      "title": "Progressive Past (〜ていた)",
      "summary": "Used to describe an ongoing action or continuing state in the past.",
      "useCases": [
        "Past action in progress",
        "Background scene-setting",
        "Past continuing state"
      ],
      "nuance": "Common in storytelling and narrative background.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "progressivePastNegative": {
    "default": {
      "key": "progressivePastNegative",
      "title": "Progressive Past Negative (〜ていなかった)",
      "summary": "Used to say an action/state was not ongoing or not true in the past.",
      "useCases": [
        "Denying a past continuing state",
        "Correcting past assumptions",
        "Explaining what was not happening"
      ],
      "nuance": "Often used in explanations and corrections.",
      "register": "neutral",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "progressivePolite": {
    "default": {
      "key": "progressivePolite",
      "title": "Progressive (Polite)",
      "summary": "Used to politely describe ongoing actions or continuing states.",
      "useCases": [
        "Polite conversation",
        "Work/customer contexts",
        "Neutral reporting of current state"
      ],
      "nuance": "A very common safe descriptive form.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "progressivePoliteNegative": {
    "default": {
      "key": "progressivePoliteNegative",
      "title": "Progressive Negative (Polite)",
      "summary": "Used to politely say something is not in progress or not true as a continuing state.",
      "useCases": [
        "Polite denial of current state",
        "Work/customer explanations",
        "Soft corrections"
      ],
      "nuance": "Often softens “not currently” responses.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "progressivePolitePast": {
    "default": {
      "key": "progressivePolitePast",
      "title": "Progressive Past (Polite)",
      "summary": "Used to politely describe ongoing actions or continuing states in the past.",
      "useCases": [
        "Polite reporting",
        "Workplace explanations",
        "Formal narrative/background"
      ],
      "nuance": "Useful for respectful reporting of past situations.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "progressivePolitePastNegative": {
    "default": {
      "key": "progressivePolitePastNegative",
      "title": "Progressive Past Negative (Polite)",
      "summary": "Used to politely say something was not ongoing or not true in the past.",
      "useCases": [
        "Polite correction",
        "Professional clarification",
        "Formal explanations"
      ],
      "nuance": "Common in careful, respectful corrections.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "request": {
    "default": {
      "key": "request",
      "title": "Request",
      "summary": "Used to ask someone to do something politely.",
      "useCases": [
        "Polite requests",
        "Instructions",
        "Everyday service interactions"
      ],
      "nuance": "Polite, but still a request; tone depends on context and delivery.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "requestNegative": {
    "default": {
      "key": "requestNegative",
      "title": "Negative Request (〜ないでください)",
      "summary": "Used to politely ask someone not to do something.",
      "useCases": [
        "Polite “please don’t…” requests",
        "Warnings/instructions",
        "Customer and service situations"
      ],
      "nuance": "Polite but still direct; softer alternatives exist depending on context.",
      "register": "polite",
      "level": "beginner",
      "reviewed": true,
      "version": 1
    }
  },
  "requestPolite": {
    "default": {
      "key": "requestPolite",
      "title": "Request (More Polite)",
      "summary": "Used for more polite requesting than standard request forms (exact nuance depends on the specific pattern).",
      "useCases": [
        "Customer service language",
        "Formal situations",
        "Requests to seniors or clients"
      ],
      "nuance": "Exact politeness level depends on the concrete request pattern used by the app.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "colloquialNegative": {
    "default": {
      "key": "colloquialNegative",
      "title": "Colloquial Negative",
      "summary": "Used as an informal spoken negative variant in casual conversation.",
      "useCases": [
        "Everyday spoken Japanese",
        "Casual conversation with friends",
        "Recognizing contractions/shortened negatives"
      ],
      "nuance": "Varies by form and can sound rough or regional; avoid in formal contexts.",
      "register": "spoken",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "colloquialPast": {
    "default": {
      "key": "colloquialPast",
      "title": "Colloquial Past",
      "summary": "Used for an informal/spoken past variant when the app exposes one.",
      "useCases": [
        "Recognizing casual speech variants",
        "Comparing standard vs colloquial past usage",
        "Drill coverage of spoken-style forms"
      ],
      "nuance": "Depending on the verb, this may match the regular past form exactly.",
      "register": "spoken",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "formalNegative": {
    "default": {
      "key": "formalNegative",
      "title": "Formal Negative",
      "summary": "Used to express negation in a more formal or literary style (often seen in writing and set expressions).",
      "useCases": [
        "Formal or literary writing",
        "Recognizing older-style negative expressions in reading",
        "Drill coverage of advanced negative variants"
      ],
      "nuance": "This is not the normal everyday spoken negative; it appears more in written, formal, or fixed-expression contexts.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "classicalNegative": {
    "default": {
      "key": "classicalNegative",
      "title": "Classical Negative",
      "summary": "Used in classical/literary Japanese and fixed expressions with older negative patterns.",
      "useCases": [
        "Reading classical-style text",
        "Recognizing fixed expressions",
        "Drill exposure to literary forms"
      ],
      "nuance": "Primarily recognition-focused for modern learners, not everyday spoken production.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "classicalNegativeModifier": {
    "default": {
      "key": "classicalNegativeModifier",
      "title": "Classical Negative Modifier",
      "summary": "Used to modify nouns/phrases with a classical negative form in literary or fixed-expression contexts.",
      "useCases": [
        "Reading literary Japanese",
        "Recognizing set phrases",
        "Understanding older modifier patterns"
      ],
      "nuance": "Mostly useful for recognition and reading comprehension rather than normal conversation.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "presumptive": {
    "default": {
      "key": "presumptive",
      "title": "Presumptive (Guess / Probably)",
      "summary": "Used to express a guess, assumption, or probability.",
      "useCases": [
        "Making a guess based on evidence",
        "Softening statements",
        "Expressing uncertainty politely/carefully"
      ],
      "nuance": "The exact strength of certainty depends on the specific presumptive pattern.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "presumptiveNegative": {
    "default": {
      "key": "presumptiveNegative",
      "title": "Presumptive Negative",
      "summary": "Used to express a negative guess or assumption (“probably not …”).",
      "useCases": [
        "Negative guesses",
        "Soft denial",
        "Uncertain negative statements"
      ],
      "nuance": "Useful when avoiding overly absolute statements.",
      "register": "written",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "presumptivePolite": {
    "default": {
      "key": "presumptivePolite",
      "title": "Presumptive (Polite)",
      "summary": "Used to politely express a guess or assumption.",
      "useCases": [
        "Polite hedging",
        "Work/customer interactions",
        "Careful professional statements"
      ],
      "nuance": "Helps avoid sounding too certain in formal contexts.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  },
  "presumptivePoliteNegative": {
    "default": {
      "key": "presumptivePoliteNegative",
      "title": "Presumptive Negative (Polite)",
      "summary": "Used to politely express a negative guess or assumption.",
      "useCases": [
        "Polite uncertainty",
        "Soft negative statements",
        "Professional hedging"
      ],
      "nuance": "Common when careful wording is preferred over blunt certainty.",
      "register": "polite",
      "level": "intermediate",
      "reviewed": true,
      "version": 1
    }
  }
}

const CURATED_CONJUGATION_USAGE_NOTES = Object.fromEntries(
  Object.entries(RAW_USAGE_NOTES).map(([key, value]) => [key, ConjugationUsageByTypeSchema.parse(value)])
) as Partial<Record<ConjugationFormKey, ConjugationUsageByType>>

const ALL_CONJUGATION_FORM_KEYS: ConjugationFormKey[] = [
  'present',
  'masuStem',
  'negativeStem',
  'past',
  'negative',
  'pastNegative',
  'polite',
  'politePast',
  'politeNegative',
  'politePastNegative',
  'politeVolitional',
  'teForm',
  'negativeTeForm',
  'naiDeForm',
  'adverbialNegative',
  'volitional',
  'volitionalNegative',
  'imperativePlain',
  'imperativePolite',
  'imperativeNegative',
  'provisional',
  'provisionalNegative',
  'provisionalNegativeColloquial',
  'conditional',
  'conditionalNegative',
  'alternativeForm',
  'alternativeNegative',
  'potential',
  'potentialNegative',
  'potentialPast',
  'potentialPastNegative',
  'potentialMasuStem',
  'potentialTeForm',
  'potentialNegativeTeForm',
  'potentialPolite',
  'potentialPoliteNegative',
  'potentialPolitePast',
  'potentialPolitePastNegative',
  'passive',
  'passiveNegative',
  'passivePast',
  'passivePastNegative',
  'passiveMasuStem',
  'passiveTeForm',
  'passiveNegativeTeForm',
  'passivePolite',
  'passivePoliteNegative',
  'passivePolitePast',
  'passivePolitePastNegative',
  'causative',
  'causativeNegative',
  'causativePast',
  'causativePastNegative',
  'causativeMasuStem',
  'causativeTeForm',
  'causativeNegativeTeForm',
  'causativePolite',
  'causativePoliteNegative',
  'causativePolitePast',
  'causativePolitePastNegative',
  'causativePassive',
  'causativePassiveNegative',
  'causativePassivePast',
  'causativePassivePastNegative',
  'causativePassiveMasuStem',
  'causativePassiveTeForm',
  'causativePassiveNegativeTeForm',
  'causativePassivePolite',
  'causativePassivePoliteNegative',
  'causativePassivePolitePast',
  'causativePassivePolitePastNegative',
  'taiForm',
  'taiFormNegative',
  'taiFormPast',
  'taiFormPastNegative',
  'taiAdjectiveStem',
  'taiTeForm',
  'taiNegativeTeForm',
  'taiAdverbial',
  'taiProvisional',
  'taiProvisionalNegative',
  'taiConditional',
  'taiConditionalNegative',
  'taiObjective',
  'progressive',
  'progressiveNegative',
  'progressivePast',
  'progressivePastNegative',
  'progressivePolite',
  'progressivePoliteNegative',
  'progressivePolitePast',
  'progressivePolitePastNegative',
  'request',
  'requestNegative',
  'requestPolite',
  'colloquialNegative',
  'colloquialPast',
  'formalNegative',
  'classicalNegative',
  'classicalNegativeModifier',
  'presumptive',
  'presumptiveNegative',
  'presumptivePolite',
  'presumptivePoliteNegative',
]

const NOTE_OVERRIDES: Partial<Record<ConjugationFormKey, ConjugationUsageNote>> = {
  politeNegative: {
    key: 'politeNegative',
    title: 'Polite Negative',
    summary: 'Used to politely say something does not happen or is not the case.',
    useCases: ['Polite negation', 'Formal denial/correction', 'Customer-facing speech'],
    nuance: 'This is general polite negation; ability/impossibility meanings belong to potential forms or context-specific verbs.',
    register: 'polite',
    level: 'beginner',
    reviewed: true,
    version: 1,
  },
  negativeTeForm: {
    key: 'negativeTeForm',
    title: 'Negative Te Form',
    summary: 'Used to connect negative clauses and to give reasons/background for something not happening.',
    useCases: [
      'Linking a negative action/state to another clause',
      'Giving a reason or cause in the negative',
      'Connecting two negative descriptions',
    ],
    nuance: 'Often means “not ... and / so ...”; “without doing” is more commonly associated with 〜ないで in many contexts.',
    register: 'neutral',
    level: 'beginner',
    reviewed: true,
    version: 1,
  },
  volitionalNegative: {
    key: 'volitionalNegative',
    title: 'Negative Volitional',
    summary: 'Used for a strong intention not to do something, often in formal or literary-style expressions.',
    useCases: [
      'Declaring intention not to do something',
      'Formal/literary negative resolve',
      'Recognizing advanced negative intention patterns',
    ],
    nuance: 'Not the common everyday way to say “let’s not”; often feels stronger or more literary.',
    register: 'written',
    level: 'intermediate',
    reviewed: true,
    version: 1,
  },
  taiObjective: {
    key: 'taiObjective',
    title: 'たい Objective (〜たさ)',
    summary: 'Used to nominalize desire as a quality or degree (the feeling/strength of wanting to do something).',
    useCases: [
      'Talking about the degree of desire',
      'Describing motivation as a noun-like concept',
      'More abstract discussion of wanting',
    ],
    nuance: 'This is not the same as directly saying “want to do”; it turns desire into a noun-like idea.',
    register: 'written',
    level: 'intermediate',
    reviewed: true,
    version: 1,
  },
  colloquialPast: {
    key: 'colloquialPast',
    title: 'Colloquial Past',
    summary: 'Used for an informal/spoken past variant when the app exposes one.',
    useCases: [
      'Recognizing casual speech variants',
      'Comparing standard vs colloquial past usage',
      'Drill coverage of spoken-style forms',
    ],
    nuance: 'Depending on the verb, this may match the regular past form exactly.',
    register: 'spoken',
    level: 'intermediate',
    reviewed: true,
    version: 1,
  },
}

function humanizeFormKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bte\b/gi, 'Te')
    .replace(/\bmasu\b/gi, 'Masu')
    .replace(/\bnai\b/gi, 'Nai')
    .replace(/\btai\b/gi, 'Tai')
    .replace(/\bcausative passive\b/i, 'Causative-Passive')
    .replace(/\b([a-z])/g, c => c.toUpperCase())
}

function inferRegister(form: string): ConjugationUsageNote['register'] {
  if (form.includes('Polite') || form === 'request' || form === 'requestNegative' || form === 'requestPolite') return 'polite'
  if (form.toLowerCase().includes('classical') || form.toLowerCase().includes('formal') || form.toLowerCase().includes('presumptive')) return 'written'
  if (form.toLowerCase().includes('colloquial')) return 'spoken'
  return 'neutral'
}

function inferLevel(form: string): ConjugationUsageNote['level'] {
  if (
    form.includes('classical') ||
    form.includes('causative') ||
    form.includes('presumptive') ||
    form.includes('Objective') ||
    form.includes('Stem')
  ) {
    return 'intermediate'
  }
  return 'beginner'
}

function inferFamily(form: string): string {
  if (form.startsWith('potential')) return 'ability/possibility'
  if (form.startsWith('passive')) return 'passive'
  if (form.startsWith('causativePassive')) return 'being made to do something'
  if (form.startsWith('causative')) return 'causative (make/let)'
  if (form.startsWith('tai')) return 'desire (“want to”)'
  if (form.startsWith('progressive')) return 'ongoing/continuing action or state'
  if (form.startsWith('request')) return 'request'
  if (form.includes('imperative')) return 'command/request'
  if (form.toLowerCase().includes('conditional') || form.toLowerCase().includes('provisional')) return 'conditional'
  if (form.includes('Negative')) return 'negative'
  if (form.includes('Past')) return 'past'
  return 'grammatical function'
}

function buildNuance(form: string, wordType?: WordType | null): string {
  if (form.includes('Stem')) return 'This is mostly a helper/base form used to build other expressions, not usually a standalone sentence form.'
  if (form.toLowerCase().includes('classical')) return 'Mostly relevant for literary/classical Japanese or fixed expressions.'
  if (form.toLowerCase().includes('presumptive')) return 'Usually expresses uncertainty, inference, or a softened guess rather than a firm statement.'
  if (wordType === 'Godan' || wordType === 'Ichidan' || wordType === 'Irregular') {
    return 'Interpret the exact nuance from the full sentence; this note describes the form’s general function.'
  }
  return 'Interpret the exact nuance from the full sentence context; this note describes the form’s general function.'
}

function buildGeneratedUsageNote(form: ConjugationFormKey): ConjugationUsageNote {
  const override = NOTE_OVERRIDES[form]
  if (override) return ConjugationUsageNoteSchema.parse(override)

  const title = humanizeFormKey(form)
  return ConjugationUsageNoteSchema.parse({
    key: form,
    title,
    summary: `Used to express the ${inferFamily(form)} meaning of this form in context.`,
    useCases: [
      'Understanding the form when it appears in drills',
      'Recognizing the form in reading or listening',
      'Practicing how this form functions in context',
    ],
    nuance: buildNuance(form, null),
    register: inferRegister(form),
    level: inferLevel(form),
    reviewed: false,
    version: 1,
  })
}

export const CONJUGATION_USAGE_NOTES = Object.fromEntries(
  ALL_CONJUGATION_FORM_KEYS.map((form) => {
    const curated = CURATED_CONJUGATION_USAGE_NOTES[form]
    if (curated) {
      const override = NOTE_OVERRIDES[form]
      if (override) {
        return [form, ConjugationUsageByTypeSchema.parse({ ...curated, default: override })]
      }
      return [form, curated]
    }
    return [form, ConjugationUsageByTypeSchema.parse({ default: buildGeneratedUsageNote(form) })]
  })
) as Record<ConjugationFormKey, ConjugationUsageByType>
