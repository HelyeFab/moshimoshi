import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/auth/session';

interface FeedbackData {
  feedback: string;
  category: string;
  userId?: string;
  userEmail?: string;
  timestamp: string;
  url: string;
  userAgent: string;
}

interface FeedbackResponse {
  success: boolean;
  message?: string;
  ticketId?: string;
}

// In production, this would integrate with your ticketing system
const SUPPORT_WEBHOOK = process.env.SUPPORT_WEBHOOK_URL;
const SLACK_WEBHOOK = process.env.SLACK_FEEDBACK_WEBHOOK;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FeedbackResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get user session if available
    const session = await getSession();
    
    const feedbackData: FeedbackData = {
      ...req.body,
      userId: session?.uid || req.body.userId,
      userEmail: session?.email || req.body.userEmail,
    };

    // Validate required fields
    if (!feedbackData.feedback || !feedbackData.category) {
      return res.status(400).json({ 
        success: false, 
        message: 'Feedback and category are required' 
      });
    }

    // Generate ticket ID
    const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store feedback in database (implement based on your DB)
    // await saveFeedback({ ...feedbackData, ticketId });

    // Send to support system webhook if configured
    if (SUPPORT_WEBHOOK) {
      await fetch(SUPPORT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          ...feedbackData,
          priority: getPriority(feedbackData.category),
        }),
      });
    }

    // Send to Slack for real-time monitoring
    if (SLACK_WEBHOOK) {
      await sendToSlack(ticketId, feedbackData);
    }

    // Log for monitoring
    console.log('Feedback received:', {
      ticketId,
      category: feedbackData.category,
      userId: feedbackData.userId,
      timestamp: feedbackData.timestamp,
    });

    return res.status(200).json({
      success: true,
      message: 'Thank you for your feedback!',
      ticketId,
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit feedback. Please try again.',
    });
  }
}

function getPriority(category: string): string {
  const priorityMap: Record<string, string> = {
    bug: 'high',
    payment: 'critical',
    performance: 'high',
    feature: 'low',
    general: 'medium',
    other: 'low',
  };
  return priorityMap[category] || 'medium';
}

async function sendToSlack(ticketId: string, data: FeedbackData) {
  if (!SLACK_WEBHOOK) return;

  const emoji = {
    bug: '🐛',
    payment: '💳',
    performance: '⚡',
    feature: '✨',
    general: '💬',
    other: '📝',
  }[data.category] || '📝';

  const color = {
    bug: 'danger',
    payment: 'danger',
    performance: 'warning',
    feature: 'good',
    general: '#808080',
    other: '#808080',
  }[data.category] || '#808080';

  const payload = {
    text: `${emoji} New ${data.category} feedback received`,
    attachments: [{
      color,
      fields: [
        {
          title: 'Ticket ID',
          value: ticketId,
          short: true,
        },
        {
          title: 'Category',
          value: data.category,
          short: true,
        },
        {
          title: 'User',
          value: data.userEmail || data.userId || 'Anonymous',
          short: true,
        },
        {
          title: 'Page',
          value: data.url,
          short: true,
        },
        {
          title: 'Feedback',
          value: data.feedback,
          short: false,
        },
      ],
      footer: 'Moshimoshi Support',
      ts: Math.floor(Date.now() / 1000),
    }],
  };

  try {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to send to Slack:', error);
  }
}