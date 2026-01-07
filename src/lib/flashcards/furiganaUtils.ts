/**
 * Furigana utilities for flashcards
 * Handles detection and generation of furigana for Japanese text
 */

/**
 * Check if text already contains furigana in various formats
 */
export function hasExistingFurigana(text: string): boolean {
  if (!text) return false;

  // Check for HTML ruby tags
  if (text.includes('<ruby>') || text.includes('<rt>')) {
    return true;
  }

  // Check for bracket notation: 漢字[かんじ]
  if (/\[[\u3040-\u309F]+\]/.test(text)) {
    return true;
  }

  // Check for parentheses notation: 漢字（かんじ）
  if (/[\u4E00-\u9FAF]+[（(][\u3040-\u309F]+[）)]/u.test(text)) {
    return true;
  }

  return false;
}

/**
 * Check if text contains Japanese characters (kanji)
 */
export function hasJapaneseKanji(text: string): boolean {
  if (!text) return false;
  return /[\u4E00-\u9FAF]/.test(text);
}

/**
 * Check if text needs furigana generation
 * (has kanji but no existing furigana)
 */
export function needsFurigana(text: string): boolean {
  return hasJapaneseKanji(text) && !hasExistingFurigana(text);
}

/**
 * Generate furigana for Japanese text using the API
 */
export async function generateFurigana(text: string): Promise<string | null> {
  if (!text || !needsFurigana(text)) {
    return null;
  }

  try {
    const response = await fetch('/api/furigana', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error('Furigana API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error('Failed to generate furigana:', error);
    return null;
  }
}

/**
 * Generate furigana for a batch of texts
 * Returns a map of original text -> furigana HTML
 */
export async function generateFuriganaBatch(
  texts: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // Filter out texts that don't need furigana
  const textsToProcess = texts.filter(needsFurigana);

  if (textsToProcess.length === 0) {
    return result;
  }

  // Process in parallel with some rate limiting (max 5 concurrent)
  const batchSize = 5;
  for (let i = 0; i < textsToProcess.length; i += batchSize) {
    const batch = textsToProcess.slice(i, i + batchSize);
    const promises = batch.map(async (text) => {
      const furigana = await generateFurigana(text);
      if (furigana) {
        result.set(text, furigana);
      }
    });

    await Promise.all(promises);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < textsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return result;
}

/**
 * Strip furigana from text, leaving only the base text
 * Useful for searching or comparing
 */
export function stripFurigana(text: string): string {
  if (!text) return '';

  // Remove HTML ruby tags, keeping only the base text
  let cleaned = text.replace(/<ruby>(.*?)<rp>.*?<\/rp><rt>.*?<\/rt><rp>.*?<\/rp><\/ruby>/g, '$1');
  cleaned = cleaned.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, '$1');

  // Remove bracket notation: 漢字[かんじ] -> 漢字
  cleaned = cleaned.replace(/\[[\u3040-\u309F]+\]/g, '');

  // Remove parentheses notation: 漢字（かんじ） -> 漢字
  cleaned = cleaned.replace(/[（(][\u3040-\u309F]+[）)]/g, '');

  return cleaned;
}
