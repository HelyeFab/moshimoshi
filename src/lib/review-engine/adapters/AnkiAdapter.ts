import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode, ContentTypeConfig } from '../core/types';
import { AnkiCard } from '@/lib/anki/importer';

export class AnkiAdapter extends BaseContentAdapter<AnkiCard> {
  constructor() {
    // Default config for Anki cards
    const config: ContentTypeConfig = {
      contentType: 'anki-card',
      availableModes: [
        {
          mode: 'recognition' as ReviewMode,
          showPrimary: true,
          showSecondary: false,
          showTertiary: false,
          showMedia: true,
          inputType: 'multiple-choice',
          optionCount: 4,
          allowHints: true,
          hintPenalty: 0.1
        },
        {
          mode: 'recall' as ReviewMode,
          showPrimary: true,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'text',
          allowHints: true,
          hintPenalty: 0.2
        }
      ],
      defaultMode: 'recognition' as ReviewMode,
      validationStrategy: 'fuzzy',
      validationOptions: {
        threshold: 0.8,
        ignoreCase: true,
        ignoreWhitespace: true
      }
    };
    super(config);
  }

  transform(item: AnkiCard): ReviewableContent {
    return {
      id: item.id,
      contentType: 'custom',  // Anki cards are custom content
      primaryDisplay: item.front,
      secondaryDisplay: item.back,
      tertiaryDisplay: item.tags?.join(', '),
      primaryAnswer: item.back,
      alternativeAnswers: [],
      difficulty: this.calculateDifficulty(item),
      tags: [...(item.tags || []), 'anki', `deck:${item.deckName}`],
      source: 'anki',
      supportedModes: ['recognition', 'recall'],
      preferredMode: 'recognition',
      // Media in AnkiCard is string[], extract based on extension
      imageUrl: item.media?.find(m => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m)),
      audioUrl: item.media?.find(m => /\.(mp3|wav|ogg|m4a)$/i.test(m)),
      metadata: {
        ...item.metadata,
        source: 'anki',
        deckName: item.deckName,
        fields: item.fields,
        interval: item.interval,
        ease: item.ease,
        reviews: item.reviews,
        lapses: item.lapses,
        hasMedia: (item.media?.length || 0) > 0
      }
    };
  }

  generateOptions(
    content: ReviewableContent,
    pool: AnkiCard[],
    count: number = 4
  ): ReviewableContent[] {
    // For Anki cards, we generate options based on similar cards from the pool
    const options: ReviewableContent[] = [];

    // Filter out the current card and cards with identical answers
    const validPool = pool.filter(card =>
      card.id !== content.id &&
      card.back !== content.primaryAnswer
    );

    // Randomly select options from the pool
    const shuffled = [...validPool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count - 1, shuffled.length));

    // Transform selected cards to ReviewableContent
    selected.forEach(card => {
      options.push(this.transform(card));
    });

    // Add the correct answer
    options.push(content);

    // Shuffle all options
    return options.sort(() => Math.random() - 0.5);
  }

  getSupportedModes(): ReviewMode[] {
    return ['recognition' as ReviewMode, 'recall' as ReviewMode];
  }

  prepareForMode(
    content: ReviewableContent,
    mode: ReviewMode
  ): ReviewableContent {
    const prepared = { ...content };

    if (mode === 'recall') {
      // In recall mode, hide the answer (secondary display)
      prepared.secondaryDisplay = undefined;
    }
    // Recognition mode shows content as-is

    return prepared;
  }

  calculateDifficulty(content: AnkiCard): number {
    // Calculate difficulty based on SRS data if available
    if (content.interval && content.ease) {
      // Longer intervals and higher ease = easier
      const intervalScore = Math.min(content.interval / 365, 1); // Normalize to 0-1
      const easeScore = (content.ease - 1.3) / (2.5 - 1.3); // Normalize ease to 0-1
      const lapseScore = Math.max(0, 1 - (content.lapses || 0) / 10); // More lapses = harder

      // Weight the scores
      const difficulty = 1 - (intervalScore * 0.3 + easeScore * 0.3 + lapseScore * 0.4);
      return Math.max(0.1, Math.min(1, difficulty));
    }

    // Default medium difficulty for new cards
    return 0.5;
  }

  generateHints(content: ReviewableContent): string[] {
    const hints: string[] = [];

    // Add tag hints
    if (content.tags?.length) {
      hints.push(`Tags: ${content.tags.join(', ')}`);
    }

    // Add first letter hint
    if (content.primaryAnswer && content.primaryAnswer.length > 0) {
      hints.push(`Starts with: ${content.primaryAnswer[0]}`);
    }

    // Add length hint for text answers
    if (content.primaryAnswer && typeof content.primaryAnswer === 'string') {
      hints.push(`${content.primaryAnswer.length} characters`);
    }

    // Add deck name as hint
    if (content.metadata?.deckName) {
      hints.push(`From deck: ${content.metadata.deckName}`);
    }

    return hints;
  }
}