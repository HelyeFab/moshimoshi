/**
 * API Route: /api/drill/session
 * Manages drill sessions - create, retrieve, update
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator';
import type { EvalContext } from '@/lib/entitlements/evaluator';
import type { FeatureId } from '@/types/FeatureId';
import type { DrillSession, DrillQuestion, JapaneseWord } from '@/types/drill';
import { WordUtils } from '@/lib/drill/word-utils';
import { QuestionGenerator } from '@/lib/drill/question-generator';
import { SRSWordSelector } from '@/lib/drill/srs-word-selector';
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper';
import { recordDrillCompletion } from '@/lib/gamification/services/gamification-coordinator';
import { Accuracy } from '@/lib/statistics/accuracy';
import { DrillSessionCompleteRequestSchema } from '@/lib/schemas/drill.schema';
import { getConjugatableWordsPractice } from '@/utils/jmdictLocalSearch';
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager';

/**
 * GET /api/drill/session
 * Get current drill session or session stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check storage decision
    const decision = await getStorageDecision(session);

    // Free users don't have Firebase access - return empty
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        success: true,
        data: {
          sessions: [],
          storage: {
            location: 'local',
            message: 'Drill history is stored locally for free users'
          }
        }
      });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (sessionId) {
      // Get specific session (premium only)
      const sessionDoc = await adminDb!
        .collection('drill_sessions')
        .doc(sessionId)
        .get();

      if (!sessionDoc.exists) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      const sessionData = sessionDoc.data() as DrillSession;

      // Verify ownership
      if (sessionData.userId !== session.uid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        data: { session: sessionData }
      });
    }

    // Get user's recent sessions (premium only)
    const recentSessions = await adminDb!
      .collection('drill_sessions')
      .where('userId', '==', session.uid)
      .orderBy('startedAt', 'desc')
      .limit(10)
      .get();

    const sessions = recentSessions.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Error in GET /api/drill/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drill/session
 * Create a new drill session
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const { mode, wordTypeFilter, selectedLists, questionsCount, jlptLevels, conjugationForms } = body;

    // Get fresh user data for entitlements
    const userDoc = await adminDb!.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    const plan = userData?.subscription?.plan || 'free';

    // Check entitlement
    const nowUtc = new Date().toISOString();
    const bucketKey = getBucketKey('conjugation_drill' as FeatureId, session.uid, nowUtc);

    // Get current usage
    const usageRef = adminDb!.collection('users').doc(session.uid).collection('usage').doc(bucketKey);
    const usageDoc = await usageRef.get();
    const usageData = usageDoc.data() || {};
    const currentUsage = usageData['conjugation_drill'] || 0;

    // Build full usage object (evaluator expects all features)
    const usage: Record<string, number> = {
      hiragana_practice: 0,
      katakana_practice: 0,
      kanji_browser: 0,
      custom_lists: 0,
      save_items: 0,
      youtube_shadowing: 0,
      media_upload: 0,
      stall_layout_customization: 0,
      todos: 0,
      conjugation_drill: currentUsage
    };

    // Evaluate entitlement
    const evalContext: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: usage as any,
      nowUtcISO: nowUtc
    };

    const decision = evaluate('conjugation_drill' as FeatureId, evalContext);

    if (!decision.allow) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LIMIT_REACHED',
          message: decision.reason || 'Daily drill limit reached'
        },
        usage: {
          current: currentUsage,
          limit: decision.limit,
          remaining: 0
        }
      }, { status: 403 });
    }

    // Generate questions based on mode
    let questions: DrillQuestion[] = [];

    if (mode === 'random') {
      // NEW: Use JMDict with JLPT filtering for 1000+ words
      const rawJlptLevels = jlptLevels && jlptLevels.length > 0 ? jlptLevels : ['N5', 'N4'];

      // Convert JLPT levels to format expected by getConjugatableWordsPractice
      // It only accepts 'N5', 'N4', or 'N3+' (where N3+ includes N3, N2, N1)
      const jlptFilter: ('N5' | 'N4' | 'N3+')[] = [];
      if (rawJlptLevels.includes('N5')) jlptFilter.push('N5');
      if (rawJlptLevels.includes('N4')) jlptFilter.push('N4');
      if (rawJlptLevels.includes('N3') || rawJlptLevels.includes('N2') || rawJlptLevels.includes('N1')) {
        jlptFilter.push('N3+');
      }
      // If no valid levels, default to N5 + N4
      if (jlptFilter.length === 0) {
        jlptFilter.push('N5', 'N4');
      }

      // Determine word type for jmdictLocalSearch
      let searchType: 'all' | 'verbs' | 'adjectives' = 'all';
      if (wordTypeFilter === 'verbs') searchType = 'verbs';
      else if (wordTypeFilter === 'adjectives') searchType = 'adjectives';

      // Get words from JMDict with JLPT filtering
      console.log('[Drill API] Requesting words:', { searchType, jlptFilter, limit: 50 });
      const practiceWords = await getConjugatableWordsPractice({
        type: searchType,
        jlptLevels: jlptFilter,
        limit: 50, // Get more words for variety
      });
      console.log('[Drill API] JMDict returned', practiceWords.length, 'words');

      if (practiceWords.length === 0) {
        // Fallback to old system if JMDict fails
        console.warn('[Drill API] JMDict returned no words, using fallback');
        const fallbackWords = WordUtils.getCommonPracticeWords();
        const filteredWords = WordUtils.filterByType(fallbackWords, wordTypeFilter);
        const questionsPerSession = questionsCount || getQuestionsPerSession(plan);
        questions = await QuestionGenerator.generateQuestions(filteredWords, 3, questionsPerSession, conjugationForms);
      } else {
        // Use custom question count if provided, otherwise use plan defaults
        const questionsPerSession = questionsCount || getQuestionsPerSession(plan);
        questions = await QuestionGenerator.generateQuestions(practiceWords, 3, questionsPerSession, conjugationForms);
      }
    } else if (mode === 'lists' && selectedLists?.length > 0) {
      // Fetch words from user's lists
      const listWords: JapaneseWord[] = [];

      for (const listId of selectedLists) {
        const listDoc = await adminDb!
          .collection('users')
          .doc(session.uid)
          .collection('lists')
          .doc(listId)
          .get();

        if (listDoc.exists) {
          const items = listDoc.data()?.items || [];
          console.log(`[Drill API] Processing list ${listId}:`, {
            itemCount: items.length,
            sampleItem: items[0] // Log first item to see structure
          });

          // Transform items to JapaneseWord format
          const words = items.map((item: any) => {
            // Handle different list item structures:
            // 1. New format: { content: "買う", metadata: { reading: "かう", meaning: "to buy" } }
            // 2. Old format: { kanji/word: "買う", kana/reading: "かう", meaning/english: "to buy" }
            const kanji = item.content || item.kanji || item.word;
            const kana = item.metadata?.reading || item.kana || item.reading;
            const meaning = item.metadata?.meaning || item.meaning || item.english;

            const word = {
              id: item.id,
              kanji: kanji,
              kana: kana,
              meaning: meaning,
              type: WordUtils.detectWordTypeByPattern({
                kanji: kanji,
                kana: kana,
              } as JapaneseWord),
              jlpt: item.jlpt || item.metadata?.jlpt,
            };
            console.log('[Drill API] Transformed word:', {
              kanji: word.kanji,
              kana: word.kana,
              type: word.type,
              isConjugatable: WordUtils.isConjugable(word as JapaneseWord)
            });
            return word;
          });

          const conjugableWords = WordUtils.filterConjugableWords(words);
          console.log(`[Drill API] List ${listId}: ${items.length} items -> ${words.length} transformed -> ${conjugableWords.length} conjugatable`);
          listWords.push(...conjugableWords);
        }
      }

      if (listWords.length > 0) {
        const filteredWords = WordUtils.filterByType(listWords, wordTypeFilter);
        // Use custom question count if provided, otherwise use plan defaults
        const questionsPerSession = questionsCount || getQuestionsPerSession(plan);
        questions = await QuestionGenerator.generateQuestions(filteredWords, 3, questionsPerSession, conjugationForms);
      }
    } else if (mode === 'srs') {
      // SRS mode: Use intelligent word selection based on spaced repetition
      console.log('[Drill API] SRS mode requested');

      const isPremium = plan === 'premium_monthly' || plan === 'premium_yearly';
      const questionsPerSession = questionsCount || getQuestionsPerSession(plan);

      try {
        // Select words using SRS algorithm
        const srsWords = await SRSWordSelector.selectWords({
          userId: session.uid,
          targetCount: questionsPerSession,
          isPremium,
          // SRS mode ignores JLPT filters - shows ALL studied words
          // This matches the user's design decision: "SRS mode shows ALL studied words"
        });

        console.log('[Drill API] SRS selected', srsWords.length, 'words');

        if (srsWords.length === 0) {
          return NextResponse.json({
            success: false,
            error: {
              code: 'NO_SRS_WORDS',
              message: 'No words available for SRS review. Practice in Random or My Lists mode first!'
            }
          }, { status: 400 });
        }

        // Generate questions from SRS words
        // Note: wordTypeFilter is ignored for SRS mode (shows all types studied)
        questions = await QuestionGenerator.generateQuestions(
          srsWords,
          3,
          Math.min(questionsPerSession, srsWords.length),
          conjugationForms
        );
      } catch (error) {
        console.error('[Drill API] SRS word selection failed:', error);
        return NextResponse.json({
          success: false,
          error: {
            code: 'SRS_ERROR',
            message: 'Failed to load SRS words. Please try again.'
          }
        }, { status: 500 });
      }
    }

    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_QUESTIONS',
          message: 'Could not generate questions with selected criteria'
        }
      }, { status: 400 });
    }

    // Helper to sanitize object for Firestore (convert undefined to null)
    const sanitizeForFirestore = (obj: any): any => {
      if (obj === null || obj === undefined) return null;
      if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
      if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
          sanitized[key] = sanitizeForFirestore(obj[key]);
        }
        return sanitized;
      }
      return obj;
    };

    // Create session
    const sessionId = `drill_${session.uid}_${Date.now()}`;

    const drillSession: DrillSession = {
      id: sessionId,
      userId: session.uid,
      questions: sanitizeForFirestore(questions), // Recursively clean all undefined values
      currentQuestionIndex: 0,
      score: 0,
      startedAt: nowUtc,
      mode,
      wordTypeFilter,
      version: 1,
      updatedAt: nowUtc
    };

    // Check storage decision
    const storageDecision = await getStorageDecision(session);

    // Only save to Firebase for premium users
    if (storageDecision.shouldWriteToFirebase) {
      console.log('[Drill API] Premium user - saving to Firebase:', session.uid);
      await adminDb!
        .collection('drill_sessions')
        .doc(sessionId)
        .set(drillSession);
    } else {
      console.log('[Drill API] Free user - session will be stored locally:', session.uid);
    }

    // Increment usage
    await usageRef.set({
      [bucketKey]: currentUsage + 1,
      lastUpdated: nowUtc
    }, { merge: true });

    return NextResponse.json({
      success: true,
      data: {
        session: drillSession,
        usage: {
          current: currentUsage + 1,
          limit: decision.limit || 0,
          remaining: (decision.limit || 0) - (currentUsage + 1)
        }
      }
    });
  } catch (error) {
    console.error('Error in POST /api/drill/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/drill/session
 * Update drill session (answer submission, completion)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const { sessionId, action, answer } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get session
    const sessionRef = adminDb!.collection('drill_sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = sessionDoc.data() as DrillSession;

    // Verify ownership
    if (sessionData.userId !== session.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'answer') {
      // Process answer
      const currentQuestion = sessionData.questions[sessionData.currentQuestionIndex];
      const isCorrect = answer === currentQuestion.correctAnswer;

      if (isCorrect) {
        sessionData.score++;
      }

      // Move to next question or complete
      if (sessionData.currentQuestionIndex < sessionData.questions.length - 1) {
        sessionData.currentQuestionIndex++;
      } else {
        // Session complete
        sessionData.completedAt = new Date().toISOString();
      }

      // Update session
      await sessionRef.update(sessionData);

      return NextResponse.json({
        success: true,
        data: {
          isCorrect,
          currentScore: sessionData.score,
          isComplete: !!sessionData.completedAt,
          session: sessionData
        }
      });
    }

    if (action === 'complete') {
      // Validate request
      const validated = DrillSessionCompleteRequestSchema.parse(body);

      // Mark session as complete
      const completedAt = new Date().toISOString();
      const finalScore = validated.finalScore || sessionData.score;
      const rawAccuracy = validated.accuracy || (finalScore / sessionData.questions.length) * 100;

      // FIXED: Normalize accuracy to 0-100
      const accuracy = Accuracy.normalize(rawAccuracy);

      // Get user's plan to determine storage
      const userDoc = await adminDb!.collection('users').doc(session.uid).get();
      const userData = userDoc.data();
      const plan = userData?.subscription?.plan || 'free';
      const isPremium = plan === 'premium_monthly' || plan === 'premium_yearly';

      // Only update Firebase for premium users
      if (isPremium) {
        // Update session with completion data and version
        await sessionRef.update({
          completedAt,
          score: finalScore,
          accuracy,
          version: FieldValue.increment(1), // FIXED: Version tracking
          updatedAt: completedAt
        });

        // Add to drill history subcollection for detailed tracking
        const historyRef = adminDb!
          .collection('users')
          .doc(session.uid)
          .collection('drill_history')
          .doc();

        await historyRef.set({
          sessionId,
          completedAt,
          score: finalScore,
          totalQuestions: sessionData.questions.length,
          accuracy,
          mode: sessionData.mode,
          wordTypeFilter: sessionData.wordTypeFilter,
          timestamp: FieldValue.serverTimestamp(),
          perfectSession: accuracy === 100
        });
      }
      // Free users: stats are handled client-side in IndexedDB

      // FIXED: Issue #6 - Record gamification (XP + streak) using coordinator
      let gamificationResult = null;
      if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true') {
        try {
          gamificationResult = await recordDrillCompletion({
            userId: session.uid,
            sessionId,
            score: finalScore,
            totalQuestions: sessionData.questions.length,
            accuracy,
            isPremium
          });

          console.log('[Drill API] Gamification updated:', {
            xpEarned: gamificationResult.xpEarned,
            streakIncremented: gamificationResult.streakIncremented,
            currentStreak: gamificationResult.currentStreak
          });
        } catch (error) {
          console.error('[Drill API] Failed to update gamification:', error);
          // Don't fail the whole request if gamification fails
        }
      }

      // NEW: Update SRS data for all answered questions (passive tracking)
      // This allows words from ANY mode (random, lists, srs) to appear in future SRS sessions
      console.log('[Drill API] Checking for questionResults:', {
        hasQuestionResults: !!validated.questionResults,
        count: validated.questionResults?.length || 0,
        sample: validated.questionResults?.[0]
      });

      if (validated.questionResults && validated.questionResults.length > 0) {
        try {
          // PREMIUM ONLY: SRS tracking follows the same pattern as achievements and video history
          if (!isPremium) {
            console.log('[Drill API] Skipping SRS tracking - premium feature');
          } else {
            console.log('[Drill API] Updating SRS data for', validated.questionResults.length, 'words');

            // Import Firebase Admin (server-only)
            const { adminFirestore } = await import('@/lib/firebase/admin');

            if (!adminFirestore) {
              throw new Error('Firebase Admin not initialized');
            }

            const drillProgressManager = DrillProgressManager.getInstance();

            // Process each question result for SRS tracking
            for (const result of validated.questionResults) {
              // Find the full question data
              const question = sessionData.questions.find(q => q.id === result.questionId);
              if (!question) continue;

              // Build word ID format expected by SRS: "kanji:kana"
              const wordId = `${question.word.kanji || question.word.kana}:${question.word.kana}`;
              const now = new Date().toISOString();

              // Reference to the SRS word document
              const wordDocRef = adminFirestore
                .collection('users')
                .doc(session.uid)
                .collection('drill-srs')
                .doc(wordId);

              // Get existing document
              const wordDoc = await wordDocRef.get();
              let wordEntry: any;

              if (!wordDoc.exists) {
                // Initialize new word entry
                wordEntry = {
                  wordId,
                  word: {
                    kanji: question.word.kanji,
                    kana: question.word.kana,
                    meaning: question.word.meaning,
                    type: question.word.type,
                    jlpt: question.word.jlpt
                  },
                  srsData: {
                    interval: 1,
                    easeFactor: 2.5,
                    repetitions: 0,
                    lastReviewedAt: null,
                    nextReviewAt: drillProgressManager.calculateNextReviewDate(1),
                    status: 'new' as const,
                    lapses: 0
                  },
                  conjugationAccuracy: {},
                  reviewHistory: [],
                  leechScore: 0,
                  firstSeenAt: now,
                  lastReviewedAt: null,
                  totalReviews: 0,
                  version: 1,
                  updatedAt: now
                };
              } else {
                // Get existing entry
                wordEntry = wordDoc.data();
              }

              // Update conjugation form accuracy
              if (!wordEntry.conjugationAccuracy[result.targetForm]) {
                wordEntry.conjugationAccuracy[result.targetForm] = {
                  attempts: 0,
                  correct: 0,
                  lastAttempted: null,
                  averageTime: 0
                };
              }

              const formAccuracy = wordEntry.conjugationAccuracy[result.targetForm];
              formAccuracy.attempts++;
              if (result.correct) formAccuracy.correct++;
              formAccuracy.lastAttempted = now;
              formAccuracy.averageTime =
                (formAccuracy.averageTime * (formAccuracy.attempts - 1) + (result.responseTime || 0)) /
                formAccuracy.attempts;

              // Update review history (keep last 10)
              if (!wordEntry.reviewHistory) {
                wordEntry.reviewHistory = [];
              }
              wordEntry.reviewHistory.push({
                timestamp: now,
                targetForm: result.targetForm,
                correct: result.correct,
                responseTime: result.responseTime || 0
              });
              if (wordEntry.reviewHistory.length > 10) {
                wordEntry.reviewHistory.shift();
              }

              // Update leech score
              if (!result.correct) {
                wordEntry.leechScore = Math.min(10, wordEntry.leechScore + 1);
              } else if (wordEntry.leechScore > 0) {
                wordEntry.leechScore = Math.max(0, wordEntry.leechScore - 0.5);
              }

              // Update SRS data using SM-2 algorithm
              wordEntry.srsData = drillProgressManager.calculateSM2(wordEntry.srsData, result.correct);
              wordEntry.lastReviewedAt = now;
              wordEntry.totalReviews++;
              wordEntry.updatedAt = now;

              // Write to Firebase
              await wordDocRef.set(wordEntry, { merge: true });

              console.log(`[Drill API] [SERVER] SRS updated for ${wordId}:`, {
                status: wordEntry.srsData.status,
                interval: wordEntry.srsData.interval,
                nextReview: wordEntry.srsData.nextReviewAt,
                leechScore: wordEntry.leechScore
              });
            }

            console.log('[Drill API] SRS data updated successfully');
          }
        } catch (error) {
          console.error('[Drill API] Failed to update SRS data:', error);
          // Don't fail the whole request if SRS tracking fails
        }
      } else {
        console.log('[Drill API] No question results provided - SRS tracking skipped');
      }

      return NextResponse.json({
        success: true,
        data: {
          session: {
            ...sessionData,
            completedAt,
            score: finalScore,
            accuracy
          },
          stats: {
            accuracy: Accuracy.format(accuracy), // FIXED: Format for display
            questionsAnswered: sessionData.questions.length,
            correctAnswers: finalScore
          },
          // NEW: Return gamification results
          gamification: gamificationResult ? {
            xpEarned: gamificationResult.xpEarned,
            newLevel: gamificationResult.newLevel,
            streakIncremented: gamificationResult.streakIncremented,
            currentStreak: gamificationResult.currentStreak,
            achievementsUnlocked: gamificationResult.achievementsUnlocked
          } : null
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in PUT /api/drill/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get questions per session based on plan
 */
function getQuestionsPerSession(plan: string): number {
  const limits = {
    guest: 5,
    free: 10,
    premium_monthly: 30,
    premium_yearly: 30
  };
  return limits[plan as keyof typeof limits] || 10;
}
