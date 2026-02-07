export type WeakCardDifficulty = 'again' | 'hard';

export interface WeakCardEntry {
  cardId: string;
  difficulty: WeakCardDifficulty;
}

export interface WeakCardsPayload {
  updatedAt: number;
  entries: WeakCardEntry[];
  cardIds?: string[];
}

const buildKey = (userId: string, deckId: string) => `flashcards_weak_cards_${userId}_${deckId}`;

export const weakCardsStore = {
  load(userId: string, deckId: string): WeakCardsPayload | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(buildKey(userId, deckId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WeakCardsPayload;
      if (!parsed) return null;
      if (Array.isArray(parsed.entries)) {
        return parsed;
      }
      if (Array.isArray(parsed.cardIds)) {
        return {
          updatedAt: parsed.updatedAt || Date.now(),
          entries: parsed.cardIds.map(cardId => ({ cardId, difficulty: 'hard' })),
          cardIds: parsed.cardIds,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  save(userId: string, deckId: string, entries: WeakCardEntry[]): void {
    if (typeof window === 'undefined') return;
    const payload: WeakCardsPayload = {
      updatedAt: Date.now(),
      entries,
    };
    localStorage.setItem(buildKey(userId, deckId), JSON.stringify(payload));
  },

  clear(userId: string, deckId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(buildKey(userId, deckId));
  },
};
