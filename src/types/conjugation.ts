// Extended Conjugation Forms Interface
// Based on comprehensive Japanese conjugation research

export interface ExtendedConjugationForms {
  // ============= BASIC FORMS =============
  // Dictionary Form
  present: string;
  
  // Stems
  masuStem: string;         // 買い (masu form stem)
  negativeStem: string;      // 買わ (negative stem)
  
  // Basic Plain Forms
  past: string;              // 買った
  negative: string;          // 買わない
  pastNegative: string;      // 買わなかった
  
  // ============= POLITE FORMS =============
  polite: string;                  // 買います
  politePast: string;              // 買いました
  politeNegative: string;          // 買いません
  politePastNegative: string;      // 買いませんでした
  politeVolitional: string;        // 買いましょう
  
  // ============= TE FORMS =============
  teForm: string;                  // 買って
  negativeTeForm: string;          // 買わなくて
  naiDeForm: string;               // 買わないで
  adverbialNegative: string;       // 買わなく
  
  // ============= VOLITIONAL =============
  volitional: string;              // 買おう
  volitionalNegative: string;      // 買うまい
  
  // ============= IMPERATIVE =============
  imperativePlain: string;         // 買え
  imperativePolite: string;        // 買いなさい
  imperativeNegative?: string;     // 買うな
  
  // ============= CONDITIONAL FORMS =============
  // Ba-form (provisional)
  provisional: string;             // 買えば
  provisionalNegative: string;     // 買わなければ
  provisionalNegativeColloquial: string; // 買わなきゃ
  
  // Tara-form
  conditional: string;             // 買ったら
  conditionalNegative: string;     // 買わなかったら
  
  // Alternative form
  alternativeForm: string;         // 買ったり
  alternativeNegative?: string;    // 買わなかったり
  
  // ============= POTENTIAL FORMS =============
  // Plain Potential
  potential: string;               // 買える
  potentialNegative: string;       // 買えない
  potentialPast: string;           // 買えた
  potentialPastNegative: string;   // 買えなかった
  
  // Potential Stems
  potentialMasuStem: string;       // 買え
  potentialTeForm: string;         // 買えて
  potentialNegativeTeForm: string; // 買えなくて
  
  // Polite Potential
  potentialPolite: string;                // 買えます
  potentialPoliteNegative: string;        // 買えません
  potentialPolitePast: string;            // 買えました
  potentialPolitePastNegative: string;    // 買えませんでした
  
  // ============= PASSIVE FORMS =============
  // Plain Passive
  passive: string;                 // 買われる
  passiveNegative: string;         // 買われない
  passivePast: string;             // 買われた
  passivePastNegative: string;     // 買われなかった
  
  // Passive Stems
  passiveMasuStem: string;         // 買われ
  passiveTeForm: string;           // 買われて
  passiveNegativeTeForm: string;   // 買われなくて
  
  // Polite Passive
  passivePolite: string;                  // 買われます
  passivePoliteNegative: string;          // 買われません
  passivePolitePast: string;              // 買われました
  passivePolitePastNegative: string;      // 買われませんでした
  
  // ============= CAUSATIVE FORMS =============
  // Plain Causative
  causative: string;               // 買わせる
  causativeNegative: string;       // 買わせない
  causativePast: string;           // 買わせた
  causativePastNegative: string;   // 買わせなかった
  
  // Causative Stems
  causativeMasuStem: string;       // 買わせ
  causativeTeForm: string;         // 買わせて
  causativeNegativeTeForm: string; // 買わせなくて
  
  // Polite Causative
  causativePolite: string;                // 買わせます
  causativePoliteNegative: string;        // 買わせません
  causativePolitePast: string;            // 買わせました
  causativePolitePastNegative: string;    // 買わせませんでした
  
  // ============= CAUSATIVE-PASSIVE =============
  // Plain Causative-Passive
  causativePassive: string;               // 買わされる or 買わせられる
  causativePassiveNegative: string;       // 買わされない
  causativePassivePast: string;           // 買わされた
  causativePassivePastNegative: string;   // 買わされなかった
  
  // Causative-Passive Stems
  causativePassiveMasuStem: string;       // 買わされ
  causativePassiveTeForm: string;         // 買わされて
  causativePassiveNegativeTeForm: string; // 買わされなくて
  
  // Polite Causative-Passive
  causativePassivePolite: string;                // 買わされます
  causativePassivePoliteNegative: string;        // 買わされません
  causativePassivePolitePast: string;            // 買わされました
  causativePassivePolitePastNegative: string;    // 買わされませんでした
  
  // ============= TAI FORMS (DESIDERATIVE) =============
  // Basic Tai Forms
  taiForm: string;                 // 買いたい
  taiFormNegative: string;         // 買いたくない
  taiFormPast: string;             // 買いたかった
  taiFormPastNegative: string;     // 買いたくなかった
  
  // Tai Adjective Forms (as i-adjective)
  taiAdjectiveStem: string;        // 買いた
  taiTeForm: string;               // 買いたくて
  taiNegativeTeForm: string;       // 買いたくなくて
  taiAdverbial: string;            // 買いたく
  
  // Tai Conditional Forms
  taiProvisional: string;          // 買いたければ
  taiProvisionalNegative: string;  // 買いたくなければ
  taiConditional: string;          // 買いたかったら
  taiConditionalNegative: string;  // 買いたくなかったら
  
  // Tai Objective Form
  taiObjective: string;            // 買いたさ
  
  // ============= PROGRESSIVE FORMS =============
  progressive: string;                    // 買っている
  progressiveNegative: string;            // 買っていない
  progressivePast: string;                // 買っていた
  progressivePastNegative: string;        // 買っていなかった
  progressivePolite: string;              // 買っています
  progressivePoliteNegative: string;      // 買っていません
  progressivePolitePast: string;          // 買っていました
  progressivePolitePastNegative: string;  // 買っていませんでした
  
  // ============= REQUEST FORMS =============
  request: string;                 // 買ってください
  requestNegative: string;         // 買わないでください
  requestPolite?: string;          // お買いください
  
  // ============= COLLOQUIAL FORMS =============
  colloquialNegative: string;      // 買わん
  colloquialPast?: string;         // 買った (same as past)
  
  // ============= CLASSICAL/FORMAL FORMS =============
  formalNegative: string;          // 買わず
  classicalNegative: string;       // 買わぬ
  classicalNegativeModifier: string; // 買わざる
  
  // ============= PRESUMPTIVE FORMS =============
  presumptive?: string;            // 買うだろう
  presumptiveNegative?: string;    // 買わないだろう
  presumptivePolite?: string;      // 買うでしょう
  presumptivePoliteNegative?: string; // 買わないでしょう
}

// Type to indicate which forms are required vs optional
export type RequiredConjugationForms = Pick<ExtendedConjugationForms,
  | 'present'
  | 'masuStem'
  | 'negativeStem'
  | 'past'
  | 'negative'
  | 'pastNegative'
  | 'polite'
  | 'politePast'
  | 'politeNegative'
  | 'politePastNegative'
  | 'teForm'
  | 'volitional'
  | 'imperativePlain'
  | 'provisional'
  | 'conditional'
  | 'potential'
  | 'passive'
  | 'causative'
  | 'causativePassive'
  | 'taiForm'
>;

// Helper type for partial conjugations
export type PartialConjugationForms = Partial<ExtendedConjugationForms>;