import crypto from 'crypto';
import { adminFirestore as db, Timestamp } from '@/lib/firebase/admin';
import { WordExplanation } from '../types';

const COLLECTION = 'wordExplanationCache';

interface CacheEntry {
  id: string;
  wordHash: string;
  word: string;
  explanation: WordExplanation;
  createdAt: Timestamp;
  lastAccessedAt: Timestamp;
  accessCount: number;
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function getCachedWordExplanation(word: string): Promise<WordExplanation | null> {
  if (!db) {
    console.warn('[WordCache] Firebase Admin not initialized - cache disabled');
    return null;
  }

  try {
    const wordHash = hashText(word.trim().toLowerCase());
    const docId = wordHash;

    const doc = await db.collection(COLLECTION).doc(docId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as CacheEntry;

    // Update access metrics
    await doc.ref.update({
      lastAccessedAt: Timestamp.now(),
      accessCount: data.accessCount + 1
    });

    return data.explanation;
  } catch (error) {
    console.error('[WordCache] ❌ Failed to read cache:', error);
    console.error('[WordCache] Word:', word);
    console.error('[WordCache] Error details:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function setCachedWordExplanation(
  word: string,
  explanation: WordExplanation
): Promise<void> {
  if (!db) {
    console.warn('[WordCache] Firebase Admin not initialized - cannot cache explanation');
    return;
  }

  try {
    const wordHash = hashText(word.trim().toLowerCase());
    const docId = wordHash;

    const entry: CacheEntry = {
      id: docId,
      wordHash,
      word,
      explanation,
      createdAt: Timestamp.now(),
      lastAccessedAt: Timestamp.now(),
      accessCount: 1
    };

    await db.collection(COLLECTION).doc(docId).set(entry, { merge: true });
  } catch (error) {
    console.error('[WordCache] ❌ Failed to write cache:', error);
    console.error('[WordCache] Word:', word);
    console.error('[WordCache] Error details:', error instanceof Error ? error.message : 'Unknown error');

    // Log full error for debugging
    if (error instanceof Error && error.stack) {
      console.error('[WordCache] Stack trace:', error.stack);
    }
  }
}
