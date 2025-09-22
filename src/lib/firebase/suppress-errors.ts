// This script suppresses Firestore network errors in the console
// It should be imported as early as possible in the application

export const suppressFirestoreErrors = `
(function() {
  if (typeof window === 'undefined') return;

  // Patterns to suppress - only network-related errors, not API errors
  const suppressedPatterns = [
    'ERR_NETWORK_CHANGED',
    'ERR_ABORTED',
    'ERR_FAILED',
    'Failed to get document because the client is offline',
    'net::ERR_',
    'NETWORK_ERROR',
    'network-request-failed',
    'webchannel_blob',
    'streakSync',
    'rpc&SID=',
    'blob_es2018',
    'listen/chan'
  ];

  // Patterns that should NOT be suppressed (actual API errors)
  const allowedPatterns = [
    'FirebaseError',
    'permission-denied',
    'unauthenticated',
    'not-found',
    'already-exists',
    'resource-exhausted',
    'failed-precondition',
    'aborted',
    'out-of-range',
    'unimplemented',
    'internal',
    'unavailable',
    'data-loss',
    'invalid-argument'
  ];

  // Helper to check if should suppress
  const shouldSuppress = function(args) {
    const errorString = Array.prototype.slice.call(args)
      .map(function(arg) {
        if (typeof arg === 'string') {
          return arg;
        }
        try {
          // Try to stringify, but catch circular reference errors
          return JSON.stringify(arg);
        } catch (e) {
          // If it's a circular structure (like DOM elements), just use toString
          if (arg && typeof arg.toString === 'function') {
            return arg.toString();
          }
          return '[Object]';
        }
      })
      .join(' ');

    // First check if it contains an allowed pattern (API errors) - don't suppress these
    const containsAllowed = allowedPatterns.some(function(pattern) {
      return errorString.indexOf(pattern) !== -1;
    });

    if (containsAllowed) {
      return false; // Don't suppress API errors
    }

    // Check if it matches suppressed patterns (network errors)
    return suppressedPatterns.some(function(pattern) {
      return errorString.indexOf(pattern) !== -1;
    });
  };

  // Store original methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  // Override console methods
  console.error = function() {
    if (!shouldSuppress(arguments)) {
      originalError.apply(console, arguments);
    }
  };

  console.warn = function() {
    if (!shouldSuppress(arguments)) {
      originalWarn.apply(console, arguments);
    }
  };

  console.log = function() {
    if (!shouldSuppress(arguments)) {
      originalLog.apply(console, arguments);
    }
  };

  // Override XMLHttpRequest to suppress only network errors (not API errors)
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function() {
    const xhr = this;
    const url = arguments[1];

    // Check if it's a Firestore URL for network-related issues only
    if (url && url.indexOf('firestore.googleapis.com') !== -1) {
      // Add error handler to suppress network errors only
      xhr.addEventListener('error', function(e) {
        // Only prevent default for network errors, not API errors
        if (!xhr.responseText || xhr.status === 0) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);

      xhr.addEventListener('abort', function(e) {
        // Only suppress actual aborts, not API errors
        if (xhr.status === 0) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);
    }

    return originalOpen.apply(this, arguments);
  };
})();
`;