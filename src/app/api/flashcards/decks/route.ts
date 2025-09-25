import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { FlashcardDeck, CreateDeckRequest } from '@/types/flashcards';
import { v4 as uuidv4 } from 'uuid';
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper';
import { cleanFirestoreData } from '@/lib/utils/cleanFirestoreData';

// GET /api/flashcards/decks - Get all user decks
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check storage decision
    const decision = await getStorageDecision(session);

    // For free users, return empty with local storage indicator
    if (!decision.shouldWriteToFirebase) {
      console.log('[Flashcards API] Free user - should use local storage:', session.uid);
      return NextResponse.json({
        decks: [],
        storage: {
          location: 'local',
          message: 'Free users should fetch from IndexedDB'
        }
      });
    }

    // Get user's decks from Firebase (premium only)
    const decksRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('flashcardDecks');

    const snapshot = await decksRef
      .orderBy('updatedAt', 'desc')
      .get();

    const decks: FlashcardDeck[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FlashcardDeck));

    return NextResponse.json({
      decks,
      storage: {
        location: decision.storageLocation,
        syncEnabled: decision.shouldWriteToFirebase
      }
    });
  } catch (error) {
    console.error('Error fetching flashcard decks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decks' },
      { status: 500 }
    );
  }
}

// POST /api/flashcards/decks - Create a new deck
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateDeckRequest = await request.json();

    // Check deck limits
    const userDoc = await adminDb
      .collection('users')
      .doc(session.uid)
      .get();

    const userData = userDoc.data();
    const plan = userData?.subscription?.plan || 'free';

    // Get current deck count
    const decksSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('flashcardDecks')
      .count()
      .get();

    const currentCount = decksSnapshot.data().count;

    // Check limits based on plan
    const limits: Record<string, number> = {
      guest: 0,
      free: 10,
      premium_monthly: -1, // Unlimited
      premium_yearly: -1   // Unlimited
    };

    const maxDecks = limits[plan] ?? 10;

    if (maxDecks !== -1 && currentCount >= maxDecks) {
      return NextResponse.json(
        { error: 'Deck limit reached for your plan' },
        { status: 403 }
      );
    }

    // Create the deck
    const now = Date.now();
    const deckId = uuidv4();

    const newDeck: FlashcardDeck = {
      id: deckId,
      userId: session.uid,
      name: body.name,
      description: body.description,
      emoji: body.emoji || '🎴',
      color: body.color || 'primary',
      cardStyle: body.cardStyle || 'minimal',
      cards: [],
      settings: {
        studyDirection: 'front-to-back',
        autoPlay: false,
        showHints: true,
        animationSpeed: 'normal',
        soundEffects: true,
        hapticFeedback: true,
        sessionLength: 20,
        reviewMode: 'srs',
        ...body.settings
      },
      stats: {
        totalCards: 0,
        newCards: 0,
        learningCards: 0,
        reviewCards: 0,
        masteredCards: 0,
        totalStudied: 0,
        averageAccuracy: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTimeSpent: 0
      },
      createdAt: now,
      updatedAt: now,
      sourceListId: body.sourceListId
    };

    // Add initial cards if provided
    if (body.initialCards && body.initialCards.length > 0) {
      newDeck.cards = body.initialCards.map(card => {
        // Create a clean card with only defined values
        const cleanCard: any = {
          id: card.id || uuidv4(),
          front: card.front || '',
          back: card.back || ''
        };

        // Add other card properties if they exist and are not undefined
        if (card.hint !== undefined && card.hint !== null) {
          cleanCard.hint = card.hint;
        }
        if (card.tags && Array.isArray(card.tags)) {
          cleanCard.tags = card.tags.filter(tag => tag !== undefined && tag !== null);
        }
        if (card.audio !== undefined && card.audio !== null) {
          cleanCard.audio = card.audio;
        }
        if (card.image !== undefined && card.image !== null) {
          cleanCard.image = card.image;
        }

        // Handle metadata carefully
        if (card.metadata && typeof card.metadata === 'object') {
          const cleanMetadata: any = {};
          for (const [key, value] of Object.entries(card.metadata)) {
            if (value !== undefined && value !== null) {
              cleanMetadata[key] = value;
            }
          }
          if (Object.keys(cleanMetadata).length > 0) {
            cleanCard.metadata = cleanMetadata;
          }
        }

        return cleanCard;
      });
      newDeck.stats.totalCards = newDeck.cards.length;
      newDeck.stats.newCards = newDeck.cards.length;
    }

    // Check storage decision
    const storageDecision = await getStorageDecision(session);

    // Update usage tracking (for all users to enforce limits)
    const today = new Date().toISOString().split('T')[0];
    const usageRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(today);

    // Only save to Firebase for premium users
    if (storageDecision.shouldWriteToFirebase) {
      console.log('[Flashcards API] Premium user - saving to Firebase:', session.uid);

      // Clean the entire deck object to remove ALL undefined values
      const cleanedDeck = cleanFirestoreData(newDeck);

      await adminDb
        .collection('users')
        .doc(session.uid)
        .collection('flashcardDecks')
        .doc(deckId)
        .set(cleanedDeck);

      const currentUsage = (await usageRef.get()).data();
      await usageRef.set({
        flashcard_decks: {
          created: ((currentUsage?.flashcard_decks?.created || 0) + 1)
        },
        updatedAt: now
      }, { merge: true });
    } else {
      console.log('[Flashcards API] Free user - returning deck for local storage:', session.uid);

      // Still update usage for free users
      const currentUsage = (await usageRef.get()).data();
      await usageRef.set({
        flashcard_decks: {
          created: ((currentUsage?.flashcard_decks?.created || 0) + 1)
        },
        updatedAt: now
      }, { merge: true });
    }

    return createStorageResponse(
      { deck: newDeck },
      storageDecision
    );
  } catch (error: any) {
    console.error('Error creating flashcard deck:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);

    // Return more detailed error for debugging
    return NextResponse.json(
      {
        error: 'Failed to create deck',
        details: error.message,
        field: error.path || 'unknown'
      },
      { status: 500 }
    );
  }
}