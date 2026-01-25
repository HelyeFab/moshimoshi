/**
 * Kanji Mnemonic Cache
 * Firebase-backed persistent storage for kanji mnemonics
 *
 * Collection: kanji_mnemonics
 * Document ID: kanji character (e.g., "本", "人", "日")
 */

import { adminDb, Timestamp } from '@/lib/firebase/admin';
import { KanjiMnemonic } from '../types';
import type { Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'kanji_mnemonics';

interface CacheEntry {
  kanji: string;
  meaning: string;
  mnemonic: string;
  components?: Array<{ part: string; meaning: string }>;
  provider: 'ollama' | 'openai' | 'koohii' | 'manual';
  version: number;
  createdAt: FirebaseFirestore.Timestamp;
  lastAccessedAt: FirebaseFirestore.Timestamp;
  accessCount: number;
  author?: string;  // For koohii attribution
  votes?: number;   // Koohii community votes
}

/**
 * Get a cached mnemonic for a kanji character
 */
export async function getCachedKanjiMnemonic(
  kanji: string,
  dbOverride?: Firestore
): Promise<KanjiMnemonic | null> {
  const db = dbOverride || adminDb;
  if (!db) return null;

  try {
    const docId = kanji.trim();
    const doc = await db.collection(COLLECTION).doc(docId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as CacheEntry;

    // Update access metrics (fire and forget)
    doc.ref.update({
      lastAccessedAt: Timestamp.now(),
      accessCount: (data.accessCount || 0) + 1
    }).catch(() => {/* ignore update errors */});

    return {
      kanji: data.kanji,
      meaning: data.meaning,
      mnemonic: data.mnemonic,
      components: data.components,
      provider: data.provider,
      version: data.version,
      createdAt: data.createdAt?.toDate() || new Date(),
      author: data.author,
      votes: data.votes
    };
  } catch (error) {
    console.error('[KanjiMnemonicCache] Failed to read cache:', error);
    return null;
  }
}

/**
 * Save a mnemonic to the cache
 */
export async function setCachedKanjiMnemonic(
  mnemonic: KanjiMnemonic,
  dbOverride?: Firestore
): Promise<void> {
  const db = dbOverride || adminDb;
  if (!db) return;

  try {
    const docId = mnemonic.kanji.trim();

    // Remove undefined fields for Firestore
    const entry: CacheEntry = {
      kanji: mnemonic.kanji,
      meaning: mnemonic.meaning,
      mnemonic: mnemonic.mnemonic,
      provider: mnemonic.provider,
      version: mnemonic.version || 1,
      createdAt: Timestamp.now(),
      lastAccessedAt: Timestamp.now(),
      accessCount: 1
    };

    if (mnemonic.components && mnemonic.components.length > 0) {
      entry.components = mnemonic.components;
    }
    if (mnemonic.author) {
      entry.author = mnemonic.author;
    }
    if (mnemonic.votes !== undefined) {
      entry.votes = mnemonic.votes;
    }

    // Use set() without merge to completely replace the document (removes old fields like stale components)
    await db.collection(COLLECTION).doc(docId).set(entry);
    console.log(`[KanjiMnemonicCache] Cached mnemonic for: ${mnemonic.kanji}`);
  } catch (error) {
    console.error('[KanjiMnemonicCache] Failed to write cache:', error);
  }
}

/**
 * Check if a mnemonic exists in the cache
 */
export async function hasKanjiMnemonic(
  kanji: string,
  dbOverride?: Firestore
): Promise<boolean> {
  const db = dbOverride || adminDb;
  if (!db) return false;

  try {
    const docId = kanji.trim();
    const doc = await db.collection(COLLECTION).doc(docId).get();
    return doc.exists;
  } catch (error) {
    console.error('[KanjiMnemonicCache] Failed to check cache:', error);
    return false;
  }
}

/**
 * Get multiple mnemonics at once (batch read)
 */
export async function getBatchKanjiMnemonics(
  kanjis: string[],
  dbOverride?: Firestore
): Promise<Map<string, KanjiMnemonic>> {
  const db = dbOverride || adminDb;
  const result = new Map<string, KanjiMnemonic>();
  if (!db || kanjis.length === 0) return result;

  try {
    // Firestore getAll supports up to 100 documents per call
    const chunks: string[][] = [];
    for (let i = 0; i < kanjis.length; i += 100) {
      chunks.push(kanjis.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      const refs = chunk.map(k => db.collection(COLLECTION).doc(k.trim()));
      const docs = await db.getAll(...refs);

      for (const doc of docs) {
        if (doc.exists) {
          const data = doc.data() as CacheEntry;
          result.set(data.kanji, {
            kanji: data.kanji,
            meaning: data.meaning,
            mnemonic: data.mnemonic,
            components: data.components,
            provider: data.provider,
            version: data.version,
            createdAt: data.createdAt?.toDate() || new Date(),
            author: data.author,
            votes: data.votes
          });
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[KanjiMnemonicCache] Failed to batch read:', error);
    return result;
  }
}

/**
 * Get all cached mnemonics (for admin/export)
 */
export async function getAllKanjiMnemonics(
  dbOverride?: Firestore
): Promise<KanjiMnemonic[]> {
  const db = dbOverride || adminDb;
  if (!db) return [];

  try {
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map(doc => {
      const data = doc.data() as CacheEntry;
      return {
        kanji: data.kanji,
        meaning: data.meaning,
        mnemonic: data.mnemonic,
        components: data.components,
        provider: data.provider,
        version: data.version,
        createdAt: data.createdAt?.toDate() || new Date(),
        author: data.author,
        votes: data.votes
      };
    });
  } catch (error) {
    console.error('[KanjiMnemonicCache] Failed to get all:', error);
    return [];
  }
}

/**
 * Get cache statistics
 */
export async function getKanjiMnemonicCacheStats(
  dbOverride?: Firestore
): Promise<{
  total: number;
  byProvider: { ollama: number; openai: number };
}> {
  const db = dbOverride || adminDb;
  if (!db) return { total: 0, byProvider: { ollama: 0, openai: 0 } };

  try {
    const snapshot = await db.collection(COLLECTION).get();
    const stats = {
      total: snapshot.size,
      byProvider: { ollama: 0, openai: 0 }
    };

    snapshot.docs.forEach(doc => {
      const data = doc.data() as CacheEntry;
      if (data.provider === 'ollama') {
        stats.byProvider.ollama++;
      } else if (data.provider === 'openai') {
        stats.byProvider.openai++;
      }
    });

    return stats;
  } catch (error) {
    console.error('[KanjiMnemonicCache] Failed to get stats:', error);
    return { total: 0, byProvider: { ollama: 0, openai: 0 } };
  }
}
