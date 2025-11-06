/**
 * Utility to format conjugation form names from camelCase to human-readable format
 * Uses the same labels as QuestionGenerator for consistency
 */

import type { ExtendedConjugationForms } from '@/types/conjugation';

/**
 * Convert camelCase conjugation form names to human-readable labels
 * @param form - The camelCase form key
 * @returns Human-readable form label
 */
export function formatConjugationForm(form: keyof ExtendedConjugationForms | string): string {
  const labels: Record<string, string> = {
    // Basic Forms
    present: 'Present',
    past: 'Past',
    negative: 'Negative',
    pastNegative: 'Past Negative',

    // Stems
    masuStem: 'Masu Stem',
    negativeStem: 'Negative Stem',

    // Polite Forms
    polite: 'Polite',
    politePast: 'Polite Past',
    politeNegative: 'Polite Negative',
    politePastNegative: 'Polite Past Negative',
    politeVolitional: 'Polite Volitional',

    // Te Forms
    teForm: 'Te-form',
    negativeTeForm: 'Negative Te-form',
    naiDeForm: 'Naide Form',
    adverbialNegative: 'Adverbial Negative',

    // Volitional
    volitional: 'Volitional',
    volitionalNegative: 'Volitional Negative',

    // Imperative
    imperativePlain: 'Imperative',
    imperativePolite: 'Polite Imperative',
    imperativeNegative: 'Negative Imperative',

    // Conditional Forms
    provisional: 'Provisional (ba-form)',
    provisionalNegative: 'Provisional Negative',
    provisionalNegativeColloquial: 'Provisional Negative (Colloquial)',
    conditional: 'Conditional (tara-form)',
    conditionalNegative: 'Conditional Negative',
    alternativeForm: 'Alternative Form (tari)',
    alternativeNegative: 'Alternative Negative',

    // Potential Forms
    potential: 'Potential',
    potentialNegative: 'Potential Negative',
    potentialPast: 'Potential Past',
    potentialPastNegative: 'Potential Past Negative',
    potentialMasuStem: 'Potential Masu Stem',
    potentialTeForm: 'Potential Te-form',
    potentialNegativeTeForm: 'Potential Negative Te-form',
    potentialPolite: 'Potential Polite',
    potentialPoliteNegative: 'Potential Polite Negative',
    potentialPolitePast: 'Potential Polite Past',
    potentialPolitePastNegative: 'Potential Polite Past Negative',

    // Passive Forms
    passive: 'Passive',
    passiveNegative: 'Passive Negative',
    passivePast: 'Passive Past',
    passivePastNegative: 'Passive Past Negative',
    passiveMasuStem: 'Passive Masu Stem',
    passiveTeForm: 'Passive Te-form',
    passiveNegativeTeForm: 'Passive Negative Te-form',
    passivePolite: 'Passive Polite',
    passivePoliteNegative: 'Passive Polite Negative',
    passivePolitePast: 'Passive Polite Past',
    passivePolitePastNegative: 'Passive Polite Past Negative',

    // Causative Forms
    causative: 'Causative',
    causativeNegative: 'Causative Negative',
    causativePast: 'Causative Past',
    causativePastNegative: 'Causative Past Negative',
    causativeMasuStem: 'Causative Masu Stem',
    causativeTeForm: 'Causative Te-form',
    causativeNegativeTeForm: 'Causative Negative Te-form',
    causativePolite: 'Causative Polite',
    causativePoliteNegative: 'Causative Polite Negative',
    causativePolitePast: 'Causative Polite Past',
    causativePolitePastNegative: 'Causative Polite Past Negative',

    // Causative-Passive Forms
    causativePassive: 'Causative-Passive',
    causativePassiveNegative: 'Causative-Passive Negative',
    causativePassivePast: 'Causative-Passive Past',
    causativePassivePastNegative: 'Causative-Passive Past Negative',
    causativePassiveMasuStem: 'Causative-Passive Masu Stem',
    causativePassiveTeForm: 'Causative-Passive Te-form',
    causativePassiveNegativeTeForm: 'Causative-Passive Negative Te-form',
    causativePassivePolite: 'Causative-Passive Polite',
    causativePassivePoliteNegative: 'Causative-Passive Polite Negative',
    causativePassivePolitePast: 'Causative-Passive Polite Past',
    causativePassivePolitePastNegative: 'Causative-Passive Polite Past Negative',

    // Tai Forms (Desiderative)
    taiForm: 'Tai-form (Want to)',
    taiFormNegative: 'Tai-form Negative',
    taiFormPast: 'Tai-form Past',
    taiFormPastNegative: 'Tai-form Past Negative',
    taiAdjectiveStem: 'Tai Adjective Stem',
    taiTeForm: 'Tai Te-form',
    taiNegativeTeForm: 'Tai Negative Te-form',
    taiAdverbial: 'Tai Adverbial',
    taiProvisional: 'Tai Provisional',
    taiProvisionalNegative: 'Tai Provisional Negative',
    taiConditional: 'Tai Conditional',
    taiConditionalNegative: 'Tai Conditional Negative',
    taiObjective: 'Tai Objective',

    // Progressive Forms
    progressive: 'Progressive',
    progressiveNegative: 'Progressive Negative',
    progressivePast: 'Progressive Past',
    progressivePastNegative: 'Progressive Past Negative',
    progressivePolite: 'Progressive Polite',
    progressivePoliteNegative: 'Progressive Polite Negative',
    progressivePolitePast: 'Progressive Polite Past',
    progressivePolitePastNegative: 'Progressive Polite Past Negative',

    // Request Forms
    request: 'Request',
    requestNegative: 'Request Negative',
    requestPolite: 'Polite Request',

    // Colloquial Forms
    colloquialNegative: 'Colloquial Negative',
    colloquialPast: 'Colloquial Past',

    // Classical/Formal Forms
    formalNegative: 'Formal Negative',
    classicalNegative: 'Classical Negative',
    classicalNegativeModifier: 'Classical Negative Modifier',

    // Presumptive Forms
    presumptive: 'Presumptive',
    presumptiveNegative: 'Presumptive Negative',
    presumptivePolite: 'Presumptive Polite',
    presumptivePoliteNegative: 'Presumptive Polite Negative',

    // Adverbial (for adjectives)
    adverbial: 'Adverbial'
  };

  // Return the label if it exists
  if (labels[form]) {
    return labels[form];
  }

  // Otherwise, convert camelCase to Title Case as fallback
  return form
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();
}
