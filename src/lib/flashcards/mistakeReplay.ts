export interface MistakeReplaySession {
  id: string;
  createdAt: number;
  cardIds: string[];
}

export interface MistakeReplayPayload {
  updatedAt: number;
  sessions: MistakeReplaySession[];
}

const buildKey = (userId: string, deckId: string) => `flashcards_mistake_replay_${userId}_${deckId}`;

export const mistakeReplayStore = {
  load(userId: string, deckId: string): MistakeReplayPayload | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(buildKey(userId, deckId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as MistakeReplayPayload;
      if (!parsed || !Array.isArray(parsed.sessions)) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  addSession(userId: string, deckId: string, cardIds: string[]): void {
    if (typeof window === 'undefined') return;
    if (cardIds.length === 0) return;
    const uniqueIds = Array.from(new Set(cardIds)).slice(0, 200);
    const payload = this.load(userId, deckId) || { updatedAt: 0, sessions: [] };
    const nextSession: MistakeReplaySession = {
      id: `mistake-${Date.now()}`,
      createdAt: Date.now(),
      cardIds: uniqueIds,
    };
    const sessions = [nextSession, ...payload.sessions].slice(0, 3);
    const nextPayload: MistakeReplayPayload = {
      updatedAt: Date.now(),
      sessions,
    };
    localStorage.setItem(buildKey(userId, deckId), JSON.stringify(nextPayload));
  },

  getCombinedCardIds(userId: string, deckId: string): string[] {
    const payload = this.load(userId, deckId);
    if (!payload?.sessions?.length) return [];
    const combined: string[] = [];
    for (const session of payload.sessions) {
      for (const cardId of session.cardIds) {
        if (!combined.includes(cardId)) {
          combined.push(cardId);
        }
      }
    }
    return combined;
  },

  clear(userId: string, deckId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(buildKey(userId, deckId));
  },
};
