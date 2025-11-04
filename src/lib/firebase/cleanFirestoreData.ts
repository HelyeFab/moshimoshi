/**
 * Utility to clean data before saving to Firestore
 * Removes undefined values that Firestore doesn't accept
 */

/**
 * Recursively removes undefined values from an object
 * Firestore doesn't accept undefined values, so we need to clean them
 */
export function cleanUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (obj instanceof Date || obj.constructor.name === 'Timestamp') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item))
      .filter(item => item !== undefined);
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (value !== undefined) {
          const cleanedValue = cleanUndefinedValues(value);
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        }
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Prepares data for Firestore by removing undefined values
 * and optionally replacing them with defaults
 */
export function prepareFirestoreData<T extends Record<string, any>>(
  data: T,
  defaults?: Partial<T>
): T {
  // First apply defaults for any undefined values
  const withDefaults = defaults ? { ...defaults, ...data } : data;

  // Then clean any remaining undefined values
  return cleanUndefinedValues(withDefaults) as T;
}

/**
 * Specifically cleans YouTube metadata for Firestore
 */
export function cleanYouTubeMetadata(metadata: any): any {
  if (!metadata) return null;

  return cleanUndefinedValues({
    ...metadata,
    // Provide defaults for common undefined fields
    uploadDate: metadata?.uploadDate || null,
    thumbnails: metadata?.thumbnails || null,
    duration: metadata?.duration || null,
    viewCount: metadata?.viewCount || 0,
    likeCount: metadata?.likeCount || 0,
    commentCount: metadata?.commentCount || 0,
  });
}