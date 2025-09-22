/**
 * Utility functions for validation
 */

export class ValidationUtils {
  /**
   * Convert romaji to hiragana
   */
  static romajiToHiragana(text: string): string {
    const map: { [key: string]: string } = {
      'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
      'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
      'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
      'sa': 'さ', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
      'za': 'ざ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
      'ta': 'た', 'chi': 'ち', 'tsu': 'つ', 'te': 'て', 'to': 'と',
      'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
      'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
      'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
      'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
      'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
      'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
      'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
      'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
      'wa': 'わ', 'wi': 'ゐ', 'we': 'ゑ', 'wo': 'を', 'n': 'ん',
      // Combinations
      'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
      'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
      'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
      'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
      'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
      'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
      'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
      'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
      'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
      'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
      'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ'
    };
    
    let result = text.toLowerCase();
    
    // Sort by length (longer combinations first)
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
      result = result.replace(new RegExp(key, 'g'), map[key]);
    }
    
    return result;
  }
  
  /**
   * Convert romaji to katakana
   */
  static romajiToKatakana(text: string): string {
    const hiragana = this.romajiToHiragana(text);
    return this.hiraganaToKatakana(hiragana);
  }
  
  /**
   * Convert hiragana to katakana
   */
  static hiraganaToKatakana(text: string): string {
    return text.replace(/[\u3041-\u3096]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) + 0x60);
    });
  }
  
  /**
   * Convert katakana to hiragana
   */
  static katakanaToHiragana(text: string): string {
    return text.replace(/[\u30A1-\u30F6]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
  }
  
  /**
   * Check if text contains kanji
   */
  static hasKanji(text: string): boolean {
    return /[\u4E00-\u9FAF]/.test(text);
  }
  
  /**
   * Check if text is only hiragana
   */
  static isOnlyHiragana(text: string): boolean {
    return /^[\u3041-\u3096\u3099-\u309F]+$/.test(text);
  }
  
  /**
   * Check if text is only katakana
   */
  static isOnlyKatakana(text: string): boolean {
    return /^[\u30A0-\u30FF]+$/.test(text);
  }
  
  /**
   * Check if text is only kana (hiragana or katakana)
   */
  static isOnlyKana(text: string): boolean {
    return /^[\u3041-\u3096\u3099-\u309F\u30A0-\u30FF]+$/.test(text);
  }
  
  /**
   * Extract kanji from text
   */
  static extractKanji(text: string): string[] {
    const matches = text.match(/[\u4E00-\u9FAF]/g);
    return matches ? [...new Set(matches)] : [];
  }
  
  /**
   * Count mora (sound units) in Japanese text
   */
  static countMora(text: string): number {
    // Remove non-kana characters
    const kanaOnly = text.replace(/[^\u3041-\u3096\u30A0-\u30FF]/g, '');
    
    // Small kana don't count as separate mora
    const withoutSmallKana = kanaOnly.replace(/[ゃゅょゃゅょァィゥェォヵヶ]/g, '');
    
    // Long vowel mark counts as one
    const normalized = withoutSmallKana.replace(/ー/g, 'あ');
    
    return normalized.length;
  }
  
  /**
   * Normalize Japanese text for comparison
   */
  static normalizeJapanese(text: string): string {
    let normalized = text;
    
    // Convert full-width alphanumeric to half-width
    normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
    
    // Normalize punctuation
    normalized = normalized.replace(/。/g, '.');
    normalized = normalized.replace(/、/g, ',');
    normalized = normalized.replace(/！/g, '!');
    normalized = normalized.replace(/？/g, '?');
    normalized = normalized.replace(/「|」/g, '"');
    normalized = normalized.replace(/『|』/g, "'");
    normalized = normalized.replace(/（|）/g, '');
    normalized = normalized.replace(/［|］/g, '');
    
    // Remove spaces between Japanese characters
    normalized = normalized.replace(/([\u3041-\u3096\u30A0-\u30FF\u4E00-\u9FAF])\s+([\u3041-\u3096\u30A0-\u30FF\u4E00-\u9FAF])/g, '$1$2');
    
    return normalized.trim();
  }
  
  /**
   * Calculate edit distance between two strings
   */
  static editDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1, // substitution
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return dp[m][n];
  }
  
  /**
   * Calculate similarity score (0-1) based on edit distance
   */
  static similarity(str1: string, str2: string): number {
    const distance = this.editDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) return 1;
    
    return 1 - (distance / maxLength);
  }
  
  /**
   * Fuzzy match with configurable threshold
   */
  static fuzzyMatch(
    input: string,
    target: string,
    threshold: number = 0.8
  ): boolean {
    const similarity = this.similarity(input, target);
    return similarity >= threshold;
  }
  
  /**
   * Find best match from array of options
   */
  static findBestMatch(
    input: string,
    options: string[]
  ): { match: string; score: number; index: number } | null {
    if (options.length === 0) return null;
    
    let bestMatch = {
      match: options[0],
      score: 0,
      index: 0
    };
    
    for (let i = 0; i < options.length; i++) {
      const score = this.similarity(input, options[i]);
      if (score > bestMatch.score) {
        bestMatch = {
          match: options[i],
          score,
          index: i
        };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Tokenize Japanese text (simplified)
   */
  static tokenizeJapanese(text: string): string[] {
    const tokens: string[] = [];
    const particles = ['は', 'が', 'を', 'に', 'へ', 'で', 'と', 'から', 'まで', 'より', 'の'];
    let current = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (particles.includes(char) || /[。、！？\s]/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        if (particles.includes(char)) {
          tokens.push(char);
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      tokens.push(current);
    }
    
    return tokens;
  }
}