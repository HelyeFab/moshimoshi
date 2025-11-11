import crypto from 'crypto';
import { adminFirestore as db, Timestamp } from '@/lib/firebase/admin';
import { GrammarExplanation } from '../types';

const COLLECTION = 'grammarExplanationCache';

interface CacheEntry {
  id: string;
  sentenceHash: string;
  sentence: string;
  contextHash?: string;
  context?: string;
  explanation: GrammarExplanation;
  createdAt: Timestamp;
  lastAccessedAt: Timestamp;
  accessCount: number;
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function getCachedExplanation(sentence: string, context?: string): Promise<GrammarExplanation | null> {
  if (!db) {
    console.warn('[GrammarCache] Firebase Admin not initialized - cache disabled');
    return null;
  }

  try {
    const sentenceHash = hashText(sentence.trim());
    const contextHash = context ? hashText(context.trim()) : undefined;
    const docId = contextHash ? `${sentenceHash}_${contextHash}` : sentenceHash;

    const doc = await db.collection(COLLECTION).doc(docId).get();

    if (!doc.exists) {
      console.log(`[GrammarCache] Cache miss for sentence: "${sentence.substring(0, 30)}..."`);
      return null;
    }

    const data = doc.data() as CacheEntry;

    // Update access metrics
    await doc.ref.update({
      lastAccessedAt: Timestamp.now(),
      accessCount: data.accessCount + 1
    });

    console.log(`[GrammarCache] ✅ Cache HIT for sentence: "${sentence.substring(0, 30)}..." (access count: ${data.accessCount + 1})`);
    return data.explanation;
  } catch (error) {
    console.error('[GrammarCache] ❌ Failed to read cache:', error);
    console.error('[GrammarCache] Sentence:', sentence.substring(0, 50));
    console.error('[GrammarCache] Error details:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function setCachedExplanation(
  sentence: string,
  context: string | undefined,
  explanation: GrammarExplanation
): Promise<void> {
  if (!db) {
    console.warn('[GrammarCache] Firebase Admin not initialized - cannot cache explanation');
    return;
  }

  try {
    const sentenceHash = hashText(sentence.trim());
    const contextHash = context ? hashText(context.trim()) : undefined;
    const docId = contextHash ? `${sentenceHash}_${contextHash}` : sentenceHash;

    const entry: CacheEntry = {
      id: docId,
      sentenceHash,
      sentence,
      contextHash,
      context,
      explanation,
      createdAt: Timestamp.now(),
      lastAccessedAt: Timestamp.now(),
      accessCount: 1
    };

    await db.collection(COLLECTION).doc(docId).set(entry, { merge: true });

    console.log(`[GrammarCache] ✅ Cached explanation for: "${sentence.substring(0, 30)}..."`);
    console.log(`[GrammarCache] Document ID: ${docId}`);
    console.log(`[GrammarCache] Pattern: ${explanation.pattern}`);
  } catch (error) {
    console.error('[GrammarCache] ❌ Failed to write cache:', error);
    console.error('[GrammarCache] Sentence:', sentence.substring(0, 50));
    console.error('[GrammarCache] Context:', context?.substring(0, 50));
    console.error('[GrammarCache] Error details:', error instanceof Error ? error.message : 'Unknown error');

    // Log full error for debugging
    if (error instanceof Error && error.stack) {
      console.error('[GrammarCache] Stack trace:', error.stack);
    }
  }
}
