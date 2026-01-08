import { BaseContentAdapter } from './base.adapter';
import type { ReviewableContent, ReviewMode } from '../core/interfaces';
import type { FlashcardDeck, FlashcardContent } from '@/types/flashcards';

export class FlashcardAdapter extends BaseContentAdapter {
  private deck: FlashcardDeck;
  private currentCards: FlashcardContent[];

  constructor(deck: FlashcardDeck) {
    super();
    this.deck = deck;
    this.currentCards = [...deck.cards]; // Copy to avoid mutations
  }

  // Helper methods to safely access CardSide properties (handles both string and object formats)
  private getText(side: string | import('@/types/flashcards').CardSide): string {
    return typeof side === 'string' ? side : side.text;
  }

  private getSubtext(side: string | import('@/types/flashcards').CardSide): string | undefined {
    return typeof side === 'string' ? undefined : side.subtext;
  }

  private getMedia(side: string | import('@/types/flashcards').CardSide) {
    return typeof side === 'string' ? undefined : side.media;
  }

  transform(card: FlashcardContent): ReviewableContent {
    const supportedModes = this.getSupportedModesForCard(card);
    const preferredMode = this.getPreferredMode(card);

    return {
      id: card.id,
      contentType: 'custom',  // Flashcards are custom content

      // Display fields based on deck settings
      primaryDisplay: this.getPrimaryDisplay(card),
      secondaryDisplay: this.getSecondaryDisplay(card),
      tertiaryDisplay: card.metadata?.notes || '',

      // Answer fields
      primaryAnswer: this.getPrimaryAnswer(card),
      alternativeAnswers: this.getAlternativeAnswers(card),

      // Media
      audioUrl: card.metadata?.audioUrl,
      imageUrl: card.metadata?.imageUrl,
      videoUrl: this.getMedia(card.front)?.type === 'video' ? this.getMedia(card.front)?.url : undefined,

      // Metadata
      difficulty: card.metadata?.difficulty || this.calculateDifficulty(card),
      tags: [
        ...(card.metadata?.tags || []),
        `deck:${this.deck.name}`,
        this.deck.cardStyle
      ],
      source: `flashcard:${this.deck.id}`,

      // Review settings
      supportedModes,
      preferredMode,

      // Additional context
      metadata: {
        deckName: this.deck.name,
        deckEmoji: this.deck.emoji,
        cardStyle: this.deck.cardStyle,
        frontHint: this.getSubtext(card.front),
        backHint: this.getSubtext(card.back),
        frontMedia: this.getMedia(card.front),
        backMedia: this.getMedia(card.back),
        // Store SRS data in metadata if available
        srsData: card.metadata?.interval ? {
          easeFactor: card.metadata.easeFactor || 2.5,
          interval: card.metadata.interval || 0,
          lastReviewed: card.metadata.lastReviewed,
          reviewCount: card.metadata.reviewCount || 0
        } : undefined
      }
    };
  }

  private getPrimaryDisplay(card: FlashcardContent): string {
    const direction = this.deck.settings.studyDirection;

    if (direction === 'back-to-front') {
      return this.getText(card.back);
    } else if (direction === 'mixed' && Math.random() > 0.5) {
      return this.getText(card.back);
    }

    return this.getText(card.front);
  }

  private getSecondaryDisplay(card: FlashcardContent): string {
    const direction = this.deck.settings.studyDirection;

    if (direction === 'back-to-front') {
      return this.getSubtext(card.back) || '';
    } else if (direction === 'mixed' && Math.random() > 0.5) {
      return this.getSubtext(card.back) || '';
    }

    return this.getSubtext(card.front) || '';
  }

  private getPrimaryAnswer(card: FlashcardContent): string {
    const direction = this.deck.settings.studyDirection;

    if (direction === 'back-to-front') {
      return this.getText(card.front);
    } else if (direction === 'mixed' && this.getPrimaryDisplay(card) === this.getText(card.back)) {
      return this.getText(card.front);
    }

    return this.getText(card.back);
  }

  private getAlternativeAnswers(card: FlashcardContent): string[] {
    const alternatives: string[] = [];

    // Add subtext as alternative if present
    const direction = this.deck.settings.studyDirection;
    const frontSubtext = this.getSubtext(card.front);
    const backSubtext = this.getSubtext(card.back);

    if (direction === 'back-to-front' && frontSubtext) {
      alternatives.push(frontSubtext);
    } else if (backSubtext) {
      alternatives.push(backSubtext);
    }

    return alternatives;
  }

  // Generate string options for multiple choice (internal method)
  private generateStringOptions(card: FlashcardContent, count: number = 4): string[] {
    const options: string[] = [];
    const correctAnswer = this.getPrimaryAnswer(card);
    options.push(correctAnswer);

    // Get other cards from the same deck as distractors
    const otherCards = this.currentCards.filter(c => c.id !== card.id);

    // Shuffle and select distractors
    const shuffled = [...otherCards].sort(() => Math.random() - 0.5);

    for (const otherCard of shuffled) {
      if (options.length >= count) break;

      // Use the same side as the correct answer for consistency
      const distractor = this.deck.settings.studyDirection === 'back-to-front'
        ? this.getText(otherCard.front)
        : this.getText(otherCard.back);

      // Ensure uniqueness
      if (!options.includes(distractor)) {
        options.push(distractor);
      }
    }

    // If we still need more options, generate some generic ones
    while (options.length < count) {
      const genericOptions = this.getGenericOptions();
      for (const option of genericOptions) {
        if (!options.includes(option) && options.length < count) {
          options.push(option);
        }
      }
    }

    // Shuffle the options
    return options.sort(() => Math.random() - 0.5);
  }

  private getGenericOptions(): string[] {
    // Generic options based on common flashcard content
    return [
      'I don\'t know',
      'Not sure',
      'None of the above',
      'All of the above',
      'True',
      'False',
      'Maybe',
      'Sometimes'
    ];
  }

  calculateDifficulty(card: FlashcardContent): number {
    let difficulty = 0.5; // Base difficulty

    // If SRS data exists, use it
    if (card.metadata?.difficulty !== undefined) {
      return card.metadata.difficulty;
    }

    // Calculate based on content complexity
    const textLength = this.getText(card.front).length + this.getText(card.back).length;
    if (textLength > 100) difficulty += 0.1;
    if (textLength > 200) difficulty += 0.1;
    if (textLength > 300) difficulty += 0.1;

    // Adjust based on media presence
    if (this.getMedia(card.front) || this.getMedia(card.back)) {
      difficulty -= 0.05; // Media makes it easier
    }

    // Adjust based on review history
    if (card.metadata?.reviewCount) {
      const accuracy = card.metadata.correctCount
        ? card.metadata.correctCount / card.metadata.reviewCount
        : 0.5;
      difficulty = 1 - accuracy; // Higher accuracy = lower difficulty
    }

    return Math.min(1, Math.max(0, difficulty));
  }

  // Generate hints for a specific card (internal method)
  private getHintsForCard(card: FlashcardContent): string[] {
    const hints: string[] = [];
    const answer = this.getPrimaryAnswer(card);

    // Add subtext as first hint if available
    const direction = this.deck.settings.studyDirection;
    const frontSubtext = this.getSubtext(card.front);
    const backSubtext = this.getSubtext(card.back);

    if (direction === 'back-to-front' && frontSubtext) {
      hints.push(frontSubtext);
    } else if (backSubtext) {
      hints.push(backSubtext);
    }

    // Add notes as hint if available
    if (card.metadata?.notes) {
      hints.push(card.metadata.notes);
    }

    // Add first letter hint
    if (answer.length > 0) {
      hints.push(`Starts with "${answer[0]}"`);
    }

    // Add word count hint
    const words = answer.split(' ');
    if (words.length > 1) {
      hints.push(`${words.length} words`);
    }

    // Add length hint
    hints.push(`${answer.length} characters`);

    // Add partial reveal hint
    if (answer.length > 4) {
      const revealed = answer.substring(0, Math.floor(answer.length / 3));
      hints.push(`Begins with: "${revealed}..."`);
    }

    return hints;
  }

  private prepareCardForMode(card: FlashcardContent, mode: ReviewMode): ReviewableContent {
    const base = this.transform(card);

    switch (mode) {
      case 'recognition':
        // Multiple choice - show question, select answer
        base.primaryDisplay = this.getPrimaryDisplay(card);
        base.secondaryDisplay = this.getSecondaryDisplay(card);
        base.primaryAnswer = this.getPrimaryAnswer(card);
        break;

      case 'recall':
        // Type the answer
        base.primaryDisplay = this.getPrimaryDisplay(card);
        base.secondaryDisplay = this.getSecondaryDisplay(card);
        base.primaryAnswer = this.getPrimaryAnswer(card);
        break;

      case 'listening':
        // For listening mode, hide text initially
        if (base.audioUrl) {
          base.primaryDisplay = '🔊 Listen carefully';
          base.secondaryDisplay = '';
        }
        break;

      case 'writing':
        // For writing mode, show meaning and let user write
        base.primaryDisplay = this.getPrimaryDisplay(card);
        base.primaryAnswer = this.getPrimaryAnswer(card);
        break;

      default:
        // Default to recognition mode
        break;
    }

    return base;
  }

  private getSupportedModesForCard(card: FlashcardContent): ReviewMode[] {
    const modes: ReviewMode[] = [];

    // All flashcards support recognition and recall
    modes.push('recognition');
    modes.push('recall');

    // Support listening if audio is available
    if (card.metadata?.audioUrl || this.getMedia(card.front)?.type === 'audio') {
      modes.push('listening');
    }

    // Support writing for short answers
    const answer = this.getPrimaryAnswer(card);
    if (answer.length <= 20) {
      modes.push('writing');
    }

    return modes;
  }

  private getPreferredMode(card: FlashcardContent): ReviewMode {
    const modes = this.getSupportedModesForCard(card);

    // Use deck's review mode setting if available
    if (this.deck.settings.reviewMode === 'random') {
      return modes[Math.floor(Math.random() * modes.length)];
    }

    // Default to recognition
    return modes[0] || 'recognition';
  }

  // Get all cards as ReviewableContent for the review session
  getAllCards(): ReviewableContent[] {
    return this.currentCards.map(card => this.transform(card));
  }

  // Get cards for a specific review mode
  getCardsForMode(mode: ReviewMode): ReviewableContent[] {
    return this.currentCards
      .filter(card => this.getSupportedModesForCard(card).includes(mode))
      .map(card => this.prepareCardForMode(card, mode));
  }

  // Get cards based on SRS status
  getCardsByStatus(status: 'new' | 'learning' | 'review' | 'due'): ReviewableContent[] {
    const now = Date.now();

    return this.currentCards.filter(card => {
      if (status === 'new') {
        return card.metadata?.status === 'new' || !card.metadata?.lastReviewed;
      } else if (status === 'learning') {
        return card.metadata?.status === 'learning';
      } else if (status === 'review') {
        return card.metadata?.status === 'review' || card.metadata?.status === 'mastered';
      } else if (status === 'due') {
        return card.metadata?.nextReview && card.metadata.nextReview <= now;
      }
      return false;
    }).map(card => this.transform(card));
  }

  // Get deck info for display
  getDeckInfo() {
    return {
      id: this.deck.id,
      name: this.deck.name,
      description: this.deck.description,
      emoji: this.deck.emoji,
      color: this.deck.color,
      cardCount: this.deck.cards.length,
      stats: this.deck.stats,
      settings: this.deck.settings
    };
  }
}