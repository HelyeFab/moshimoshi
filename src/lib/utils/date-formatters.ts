/**
 * Utility functions for formatting Firebase timestamps and dates
 */

interface FirebaseTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

/**
 * Converts Firebase timestamp to JavaScript Date
 */
export function firebaseTimestampToDate(timestamp: FirebaseTimestamp | Date | string | null | undefined): Date | null {
  if (!timestamp) return null;

  // Already a Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // ISO string
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }

  // Firebase Timestamp format
  if (typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
  }

  return null;
}

/**
 * Formats a Firebase timestamp to a human-readable string
 * Example: "Oct 4, 2025 2:30 PM"
 */
export function formatFirebaseTimestamp(timestamp: FirebaseTimestamp | Date | string | null | undefined): string {
  const date = firebaseTimestampToDate(timestamp);
  if (!date) return 'Never';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Formats a Firebase timestamp to just the date
 * Example: "Oct 4, 2025"
 */
export function formatFirebaseDate(timestamp: FirebaseTimestamp | Date | string | null | undefined): string {
  const date = firebaseTimestampToDate(timestamp);
  if (!date) return 'Never';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

/**
 * Formats a Firebase timestamp as relative time
 * Example: "2 hours ago", "3 days ago"
 */
export function formatFirebaseRelative(timestamp: FirebaseTimestamp | Date | string | null | undefined): string {
  const date = firebaseTimestampToDate(timestamp);
  if (!date) return 'Never';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (seconds > 10) return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  return 'Just now';
}

/**
 * Recursively converts all Firebase timestamps in an object to formatted strings
 */
export function formatAllTimestamps(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => formatAllTimestamps(item));
  }

  // Handle objects
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if this looks like a Firebase timestamp
    if (
      value &&
      typeof value === 'object' &&
      '_seconds' in value &&
      '_nanoseconds' in value
    ) {
      result[key] = {
        raw: value,
        formatted: formatFirebaseTimestamp(value as FirebaseTimestamp),
        date: formatFirebaseDate(value as FirebaseTimestamp),
        relative: formatFirebaseRelative(value as FirebaseTimestamp),
        iso: firebaseTimestampToDate(value as FirebaseTimestamp)?.toISOString() || null
      };
    } else if (value && typeof value === 'object') {
      // Recursively process nested objects
      result[key] = formatAllTimestamps(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
