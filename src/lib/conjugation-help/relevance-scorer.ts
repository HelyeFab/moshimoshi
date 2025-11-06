/**
 * Help Relevance Scorer
 *
 * Scores and ranks help content by relevance to the user's error.
 * Uses multiple factors to determine which help bubbles are most useful.
 */

import type { HelpContent } from '@/data/conjugation-help/help-content';
import type { ErrorAnalysis, RankedHelp } from './types';
import {
  getHelpByErrorPattern,
  getHelpByWordType,
  getHelpByFormType,
  HELP_CONTENT
} from '@/data/conjugation-help';

/**
 * Scores and ranks help content by relevance to the error
 */
export class HelpRelevanceScorer {
  /**
   * Get relevant help content ranked by relevance
   */
  static getRelevantHelp(
    analysis: ErrorAnalysis,
    maxResults: number = 3
  ): RankedHelp[] {
    const helpMap = new Map<string, RankedHelp>();

    // 1. Get help by error pattern (regex matching)
    const patternHelp = getHelpByErrorPattern(analysis.userInput);
    patternHelp.forEach(help => {
      const score = this.scoreByErrorPattern(help, analysis);
      helpMap.set(help.id, {
        helpContent: help,
        relevanceScore: score,
        matchReasons: ['Matches error pattern']
      });
    });

    // 2. Get help by word type
    const wordTypeHelp = getHelpByWordType(analysis.word.type);
    wordTypeHelp.forEach(help => {
      if (helpMap.has(help.id)) {
        const existing = helpMap.get(help.id)!;
        const additionalScore = this.scoreByWordType(help, analysis);
        existing.relevanceScore += additionalScore;
        existing.matchReasons.push('Relevant to word type');
      } else {
        helpMap.set(help.id, {
          helpContent: help,
          relevanceScore: this.scoreByWordType(help, analysis),
          matchReasons: ['Relevant to word type']
        });
      }
    });

    // 3. Get help by form type
    const formTypeHelp = getHelpByFormType(analysis.attemptedForm);
    formTypeHelp.forEach(help => {
      if (helpMap.has(help.id)) {
        const existing = helpMap.get(help.id)!;
        const additionalScore = this.scoreByFormType(help, analysis);
        existing.relevanceScore += additionalScore;
        existing.matchReasons.push('Relevant to conjugation form');
      } else {
        helpMap.set(help.id, {
          helpContent: help,
          relevanceScore: this.scoreByFormType(help, analysis),
          matchReasons: ['Relevant to conjugation form']
        });
      }
    });

    // 4. Score by error type for all help content
    const allHelp = Array.from(helpMap.values());
    allHelp.forEach(ranked => {
      const errorTypeBonus = this.scoreByErrorType(ranked.helpContent, analysis);
      if (errorTypeBonus > 0) {
        ranked.relevanceScore += errorTypeBonus;
        ranked.matchReasons.push('Matches error type');
      }
    });

    // 5. Filter out helps with negative or very low scores (irrelevant)
    const filteredHelp = allHelp.filter(h => h.relevanceScore > 50);

    // DON'T add fallback "general help" - better to show nothing than wrong help!
    // If filteredHelp.length === 0, user won't see a help banner (which is correct)

    // 6. Sort by relevance and return top N (default to just 1 - the most relevant!)
    return filteredHelp
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, Math.min(maxResults, filteredHelp.length));
  }

  /**
   * Score help content based on error pattern matching
   */
  private static scoreByErrorPattern(help: HelpContent, analysis: ErrorAnalysis): number {
    let score = 40; // Base score for pattern match

    // Boost if error pattern exactly matches
    if (help.triggers.errorPatterns?.some(pattern => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(analysis.userInput);
      } catch (e) {
        console.warn(`Invalid regex pattern: ${pattern}`, e);
        return false;
      }
    })) {
      score += 20;
    }

    return score;
  }

  /**
   * Score help content based on word type relevance
   */
  private static scoreByWordType(help: HelpContent, analysis: ErrorAnalysis): number {
    let score = 0;

    // Exact word type match - HIGH PRIORITY
    if (help.triggers.wordTypes.includes(analysis.word.type)) {
      score += 100; // Strong boost for matching word type
    }

    // "all" wildcard - very low priority
    if (help.triggers.wordTypes.includes('all')) {
      score += 5;
    }

    // PENALTY for word type mismatch (e.g., showing adjective help for verb drills)
    const isVerbDrill = ['Ichidan', 'Godan', 'Irregular'].includes(analysis.word.type);
    const isAdjectiveDrill = ['i-adjective', 'na-adjective'].includes(analysis.word.type);
    const isAdjectiveHelp = help.triggers.wordTypes.some(type =>
      type === 'i-adjective' || type === 'na-adjective'
    );
    const isVerbHelp = help.triggers.wordTypes.some(type =>
      type === 'Ichidan' || type === 'Godan' || type === 'Irregular'
    );

    // Heavily penalize showing adjective help for verb drills and vice versa
    if (isVerbDrill && isAdjectiveHelp && !help.triggers.wordTypes.includes('all')) {
      score -= 1000; // Filter out adjective help when practicing verbs
    }
    if (isAdjectiveDrill && isVerbHelp && !help.triggers.wordTypes.includes('all')) {
      score -= 1000; // Filter out verb help when practicing adjectives
    }

    return score;
  }

  /**
   * Score help content based on conjugation form relevance
   */
  private static scoreByFormType(help: HelpContent, analysis: ErrorAnalysis): number {
    let score = 0;

    // EXACT FORM MATCH = HIGHEST PRIORITY (this is what the user is practicing!)
    if (help.triggers.formTypes.includes(analysis.attemptedForm)) {
      score += 200; // Massive boost for exact form match
    }

    // If user used wrong form, that form is also highly relevant
    if (analysis.closestWrongForm) {
      if (help.triggers.formTypes.includes(analysis.closestWrongForm.formName)) {
        score += 150; // High boost for the wrong form they used
      }
    }

    // "all" wildcard gets very low score (only as fallback)
    if (help.triggers.formTypes.includes('all')) {
      score += 5;
    }

    return score;
  }

  /**
   * Score help content based on error type
   */
  private static scoreByErrorType(help: HelpContent, analysis: ErrorAnalysis): number {
    let score = 0;

    // Special case errors get special case help
    if (analysis.errorType === 'special-case' && help.category === 'special-case') {
      score += 100; // High priority for special cases
    }

    // ONLY show verb type help if it's actually a verb type error
    if (analysis.errorType === 'wrong-verb-type' && help.category === 'verb-type') {
      score += 150; // High boost only when relevant
    } else if (help.category === 'verb-type') {
      // If NOT a verb type error, heavily penalize verb type help
      score -= 1000; // Effectively filter it out
    }

    // Form confusion gets form help (but form-specific help scored higher elsewhere)
    if (analysis.errorType === 'wrong-form') {
      if (help.category === 'meaning' || help.category === 'tense') {
        score += 50;
      }
    }

    // Mnemonic helps are useful but low priority
    if (help.category === 'mnemonic') {
      score += 10;
    }

    // Politeness level confusion
    if (help.category === 'politeness') {
      score += 30;
    }

    return score;
  }

  /**
   * Get general help content when specific matches are insufficient
   */
  private static getGeneralHelp(
    analysis: ErrorAnalysis,
    existingHelp: Map<string, RankedHelp>
  ): RankedHelp[] {
    const generalHelp: RankedHelp[] = [];

    // Add verb type help if not already present
    const verbTypeHelpId = `${analysis.word.type.toLowerCase()}-verbs`;
    if (!existingHelp.has(verbTypeHelpId)) {
      const help = HELP_CONTENT.find(h => h.id === verbTypeHelpId);
      if (help) {
        generalHelp.push({
          helpContent: help,
          relevanceScore: 20,
          matchReasons: ['General help for your word type']
        });
      }
    }

    // Add mnemonic help for Godan verbs
    if (analysis.word.type === 'Godan') {
      const teFormHelp = HELP_CONTENT.find(h => h.id === 'te-form-groups');
      if (teFormHelp && !existingHelp.has(teFormHelp.id)) {
        generalHelp.push({
          helpContent: teFormHelp,
          relevanceScore: 15,
          matchReasons: ['Useful mnemonic for Godan verbs']
        });
      }
    }

    return generalHelp;
  }
}
