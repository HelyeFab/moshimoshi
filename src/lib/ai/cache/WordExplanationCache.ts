import crypto from 'crypto';
import { adminDb, Timestamp } from '@/lib/firebase/admin';
import { WordExplanation } from '../types';
import type { Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'wordExplanationCache';

interface CacheEntry {
  id: string;
  wordHash: string;
  word: string;
  explanation: WordExplanation;
  createdAt: FirebaseFirestore.Timestamp;
  lastAccessedAt: FirebaseFirestore.Timestamp;
  accessCount: number;
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function getCachedWordExplanation(word: string, dbOverride?: Firestore): Promise<WordExplanation | null> {
  const db = dbOverride || adminDb;
  if (!db) return null;

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
  explanation: WordExplanation,
  dbOverride?: Firestore
): Promise<void> {
  const db = dbOverride || adminDb;
  if (!db) return;

  try {
    // Remove undefined fields to satisfy Firestore
    const sanitizedExplanation: any = { ...explanation };
    Object.keys(sanitizedExplanation).forEach(key => {
      if (sanitizedExplanation[key] === undefined) {
        delete sanitizedExplanation[key];
      }
    });

    const wordHash = hashText(word.trim().toLowerCase());
    const docId = wordHash;

    const entry: CacheEntry = {
      id: docId,
      wordHash,
      word,
      explanation: sanitizedExplanation as WordExplanation,
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
