type ErrorCode = string;
type UserMessage = string;

const errorMessageMap: Record<ErrorCode, UserMessage> = {
  // Firebase Auth Errors
  'auth/popup-closed-by-user': 'Sign-in cancelled. Please try again when you\'re ready.',
  'auth/cancelled-popup-request': 'Sign-in cancelled. Please try again.',
  'auth/network-request-failed': 'Connection issue. Please check your internet and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/user-not-found': 'No account found with this email. Please check or sign up.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
  'auth/weak-password': 'Please choose a stronger password (at least 6 characters).',
  'auth/invalid-credential': 'Invalid email or password. Please check and try again.',
  'auth/operation-not-allowed': 'This sign-in method is currently disabled.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
  'auth/requires-recent-login': 'Please sign in again to complete this action.',
  'auth/unauthorized-domain': 'This domain is not authorized. Please contact support.',
  'auth/invalid-action-code': 'This link has expired or is invalid. Please request a new one.',
  'auth/expired-action-code': 'This link has expired. Please request a new one.',

  // Custom Auth Errors
  'AUTH_EMAIL_EXISTS': 'This email is already registered. Please sign in instead.',
  'AUTH_WEAK_PASSWORD': 'Password must be at least 8 characters with uppercase, number, and special character.',
  'AUTH_INVALID_EMAIL': 'Please enter a valid email address.',
  'AUTH_INVALID_CREDENTIALS': 'Invalid email or password. Please check and try again.',
  'AUTH_USER_NOT_FOUND': 'No account found with this email. Please check or sign up.',
  'RATE_LIMITED': 'Too many attempts. Please try again later.',
  
  // Validation Errors
  'VALIDATION_ERROR': 'Please check your information and try again.',
  'Invalid input data': 'Please check your information and try again.',
  'INVALID_INPUT': 'Please check your information and try again.',
  
  // Network Errors
  'NETWORK_ERROR': 'Connection issue. Please check your internet.',
  'TIMEOUT': 'Request timed out. Please try again.',
  'OFFLINE': 'You appear to be offline. Please check your connection.',
  
  // Payment/Subscription Errors
  'payment_intent_authentication_failure': 'Payment authentication failed. Please try again.',
  'card_declined': 'Card was declined. Please try a different payment method.',
  'expired_card': 'Your card has expired. Please update your payment information.',
  'insufficient_funds': 'Insufficient funds. Please try a different payment method.',
  'SUBSCRIPTION_REQUIRED': 'Premium subscription required for this feature.',
  'SUBSCRIPTION_EXPIRED': 'Your subscription has expired. Please renew to continue.',
  
  // Permission Errors
  'PERMISSION_DENIED': 'You don\'t have permission to perform this action.',
  'UNAUTHORIZED': 'Please sign in to continue.',
  'FORBIDDEN': 'Access denied. Please contact support if you believe this is an error.',
  
  // Resource Errors
  'NOT_FOUND': 'The requested content could not be found.',
  'RESOURCE_EXHAUSTED': 'Daily limit reached. Please try again tomorrow.',
  'ALREADY_EXISTS': 'This already exists. Please choose a different name.',
  
  // Server Errors
  'INTERNAL_ERROR': 'Something went wrong on our end. Please try again.',
  'SERVER_ERROR': 'Server error. Our team has been notified.',
  'SERVICE_UNAVAILABLE': 'Service temporarily unavailable. Please try again later.',
  
  // Generic Errors
  'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.',
  'GENERIC_ERROR': 'Something went wrong. Please try again.',
};

export function getUserFriendlyErrorMessage(error: unknown): string {
  // Handle string errors
  if (typeof error === 'string') {
    // Check if it's a Firebase error format
    if (error.includes('Firebase: Error')) {
      const match = error.match(/\((.*?)\)/);
      if (match) {
        const errorCode = match[1];
        return errorMessageMap[errorCode] || getFallbackMessage(error);
      }
    }
    // Check direct mapping
    return errorMessageMap[error] || getFallbackMessage(error);
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    // Check for Firebase auth errors
    if ('code' in error && typeof (error as any).code === 'string') {
      const code = (error as any).code;
      return errorMessageMap[code] || getFallbackMessage(error.message);
    }
    
    // Check message for known patterns
    const message = error.message;
    for (const [key, value] of Object.entries(errorMessageMap)) {
      if (message.includes(key)) {
        return value;
      }
    }
    
    return getFallbackMessage(message);
  }
  
  // Handle API error responses
  if (error && typeof error === 'object') {
    // First check if error has a code property (most specific)
    if ('code' in error && typeof (error as any).code === 'string') {
      const mapped = errorMessageMap[(error as any).code];
      if (mapped) return mapped;
    }

    // Then check nested error object
    if ('error' in error) {
      const apiError = (error as any).error;
      if (typeof apiError === 'string') {
        return errorMessageMap[apiError] || getFallbackMessage(apiError);
      }
      if (apiError && typeof apiError === 'object') {
        if ('code' in apiError) {
          const mapped = errorMessageMap[apiError.code];
          if (mapped) return mapped;
          return getFallbackMessage(apiError.message || apiError.code);
        }
        if ('message' in apiError) {
          return errorMessageMap[apiError.message] || getFallbackMessage(apiError.message);
        }
      }
    }

    // Finally check message property
    if ('message' in error && typeof (error as any).message === 'string') {
      return errorMessageMap[(error as any).message] || getFallbackMessage((error as any).message);
    }
  }
  
  return errorMessageMap['UNKNOWN_ERROR'];
}

function getFallbackMessage(originalError: string): string {
  // Remove technical details but provide helpful context
  const lowerError = originalError.toLowerCase();
  
  if (lowerError.includes('network') || lowerError.includes('fetch')) {
    return errorMessageMap['NETWORK_ERROR'];
  }
  if (lowerError.includes('timeout')) {
    return errorMessageMap['TIMEOUT'];
  }
  if (lowerError.includes('permission') || lowerError.includes('denied')) {
    return errorMessageMap['PERMISSION_DENIED'];
  }
  if (lowerError.includes('unauthorized') || lowerError.includes('auth')) {
    return errorMessageMap['UNAUTHORIZED'];
  }
  if (lowerError.includes('not found') || lowerError.includes('404')) {
    return errorMessageMap['NOT_FOUND'];
  }
  if (lowerError.includes('server') || lowerError.includes('500')) {
    return errorMessageMap['SERVER_ERROR'];
  }
  if (lowerError.includes('validation') || lowerError.includes('invalid')) {
    return errorMessageMap['VALIDATION_ERROR'];
  }
  
  // Default fallback
  return errorMessageMap['GENERIC_ERROR'];
}

export function getErrorToastType(error: unknown): 'error' | 'warning' {
  if (typeof error === 'string') {
    const lowerError = error.toLowerCase();
    // Warnings for less critical errors
    if (
      lowerError.includes('cancelled') ||
      lowerError.includes('popup-closed') ||
      lowerError.includes('too-many-requests') ||
      lowerError.includes('expired')
    ) {
      return 'warning';
    }
  }
  
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as any).code;
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/too-many-requests' ||
      code === 'RESOURCE_EXHAUSTED'
    ) {
      return 'warning';
    }
  }
  
  return 'error';
}