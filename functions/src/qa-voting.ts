/**
 * Q&A Voting Cloud Functions
 * Server-side vote counting for questions and answers
 *
 * This approach is more secure than client-side counting:
 * - Atomic operations guaranteed
 * - No race conditions
 * - Cannot be manipulated by client
 * - Consistent vote counts
 */

import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

/**
 * When a question vote is created, increment the question's vote count
 */
export const onQuestionVoteCreated = onDocumentCreated(
  'qa_question_votes/{voteId}',
  async (event) => {
    const voteData = event.data?.data();

    if (!voteData) {
      console.error('No vote data in event');
      return;
    }

    const { questionId, voteType } = voteData;

    try {
      const db = admin.firestore();
      const questionRef = db.collection('qa_questions').doc(questionId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(questionRef);
        if (!snap.exists) return;

        const data = snap.data() || {};
        const currentUp = data.upvotes || 0;
        const currentDown = data.downvotes || 0;

        const newUp = voteType === 'upvote' ? currentUp + 1 : currentUp;
        const newDown = voteType === 'downvote' ? currentDown + 1 : currentDown;

        tx.update(questionRef, { upvotes: newUp, downvotes: newDown });
      });

      console.log(
        `Question ${questionId} ${voteType} count incremented`
      );
    } catch (error) {
      console.error(`Failed to increment question vote count:`, error);
    }
  }
);

/**
 * When a question vote is deleted, decrement the question's vote count
 */
export const onQuestionVoteDeleted = onDocumentDeleted(
  'qa_question_votes/{voteId}',
  async (event) => {
    const voteData = event.data?.data();

    if (!voteData) {
      console.error('No vote data in event');
      return;
    }

    const { questionId, voteType } = voteData;

    try {
      const db = admin.firestore();
      const questionRef = db.collection('qa_questions').doc(questionId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(questionRef);
        if (!snap.exists) return;

        const data = snap.data() || {};
        const currentUp = data.upvotes || 0;
        const currentDown = data.downvotes || 0;

        // Prevent negative counts
        const newUp = voteType === 'upvote' ? Math.max(0, currentUp - 1) : currentUp;
        const newDown = voteType === 'downvote' ? Math.max(0, currentDown - 1) : currentDown;

        tx.update(questionRef, { upvotes: newUp, downvotes: newDown });
      });

      console.log(
        `Question ${questionId} ${voteType} count decremented`
      );
    } catch (error) {
      console.error(`Failed to decrement question vote count:`, error);
    }
  }
);

/**
 * When an answer vote is created, increment the answer's vote count
 */
export const onAnswerVoteCreated = onDocumentCreated(
  'qa_answer_votes/{voteId}',
  async (event) => {
    const voteData = event.data?.data();

    if (!voteData) {
      console.error('No vote data in event');
      return;
    }

    const { answerId, voteType } = voteData;

    try {
      const db = admin.firestore();
      const answerRef = db.collection('qa_answers').doc(answerId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(answerRef);
        if (!snap.exists) return;

        const data = snap.data() || {};
        const currentUp = data.upvotes || 0;
        const currentDown = data.downvotes || 0;

        const newUp = voteType === 'upvote' ? currentUp + 1 : currentUp;
        const newDown = voteType === 'downvote' ? currentDown + 1 : currentDown;

        tx.update(answerRef, { upvotes: newUp, downvotes: newDown });
      });

      console.log(
        `Answer ${answerId} ${voteType} count incremented`
      );
    } catch (error) {
      console.error(`Failed to increment answer vote count:`, error);
    }
  }
);

/**
 * When an answer vote is deleted, decrement the answer's vote count
 */
export const onAnswerVoteDeleted = onDocumentDeleted(
  'qa_answer_votes/{voteId}',
  async (event) => {
    const voteData = event.data?.data();

    if (!voteData) {
      console.error('No vote data in event');
      return;
    }

    const { answerId, voteType } = voteData;

    try {
      const db = admin.firestore();
      const answerRef = db.collection('qa_answers').doc(answerId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(answerRef);
        if (!snap.exists) return;

        const data = snap.data() || {};
        const currentUp = data.upvotes || 0;
        const currentDown = data.downvotes || 0;

        // Prevent negative counts
        const newUp = voteType === 'upvote' ? Math.max(0, currentUp - 1) : currentUp;
        const newDown = voteType === 'downvote' ? Math.max(0, currentDown - 1) : currentDown;

        tx.update(answerRef, { upvotes: newUp, downvotes: newDown });
      });

      console.log(
        `Answer ${answerId} ${voteType} count decremented`
      );
    } catch (error) {
      console.error(`Failed to decrement answer vote count:`, error);
    }
  }
);
