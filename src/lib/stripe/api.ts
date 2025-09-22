/**
 * Client-side Stripe API helpers with idempotency and session-based auth
 */

/**
 * Generic POST helper using session cookies for authentication
 * @param url - The API endpoint
 * @param body - The request body
 */
export async function postJSON(url: string, body: any) {
  // No need for Firebase auth - we use session cookies
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for session auth
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;

    // Clone the response so we can try multiple reads if needed
    const clonedRes = res.clone();

    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If response isn't JSON, try text from the cloned response
      try {
        const text = await clonedRes.text();
        if (text) errorMessage = text;
      } catch {
        // If both fail, just use the status code message
        errorMessage = `Request failed with status ${res.status}`;
      }
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

/**
 * Start Stripe Checkout for subscription
 */
export async function startCheckout(
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<void> {
  try {
    const { url } = await postJSON('/api/stripe/create-checkout-session', {
      priceId,
      successUrl,
      cancelUrl,
      idempotencyKey: crypto.randomUUID(),
    });
    
    if (url) {
      window.location.assign(url);
    } else {
      throw new Error('No checkout URL returned');
    }
  } catch (error) {
    console.error('Failed to start checkout:', error);
    throw error;
  }
}

/**
 * Open Stripe Customer Portal for subscription management
 */
export async function openBillingPortal(returnUrl: string): Promise<void> {
  try {
    const { url } = await postJSON('/api/stripe/create-portal-session', {
      returnUrl,
      idempotencyKey: crypto.randomUUID(),
    });
    
    if (url) {
      window.location.assign(url);
    } else {
      throw new Error('No portal URL returned');
    }
  } catch (error) {
    console.error('Failed to open billing portal:', error);
    throw error;
  }
}

/**
 * Cancel subscription (via portal for now)
 */
export async function cancelSubscription(): Promise<void> {
  // For now, redirect to portal for cancellation
  // Could implement direct cancellation endpoint later
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const returnUrl = `${origin}/account?action=canceled`;
  await openBillingPortal(returnUrl);
}

/**
 * Upgrade or downgrade subscription
 */
export async function changeSubscription(newPriceId: string): Promise<void> {
  // For MVP, use portal for plan changes
  // Could implement direct update endpoint later
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const returnUrl = `${origin}/account?action=updated`;
  await openBillingPortal(returnUrl);
}

/**
 * Helper to construct success/cancel URLs with proper encoding
 */
export function getCheckoutUrls(baseUrl?: string) {
  const defaultUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = baseUrl || defaultUrl;
  return {
    success: `${url}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${url}/pricing?checkout=canceled`
  };
}

/**
 * Check if user just completed checkout (from URL params)
 */
export function checkCheckoutStatus(): {
  completed: boolean;
  success: boolean;
  sessionId?: string;
} {
  if (typeof window === 'undefined') {
    return { completed: false, success: false };
  }
  const params = new URLSearchParams(window.location.search);
  const checkoutParam = params.get('checkout');
  const sessionId = params.get('session_id');
  
  return {
    completed: !!checkoutParam,
    success: checkoutParam === 'success',
    sessionId: sessionId || undefined
  };
}

/**
 * Clear checkout params from URL (for cleanup after showing success message)
 */
export function clearCheckoutParams(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('checkout');
  url.searchParams.delete('session_id');
  window.history.replaceState({}, '', url.toString());
}