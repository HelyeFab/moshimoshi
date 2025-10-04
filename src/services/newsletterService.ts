// Client-side newsletter service - uses API routes, NO direct Firestore access

export interface NewsletterSubscriber {
  email: string;
  subscribedAt: string | Date;
  status: 'active' | 'unsubscribed';
  source: 'blog' | 'homepage' | 'popup';
  userId?: string; // Optional: link to user account if logged in
  unsubscribedAt?: string | Date;
}

/**
 * Subscribe an email to the newsletter
 */
export async function subscribeToNewsletter(
  email: string,
  source: 'blog' | 'homepage' | 'popup' = 'blog'
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for potential user session
      body: JSON.stringify({ email, source }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to subscribe to newsletter');
    }

    return {
      success: true,
      message: data.message || 'Successfully subscribed to newsletter!',
    };
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to subscribe. Please try again.',
    };
  }
}

/**
 * Unsubscribe an email from the newsletter
 */
export async function unsubscribeFromNewsletter(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to unsubscribe from newsletter');
    }

    return {
      success: true,
      message: data.message || 'Successfully unsubscribed from newsletter',
    };
  } catch (error) {
    console.error('Error unsubscribing from newsletter:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to unsubscribe. Please try again.',
    };
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
