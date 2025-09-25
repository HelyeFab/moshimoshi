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
      type: 'anki-card',
      content: {
        primary: item.front,
        secondary: item.back,
        tertiary: item.tags?.join(', '),
        media: item.media,
        metadata: {
          deckName: item.deckName,
          fields: item.fields,
          interval: item.interval,
          ease: item.ease,
          reviews: item.reviews,
          lapses: item.lapses
        }
      },
      metadata: {
        ...item.metadata,
        source: 'anki',
        deckName: item.deckName,
        tags: item.tags,
        hasMedia: (item.media?.length || 0) > 0
      }
    };
  }

  generateOptions(
    content: ReviewableContent,
    pool: AnkiCard[],
    count: number
  ): ReviewableContent[] {
    // For Anki cards, we generate options based on similar cards from the pool
    const options: ReviewableContent[] = [];
    const currentCard = content.content as any;

    // Filter out the current card and cards with identical answers
    const validPool = pool.filter(card =>
      card.id !== content.id &&
      card.back !== currentCard.secondary
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
      // In recall mode, hide the answer (secondary)
      prepared.content = {
        ...prepared.content,
        secondary: undefined
      };
    } else if (mode === 'recognition') {
      // In recognition mode, show the question
      prepared.content = {
        ...prepared.content,
        primary: content.content.primary
      };
    }

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
    const ankiContent = content.content as any;

    // Add tag hints
    if (content.metadata?.tags?.length) {
      hints.push(`Tags: ${content.metadata.tags.join(', ')}`);
    }

    // Add first letter hint
    if (ankiContent.secondary && ankiContent.secondary.length > 0) {
      hints.push(`Starts with: ${ankiContent.secondary[0]}`);
    }

    // Add length hint for text answers
    if (ankiContent.secondary && typeof ankiContent.secondary === 'string') {
      hints.push(`${ankiContent.secondary.length} characters`);
    }

    // Add deck name as hint
    if (content.metadata?.deckName) {
      hints.push(`From deck: ${content.metadata.deckName}`);
    }

    return hints;
  }
}