/**
 * Q&A Content Moderation Cloud Function
 *
 * Automatically moderates questions and answers using AI
 * Runs server-side asynchronously when new content is created
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

// Define secrets
const modalApiKey = defineSecret('MODAL_API_KEY');

interface ModerationResult {
  approved: boolean;
  reason: string;
}

/**
 * Moderate content using Ollama AI on Modal
 */
async function moderateContent(
  content: string,
  title?: string,
  type: 'question' | 'answer' = 'question'
): Promise<ModerationResult> {
  const OLLAMA_ENDPOINT = process.env.OLLAMA_BASE_URL || 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run';

  const systemPrompt = `You are a content moderator for a Japanese language learning community Q&A forum.

Your task is to determine if the content is appropriate for the platform.

APPROVE content that:
- Asks genuine questions about Japanese language learning
- Shares helpful Japanese learning knowledge or experiences
- Discusses Japanese culture, grammar, vocabulary, or study methods
- Contains beginner mistakes or typos (this is a learning platform!)
- Expresses frustration with learning (as long as it's not abusive)
- Shows support, encouragement, or appreciation (e.g., "cheers", "thanks", "good luck", emojis)
- Provides short but friendly responses that contribute to community spirit
- Includes brief acknowledgments or expressions of gratitude

IMPORTANT: Be lenient with short supportive messages. "Cheers", "thanks", "👍", "good luck" etc. are all acceptable.
Community building and encouragement are valuable even if brief.

REJECT content that contains:
- Hate speech, racism, or discrimination
- Personal attacks or harassment
- Spam or advertising
- Explicit sexual content or inappropriate material
- Trolling or deliberate disruption
- ONLY reject short messages if they are clearly hostile, offensive, or spam

Respond in JSON format:
{
  "approved": true/false,
  "reason": "Brief explanation"
}`;

  const userPrompt = title
    ? `Type: ${type}\nTitle: ${title}\nContent: ${content}`
    : `Type: ${type}\nContent: ${content}`;

  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': modalApiKey.value(),
      },
      body: JSON.stringify({
        model: 'qwen2.5:32b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Parse JSON response
    const result = JSON.parse(aiResponse);
    return {
      approved: Boolean(result.approved),
      reason: String(result.reason || 'No reason provided'),
    };
  } catch (error) {
    console.error('AI moderation error:', error);
    // On error, default to pending (manual review required)
    return {
      approved: false,
      reason: 'Automatic moderation failed. Requires manual review.',
    };
  }
}

/**
 * Trigger: When a new question is created
 *
 * Concurrency limits:
 * - maxInstances: 10 - Prevents Modal API overload and cost explosion
 * - minInstances: 1 - Keeps one warm for low latency (~100ms vs ~2s cold start)
 * - concurrency: 5 - Balances throughput with Modal API rate limits
 * - Max concurrent moderations: 50 (10 instances × 5 requests)
 */
export const moderateQuestion = onDocumentCreated(
  {
    document: 'qa_questions/{questionId}',
    secrets: [modalApiKey],
    maxInstances: 10,
    minInstances: 1,
    concurrency: 5,
    timeoutSeconds: 30,
    memory: '512MiB',
    cpu: 1,
  },
  async (event) => {
  const questionId = event.params.questionId;
  const data = event.data?.data();

  if (!data) {
    console.error('No data in event');
    return;
  }

  // Only moderate if status is pending
  if (data.moderationStatus !== 'pending') {
    return;
  }

  console.log(`Moderating question: ${questionId}`);

  try {
    const result = await moderateContent(
      data.content,
      data.title,
      'question'
    );

    // Update document with moderation result
    await admin.firestore().collection('qa_questions').doc(questionId).update({
      moderationStatus: result.approved ? 'approved' : 'rejected',
      moderationReason: result.reason,
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Question ${questionId}: ${result.approved ? 'APPROVED' : 'REJECTED'} - ${result.reason}`);
  } catch (error) {
    console.error(`Failed to moderate question ${questionId}:`, error);

    // Mark as pending for manual review
    await admin.firestore().collection('qa_questions').doc(questionId).update({
      moderationStatus: 'pending',
      moderationReason: 'Automatic moderation failed. Requires manual review.',
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});

/**
 * Trigger: When a question is updated and needs re-moderation
 *
 * Concurrency limits:
 * - maxInstances: 5 - Lower for edits (less frequent than new questions)
 * - concurrency: 5 - Same as creation
 * - Max concurrent re-moderations: 25 (5 instances × 5 requests)
 */
export const moderateQuestionOnUpdate = onDocumentUpdated(
  {
    document: 'qa_questions/{questionId}',
    secrets: [modalApiKey],
    maxInstances: 5,
    concurrency: 5,
    timeoutSeconds: 30,
    memory: '512MiB',
    cpu: 1,
  },
  async (event) => {
  const questionId = event.params.questionId;
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!beforeData || !afterData) {
    console.error('No data in event');
    return;
  }

  // Only moderate if status changed to 'pending'
  if (beforeData.moderationStatus !== 'pending' && afterData.moderationStatus === 'pending') {
    console.log(`Re-moderating updated question: ${questionId}`);

    try {
      const result = await moderateContent(
        afterData.content,
        afterData.title,
        'question'
      );

      // Update document with moderation result
      await admin.firestore().collection('qa_questions').doc(questionId).update({
        moderationStatus: result.approved ? 'approved' : 'rejected',
        moderationReason: result.reason,
        moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Question ${questionId} re-moderation: ${result.approved ? 'APPROVED' : 'REJECTED'} - ${result.reason}`);
    } catch (error) {
      console.error(`Failed to re-moderate question ${questionId}:`, error);

      // Mark as pending for manual review
      await admin.firestore().collection('qa_questions').doc(questionId).update({
        moderationStatus: 'pending',
        moderationReason: 'Automatic moderation failed. Requires manual review.',
        moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
});

/**
 * Trigger: When a new answer is created
 *
 * Concurrency limits:
 * - maxInstances: 10 - Same as questions (answers can be frequent)
 * - minInstances: 1 - Keep warm for low latency
 * - concurrency: 5 - Balances throughput with Modal API
 * - Max concurrent moderations: 50 (10 instances × 5 requests)
 */
export const moderateAnswer = onDocumentCreated(
  {
    document: 'qa_answers/{answerId}',
    secrets: [modalApiKey],
    maxInstances: 10,
    minInstances: 1,
    concurrency: 5,
    timeoutSeconds: 30,
    memory: '512MiB',
    cpu: 1,
  },
  async (event) => {
  const answerId = event.params.answerId;
  const data = event.data?.data();

  if (!data) {
    console.error('No data in event');
    return;
  }

  // Only moderate if status is pending
  if (data.moderationStatus !== 'pending') {
    return;
  }

  console.log(`Moderating answer: ${answerId}`);

  try {
    const result = await moderateContent(
      data.content,
      undefined,
      'answer'
    );

    // Update document with moderation result
    await admin.firestore().collection('qa_answers').doc(answerId).update({
      moderationStatus: result.approved ? 'approved' : 'rejected',
      moderationReason: result.reason,
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // If approved, increment answer count on the question
    if (result.approved) {
      const questionRef = admin.firestore().collection('qa_questions').doc(data.questionId);
      await questionRef.update({
        answerCount: admin.firestore.FieldValue.increment(1),
      });
    }

    console.log(`Answer ${answerId}: ${result.approved ? 'APPROVED' : 'REJECTED'} - ${result.reason}`);
  } catch (error) {
    console.error(`Failed to moderate answer ${answerId}:`, error);

    // Mark as pending for manual review
    await admin.firestore().collection('qa_answers').doc(answerId).update({
      moderationStatus: 'pending',
      moderationReason: 'Automatic moderation failed. Requires manual review.',
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});

/**
 * Trigger: When an answer is updated and needs re-moderation
 *
 * Concurrency limits:
 * - maxInstances: 5 - Lower for edits (less frequent)
 * - concurrency: 5 - Same as creation
 * - Max concurrent re-moderations: 25 (5 instances × 5 requests)
 */
export const moderateAnswerOnUpdate = onDocumentUpdated(
  {
    document: 'qa_answers/{answerId}',
    secrets: [modalApiKey],
    maxInstances: 5,
    concurrency: 5,
    timeoutSeconds: 30,
    memory: '512MiB',
    cpu: 1,
  },
  async (event) => {
  const answerId = event.params.answerId;
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!beforeData || !afterData) {
    console.error('No data in event');
    return;
  }

  // Only moderate if status changed to 'pending'
  if (beforeData.moderationStatus !== 'pending' && afterData.moderationStatus === 'pending') {
    console.log(`Re-moderating updated answer: ${answerId}`);

    try {
      const result = await moderateContent(
        afterData.content,
        undefined,
        'answer'
      );

      const newStatus = result.approved ? 'approved' : 'rejected';
      const previousStatus = beforeData.moderationStatus;
      const questionId = afterData.questionId;

      // Update answer document with moderation result
      await admin.firestore().collection('qa_answers').doc(answerId).update({
        moderationStatus: newStatus,
        moderationReason: result.reason,
        moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Adjust question answerCount when approval state flips
      try {
        if (previousStatus !== newStatus && questionId) {
          const questionRef = admin.firestore().collection('qa_questions').doc(questionId);

          if (previousStatus === 'approved' && newStatus !== 'approved') {
            await questionRef.update({
              answerCount: admin.firestore.FieldValue.increment(-1),
            });
          } else if (previousStatus !== 'approved' && newStatus === 'approved') {
            await questionRef.update({
              answerCount: admin.firestore.FieldValue.increment(1),
            });
          }
        }
      } catch (countError) {
        console.error(`Failed to adjust answerCount for question ${questionId}:`, countError);
      }

      console.log(`Answer ${answerId} re-moderation: ${newStatus === 'approved' ? 'APPROVED' : 'REJECTED'} - ${result.reason}`);
    } catch (error) {
      console.error(`Failed to re-moderate answer ${answerId}:`, error);

      // Mark as pending for manual review
      await admin.firestore().collection('qa_answers').doc(answerId).update({
        moderationStatus: 'pending',
        moderationReason: 'Automatic moderation failed. Requires manual review.',
        moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
});
