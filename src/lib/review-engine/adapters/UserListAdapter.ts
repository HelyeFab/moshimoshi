import { BaseContentAdapter } from './BaseContentAdapter';
import type { ReviewableContent, ReviewMode } from '../core/interfaces';
import type { UserList, ListItem } from '@/types/userLists';

export class UserListAdapter extends BaseContentAdapter {
  private list: UserList;
  private currentItems: ListItem[];

  constructor(list: UserList) {
    super();
    this.list = list;
    this.currentItems = [...list.items]; // Copy to avoid mutations
  }

  transform(item: ListItem): ReviewableContent {
    // Determine the best review mode based on list type
    const supportedModes = this.getSupportedModes();
    const preferredMode = supportedModes[0]; // Default to first supported mode

    return {
      id: item.id,
      type: 'user-list-item',
      content: item.content,

      // Display fields
      primaryDisplay: item.content, // The main content (word, sentence, etc.)
      secondaryDisplay: item.metadata?.reading || '', // Reading if available
      tertiaryDisplay: item.metadata?.meaning || '', // Meaning if available

      // Answer fields
      primaryAnswer: item.content,
      alternativeAnswers: item.metadata?.reading ? [item.metadata.reading] : [],

      // Media (could be extended later for audio)
      audioUrl: undefined,
      imageUrl: undefined,

      // Metadata
      difficulty: this.calculateDifficulty(item),
      tags: [...(item.metadata?.tags || []), this.list.type, `list:${this.list.name}`],
      source: `list:${this.list.id}`,

      // Review settings
      supportedModes,
      preferredMode,

      // Additional context
      metadata: {
        listName: this.list.name,
        listType: this.list.type,
        itemNotes: item.metadata?.notes,
        jlptLevel: item.metadata?.jlptLevel,
        addedAt: item.metadata?.addedAt
      }
    };
  }

  generateOptions(item: ListItem, count: number = 4): string[] {
    const options: string[] = [];
    const correctAnswer = item.metadata?.meaning || item.content;
    options.push(correctAnswer);

    // Get other items from the same list as distractors
    const otherItems = this.currentItems.filter(i => i.id !== item.id);

    // Shuffle and select distractors
    const shuffled = [...otherItems].sort(() => Math.random() - 0.5);

    for (const otherItem of shuffled) {
      if (options.length >= count) break;

      const distractor = this.list.type === 'sentence'
        ? otherItem.content
        : (otherItem.metadata?.meaning || otherItem.content);

      if (!options.includes(distractor)) {
        options.push(distractor);
      }
    }

    // If we still need more options, generate some defaults
    while (options.length < count) {
      const defaults = this.getDefaultOptions(this.list.type);
      for (const defaultOption of defaults) {
        if (!options.includes(defaultOption) && options.length < count) {
          options.push(defaultOption);
          break;
        }
      }
    }

    // Shuffle the options
    return options.sort(() => Math.random() - 0.5);
  }

  private getDefaultOptions(listType: string): string[] {
    switch (listType) {
      case 'word':
        return [
          'water', 'fire', 'earth', 'wind', 'light', 'dark',
          'big', 'small', 'new', 'old', 'good', 'bad'
        ];
      case 'sentence':
        return [
          'This is a pen.', 'I like coffee.', 'The weather is nice.',
          'Where is the station?', 'Thank you very much.', 'Good morning.'
        ];
      case 'verbAdj':
        return [
          'to eat', 'to drink', 'to go', 'to come', 'to see', 'to do',
          'big', 'small', 'beautiful', 'interesting', 'difficult', 'easy'
        ];
      default:
        return ['Option A', 'Option B', 'Option C', 'Option D'];
    }
  }

  calculateDifficulty(item: ListItem): number {
    let difficulty = 0.5; // Base difficulty

    // Adjust based on content length
    const contentLength = item.content.length;
    if (contentLength > 20) difficulty += 0.2;
    if (contentLength > 40) difficulty += 0.1;

    // Adjust based on JLPT level if available
    if (item.metadata?.jlptLevel) {
      // JLPT N5 = easiest (1), N1 = hardest (5)
      difficulty = (6 - item.metadata.jlptLevel) * 0.2;
    }

    // Adjust based on list type
    if (this.list.type === 'sentence') {
      difficulty += 0.1; // Sentences are generally harder
    } else if (this.list.type === 'verbAdj') {
      difficulty += 0.05; // Conjugatable items are slightly harder
    }

    return Math.min(1, Math.max(0, difficulty));
  }

  generateHints(item: ListItem): string[] {
    const hints: string[] = [];

    // Add notes as a hint if available
    if (item.metadata?.notes) {
      hints.push(item.metadata.notes);
    }

    // Add partial meaning if available
    if (item.metadata?.meaning) {
      const words = item.metadata.meaning.split(' ');
      if (words.length > 1) {
        hints.push(`It means something related to "${words[0]}..."`);
      }
    }

    // Add reading hint if available
    if (item.metadata?.reading) {
      const reading = item.metadata.reading;
      hints.push(`Pronunciation starts with "${reading[0]}"`);
      if (reading.length > 3) {
        hints.push(`It has ${reading.length} syllables`);
      }
    }

    // Add content length hint
    hints.push(`It has ${item.content.length} characters`);

    // Add JLPT level hint if available
    if (item.metadata?.jlptLevel) {
      hints.push(`This is a JLPT N${item.metadata.jlptLevel} item`);
    }

    return hints;
  }

  prepareForMode(item: ListItem, mode: ReviewMode): ReviewableContent {
    const base = this.transform(item);

    switch (mode) {
      case 'recognition':
        // Show the content, user selects meaning
        base.primaryDisplay = item.content;
        base.primaryAnswer = item.metadata?.meaning || item.content;
        break;

      case 'recall':
        // Show the meaning, user types the content
        base.primaryDisplay = item.metadata?.meaning || 'Recall this item';
        base.primaryAnswer = item.content;
        break;

      case 'listening':
        // For listening mode, hide the text initially
        base.primaryDisplay = '🔊 Listen carefully';
        base.audioUrl = undefined; // Would need TTS integration
        base.primaryAnswer = item.content;
        break;

      case 'writing':
        // For writing mode, show meaning and let user write
        base.primaryDisplay = item.metadata?.meaning || 'Write this item';
        base.primaryAnswer = item.content;
        break;

      default:
        // Default mode
        break;
    }

    return base;
  }

  private getSupportedModes(): ReviewMode[] {
    // Determine supported modes based on list type and available metadata
    const modes: ReviewMode[] = [];

    // All lists support recognition if they have meanings
    if (this.list.items.some(item => item.metadata?.meaning)) {
      modes.push('recognition');
    }

    // All lists support recall
    modes.push('recall');

    // Sentences and words with readings can support listening
    if (this.list.type === 'sentence' ||
        this.list.items.some(item => item.metadata?.reading)) {
      modes.push('listening');
    }

    // Single words/kanji support writing mode
    if (this.list.type === 'word' ||
        this.list.items.some(item => item.content.length <= 4)) {
      modes.push('writing');
    }

    // Default to recognition if no modes determined
    if (modes.length === 0) {
      modes.push('recognition');
    }

    return modes;
  }

  // Get all items as ReviewableContent for the review session
  getAllItems(): ReviewableContent[] {
    return this.currentItems.map(item => this.transform(item));
  }

  // Get items for a specific review mode
  getItemsForMode(mode: ReviewMode): ReviewableContent[] {
    return this.currentItems.map(item => this.prepareForMode(item, mode));
  }
}