/**
 * One-time migration to fix bracket notation furigana in existing Anki decks
 * Converts: kanji[reading] → <ruby>kanji<rt>reading</rt></ruby>
 *
 * Usage:
 * 1. Import this in browser console or run from a page
 * 2. Call: await fixBracketFuriganaInExistingDecks()
 */

import { openDB } from 'idb';

/**
 * Convert bracket notation furigana to ruby tags
 * Same logic as AnkiParser.convertBracketFuriganaToRuby()
 */
function convertBracketFuriganaToRuby(html: string): string {
  if (!html) return html;

  // Match: one or more kanji/kana characters followed by [hiragana/katakana reading]
  return html.replace(
    /([一-龯々〆ヵヶ]+)\[([ぁ-んァ-ヶー]+)\]/g,
    '<ruby>$1<rt>$2</rt></ruby>'
  );
}

/**
 * Add line break between romaji and Japanese text for better visual separation
 * Same logic as in AnkiParser.cleanAnkiHtml()
 */
function separateRomajiFromJapanese(html: string): string {
  if (!html) return html;

  // Add line break between romaji and Japanese text
  // Example: "boku mo neru 僕も寝る" becomes "boku mo neru<br>僕も寝る"
  return html.replace(
    /([a-zA-Z][a-zA-Z\s]*)\s+([一-龯々ぁ-んァ-ヶー<][^a-zA-Z]*)/g,
    '$1<br>$2'
  );
}

/**
 * Extract furigana from HTML with ruby tags
 */
function extractFurigana(html: string): string | null {
  if (!html) return null;

  // Check if the HTML contains ruby tags
  const hasRubyTags = /<ruby>.*?<rt>.*?<\/rt><\/ruby>/gi.test(html);

  if (!hasRubyTags) {
    return null;
  }

  // Return the HTML with ruby tags preserved
  let furiganaHtml = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove audio/image references
  furiganaHtml = furiganaHtml.replace(/\[sound:[^\]]+\]/g, '');
  furiganaHtml = furiganaHtml.replace(/<img[^>]+>/g, '');

  // Remove all links (complete tags with content)
  furiganaHtml = furiganaHtml.replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '');

  // Remove instructional text patterns
  furiganaHtml = furiganaHtml.replace(/Hover\s*\/\s*tap\s+on\s+kanji.*?(?=<|$)/gi, '');
  furiganaHtml = furiganaHtml.replace(/Source\s+of\s+this\s+card:.*?(?=<|$)/gi, '');
  furiganaHtml = furiganaHtml.replace(/Change\s+text\s+with.*?(?=<|$)/gi, '');
  furiganaHtml = furiganaHtml.replace(/Your\s+deck\s+version:.*?(?=<|$)/gi, '');
  furiganaHtml = furiganaHtml.replace(/Check\s+for\s+updates.*?(?=<|$)/gi, '');
  furiganaHtml = furiganaHtml.replace(/You\s+can\s+support.*?(?=<|$)/gi, '');

  // Remove "References:" if not followed by actual content (handles closing tags too)
  furiganaHtml = furiganaHtml.replace(/References:\s*(<br\s*\/?>|\s|<\/[^>]+>)*$/gi, '');

  // Remove non-ruby formatting tags but preserve content
  // Use \b word boundaries to avoid matching <br> when removing <b>
  furiganaHtml = furiganaHtml.replace(/<\/?(div|p|span|strong|em|font)\b[^>]*>/gi, '');
  furiganaHtml = furiganaHtml.replace(/<\/?([biu])\b(?![a-z])[^>]*>/gi, '');

  // Clean up excessive line breaks - replace multiple <br> with single one
  furiganaHtml = furiganaHtml.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');

  // Remove leading line breaks
  furiganaHtml = furiganaHtml.replace(/^(<br\s*\/?>\s*)+/gi, '');

  // Wrap romaji text with styled span
  // Pattern: [Latin text] followed by <br> and then Japanese
  furiganaHtml = furiganaHtml.replace(
    /^([a-zA-Z][a-zA-Z\s]*?)(<br>)/,
    '<span class="anki-romaji-label">romaji: <span class="anki-romaji-text">$1</span></span>$2'
  );

  return furiganaHtml.trim();
}

export async function fixBracketFuriganaInExistingDecks(options?: {
  forceRegenerateFurigana?: boolean;
}): Promise<{
  success: boolean;
  decksProcessed: number;
  cardsUpdated: number;
  errors: string[];
}> {
  const forceRegenerate = options?.forceRegenerateFurigana ?? false;
  const result = {
    success: true,
    decksProcessed: 0,
    cardsUpdated: 0,
    errors: [] as string[]
  };

  try {
    console.log('[Migration] Opening FlashcardDB...');
    if (forceRegenerate) {
      console.log('[Migration] 🔄 FORCE REGENERATE MODE: Will update all furigana fields');
    }
    const db = await openDB('FlashcardDB', 2);

    console.log('[Migration] Fetching all decks...');
    const allDecks = await db.getAll('decks');

    // Filter for Anki decks only
    const ankiDecks = allDecks.filter((deck: any) => deck.source === 'anki');
    console.log(`[Migration] Found ${ankiDecks.length} Anki decks`);

    if (ankiDecks.length === 0) {
      console.log('[Migration] No Anki decks found. Nothing to migrate.');
      return result;
    }

    for (const deck of ankiDecks) {
      try {
        console.log(`[Migration] Processing deck: ${deck.name} (${deck.id})`);
        let deckUpdated = false;
        let cardsUpdatedInDeck = 0;

        // Count cards that need processing
        const cardsNeedingBracketConversion = deck.cards.filter((c: any) =>
          /[一-龯々〆ヵヶ]+\[[ぁ-んァ-ヶー]+\]/.test(c.front) ||
          /[一-龯々〆ヵヶ]+\[[ぁ-んァ-ヶー]+\]/.test(c.back)
        ).length;
        const cardsNeedingRomajiSeparation = deck.cards.filter((c: any) =>
          /[a-zA-Z]+.*?\s+[一-龯々ぁ-んァ-ヶー<]/.test(c.front) ||
          /[a-zA-Z]+.*?\s+[一-龯々ぁ-んァ-ヶー<]/.test(c.back)
        ).length;

        console.log(`[Migration]   Cards with bracket notation: ${cardsNeedingBracketConversion}`);
        console.log(`[Migration]   Cards with romaji+Japanese pattern: ${cardsNeedingRomajiSeparation}`);

        // Process each card in the deck
        for (let i = 0; i < deck.cards.length; i++) {
          const card = deck.cards[i];
          let cardUpdated = false;

          // Check if card has bracket notation
          const hasBracketNotationFront = /[一-龯々〆ヵヶ]+\[[ぁ-んァ-ヶー]+\]/.test(card.front);
          const hasBracketNotationBack = /[一-龯々〆ヵヶ]+\[[ぁ-んァ-ヶー]+\]/.test(card.back);

          // Check if card has romaji + Japanese (more flexible pattern)
          // Matches: any Latin text followed by space(s) and Japanese text
          // We'll apply the transformation to all matching cards - the regex will only add <br> where needed
          const needsRomajiSeparationFront = /[a-zA-Z]+.*?\s+[一-龯々ぁ-んァ-ヶー<]/.test(card.front);
          const needsRomajiSeparationBack = /[a-zA-Z]+.*?\s+[一-龯々ぁ-んァ-ヶー<]/.test(card.back);


          const needsProcessing = hasBracketNotationFront || hasBracketNotationBack ||
                                  needsRomajiSeparationFront || needsRomajiSeparationBack ||
                                  (forceRegenerate && card.hasNativeFurigana);

          if (needsProcessing) {
            // Process front side
            if (hasBracketNotationFront || needsRomajiSeparationFront) {
              const oldFront = card.front;
              let frontChanged = false;

              // Convert bracket notation to ruby tags (if needed)
              if (hasBracketNotationFront) {
                const beforeBracket = card.front;
                card.front = convertBracketFuriganaToRuby(card.front);
                if (card.front !== beforeBracket) frontChanged = true;
              }

              // Add line breaks between romaji and Japanese (always apply if needed)
              if (needsRomajiSeparationFront || hasBracketNotationFront) {
                const beforeSeparation = card.front;
                card.front = separateRomajiFromJapanese(card.front);
                if (card.front !== beforeSeparation) frontChanged = true;
              }

              // Update furiganaFront if content changed OR if forcing regeneration
              if (frontChanged || forceRegenerate) {
                const extractedFurigana = extractFurigana(card.front);
                if (extractedFurigana) {
                  const furiganaChanged = card.furiganaFront !== extractedFurigana;
                  if (furiganaChanged || forceRegenerate) {
                    card.furiganaFront = extractedFurigana;
                    card.hasNativeFurigana = true;
                    cardUpdated = true;
                    if (i < 5) {
                      console.log(`[Migration]   Card ${i + 1} furiganaFront regenerated`);
                    }
                  }
                }

                if (frontChanged) {
                  console.log(`[Migration]   Card ${i + 1} front: "${oldFront.substring(0, 50)}..." → "${card.front.substring(0, 50)}..."`);
                }
              }
            }

            // Process back side
            if (hasBracketNotationBack || needsRomajiSeparationBack) {
              const oldBack = card.back;
              let backChanged = false;

              // Convert bracket notation to ruby tags (if needed)
              if (hasBracketNotationBack) {
                const beforeBracket = card.back;
                card.back = convertBracketFuriganaToRuby(card.back);
                if (card.back !== beforeBracket) backChanged = true;
              }

              // Add line breaks between romaji and Japanese (always apply if needed)
              if (needsRomajiSeparationBack || hasBracketNotationBack) {
                const beforeSeparation = card.back;
                card.back = separateRomajiFromJapanese(card.back);
                if (card.back !== beforeSeparation) backChanged = true;
              }

              // Update furiganaBack if content changed OR if forcing regeneration
              if (backChanged || forceRegenerate) {
                const extractedFurigana = extractFurigana(card.back);
                if (extractedFurigana) {
                  const furiganaChanged = card.furiganaBack !== extractedFurigana;
                  if (furiganaChanged || forceRegenerate) {
                    card.furiganaBack = extractedFurigana;
                    card.hasNativeFurigana = true;
                    cardUpdated = true;
                    if (i < 5) {
                      console.log(`[Migration]   Card ${i + 1} furiganaBack regenerated`);
                    }
                  }
                }

                if (backChanged) {
                  console.log(`[Migration]   Card ${i + 1} back: "${oldBack.substring(0, 50)}..." → "${card.back.substring(0, 50)}..."`);
                }
              }
            }
          }

          if (cardUpdated) {
            cardsUpdatedInDeck++;
            deckUpdated = true;
          }
        }

        // Save updated deck back to IndexedDB
        if (deckUpdated) {
          deck.updatedAt = Date.now();
          await db.put('decks', deck);
          console.log(`[Migration]   ✓ Deck "${deck.name}" updated: ${cardsUpdatedInDeck} cards fixed`);
          result.cardsUpdated += cardsUpdatedInDeck;
          result.decksProcessed++;
        } else {
          console.log(`[Migration]   ℹ Deck "${deck.name}" already has proper furigana`);
        }
      } catch (error) {
        const errorMsg = `Failed to process deck ${deck.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Migration] ${errorMsg}`);
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    db.close();

    console.log('[Migration] ========== MIGRATION COMPLETE ==========');
    console.log(`[Migration] Decks processed: ${result.decksProcessed}`);
    console.log(`[Migration] Cards updated: ${result.cardsUpdated}`);
    if (result.errors.length > 0) {
      console.error(`[Migration] Errors: ${result.errors.length}`);
      result.errors.forEach(err => console.error(`[Migration]   - ${err}`));
    } else {
      console.log('[Migration] ✓ No errors');
    }

    return result;
  } catch (error) {
    const errorMsg = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[Migration] ${errorMsg}`);
    result.errors.push(errorMsg);
    result.success = false;
    return result;
  }
}

// For browser console usage
if (typeof window !== 'undefined') {
  (window as any).fixBracketFuriganaInExistingDecks = fixBracketFuriganaInExistingDecks;
}
