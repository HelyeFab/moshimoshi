#!/usr/bin/env node
import { ExtendedConjugationEngine } from '../src/lib/conjugation/engine'
import { enhanceWordWithType } from '../src/utils/enhancedWordTypeDetection'
import { JapaneseWord } from '../src/types/vocabulary'

// Test words covering all verb types and adjectives
const testWords: JapaneseWord[] = [
  // Godan verbs
  { id: '1', kana: 'かう', kanji: '買う', meaning: 'to buy', type: 'verb', partsOfSpeech: ['v5u'] },
  { id: '2', kana: 'かく', kanji: '書く', meaning: 'to write', type: 'verb', partsOfSpeech: ['v5k'] },
  { id: '3', kana: 'およぐ', kanji: '泳ぐ', meaning: 'to swim', type: 'verb', partsOfSpeech: ['v5g'] },
  { id: '4', kana: 'はなす', kanji: '話す', meaning: 'to speak', type: 'verb', partsOfSpeech: ['v5s'] },
  { id: '5', kana: 'もつ', kanji: '持つ', meaning: 'to hold', type: 'verb', partsOfSpeech: ['v5t'] },
  { id: '6', kana: 'しぬ', kanji: '死ぬ', meaning: 'to die', type: 'verb', partsOfSpeech: ['v5n'] },
  { id: '7', kana: 'よぶ', kanji: '呼ぶ', meaning: 'to call', type: 'verb', partsOfSpeech: ['v5b'] },
  { id: '8', kana: 'よむ', kanji: '読む', meaning: 'to read', type: 'verb', partsOfSpeech: ['v5m'] },
  { id: '9', kana: 'かえる', kanji: '帰る', meaning: 'to return', type: 'verb', partsOfSpeech: ['v5r'] },

  // Ichidan verbs
  { id: '10', kana: 'たべる', kanji: '食べる', meaning: 'to eat', type: 'verb', partsOfSpeech: ['v1'] },
  { id: '11', kana: 'みる', kanji: '見る', meaning: 'to see', type: 'verb', partsOfSpeech: ['v1'] },

  // Irregular verbs
  { id: '12', kana: 'する', kanji: null, meaning: 'to do', type: 'verb', partsOfSpeech: ['vs-i'] },
  { id: '13', kana: 'くる', kanji: '来る', meaning: 'to come', type: 'verb', partsOfSpeech: ['vk'] },

  // Special する verbs
  { id: '14', kana: 'べんきょうする', kanji: '勉強する', meaning: 'to study', type: 'verb', partsOfSpeech: ['vs'] },

  // i-adjectives
  { id: '15', kana: 'たかい', kanji: '高い', meaning: 'expensive', type: 'adjective', partsOfSpeech: ['adj-i'] },
  { id: '16', kana: 'いい', kanji: null, meaning: 'good', type: 'adjective', partsOfSpeech: ['adj-ix'] },

  // na-adjectives
  { id: '17', kana: 'きれい', kanji: '綺麗', meaning: 'beautiful', type: 'adjective', partsOfSpeech: ['adj-na'] },
  { id: '18', kana: 'しずか', kanji: '静か', meaning: 'quiet', type: 'adjective', partsOfSpeech: ['adj-na'] },
]

console.log('🧪 Testing Conjugation Engine\n')
console.log('=' .repeat(60))

let passCount = 0
let failCount = 0

for (const word of testWords) {
  console.log(`\n📝 Testing: ${word.kanji || word.kana} (${word.meaning})`)
  console.log(`   Type: ${word.partsOfSpeech?.join(', ')}`)

  try {
    // Enhance word with type detection
    const enhanced = enhanceWordWithType(word)

    if (!enhanced.isConjugatable) {
      console.log('   ❌ Not detected as conjugatable')
      failCount++
      continue
    }

    console.log(`   ✅ Detected as: ${enhanced.conjugationType} (confidence: ${enhanced.typeConfidence})`)

    // Test conjugation
    const conjugations = ExtendedConjugationEngine.conjugate(enhanced)

    // Check key conjugations
    const keyForms = ['present', 'past', 'negative', 'teForm', 'polite']
    const results: string[] = []

    for (const form of keyForms) {
      if (conjugations[form as keyof typeof conjugations]) {
        results.push(`${form}: ${conjugations[form as keyof typeof conjugations]}`)
      }
    }

    if (results.length > 0) {
      console.log(`   ✅ Sample conjugations:`)
      results.forEach(r => console.log(`      - ${r}`))
      passCount++
    } else {
      console.log('   ❌ No conjugations generated')
      failCount++
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error}`)
    failCount++
  }
}

console.log('\n' + '=' .repeat(60))
console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed`)
console.log(`   Success rate: ${Math.round((passCount / testWords.length) * 100)}%`)

if (failCount === 0) {
  console.log('\n🎉 All tests passed!')
} else {
  console.log('\n⚠️  Some tests failed. Please review the output above.')
}