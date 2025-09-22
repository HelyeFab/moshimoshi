// Kana (Hiragana & Katakana) data structure
export interface KanaCharacter {
  id: string;
  hiragana: string;
  katakana: string;
  romaji: string;
  type: 'vowel' | 'consonant' | 'y-consonant' | 'digraph' | 'dakuten' | 'handakuten';
  row: string; // a, ka, sa, ta, na, ha, ma, ya, ra, wa, n
  column: string; // a, i, u, e, o
  pronunciation?: string; // Special pronunciation notes
}

// Complete Hiragana & Katakana Chart Data
export const kanaData: KanaCharacter[] = [
  // Vowels (a-row)
  { id: 'a', hiragana: 'あ', katakana: 'ア', romaji: 'a', type: 'vowel', row: 'vowel', column: 'a' },
  { id: 'i', hiragana: 'い', katakana: 'イ', romaji: 'i', type: 'vowel', row: 'vowel', column: 'i' },
  { id: 'u', hiragana: 'う', katakana: 'ウ', romaji: 'u', type: 'vowel', row: 'vowel', column: 'u' },
  { id: 'e', hiragana: 'え', katakana: 'エ', romaji: 'e', type: 'vowel', row: 'vowel', column: 'e' },
  { id: 'o', hiragana: 'お', katakana: 'オ', romaji: 'o', type: 'vowel', row: 'vowel', column: 'o' },

  // K-row
  { id: 'ka', hiragana: 'か', katakana: 'カ', romaji: 'ka', type: 'consonant', row: 'k', column: 'a' },
  { id: 'ki', hiragana: 'き', katakana: 'キ', romaji: 'ki', type: 'consonant', row: 'k', column: 'i' },
  { id: 'ku', hiragana: 'く', katakana: 'ク', romaji: 'ku', type: 'consonant', row: 'k', column: 'u' },
  { id: 'ke', hiragana: 'け', katakana: 'ケ', romaji: 'ke', type: 'consonant', row: 'k', column: 'e' },
  { id: 'ko', hiragana: 'こ', katakana: 'コ', romaji: 'ko', type: 'consonant', row: 'k', column: 'o' },

  // G-row (dakuten)
  { id: 'ga', hiragana: 'が', katakana: 'ガ', romaji: 'ga', type: 'consonant', row: 'g', column: 'a' },
  { id: 'gi', hiragana: 'ぎ', katakana: 'ギ', romaji: 'gi', type: 'consonant', row: 'g', column: 'i' },
  { id: 'gu', hiragana: 'ぐ', katakana: 'グ', romaji: 'gu', type: 'consonant', row: 'g', column: 'u' },
  { id: 'ge', hiragana: 'げ', katakana: 'ゲ', romaji: 'ge', type: 'consonant', row: 'g', column: 'e' },
  { id: 'go', hiragana: 'ご', katakana: 'ゴ', romaji: 'go', type: 'consonant', row: 'g', column: 'o' },

  // S-row
  { id: 'sa', hiragana: 'さ', katakana: 'サ', romaji: 'sa', type: 'consonant', row: 's', column: 'a' },
  { id: 'shi', hiragana: 'し', katakana: 'シ', romaji: 'shi', type: 'consonant', row: 's', column: 'i', pronunciation: 'not si' },
  { id: 'su', hiragana: 'す', katakana: 'ス', romaji: 'su', type: 'consonant', row: 's', column: 'u' },
  { id: 'se', hiragana: 'せ', katakana: 'セ', romaji: 'se', type: 'consonant', row: 's', column: 'e' },
  { id: 'so', hiragana: 'そ', katakana: 'ソ', romaji: 'so', type: 'consonant', row: 's', column: 'o' },

  // Z-row (dakuten)
  { id: 'za', hiragana: 'ざ', katakana: 'ザ', romaji: 'za', type: 'consonant', row: 'z', column: 'a' },
  { id: 'ji', hiragana: 'じ', katakana: 'ジ', romaji: 'ji', type: 'consonant', row: 'z', column: 'i', pronunciation: 'not zi' },
  { id: 'zu', hiragana: 'ず', katakana: 'ズ', romaji: 'zu', type: 'consonant', row: 'z', column: 'u' },
  { id: 'ze', hiragana: 'ぜ', katakana: 'ゼ', romaji: 'ze', type: 'consonant', row: 'z', column: 'e' },
  { id: 'zo', hiragana: 'ぞ', katakana: 'ゾ', romaji: 'zo', type: 'consonant', row: 'z', column: 'o' },

  // T-row
  { id: 'ta', hiragana: 'た', katakana: 'タ', romaji: 'ta', type: 'consonant', row: 't', column: 'a' },
  { id: 'chi', hiragana: 'ち', katakana: 'チ', romaji: 'chi', type: 'consonant', row: 't', column: 'i', pronunciation: 'not ti' },
  { id: 'tsu', hiragana: 'つ', katakana: 'ツ', romaji: 'tsu', type: 'consonant', row: 't', column: 'u', pronunciation: 'not tu' },
  { id: 'te', hiragana: 'て', katakana: 'テ', romaji: 'te', type: 'consonant', row: 't', column: 'e' },
  { id: 'to', hiragana: 'と', katakana: 'ト', romaji: 'to', type: 'consonant', row: 't', column: 'o' },

  // D-row (dakuten)
  { id: 'da', hiragana: 'だ', katakana: 'ダ', romaji: 'da', type: 'consonant', row: 'd', column: 'a' },
  { id: 'ji2', hiragana: 'ぢ', katakana: 'ヂ', romaji: 'ji', type: 'consonant', row: 'd', column: 'i', pronunciation: 'rarely used' },
  { id: 'zu2', hiragana: 'づ', katakana: 'ヅ', romaji: 'zu', type: 'consonant', row: 'd', column: 'u', pronunciation: 'rarely used' },
  { id: 'de', hiragana: 'で', katakana: 'デ', romaji: 'de', type: 'consonant', row: 'd', column: 'e' },
  { id: 'do', hiragana: 'ど', katakana: 'ド', romaji: 'do', type: 'consonant', row: 'd', column: 'o' },

  // N-row
  { id: 'na', hiragana: 'な', katakana: 'ナ', romaji: 'na', type: 'consonant', row: 'n', column: 'a' },
  { id: 'ni', hiragana: 'に', katakana: 'ニ', romaji: 'ni', type: 'consonant', row: 'n', column: 'i' },
  { id: 'nu', hiragana: 'ぬ', katakana: 'ヌ', romaji: 'nu', type: 'consonant', row: 'n', column: 'u' },
  { id: 'ne', hiragana: 'ね', katakana: 'ネ', romaji: 'ne', type: 'consonant', row: 'n', column: 'e' },
  { id: 'no', hiragana: 'の', katakana: 'ノ', romaji: 'no', type: 'consonant', row: 'n', column: 'o' },

  // H-row
  { id: 'ha', hiragana: 'は', katakana: 'ハ', romaji: 'ha', type: 'consonant', row: 'h', column: 'a' },
  { id: 'hi', hiragana: 'ひ', katakana: 'ヒ', romaji: 'hi', type: 'consonant', row: 'h', column: 'i' },
  { id: 'fu', hiragana: 'ふ', katakana: 'フ', romaji: 'fu', type: 'consonant', row: 'h', column: 'u', pronunciation: 'not hu' },
  { id: 'he', hiragana: 'へ', katakana: 'ヘ', romaji: 'he', type: 'consonant', row: 'h', column: 'e' },
  { id: 'ho', hiragana: 'ほ', katakana: 'ホ', romaji: 'ho', type: 'consonant', row: 'h', column: 'o' },

  // B-row (dakuten)
  { id: 'ba', hiragana: 'ば', katakana: 'バ', romaji: 'ba', type: 'consonant', row: 'b', column: 'a' },
  { id: 'bi', hiragana: 'び', katakana: 'ビ', romaji: 'bi', type: 'consonant', row: 'b', column: 'i' },
  { id: 'bu', hiragana: 'ぶ', katakana: 'ブ', romaji: 'bu', type: 'consonant', row: 'b', column: 'u' },
  { id: 'be', hiragana: 'べ', katakana: 'ベ', romaji: 'be', type: 'consonant', row: 'b', column: 'e' },
  { id: 'bo', hiragana: 'ぼ', katakana: 'ボ', romaji: 'bo', type: 'consonant', row: 'b', column: 'o' },

  // P-row (handakuten)
  { id: 'pa', hiragana: 'ぱ', katakana: 'パ', romaji: 'pa', type: 'consonant', row: 'p', column: 'a' },
  { id: 'pi', hiragana: 'ぴ', katakana: 'ピ', romaji: 'pi', type: 'consonant', row: 'p', column: 'i' },
  { id: 'pu', hiragana: 'ぷ', katakana: 'プ', romaji: 'pu', type: 'consonant', row: 'p', column: 'u' },
  { id: 'pe', hiragana: 'ぺ', katakana: 'ペ', romaji: 'pe', type: 'consonant', row: 'p', column: 'e' },
  { id: 'po', hiragana: 'ぽ', katakana: 'ポ', romaji: 'po', type: 'consonant', row: 'p', column: 'o' },

  // M-row
  { id: 'ma', hiragana: 'ま', katakana: 'マ', romaji: 'ma', type: 'consonant', row: 'm', column: 'a' },
  { id: 'mi', hiragana: 'み', katakana: 'ミ', romaji: 'mi', type: 'consonant', row: 'm', column: 'i' },
  { id: 'mu', hiragana: 'む', katakana: 'ム', romaji: 'mu', type: 'consonant', row: 'm', column: 'u' },
  { id: 'me', hiragana: 'め', katakana: 'メ', romaji: 'me', type: 'consonant', row: 'm', column: 'e' },
  { id: 'mo', hiragana: 'も', katakana: 'モ', romaji: 'mo', type: 'consonant', row: 'm', column: 'o' },

  // Y-row
  { id: 'ya', hiragana: 'や', katakana: 'ヤ', romaji: 'ya', type: 'consonant', row: 'y', column: 'a' },
  { id: 'yu', hiragana: 'ゆ', katakana: 'ユ', romaji: 'yu', type: 'consonant', row: 'y', column: 'u' },
  { id: 'yo', hiragana: 'よ', katakana: 'ヨ', romaji: 'yo', type: 'consonant', row: 'y', column: 'o' },

  // R-row
  { id: 'ra', hiragana: 'ら', katakana: 'ラ', romaji: 'ra', type: 'consonant', row: 'r', column: 'a' },
  { id: 'ri', hiragana: 'り', katakana: 'リ', romaji: 'ri', type: 'consonant', row: 'r', column: 'i' },
  { id: 'ru', hiragana: 'る', katakana: 'ル', romaji: 'ru', type: 'consonant', row: 'r', column: 'u' },
  { id: 're', hiragana: 'れ', katakana: 'レ', romaji: 're', type: 'consonant', row: 'r', column: 'e' },
  { id: 'ro', hiragana: 'ろ', katakana: 'ロ', romaji: 'ro', type: 'consonant', row: 'r', column: 'o' },

  // W-row
  { id: 'wa', hiragana: 'わ', katakana: 'ワ', romaji: 'wa', type: 'consonant', row: 'w', column: 'a' },
  { id: 'wi', hiragana: 'ゐ', katakana: 'ヰ', romaji: 'wi', type: 'consonant', row: 'w', column: 'i', pronunciation: 'archaic' },
  { id: 'we', hiragana: 'ゑ', katakana: 'ヱ', romaji: 'we', type: 'consonant', row: 'w', column: 'e', pronunciation: 'archaic' },
  { id: 'wo', hiragana: 'を', katakana: 'ヲ', romaji: 'wo', type: 'consonant', row: 'w', column: 'o', pronunciation: 'particle only' },

  // N
  { id: 'n', hiragana: 'ん', katakana: 'ン', romaji: 'n', type: 'consonant', row: 'special', column: 'n' },

  // Digraphs (combinations with small ya, yu, yo)
  { id: 'kya', hiragana: 'きゃ', katakana: 'キャ', romaji: 'kya', type: 'digraph', row: 'ky', column: 'a' },
  { id: 'kyu', hiragana: 'きゅ', katakana: 'キュ', romaji: 'kyu', type: 'digraph', row: 'ky', column: 'u' },
  { id: 'kyo', hiragana: 'きょ', katakana: 'キョ', romaji: 'kyo', type: 'digraph', row: 'ky', column: 'o' },
  
  { id: 'gya', hiragana: 'ぎゃ', katakana: 'ギャ', romaji: 'gya', type: 'digraph', row: 'gy', column: 'a' },
  { id: 'gyu', hiragana: 'ぎゅ', katakana: 'ギュ', romaji: 'gyu', type: 'digraph', row: 'gy', column: 'u' },
  { id: 'gyo', hiragana: 'ぎょ', katakana: 'ギョ', romaji: 'gyo', type: 'digraph', row: 'gy', column: 'o' },
  
  { id: 'sha', hiragana: 'しゃ', katakana: 'シャ', romaji: 'sha', type: 'digraph', row: 'sh', column: 'a' },
  { id: 'shu', hiragana: 'しゅ', katakana: 'シュ', romaji: 'shu', type: 'digraph', row: 'sh', column: 'u' },
  { id: 'sho', hiragana: 'しょ', katakana: 'ショ', romaji: 'sho', type: 'digraph', row: 'sh', column: 'o' },
  
  { id: 'ja', hiragana: 'じゃ', katakana: 'ジャ', romaji: 'ja', type: 'digraph', row: 'j', column: 'a' },
  { id: 'ju', hiragana: 'じゅ', katakana: 'ジュ', romaji: 'ju', type: 'digraph', row: 'j', column: 'u' },
  { id: 'jo', hiragana: 'じょ', katakana: 'ジョ', romaji: 'jo', type: 'digraph', row: 'j', column: 'o' },
  
  { id: 'cha', hiragana: 'ちゃ', katakana: 'チャ', romaji: 'cha', type: 'digraph', row: 'ch', column: 'a' },
  { id: 'chu', hiragana: 'ちゅ', katakana: 'チュ', romaji: 'chu', type: 'digraph', row: 'ch', column: 'u' },
  { id: 'cho', hiragana: 'ちょ', katakana: 'チョ', romaji: 'cho', type: 'digraph', row: 'ch', column: 'o' },
  
  { id: 'nya', hiragana: 'にゃ', katakana: 'ニャ', romaji: 'nya', type: 'digraph', row: 'ny', column: 'a' },
  { id: 'nyu', hiragana: 'にゅ', katakana: 'ニュ', romaji: 'nyu', type: 'digraph', row: 'ny', column: 'u' },
  { id: 'nyo', hiragana: 'にょ', katakana: 'ニョ', romaji: 'nyo', type: 'digraph', row: 'ny', column: 'o' },
  
  { id: 'hya', hiragana: 'ひゃ', katakana: 'ヒャ', romaji: 'hya', type: 'digraph', row: 'hy', column: 'a' },
  { id: 'hyu', hiragana: 'ひゅ', katakana: 'ヒュ', romaji: 'hyu', type: 'digraph', row: 'hy', column: 'u' },
  { id: 'hyo', hiragana: 'ひょ', katakana: 'ヒョ', romaji: 'hyo', type: 'digraph', row: 'hy', column: 'o' },
  
  { id: 'bya', hiragana: 'びゃ', katakana: 'ビャ', romaji: 'bya', type: 'digraph', row: 'by', column: 'a' },
  { id: 'byu', hiragana: 'びゅ', katakana: 'ビュ', romaji: 'byu', type: 'digraph', row: 'by', column: 'u' },
  { id: 'byo', hiragana: 'びょ', katakana: 'ビョ', romaji: 'byo', type: 'digraph', row: 'by', column: 'o' },
  
  { id: 'pya', hiragana: 'ぴゃ', katakana: 'ピャ', romaji: 'pya', type: 'digraph', row: 'py', column: 'a' },
  { id: 'pyu', hiragana: 'ぴゅ', katakana: 'ピュ', romaji: 'pyu', type: 'digraph', row: 'py', column: 'u' },
  { id: 'pyo', hiragana: 'ぴょ', katakana: 'ピョ', romaji: 'pyo', type: 'digraph', row: 'py', column: 'o' },
  
  { id: 'mya', hiragana: 'みゃ', katakana: 'ミャ', romaji: 'mya', type: 'digraph', row: 'my', column: 'a' },
  { id: 'myu', hiragana: 'みゅ', katakana: 'ミュ', romaji: 'myu', type: 'digraph', row: 'my', column: 'u' },
  { id: 'myo', hiragana: 'みょ', katakana: 'ミョ', romaji: 'myo', type: 'digraph', row: 'my', column: 'o' },
  
  { id: 'rya', hiragana: 'りゃ', katakana: 'リャ', romaji: 'rya', type: 'digraph', row: 'ry', column: 'a' },
  { id: 'ryu', hiragana: 'りゅ', katakana: 'リュ', romaji: 'ryu', type: 'digraph', row: 'ry', column: 'u' },
  { id: 'ryo', hiragana: 'りょ', katakana: 'リョ', romaji: 'ryo', type: 'digraph', row: 'ry', column: 'o' },
];

// Helper function to get basic kana (excluding digraphs and special characters)
export function getBasicKana(): KanaCharacter[] {
  return kanaData.filter(k => 
    k.type !== 'digraph' && 
    !['wi', 'we', 'wo', 'ji2', 'zu2'].includes(k.id)
  );
}

// Helper function to get kana by type
export function getKanaByType(type: 'hiragana' | 'katakana', includeDigraphs = true): KanaCharacter[] {
  const filtered = includeDigraphs ? kanaData : getBasicKana();
  return filtered;
}

// Helper function to get kana by row
export function getKanaByRow(row: string): KanaCharacter[] {
  return kanaData.filter(k => k.row === row);
}

// Helper function to play kana audio
// Create a single audio element that we'll reuse
let audioElement: HTMLAudioElement | null = null;

export async function playKanaAudio(kanaId: string, type: 'hiragana' | 'katakana' = 'hiragana'): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create audio element only once
      if (!audioElement) {
        console.log('Creating audio element');
        audioElement = new Audio();
      }
      
      const audioPath = `/audio/kana/${type}/${kanaId}.mp3`;
      console.log('Loading audio for:', kanaId, 'path:', audioPath);
      
      // Stop any currently playing audio
      audioElement.pause();
      audioElement.currentTime = 0;
      
      // Remove old event listeners
      audioElement.onloadeddata = null;
      audioElement.onerror = null;
      audioElement.onended = null;
      
      // Set new source
      audioElement.src = audioPath;
      
      // Set up new event listeners
      audioElement.onloadeddata = () => {
        console.log('Audio loaded for:', kanaId);
        // Add a tiny delay to ensure audio context is ready
        setTimeout(() => {
          audioElement!.play()
            .then(() => {
              console.log('✓ Audio SHOULD BE PLAYING NOW for:', kanaId);
              resolve();
            })
            .catch((err) => {
              console.error('✗ Play() failed for', kanaId, ':', err);
              reject(err);
            });
        }, 100);
      };
      
      audioElement.onerror = (e) => {
        console.error('✗ Audio error for', kanaId, ':', e);
        reject(new Error(`Failed to load audio for ${kanaId}`));
      };
      
      // Load the new audio
      audioElement.load();
      
    } catch (error) {
      console.error('✗ Audio setup error for', kanaId, ':', error);
      reject(error);
    }
  });
}