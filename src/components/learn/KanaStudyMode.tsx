'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KanaCharacter, playKanaAudio } from '@/data/kanaData'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import AudioButton from '@/components/ui/AudioButton'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { kanaProgressManagerV2 } from '@/utils/kanaProgressManagerV2'
import StrokeOrderModal from '@/components/kanji/StrokeOrderModal'
import DrawingPracticeModal from '@/components/drawing-practice/DrawingPracticeModal'

interface KanaStudyModeProps {
  character: KanaCharacter
  progress: any
  onNext: () => void
  onPrevious: () => void
  onBack: () => void
  onUpdateProgress: (characterId: string, updates: any) => void
  onTogglePin: () => void
  showBothKana: boolean
  currentIndex: number
  totalCharacters: number
  displayScript?: 'hiragana' | 'katakana'
}

export default function KanaStudyMode({
  character,
  progress,
  onNext,
  onPrevious,
  onBack,
  onUpdateProgress,
  onTogglePin,
  showBothKana,
  currentIndex,
  totalCharacters,
  displayScript = 'hiragana'
}: KanaStudyModeProps) {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [showRomaji, setShowRomaji] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [hasRecordedActivity, setHasRecordedActivity] = useState(false)
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const [viewStartTime, setViewStartTime] = useState<number>(Date.now())
  const [showStrokeOrder, setShowStrokeOrder] = useState(false)
  const [showDrawingPractice, setShowDrawingPractice] = useState(false)

  // Track character view when component mounts or character changes
  useEffect(() => {
    const trackView = async () => {
      // Only track if user has a valid uid (Firebase is synced)
      if (character && user && user.uid && !hasTrackedView) {
        const script = displayScript as 'hiragana' | 'katakana'
        await kanaProgressManagerV2.trackCharacterView(
          script,
          character.id,
          user,
          isPremium
        )
        setHasTrackedView(true)
      }
    }
    trackView()
  }, [character.id, user, isPremium, displayScript, hasTrackedView])

  // Reset state when character changes
  useEffect(() => {
    // Track skip if user spent less than 2 seconds on previous character
    const timeSpent = Date.now() - viewStartTime
    if (timeSpent < 2000 && hasTrackedView && user && user.uid) {
      const script = displayScript as 'hiragana' | 'katakana'
      kanaProgressManagerV2.trackCharacterSkipped?.(script, character.id, user, isPremium)
    }

    setShowRomaji(false)
    setShowExamples(false)
    setIsFlipped(false)
    setHasTrackedView(false) // Reset view tracking for new character
    setViewStartTime(Date.now()) // Reset timer for new character
  }, [character.id])

  // Record daily activity when reaching the last character
  useEffect(() => {
    if (currentIndex === totalCharacters && !hasRecordedActivity && user?.uid) {
      try {
        const today = new Date().toISOString().split('T')[0]
        const activities = JSON.parse(
          localStorage.getItem(`activities_${user.uid}`) || '{}'
        )
        activities[today] = true
        localStorage.setItem(`activities_${user.uid}`, JSON.stringify(activities))
        setHasRecordedActivity(true)
      } catch (error) {
        console.error('[KanaStudyMode] Failed to record daily activity:', error)
      }
    }
  }, [currentIndex, totalCharacters, hasRecordedActivity, user?.uid])
  
  const handlePlayAudio = async () => {
    try {
      await playKanaAudio(character.id, displayScript)

      // Track audio interaction
      if (user) {
        const script = displayScript as 'hiragana' | 'katakana'
        await kanaProgressManagerV2.trackCharacterInteraction(
          script,
          character.id,
          'audio',
          user,
          isPremium
        )
      }
    } catch (error) {
      showToast(t('kana.messages.audioNotAvailable'), 'warning')
      throw error // Re-throw to let AudioButton handle the state
    }
  }

  const handleSkip = async () => {
    // Track skip event - only if user has valid uid
    if (user && user.uid) {
      const script = displayScript as 'hiragana' | 'katakana'
      await kanaProgressManagerV2.trackCharacterSkipped?.(script, character.id, user, isPremium)
    }

    // Animate and move to next
    onNext()
  }
  
  const handleMarkAsLearned = async () => {
    onUpdateProgress(character.id, {
      status: 'learned',
      reviewCount: (progress?.reviewCount || 0) + 1,
      correctCount: (progress?.correctCount || 0) + 1,
      pinned: false
    })

    // Track as learned/completed
    if (user) {
      const script = displayScript as 'hiragana' | 'katakana'
      await kanaProgressManagerV2.trackCharacterLearned(
        script,
        character.id,
        user,
        isPremium
      )
    }

    // Record daily activity when user marks something as learned
    if (user?.uid && !hasRecordedActivity) {
      try {
        const today = new Date().toISOString().split('T')[0]
        const activities = JSON.parse(
          localStorage.getItem(`activities_${user.uid}`) || '{}'
        )
        activities[today] = true
        localStorage.setItem(`activities_${user.uid}`, JSON.stringify(activities))
        setHasRecordedActivity(true)
      } catch (error) {
        console.error('[KanaStudyMode] Failed to record daily activity:', error)
      }
    }

    showToast(t('kana.messages.markedAsLearned'), 'success')
    setTimeout(onNext, 500)
  }
  
  // Example words for each character (simplified for demo)
  const getExampleWords = () => {
    // Different examples based on script type
    const hiraganaExamples: Record<string, Array<{ word: string; reading: string; meaning: string }>> = {
      'a': [
        { word: 'あさ', reading: 'asa', meaning: 'morning' },
        { word: 'あめ', reading: 'ame', meaning: 'rain' },
        { word: 'あき', reading: 'aki', meaning: 'autumn' }
      ],
      'i': [
        { word: 'いぬ', reading: 'inu', meaning: 'dog' },
        { word: 'いえ', reading: 'ie', meaning: 'house' },
        { word: 'いま', reading: 'ima', meaning: 'now' }
      ],
      'u': [
        { word: 'うみ', reading: 'umi', meaning: 'sea' },
        { word: 'うた', reading: 'uta', meaning: 'song' },
        { word: 'うえ', reading: 'ue', meaning: 'above' }
      ],
      'e': [
        { word: 'えき', reading: 'eki', meaning: 'station' },
        { word: 'えんぴつ', reading: 'enpitsu', meaning: 'pencil' },
        { word: 'えいご', reading: 'eigo', meaning: 'English' }
      ],
      'o': [
        { word: 'おかね', reading: 'okane', meaning: 'money' },
        { word: 'おちゃ', reading: 'ocha', meaning: 'tea' },
        { word: 'おんな', reading: 'onna', meaning: 'woman' }
      ],
      'ka': [
        { word: 'かさ', reading: 'kasa', meaning: 'umbrella' },
        { word: 'かわ', reading: 'kawa', meaning: 'river' },
        { word: 'かみ', reading: 'kami', meaning: 'paper' }
      ],
      'ki': [
        { word: 'きって', reading: 'kitte', meaning: 'stamp' },
        { word: 'きのう', reading: 'kinou', meaning: 'yesterday' },
        { word: 'きた', reading: 'kita', meaning: 'north' }
      ],
      'ku': [
        { word: 'くつ', reading: 'kutsu', meaning: 'shoes' },
        { word: 'くち', reading: 'kuchi', meaning: 'mouth' },
        { word: 'くも', reading: 'kumo', meaning: 'cloud' }
      ],
      'ke': [
        { word: 'けさ', reading: 'kesa', meaning: 'this morning' },
        { word: 'けん', reading: 'ken', meaning: 'ticket' },
        { word: 'けしゴム', reading: 'keshigomu', meaning: 'eraser' }
      ],
      'ko': [
        { word: 'ここ', reading: 'koko', meaning: 'here' },
        { word: 'こども', reading: 'kodomo', meaning: 'child' },
        { word: 'ことば', reading: 'kotoba', meaning: 'word' }
      ],
      'sa': [
        { word: 'さかな', reading: 'sakana', meaning: 'fish' },
        { word: 'さくら', reading: 'sakura', meaning: 'cherry blossom' },
        { word: 'さむい', reading: 'samui', meaning: 'cold' }
      ],
      'shi': [
        { word: 'しろ', reading: 'shiro', meaning: 'white' },
        { word: 'した', reading: 'shita', meaning: 'below' },
        { word: 'しごと', reading: 'shigoto', meaning: 'work' }
      ],
      'su': [
        { word: 'すし', reading: 'sushi', meaning: 'sushi' },
        { word: 'すき', reading: 'suki', meaning: 'like' },
        { word: 'すこし', reading: 'sukoshi', meaning: 'a little' }
      ],
      'se': [
        { word: 'せんせい', reading: 'sensei', meaning: 'teacher' },
        { word: 'せかい', reading: 'sekai', meaning: 'world' },
        { word: 'せなか', reading: 'senaka', meaning: 'back' }
      ],
      'so': [
        { word: 'そら', reading: 'sora', meaning: 'sky' },
        { word: 'そと', reading: 'soto', meaning: 'outside' },
        { word: 'そば', reading: 'soba', meaning: 'near' }
      ],
      'ta': [
        { word: 'たべる', reading: 'taberu', meaning: 'to eat' },
        { word: 'たかい', reading: 'takai', meaning: 'tall/expensive' },
        { word: 'たまご', reading: 'tamago', meaning: 'egg' }
      ],
      'chi': [
        { word: 'ちち', reading: 'chichi', meaning: 'father' },
        { word: 'ちいさい', reading: 'chiisai', meaning: 'small' },
        { word: 'ちかく', reading: 'chikaku', meaning: 'nearby' }
      ],
      'tsu': [
        { word: 'つき', reading: 'tsuki', meaning: 'moon' },
        { word: 'つくえ', reading: 'tsukue', meaning: 'desk' },
        { word: 'つよい', reading: 'tsuyoi', meaning: 'strong' }
      ],
      'te': [
        { word: 'て', reading: 'te', meaning: 'hand' },
        { word: 'てんき', reading: 'tenki', meaning: 'weather' },
        { word: 'てがみ', reading: 'tegami', meaning: 'letter' }
      ],
      'to': [
        { word: 'とり', reading: 'tori', meaning: 'bird' },
        { word: 'ともだち', reading: 'tomodachi', meaning: 'friend' },
        { word: 'とけい', reading: 'tokei', meaning: 'clock' }
      ],
      'na': [
        { word: 'なつ', reading: 'natsu', meaning: 'summer' },
        { word: 'なまえ', reading: 'namae', meaning: 'name' },
        { word: 'ながい', reading: 'nagai', meaning: 'long' }
      ],
      'ni': [
        { word: 'にく', reading: 'niku', meaning: 'meat' },
        { word: 'にし', reading: 'nishi', meaning: 'west' },
        { word: 'にほん', reading: 'nihon', meaning: 'Japan' }
      ],
      'nu': [
        { word: 'ぬる', reading: 'nuru', meaning: 'to paint' },
        { word: 'ぬま', reading: 'numa', meaning: 'swamp' },
        { word: 'ぬの', reading: 'nuno', meaning: 'cloth' }
      ],
      'ne': [
        { word: 'ねこ', reading: 'neko', meaning: 'cat' },
        { word: 'ねる', reading: 'neru', meaning: 'to sleep' },
        { word: 'ねだん', reading: 'nedan', meaning: 'price' }
      ],
      'no': [
        { word: 'のむ', reading: 'nomu', meaning: 'to drink' },
        { word: 'のる', reading: 'noru', meaning: 'to ride' },
        { word: 'のこる', reading: 'nokoru', meaning: 'to remain' }
      ],
      'ha': [
        { word: 'はな', reading: 'hana', meaning: 'flower' },
        { word: 'はる', reading: 'haru', meaning: 'spring' },
        { word: 'はし', reading: 'hashi', meaning: 'chopsticks' }
      ],
      'hi': [
        { word: 'ひと', reading: 'hito', meaning: 'person' },
        { word: 'ひる', reading: 'hiru', meaning: 'noon' },
        { word: 'ひだり', reading: 'hidari', meaning: 'left' }
      ],
      'fu': [
        { word: 'ふゆ', reading: 'fuyu', meaning: 'winter' },
        { word: 'ふく', reading: 'fuku', meaning: 'clothes' },
        { word: 'ふたつ', reading: 'futatsu', meaning: 'two things' }
      ],
      'he': [
        { word: 'へや', reading: 'heya', meaning: 'room' },
        { word: 'へた', reading: 'heta', meaning: 'unskillful' },
        { word: 'へん', reading: 'hen', meaning: 'strange' }
      ],
      'ho': [
        { word: 'ほん', reading: 'hon', meaning: 'book' },
        { word: 'ほし', reading: 'hoshi', meaning: 'star' },
        { word: 'ほか', reading: 'hoka', meaning: 'other' }
      ],
      'ma': [
        { word: 'まち', reading: 'machi', meaning: 'town' },
        { word: 'まど', reading: 'mado', meaning: 'window' },
        { word: 'まえ', reading: 'mae', meaning: 'in front' }
      ],
      'mi': [
        { word: 'みず', reading: 'mizu', meaning: 'water' },
        { word: 'みち', reading: 'michi', meaning: 'road' },
        { word: 'みぎ', reading: 'migi', meaning: 'right' }
      ],
      'mu': [
        { word: 'むら', reading: 'mura', meaning: 'village' },
        { word: 'むし', reading: 'mushi', meaning: 'insect' },
        { word: 'むかし', reading: 'mukashi', meaning: 'long ago' }
      ],
      'me': [
        { word: 'め', reading: 'me', meaning: 'eye' },
        { word: 'めがね', reading: 'megane', meaning: 'glasses' },
        { word: 'めだつ', reading: 'medatsu', meaning: 'to stand out' }
      ],
      'mo': [
        { word: 'もの', reading: 'mono', meaning: 'thing' },
        { word: 'もり', reading: 'mori', meaning: 'forest' },
        { word: 'もつ', reading: 'motsu', meaning: 'to hold' }
      ],
      'ya': [
        { word: 'やま', reading: 'yama', meaning: 'mountain' },
        { word: 'やさい', reading: 'yasai', meaning: 'vegetable' },
        { word: 'やすい', reading: 'yasui', meaning: 'cheap' }
      ],
      'yu': [
        { word: 'ゆき', reading: 'yuki', meaning: 'snow' },
        { word: 'ゆめ', reading: 'yume', meaning: 'dream' },
        { word: 'ゆうべ', reading: 'yuube', meaning: 'last night' }
      ],
      'yo': [
        { word: 'よる', reading: 'yoru', meaning: 'night' },
        { word: 'よむ', reading: 'yomu', meaning: 'to read' },
        { word: 'よこ', reading: 'yoko', meaning: 'side' }
      ],
      'ra': [
        { word: 'らいねん', reading: 'rainen', meaning: 'next year' },
        { word: 'らく', reading: 'raku', meaning: 'easy' },
        { word: 'らんち', reading: 'ranchi', meaning: 'lunch' }
      ],
      'ri': [
        { word: 'りんご', reading: 'ringo', meaning: 'apple' },
        { word: 'りゆう', reading: 'riyuu', meaning: 'reason' },
        { word: 'りょうり', reading: 'ryouri', meaning: 'cooking' }
      ],
      'ru': [
        { word: 'るす', reading: 'rusu', meaning: 'absence' },
        { word: 'るい', reading: 'rui', meaning: 'kind/type' },
        { word: 'るーる', reading: 'ruuru', meaning: 'rule' }
      ],
      're': [
        { word: 'れい', reading: 'rei', meaning: 'example' },
        { word: 'れんしゅう', reading: 'renshuu', meaning: 'practice' },
        { word: 'れきし', reading: 'rekishi', meaning: 'history' }
      ],
      'ro': [
        { word: 'ろく', reading: 'roku', meaning: 'six' },
        { word: 'ろうか', reading: 'rouka', meaning: 'corridor' },
        { word: 'ろうじん', reading: 'roujin', meaning: 'elderly person' }
      ],
      'wa': [
        { word: 'わたし', reading: 'watashi', meaning: 'I/me' },
        { word: 'わかる', reading: 'wakaru', meaning: 'to understand' },
        { word: 'わるい', reading: 'warui', meaning: 'bad' }
      ],
      'wo': [
        { word: 'を', reading: 'wo', meaning: 'object marker' },
        { word: 'をとこ', reading: 'otoko', meaning: 'man' },
        { word: 'をんな', reading: 'onna', meaning: 'woman' }
      ],
      'n': [
        { word: 'ん', reading: 'n', meaning: 'syllabic n' },
        { word: 'みかん', reading: 'mikan', meaning: 'orange' },
        { word: 'ほん', reading: 'hon', meaning: 'book' }
      ],
      'ga': [
        { word: 'がっこう', reading: 'gakkou', meaning: 'school' },
        { word: 'がくせい', reading: 'gakusei', meaning: 'student' },
        { word: 'がんばる', reading: 'ganbaru', meaning: 'to persevere' }
      ],
      'gi': [
        { word: 'ぎんこう', reading: 'ginkou', meaning: 'bank' },
        { word: 'ぎゅうにゅう', reading: 'gyuunyuu', meaning: 'milk' },
        { word: 'ぎもん', reading: 'gimon', meaning: 'question' }
      ],
      'gu': [
        { word: 'ぐあい', reading: 'guai', meaning: 'condition' },
        { word: 'ぐうぜん', reading: 'guuzen', meaning: 'coincidence' },
        { word: 'ぐらい', reading: 'gurai', meaning: 'about' }
      ],
      'ge': [
        { word: 'げんき', reading: 'genki', meaning: 'healthy' },
        { word: 'げつようび', reading: 'getsuyoubi', meaning: 'Monday' },
        { word: 'げーむ', reading: 'geemu', meaning: 'game' }
      ],
      'go': [
        { word: 'ごはん', reading: 'gohan', meaning: 'rice/meal' },
        { word: 'ごご', reading: 'gogo', meaning: 'afternoon' },
        { word: 'ごぜん', reading: 'gozen', meaning: 'morning' }
      ],
      'za': [
        { word: 'ざっし', reading: 'zasshi', meaning: 'magazine' },
        { word: 'ざんねん', reading: 'zannen', meaning: 'regrettable' },
        { word: 'ざいりょう', reading: 'zairyou', meaning: 'ingredients' }
      ],
      'ji': [
        { word: 'じかん', reading: 'jikan', meaning: 'time' },
        { word: 'じしょ', reading: 'jisho', meaning: 'dictionary' },
        { word: 'じぶん', reading: 'jibun', meaning: 'myself' }
      ],
      'zu': [
        { word: 'ずつう', reading: 'zutsuu', meaning: 'headache' },
        { word: 'ずぼん', reading: 'zubon', meaning: 'pants' },
        { word: 'ずっと', reading: 'zutto', meaning: 'continuously' }
      ],
      'ze': [
        { word: 'ぜんぶ', reading: 'zenbu', meaning: 'all' },
        { word: 'ぜったい', reading: 'zettai', meaning: 'absolutely' },
        { word: 'ぜんぜん', reading: 'zenzen', meaning: 'not at all' }
      ],
      'zo': [
        { word: 'ぞう', reading: 'zou', meaning: 'elephant' },
        { word: 'ぞうき', reading: 'zouki', meaning: 'rag' },
        { word: 'ぞくぞく', reading: 'zokuzoku', meaning: 'one after another' }
      ],
      'da': [
        { word: 'だれ', reading: 'dare', meaning: 'who' },
        { word: 'だいがく', reading: 'daigaku', meaning: 'university' },
        { word: 'だいじょうぶ', reading: 'daijoubu', meaning: 'alright' }
      ],
      'de': [
        { word: 'でんき', reading: 'denki', meaning: 'electricity' },
        { word: 'でんわ', reading: 'denwa', meaning: 'telephone' },
        { word: 'でんしゃ', reading: 'densha', meaning: 'train' }
      ],
      'do': [
        { word: 'どこ', reading: 'doko', meaning: 'where' },
        { word: 'どうぶつ', reading: 'doubutsu', meaning: 'animal' },
        { word: 'どようび', reading: 'doyoubi', meaning: 'Saturday' }
      ],
      'ba': [
        { word: 'ばんごはん', reading: 'bangohan', meaning: 'dinner' },
        { word: 'ばしょ', reading: 'basho', meaning: 'place' },
        { word: 'ばん', reading: 'ban', meaning: 'evening' }
      ],
      'bi': [
        { word: 'びょういん', reading: 'byouin', meaning: 'hospital' },
        { word: 'びょうき', reading: 'byouki', meaning: 'illness' },
        { word: 'びっくり', reading: 'bikkuri', meaning: 'surprise' }
      ],
      'bu': [
        { word: 'ぶた', reading: 'buta', meaning: 'pig' },
        { word: 'ぶんか', reading: 'bunka', meaning: 'culture' },
        { word: 'ぶどう', reading: 'budou', meaning: 'grape' }
      ],
      'be': [
        { word: 'べんきょう', reading: 'benkyou', meaning: 'study' },
        { word: 'べんり', reading: 'benri', meaning: 'convenient' },
        { word: 'べつ', reading: 'betsu', meaning: 'different' }
      ],
      'bo': [
        { word: 'ぼうし', reading: 'boushi', meaning: 'hat' },
        { word: 'ぼく', reading: 'boku', meaning: 'I (male)' },
        { word: 'ぼーる', reading: 'booru', meaning: 'ball' }
      ],
      'pa': [
        { word: 'ぱん', reading: 'pan', meaning: 'bread' },
        { word: 'ぱーてぃー', reading: 'paatii', meaning: 'party' },
        { word: 'ぱそこん', reading: 'pasokon', meaning: 'computer' }
      ],
      'pi': [
        { word: 'ぴんく', reading: 'pinku', meaning: 'pink' },
        { word: 'ぴあの', reading: 'piano', meaning: 'piano' },
        { word: 'ぴかぴか', reading: 'pikapika', meaning: 'sparkling' }
      ],
      'pu': [
        { word: 'ぷーる', reading: 'puuru', meaning: 'pool' },
        { word: 'ぷれぜんと', reading: 'purezento', meaning: 'present' },
        { word: 'ぷりん', reading: 'purin', meaning: 'pudding' }
      ],
      'pe': [
        { word: 'ぺん', reading: 'pen', meaning: 'pen' },
        { word: 'ぺーじ', reading: 'peeji', meaning: 'page' },
        { word: 'ぺっと', reading: 'petto', meaning: 'pet' }
      ],
      'po': [
        { word: 'ぽけっと', reading: 'poketto', meaning: 'pocket' },
        { word: 'ぽすと', reading: 'posuto', meaning: 'post' },
        { word: 'ぽかぽか', reading: 'pokapoka', meaning: 'warm' }
      ],
      'kya': [
        { word: 'きゃく', reading: 'kyaku', meaning: 'guest' },
        { word: 'きゃべつ', reading: 'kyabetsu', meaning: 'cabbage' },
        { word: 'きゃんぷ', reading: 'kyanpu', meaning: 'camp' }
      ],
      'kyu': [
        { word: 'きゅう', reading: 'kyuu', meaning: 'nine' },
        { word: 'きゅうりょう', reading: 'kyuuryou', meaning: 'salary' },
        { word: 'きゅうけい', reading: 'kyuukei', meaning: 'break' }
      ],
      'kyo': [
        { word: 'きょう', reading: 'kyou', meaning: 'today' },
        { word: 'きょうしつ', reading: 'kyoushitsu', meaning: 'classroom' },
        { word: 'きょねん', reading: 'kyonen', meaning: 'last year' }
      ],
      'sha': [
        { word: 'しゃしん', reading: 'shashin', meaning: 'photograph' },
        { word: 'しゃつ', reading: 'shatsu', meaning: 'shirt' },
        { word: 'しゃちょう', reading: 'shachou', meaning: 'company president' }
      ],
      'shu': [
        { word: 'しゅくだい', reading: 'shukudai', meaning: 'homework' },
        { word: 'しゅみ', reading: 'shumi', meaning: 'hobby' },
        { word: 'しゅうまつ', reading: 'shuumatsu', meaning: 'weekend' }
      ],
      'sho': [
        { word: 'しょうがつ', reading: 'shougatsu', meaning: 'New Year' },
        { word: 'しょうらい', reading: 'shourai', meaning: 'future' },
        { word: 'しょくじ', reading: 'shokuji', meaning: 'meal' }
      ],
      'cha': [
        { word: 'ちゃわん', reading: 'chawan', meaning: 'rice bowl' },
        { word: 'ちゃいろ', reading: 'chairo', meaning: 'brown' },
        { word: 'ちゃんす', reading: 'chansu', meaning: 'chance' }
      ],
      'chu': [
        { word: 'ちゅうい', reading: 'chuui', meaning: 'caution' },
        { word: 'ちゅうごく', reading: 'chuugoku', meaning: 'China' },
        { word: 'ちゅうしゃ', reading: 'chuusha', meaning: 'injection' }
      ],
      'cho': [
        { word: 'ちょっと', reading: 'chotto', meaning: 'a little' },
        { word: 'ちょうしょく', reading: 'choushoku', meaning: 'breakfast' },
        { word: 'ちょうど', reading: 'choudo', meaning: 'exactly' }
      ],
      'nya': [
        { word: 'にゃんこ', reading: 'nyanko', meaning: 'kitty' },
        { word: 'にゃー', reading: 'nyaa', meaning: 'meow' },
        { word: 'こにゃん', reading: 'konyan', meaning: 'kitten' }
      ],
      'nyu': [
        { word: 'にゅうがく', reading: 'nyuugaku', meaning: 'school entrance' },
        { word: 'にゅうよく', reading: 'nyuuyoku', meaning: 'bathing' },
        { word: 'にゅうじょう', reading: 'nyuujou', meaning: 'entrance' }
      ],
      'nyo': [
        { word: 'にょうぼう', reading: 'nyoubou', meaning: 'wife' },
        { word: 'じょせい', reading: 'josei', meaning: 'female' },
        { word: 'じょゆう', reading: 'joyuu', meaning: 'actress' }
      ],
      'hya': [
        { word: 'ひゃく', reading: 'hyaku', meaning: 'hundred' },
        { word: 'ひゃっかてん', reading: 'hyakkaten', meaning: 'department store' },
        { word: 'さんびゃく', reading: 'sanbyaku', meaning: 'three hundred' }
      ],
      'hyu': [
        { word: 'ひゅうひゅう', reading: 'hyuuhyuu', meaning: 'whistling sound' },
        { word: 'ひゅうまん', reading: 'hyuuman', meaning: 'human' },
        { word: 'ひゅうが', reading: 'hyuuga', meaning: 'sunny spot' }
      ],
      'hyo': [
        { word: 'ひょう', reading: 'hyou', meaning: 'chart' },
        { word: 'ひょうか', reading: 'hyouka', meaning: 'evaluation' },
        { word: 'ひょうげん', reading: 'hyougen', meaning: 'expression' }
      ],
      'mya': [
        { word: 'みゃく', reading: 'myaku', meaning: 'pulse' },
        { word: 'みゃー', reading: 'myaa', meaning: 'meow (cat sound)' },
        { word: 'さんみゃく', reading: 'sanmyaku', meaning: 'mountain range' }
      ],
      'myu': [
        { word: 'みゅーじっく', reading: 'myuujikku', meaning: 'music' },
        { word: 'みゅーじあむ', reading: 'myuujiamu', meaning: 'museum' },
        { word: 'みゅーちゅある', reading: 'myuuchuaru', meaning: 'mutual' }
      ],
      'myo': [
        { word: 'みょう', reading: 'myou', meaning: 'strange' },
        { word: 'みょうじ', reading: 'myouji', meaning: 'surname' },
        { word: 'みょうにち', reading: 'myounichi', meaning: 'tomorrow' }
      ],
      'rya': [
        { word: 'りゃく', reading: 'ryaku', meaning: 'abbreviation' },
        { word: 'りゃくご', reading: 'ryakugo', meaning: 'acronym' },
        { word: 'りゃくしき', reading: 'ryakushiki', meaning: 'simplified form' }
      ],
      'ryu': [
        { word: 'りゅう', reading: 'ryuu', meaning: 'dragon' },
        { word: 'りゅうこう', reading: 'ryuukou', meaning: 'fashion' },
        { word: 'りゅうがくせい', reading: 'ryuugakusei', meaning: 'exchange student' }
      ],
      'ryo': [
        { word: 'りょこう', reading: 'ryokou', meaning: 'travel' },
        { word: 'りょうり', reading: 'ryouri', meaning: 'cooking' },
        { word: 'りょかん', reading: 'ryokan', meaning: 'Japanese inn' }
      ],
      'gya': [
        { word: 'ぎゃく', reading: 'gyaku', meaning: 'reverse' },
        { word: 'ぎゃくてん', reading: 'gyakuten', meaning: 'reversal' },
        { word: 'ぎゃくせつ', reading: 'gyakusetsu', meaning: 'paradox' }
      ],
      'gyu': [
        { word: 'ぎゅうにく', reading: 'gyuuniku', meaning: 'beef' },
        { word: 'ぎゅうにゅう', reading: 'gyuunyuu', meaning: 'milk' },
        { word: 'ぎゅうどん', reading: 'gyuudon', meaning: 'beef bowl' }
      ],
      'gyo': [
        { word: 'ぎょうれつ', reading: 'gyouretsu', meaning: 'line/queue' },
        { word: 'ぎょうじ', reading: 'gyouji', meaning: 'event' },
        { word: 'ぎょうせい', reading: 'gyousei', meaning: 'administration' }
      ],
      'ja': [
        { word: 'じゃがいも', reading: 'jagaimo', meaning: 'potato' },
        { word: 'じゃけっと', reading: 'jaketto', meaning: 'jacket' },
        { word: 'じゃんぷ', reading: 'janpu', meaning: 'jump' }
      ],
      'ju': [
        { word: 'じゅーす', reading: 'juusu', meaning: 'juice' },
        { word: 'じゅぎょう', reading: 'jugyou', meaning: 'class' },
        { word: 'じゅうしょ', reading: 'juusho', meaning: 'address' }
      ],
      'jo': [
        { word: 'じょせい', reading: 'josei', meaning: 'woman' },
        { word: 'じょうきょう', reading: 'joukyou', meaning: 'situation' },
        { word: 'じょうず', reading: 'jouzu', meaning: 'skillful' }
      ],
      'bya': [
        { word: 'びゃく', reading: 'byaku', meaning: 'white (in compounds)' },
        { word: 'さんびゃく', reading: 'sanbyaku', meaning: 'three hundred' },
        { word: 'ろっぴゃく', reading: 'roppyaku', meaning: 'six hundred' }
      ],
      'byu': [
        { word: 'びゅー', reading: 'byuu', meaning: 'whoosh' },
        { word: 'びゅーてぃー', reading: 'byuutii', meaning: 'beauty' },
        { word: 'でびゅー', reading: 'debyuu', meaning: 'debut' }
      ],
      'byo': [
        { word: 'びょういん', reading: 'byouin', meaning: 'hospital' },
        { word: 'びょうき', reading: 'byouki', meaning: 'illness' },
        { word: 'びょうどう', reading: 'byoudou', meaning: 'equality' }
      ],
      'pya': [
        { word: 'ぴゃく', reading: 'pyaku', meaning: 'hundred (in compounds)' },
        { word: 'ろっぴゃく', reading: 'roppyaku', meaning: 'six hundred' },
        { word: 'はっぴゃく', reading: 'happyaku', meaning: 'eight hundred' }
      ],
      'pyu': [
        { word: 'ぴゅあ', reading: 'pyua', meaning: 'pure' },
        { word: 'こんぴゅーた', reading: 'konpyuuta', meaning: 'computer' },
        { word: 'ぴゅーれ', reading: 'pyuure', meaning: 'puree' }
      ],
      'pyo': [
        { word: 'ぴょん', reading: 'pyon', meaning: 'hop' },
        { word: 'ぴょんぴょん', reading: 'pyonpyon', meaning: 'hopping' },
        { word: 'はっぴょう', reading: 'happyou', meaning: 'announcement' }
      ]
    }
    
    // Katakana examples (foreign loanwords, onomatopoeia, emphasis)
    const katakanaExamples: Record<string, Array<{ word: string; reading: string; meaning: string }>> = {
      'a': [
        { word: 'アメリカ', reading: 'amerika', meaning: 'America' },
        { word: 'アイス', reading: 'aisu', meaning: 'ice cream' },
        { word: 'アニメ', reading: 'anime', meaning: 'animation' }
      ],
      'i': [
        { word: 'インターネット', reading: 'intaanetto', meaning: 'internet' },
        { word: 'イギリス', reading: 'igirisu', meaning: 'England' },
        { word: 'イタリア', reading: 'itaria', meaning: 'Italy' }
      ],
      'u': [
        { word: 'ウイルス', reading: 'uirusu', meaning: 'virus' },
        { word: 'ウェブ', reading: 'webu', meaning: 'web' },
        { word: 'ウール', reading: 'uuru', meaning: 'wool' }
      ],
      'e': [
        { word: 'エレベーター', reading: 'erebeetaa', meaning: 'elevator' },
        { word: 'エアコン', reading: 'eakon', meaning: 'air conditioner' },
        { word: 'エンジン', reading: 'enjin', meaning: 'engine' }
      ],
      'o': [
        { word: 'オレンジ', reading: 'orenji', meaning: 'orange' },
        { word: 'オフィス', reading: 'ofisu', meaning: 'office' },
        { word: 'オーストラリア', reading: 'oosutoraria', meaning: 'Australia' }
      ],
      'ka': [
        { word: 'カメラ', reading: 'kamera', meaning: 'camera' },
        { word: 'カード', reading: 'kaado', meaning: 'card' },
        { word: 'カフェ', reading: 'kafe', meaning: 'cafe' }
      ],
      'ki': [
        { word: 'キーボード', reading: 'kiiboodo', meaning: 'keyboard' },
        { word: 'キッチン', reading: 'kitchin', meaning: 'kitchen' },
        { word: 'キャンプ', reading: 'kyanpu', meaning: 'camp' }
      ],
      'ku': [
        { word: 'クラス', reading: 'kurasu', meaning: 'class' },
        { word: 'クリスマス', reading: 'kurisumasu', meaning: 'Christmas' },
        { word: 'クッキー', reading: 'kukkii', meaning: 'cookie' }
      ],
      'ke': [
        { word: 'ケーキ', reading: 'keeki', meaning: 'cake' },
        { word: 'ケース', reading: 'keesu', meaning: 'case' },
        { word: 'ケータイ', reading: 'keetai', meaning: 'mobile phone' }
      ],
      'ko': [
        { word: 'コーヒー', reading: 'koohii', meaning: 'coffee' },
        { word: 'コンピューター', reading: 'konpyuutaa', meaning: 'computer' },
        { word: 'コップ', reading: 'koppu', meaning: 'cup' }
      ],
      'sa': [
        { word: 'サッカー', reading: 'sakkaa', meaning: 'soccer' },
        { word: 'サンドイッチ', reading: 'sandoitchi', meaning: 'sandwich' },
        { word: 'サラダ', reading: 'sarada', meaning: 'salad' }
      ],
      'shi': [
        { word: 'シャツ', reading: 'shatsu', meaning: 'shirt' },
        { word: 'シャワー', reading: 'shawaa', meaning: 'shower' },
        { word: 'ショップ', reading: 'shoppu', meaning: 'shop' }
      ],
      'su': [
        { word: 'スポーツ', reading: 'supootsu', meaning: 'sports' },
        { word: 'スーパー', reading: 'suupaa', meaning: 'supermarket' },
        { word: 'スープ', reading: 'suupu', meaning: 'soup' }
      ],
      'se': [
        { word: 'セーター', reading: 'seetaa', meaning: 'sweater' },
        { word: 'センター', reading: 'sentaa', meaning: 'center' },
        { word: 'セット', reading: 'setto', meaning: 'set' }
      ],
      'so': [
        { word: 'ソフト', reading: 'sofuto', meaning: 'software' },
        { word: 'ソース', reading: 'soosu', meaning: 'sauce' },
        { word: 'ソファー', reading: 'sofaa', meaning: 'sofa' }
      ],
      'ta': [
        { word: 'タクシー', reading: 'takushii', meaning: 'taxi' },
        { word: 'タオル', reading: 'taoru', meaning: 'towel' },
        { word: 'タイミング', reading: 'taimingu', meaning: 'timing' }
      ],
      'chi': [
        { word: 'チーズ', reading: 'chiizu', meaning: 'cheese' },
        { word: 'チケット', reading: 'chiketto', meaning: 'ticket' },
        { word: 'チョコレート', reading: 'chokoreeto', meaning: 'chocolate' }
      ],
      'tsu': [
        { word: 'ツアー', reading: 'tsuaa', meaning: 'tour' },
        { word: 'ツール', reading: 'tsuuru', meaning: 'tool' },
        { word: 'ツイッター', reading: 'tsuittaa', meaning: 'Twitter' }
      ],
      'te': [
        { word: 'テレビ', reading: 'terebi', meaning: 'television' },
        { word: 'テスト', reading: 'tesuto', meaning: 'test' },
        { word: 'テーブル', reading: 'teeburu', meaning: 'table' }
      ],
      'to': [
        { word: 'トマト', reading: 'tomato', meaning: 'tomato' },
        { word: 'トイレ', reading: 'toire', meaning: 'toilet' },
        { word: 'トラック', reading: 'torakku', meaning: 'truck' }
      ],
      'na': [
        { word: 'ナイフ', reading: 'naifu', meaning: 'knife' },
        { word: 'ナンバー', reading: 'nanbaa', meaning: 'number' },
        { word: 'ナプキン', reading: 'napukin', meaning: 'napkin' }
      ],
      'ni': [
        { word: 'ニュース', reading: 'nyuusu', meaning: 'news' },
        { word: 'ニット', reading: 'nitto', meaning: 'knit' },
        { word: 'ニコニコ', reading: 'nikoniko', meaning: 'smiling' }
      ],
      'nu': [
        { word: 'ヌードル', reading: 'nuudoru', meaning: 'noodle' },
        { word: 'ヌガー', reading: 'nugaa', meaning: 'nougat' },
        { word: 'ヌード', reading: 'nuudo', meaning: 'nude' }
      ],
      'ne': [
        { word: 'ネット', reading: 'netto', meaning: 'net' },
        { word: 'ネクタイ', reading: 'nekutai', meaning: 'necktie' },
        { word: 'ネガティブ', reading: 'negatibu', meaning: 'negative' }
      ],
      'no': [
        { word: 'ノート', reading: 'nooto', meaning: 'notebook' },
        { word: 'ノック', reading: 'nokku', meaning: 'knock' },
        { word: 'ノーマル', reading: 'noomaru', meaning: 'normal' }
      ],
      'ha': [
        { word: 'ハンバーガー', reading: 'hanbaagaa', meaning: 'hamburger' },
        { word: 'ハート', reading: 'haato', meaning: 'heart' },
        { word: 'ハサミ', reading: 'hasami', meaning: 'scissors' }
      ],
      'hi': [
        { word: 'ヒーター', reading: 'hiitaa', meaning: 'heater' },
        { word: 'ヒント', reading: 'hinto', meaning: 'hint' },
        { word: 'ヒーロー', reading: 'hiiroo', meaning: 'hero' }
      ],
      'fu': [
        { word: 'フォーク', reading: 'fooku', meaning: 'fork' },
        { word: 'フライドポテト', reading: 'furaidopoteto', meaning: 'french fries' },
        { word: 'フィルム', reading: 'firumu', meaning: 'film' }
      ],
      'he': [
        { word: 'ヘルメット', reading: 'herumetto', meaning: 'helmet' },
        { word: 'ヘアー', reading: 'heaa', meaning: 'hair' },
        { word: 'ヘルプ', reading: 'herupu', meaning: 'help' }
      ],
      'ho': [
        { word: 'ホテル', reading: 'hoteru', meaning: 'hotel' },
        { word: 'ホームページ', reading: 'hoomu peeji', meaning: 'homepage' },
        { word: 'ホットドッグ', reading: 'hotto doggu', meaning: 'hot dog' }
      ],
      'ma': [
        { word: 'マンション', reading: 'manshon', meaning: 'apartment' },
        { word: 'マウス', reading: 'mausu', meaning: 'mouse' },
        { word: 'マーケット', reading: 'maaketto', meaning: 'market' }
      ],
      'mi': [
        { word: 'ミルク', reading: 'miruku', meaning: 'milk' },
        { word: 'ミュージック', reading: 'myuujikku', meaning: 'music' },
        { word: 'ミニ', reading: 'mini', meaning: 'mini' }
      ],
      'mu': [
        { word: 'ムード', reading: 'muudo', meaning: 'mood' },
        { word: 'ムービー', reading: 'muubii', meaning: 'movie' },
        { word: 'ムース', reading: 'muusu', meaning: 'mousse' }
      ],
      'me': [
        { word: 'メール', reading: 'meeru', meaning: 'email' },
        { word: 'メニュー', reading: 'menyuu', meaning: 'menu' },
        { word: 'メモ', reading: 'memo', meaning: 'memo' }
      ],
      'mo': [
        { word: 'モニター', reading: 'monitaa', meaning: 'monitor' },
        { word: 'モデル', reading: 'moderu', meaning: 'model' },
        { word: 'モーター', reading: 'mootaa', meaning: 'motor' }
      ],
      'ya': [
        { word: 'ヤード', reading: 'yaado', meaning: 'yard' },
        { word: 'ヤング', reading: 'yangu', meaning: 'young' },
        { word: 'ヤクルト', reading: 'yakuruto', meaning: 'Yakult' }
      ],
      'yu': [
        { word: 'ユーザー', reading: 'yuuzaa', meaning: 'user' },
        { word: 'ユニフォーム', reading: 'yunifoomu', meaning: 'uniform' },
        { word: 'ユーモア', reading: 'yuumoa', meaning: 'humor' }
      ],
      'yo': [
        { word: 'ヨーグルト', reading: 'yooguruto', meaning: 'yogurt' },
        { word: 'ヨーロッパ', reading: 'yooroppa', meaning: 'Europe' },
        { word: 'ヨット', reading: 'yotto', meaning: 'yacht' }
      ],
      'ra': [
        { word: 'ラーメン', reading: 'raamen', meaning: 'ramen' },
        { word: 'ライト', reading: 'raito', meaning: 'light' },
        { word: 'ラジオ', reading: 'rajio', meaning: 'radio' }
      ],
      'ri': [
        { word: 'リモコン', reading: 'rimokon', meaning: 'remote control' },
        { word: 'リスト', reading: 'risuto', meaning: 'list' },
        { word: 'リボン', reading: 'ribon', meaning: 'ribbon' }
      ],
      'ru': [
        { word: 'ルール', reading: 'ruuru', meaning: 'rule' },
        { word: 'ルーム', reading: 'ruumu', meaning: 'room' },
        { word: 'ルート', reading: 'ruuto', meaning: 'route' }
      ],
      're': [
        { word: 'レストラン', reading: 'resutoran', meaning: 'restaurant' },
        { word: 'レベル', reading: 'reberu', meaning: 'level' },
        { word: 'レシート', reading: 'reshiito', meaning: 'receipt' }
      ],
      'ro': [
        { word: 'ロボット', reading: 'robotto', meaning: 'robot' },
        { word: 'ロック', reading: 'rokku', meaning: 'rock' },
        { word: 'ロケット', reading: 'roketto', meaning: 'rocket' }
      ],
      'wa': [
        { word: 'ワイン', reading: 'wain', meaning: 'wine' },
        { word: 'ワゴン', reading: 'wagon', meaning: 'wagon' },
        { word: 'ワンピース', reading: 'wanpiisu', meaning: 'dress' }
      ],
      'wo': [
        { word: 'ヲ', reading: 'wo', meaning: 'object marker (rare)' },
        { word: 'カヲル', reading: 'kaworu', meaning: 'Kaworu (name)' },
        { word: 'ヲタク', reading: 'wotaku', meaning: 'otaku' }
      ],
      'n': [
        { word: 'パン', reading: 'pan', meaning: 'bread' },
        { word: 'ペン', reading: 'pen', meaning: 'pen' },
        { word: 'ラーメン', reading: 'raamen', meaning: 'ramen' }
      ],
      'ga': [
        { word: 'ガソリン', reading: 'gasorin', meaning: 'gasoline' },
        { word: 'ガラス', reading: 'garasu', meaning: 'glass' },
        { word: 'ガム', reading: 'gamu', meaning: 'gum' }
      ],
      'gi': [
        { word: 'ギター', reading: 'gitaa', meaning: 'guitar' },
        { word: 'ギフト', reading: 'gifuto', meaning: 'gift' },
        { word: 'ギャラリー', reading: 'gyararii', meaning: 'gallery' }
      ],
      'gu': [
        { word: 'グループ', reading: 'guruupu', meaning: 'group' },
        { word: 'グラス', reading: 'gurasu', meaning: 'glass (drinking)' },
        { word: 'グッズ', reading: 'guzzu', meaning: 'goods' }
      ],
      'ge': [
        { word: 'ゲーム', reading: 'geemu', meaning: 'game' },
        { word: 'ゲスト', reading: 'gesuto', meaning: 'guest' },
        { word: 'ゲート', reading: 'geeto', meaning: 'gate' }
      ],
      'go': [
        { word: 'ゴール', reading: 'gooru', meaning: 'goal' },
        { word: 'ゴルフ', reading: 'gorufu', meaning: 'golf' },
        { word: 'ゴミ', reading: 'gomi', meaning: 'garbage' }
      ],
      'za': [
        { word: 'ザー', reading: 'zaa', meaning: 'pouring sound' },
        { word: 'ザック', reading: 'zakku', meaning: 'backpack' },
        { word: 'ザラザラ', reading: 'zarazara', meaning: 'rough' }
      ],
      'ji': [
        { word: 'ジュース', reading: 'juusu', meaning: 'juice' },
        { word: 'ジャケット', reading: 'jaketto', meaning: 'jacket' },
        { word: 'ジム', reading: 'jimu', meaning: 'gym' }
      ],
      'zu': [
        { word: 'ズボン', reading: 'zubon', meaning: 'pants' },
        { word: 'ズーム', reading: 'zuumu', meaning: 'zoom' },
        { word: 'ズルズル', reading: 'zuruzuru', meaning: 'slurping sound' }
      ],
      'ze': [
        { word: 'ゼロ', reading: 'zero', meaning: 'zero' },
        { word: 'ゼリー', reading: 'zerii', meaning: 'jelly' },
        { word: 'ゼミ', reading: 'zemi', meaning: 'seminar' }
      ],
      'zo': [
        { word: 'ゾーン', reading: 'zoon', meaning: 'zone' },
        { word: 'ゾンビ', reading: 'zonbi', meaning: 'zombie' },
        { word: 'ゾウ', reading: 'zou', meaning: 'elephant' }
      ],
      'da': [
        { word: 'ダンス', reading: 'dansu', meaning: 'dance' },
        { word: 'ダイエット', reading: 'daietto', meaning: 'diet' },
        { word: 'ダウンロード', reading: 'daunroodo', meaning: 'download' }
      ],
      'de': [
        { word: 'デザート', reading: 'dezaato', meaning: 'dessert' },
        { word: 'デスク', reading: 'desuku', meaning: 'desk' },
        { word: 'データ', reading: 'deeta', meaning: 'data' }
      ],
      'do': [
        { word: 'ドア', reading: 'doa', meaning: 'door' },
        { word: 'ドラマ', reading: 'dorama', meaning: 'drama' },
        { word: 'ドライブ', reading: 'doraibu', meaning: 'drive' }
      ],
      'ba': [
        { word: 'バス', reading: 'basu', meaning: 'bus' },
        { word: 'バナナ', reading: 'banana', meaning: 'banana' },
        { word: 'バッグ', reading: 'baggu', meaning: 'bag' }
      ],
      'bi': [
        { word: 'ビール', reading: 'biiru', meaning: 'beer' },
        { word: 'ビル', reading: 'biru', meaning: 'building' },
        { word: 'ビデオ', reading: 'bideo', meaning: 'video' }
      ],
      'bu': [
        { word: 'ブラウス', reading: 'burausu', meaning: 'blouse' },
        { word: 'ブック', reading: 'bukku', meaning: 'book' },
        { word: 'ブーツ', reading: 'buutsu', meaning: 'boots' }
      ],
      'be': [
        { word: 'ベッド', reading: 'beddo', meaning: 'bed' },
        { word: 'ベルト', reading: 'beruto', meaning: 'belt' },
        { word: 'ベース', reading: 'beesu', meaning: 'base' }
      ],
      'bo': [
        { word: 'ボール', reading: 'booru', meaning: 'ball' },
        { word: 'ボタン', reading: 'botan', meaning: 'button' },
        { word: 'ボックス', reading: 'bokkusu', meaning: 'box' }
      ],
      'pa': [
        { word: 'パン', reading: 'pan', meaning: 'bread' },
        { word: 'パーティー', reading: 'paatii', meaning: 'party' },
        { word: 'パソコン', reading: 'pasokon', meaning: 'computer' }
      ],
      'pi': [
        { word: 'ピンク', reading: 'pinku', meaning: 'pink' },
        { word: 'ピアノ', reading: 'piano', meaning: 'piano' },
        { word: 'ピザ', reading: 'piza', meaning: 'pizza' }
      ],
      'pu': [
        { word: 'プール', reading: 'puuru', meaning: 'pool' },
        { word: 'プレゼント', reading: 'purezento', meaning: 'present' },
        { word: 'プリン', reading: 'purin', meaning: 'pudding' }
      ],
      'pe': [
        { word: 'ペン', reading: 'pen', meaning: 'pen' },
        { word: 'ページ', reading: 'peeji', meaning: 'page' },
        { word: 'ペット', reading: 'petto', meaning: 'pet' }
      ],
      'po': [
        { word: 'ポケット', reading: 'poketto', meaning: 'pocket' },
        { word: 'ポスト', reading: 'posuto', meaning: 'post' },
        { word: 'ポテト', reading: 'poteto', meaning: 'potato' }
      ],
      'kya': [
        { word: 'キャンプ', reading: 'kyanpu', meaning: 'camp' },
        { word: 'キャベツ', reading: 'kyabetsu', meaning: 'cabbage' },
        { word: 'キャンセル', reading: 'kyanseru', meaning: 'cancel' }
      ],
      'kyu': [
        { word: 'キュート', reading: 'kyuuto', meaning: 'cute' },
        { word: 'レスキュー', reading: 'resukyuu', meaning: 'rescue' },
        { word: 'バーベキュー', reading: 'baabekyuu', meaning: 'barbecue' }
      ],
      'kyo': [
        { word: 'キョロキョロ', reading: 'kyorokyoro', meaning: 'looking around' },
        { word: 'トーキョー', reading: 'tookyoo', meaning: 'Tokyo' },
        { word: 'キョウリュウ', reading: 'kyouryuu', meaning: 'dinosaur' }
      ],
      'sha': [
        { word: 'シャツ', reading: 'shatsu', meaning: 'shirt' },
        { word: 'シャワー', reading: 'shawaa', meaning: 'shower' },
        { word: 'シャンプー', reading: 'shanpuu', meaning: 'shampoo' }
      ],
      'shu': [
        { word: 'シュート', reading: 'shuuto', meaning: 'shoot' },
        { word: 'シューズ', reading: 'shuuzu', meaning: 'shoes' },
        { word: 'ジュース', reading: 'juusu', meaning: 'juice' }
      ],
      'sho': [
        { word: 'ショッピング', reading: 'shoppingu', meaning: 'shopping' },
        { word: 'ショー', reading: 'shoo', meaning: 'show' },
        { word: 'ショック', reading: 'shokku', meaning: 'shock' }
      ],
      'cha': [
        { word: 'チャンネル', reading: 'channeru', meaning: 'channel' },
        { word: 'チャレンジ', reading: 'charenji', meaning: 'challenge' },
        { word: 'チャンス', reading: 'chansu', meaning: 'chance' }
      ],
      'chu': [
        { word: 'チューブ', reading: 'chuubu', meaning: 'tube' },
        { word: 'チューリップ', reading: 'chuurippu', meaning: 'tulip' },
        { word: 'チュー', reading: 'chuu', meaning: 'kiss sound' }
      ],
      'cho': [
        { word: 'チョコレート', reading: 'chokoreeto', meaning: 'chocolate' },
        { word: 'チョイス', reading: 'choisu', meaning: 'choice' },
        { word: 'チョーク', reading: 'chooku', meaning: 'chalk' }
      ],
      'nya': [
        { word: 'ニャー', reading: 'nyaa', meaning: 'meow' },
        { word: 'ニャンコ', reading: 'nyanko', meaning: 'kitty' },
        { word: 'ニャンニャン', reading: 'nyannyan', meaning: 'meow meow' }
      ],
      'nyu': [
        { word: 'ニュース', reading: 'nyuusu', meaning: 'news' },
        { word: 'ニューヨーク', reading: 'nyuuyooku', meaning: 'New York' },
        { word: 'メニュー', reading: 'menyuu', meaning: 'menu' }
      ],
      'nyo': [
        { word: 'ニョロニョロ', reading: 'nyoronyoro', meaning: 'slithering' },
        { word: 'ニョキニョキ', reading: 'nyokinyoki', meaning: 'sprouting' },
        { word: 'ニョッキ', reading: 'nyokki', meaning: 'gnocchi' }
      ],
      'hya': [
        { word: 'ヒャー', reading: 'hyaa', meaning: 'eek!' },
        { word: 'ヒャクエン', reading: 'hyakuen', meaning: '100 yen' },
        { word: 'ヒャッホー', reading: 'hyahhoo', meaning: 'yahoo!' }
      ],
      'hyu': [
        { word: 'ヒューヒュー', reading: 'hyuuhyuu', meaning: 'whistling' },
        { word: 'ヒューマン', reading: 'hyuuman', meaning: 'human' },
        { word: 'ヒュー', reading: 'hyuu', meaning: 'whew' }
      ],
      'hyo': [
        { word: 'ヒョウ', reading: 'hyou', meaning: 'leopard' },
        { word: 'ヒョロヒョロ', reading: 'hyorohyoro', meaning: 'lanky' },
        { word: 'ヒョイ', reading: 'hyoi', meaning: 'with ease' }
      ],
      'mya': [
        { word: 'ミャンマー', reading: 'myanmaa', meaning: 'Myanmar' },
        { word: 'ミャー', reading: 'myaa', meaning: 'meow' },
        { word: 'ミャオ', reading: 'myao', meaning: 'meow (Chinese)' }
      ],
      'myu': [
        { word: 'ミュージック', reading: 'myuujikku', meaning: 'music' },
        { word: 'ミュージアム', reading: 'myuujiamu', meaning: 'museum' },
        { word: 'ミュート', reading: 'myuuto', meaning: 'mute' }
      ],
      'myo': [
        { word: 'ミョウガ', reading: 'myouga', meaning: 'Japanese ginger' },
        { word: 'ミョウバン', reading: 'myouban', meaning: 'alum' },
        { word: 'ミョーン', reading: 'myoon', meaning: 'strange sound' }
      ],
      'rya': [
        { word: 'リャマ', reading: 'ryama', meaning: 'llama' },
        { word: 'リャンメン', reading: 'ryanmen', meaning: 'cold noodles' },
        { word: 'リャク', reading: 'ryaku', meaning: 'abbreviation' }
      ],
      'ryu': [
        { word: 'リュック', reading: 'ryukku', meaning: 'backpack' },
        { word: 'リュウ', reading: 'ryuu', meaning: 'dragon' },
        { word: 'リューマチ', reading: 'ryuumachi', meaning: 'rheumatism' }
      ],
      'ryo': [
        { word: 'リョコウ', reading: 'ryokou', meaning: 'travel' },
        { word: 'リョウリ', reading: 'ryouri', meaning: 'cooking' },
        { word: 'リョカン', reading: 'ryokan', meaning: 'inn' }
      ],
      'gya': [
        { word: 'ギャラリー', reading: 'gyararii', meaning: 'gallery' },
        { word: 'ギャング', reading: 'gyangu', meaning: 'gang' },
        { word: 'ギャップ', reading: 'gyappu', meaning: 'gap' }
      ],
      'gyu': [
        { word: 'ギュー', reading: 'gyuu', meaning: 'squeeze' },
        { word: 'ギューニュー', reading: 'gyuunyuu', meaning: 'milk' },
        { word: 'ギュウドン', reading: 'gyuudon', meaning: 'beef bowl' }
      ],
      'gyo': [
        { word: 'ギョーザ', reading: 'gyooza', meaning: 'dumplings' },
        { word: 'ギョッ', reading: 'gyo', meaning: 'surprised sound' },
        { word: 'ギョロギョロ', reading: 'gyorogyoro', meaning: 'goggling' }
      ],
      'ja': [
        { word: 'ジャケット', reading: 'jaketto', meaning: 'jacket' },
        { word: 'ジャンプ', reading: 'janpu', meaning: 'jump' },
        { word: 'ジャム', reading: 'jamu', meaning: 'jam' }
      ],
      'ju': [
        { word: 'ジュース', reading: 'juusu', meaning: 'juice' },
        { word: 'ジュエリー', reading: 'juerii', meaning: 'jewelry' },
        { word: 'ジューシー', reading: 'juushii', meaning: 'juicy' }
      ],
      'jo': [
        { word: 'ジョギング', reading: 'jogingu', meaning: 'jogging' },
        { word: 'ジョーク', reading: 'jooku', meaning: 'joke' },
        { word: 'ジョイント', reading: 'jointo', meaning: 'joint' }
      ],
      'bya': [
        { word: 'ビャー', reading: 'byaa', meaning: 'sound effect' },
        { word: 'サンビャク', reading: 'sanbyaku', meaning: '300' },
        { word: 'ロッピャク', reading: 'roppyaku', meaning: '600' }
      ],
      'byu': [
        { word: 'ビュー', reading: 'byuu', meaning: 'view' },
        { word: 'ビューティー', reading: 'byuutii', meaning: 'beauty' },
        { word: 'デビュー', reading: 'debyuu', meaning: 'debut' }
      ],
      'byo': [
        { word: 'ビョーキ', reading: 'byooki', meaning: 'illness' },
        { word: 'ビョウイン', reading: 'byouin', meaning: 'hospital' },
        { word: 'ビョーン', reading: 'byoon', meaning: 'boing' }
      ],
      'pya': [
        { word: 'ピャー', reading: 'pyaa', meaning: 'screech' },
        { word: 'ハッピャク', reading: 'happyaku', meaning: '800' },
        { word: 'ロッピャク', reading: 'roppyaku', meaning: '600' }
      ],
      'pyu': [
        { word: 'ピュア', reading: 'pyua', meaning: 'pure' },
        { word: 'コンピューター', reading: 'konpyuutaa', meaning: 'computer' },
        { word: 'ピューレ', reading: 'pyuure', meaning: 'puree' }
      ],
      'pyo': [
        { word: 'ピョン', reading: 'pyon', meaning: 'hop' },
        { word: 'ピョンピョン', reading: 'pyonpyon', meaning: 'hopping' },
        { word: 'ハッピョウ', reading: 'happyou', meaning: 'announcement' }
      ]
    }
    
    // Return appropriate examples based on display script
    return displayScript === 'hiragana' 
      ? hiraganaExamples[character.id] || [] 
      : katakanaExamples[character.id] || []
  }
  
  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-4">
      {/* Progress Indicator */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {currentIndex} / {totalCharacters}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {progress?.status === 'learned' ? t('kana.progress.learned') :
             progress?.status === 'learning' ? t('kana.progress.learning') :
             t('kana.progress.notStarted')}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300"
            style={{ width: `${(currentIndex / totalCharacters) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative"
      >
        <div
          className="relative w-80 h-80 md:w-96 md:h-96 cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <AnimatePresence mode="wait">
            {!isFlipped ? (
              <motion.div
                key="front"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: 0 }}
                exit={{ rotateY: 90 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl
                         border-2 border-gray-200 dark:border-dark-600
                         flex flex-col items-center justify-center p-8
                         hover:scale-[1.02] transition-transform duration-200"
              >
                {/* Stroke Order Animation Button - Top Left */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowStrokeOrder(true)
                  }}
                  className="absolute top-4 left-4 p-2 rounded-full bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-all"
                  title="Stroke order animation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>

                {/* Practice Button - Top Right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDrawingPractice(true)
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-all"
                  title="Practice drawing"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>

                {/* Audio Icon - Bottom Right */}
                <AudioButton
                  position="bottom-right"
                  size="sm"
                  onPlay={handlePlayAudio}
                />

                {/* Character Display */}
                <div className="text-8xl font-japanese font-bold text-gray-800 dark:text-gray-200 mb-4">
                  {displayScript === 'hiragana' ? character.hiragana : character.katakana}
                </div>
                
                {showBothKana && (
                  <div className="text-6xl font-japanese font-bold text-gray-600 dark:text-gray-400 mb-4">
                    {displayScript === 'hiragana' ? character.katakana : character.hiragana}
                  </div>
                )}
                
                {/* Romaji (optional) */}
                <AnimatePresence>
                  {showRomaji && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-2xl font-medium text-primary-600 dark:text-primary-400"
                    >
                      {character.romaji}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Examples Icon - Bottom Left */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowExamples(!showExamples)
                  }}
                  className={`absolute bottom-4 left-4 p-2 rounded-full transition-all
                            ${showExamples
                              ? 'bg-purple-500 text-white shadow-lg'
                              : 'bg-gray-100 dark:bg-dark-700 hover:bg-purple-100 dark:hover:bg-purple-900/20 text-gray-600 dark:text-gray-400 hover:text-purple-600'}`}
                  title="Examples"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </button>

                {/* Pronunciation Note */}
                {character.pronunciation && (
                  <div className="absolute bottom-16 left-4 right-4 bg-yellow-100 dark:bg-yellow-900/30
                                rounded-lg p-2 text-sm text-yellow-800 dark:text-yellow-200">
                    {character.pronunciation}
                  </div>
                )}

                <p className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-600">
                  {t('kana.study.flipCard')}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="back"
                initial={{ rotateY: -90 }}
                animate={{ rotateY: 0 }}
                exit={{ rotateY: 90 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100 
                         dark:from-primary-900/20 dark:to-primary-800/20 
                         rounded-2xl shadow-2xl border-2 border-primary-200 dark:border-primary-700 
                         flex flex-col items-center justify-center p-8"
              >
                <div className="text-6xl font-japanese font-bold text-gray-800 dark:text-gray-200 mb-2">
                  {displayScript === 'hiragana' ? character.hiragana : character.katakana}
                </div>
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-4">
                  {character.romaji}
                </div>
                
                {/* Example Words */}
                {showExamples && (
                  <div className="mt-4 space-y-2">
                    {getExampleWords().map((example, idx) => (
                      <div key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-japanese">{example.word}</span>
                        <span className="mx-2">({example.reading})</span>
                        <span className="text-gray-500">- {example.meaning}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-600">
                  {t('kana.study.flipCard')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Example Words Display */}
      <AnimatePresence>
        {showExamples && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md mt-4 p-4 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-gray-200 dark:border-dark-700"
          >
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Example Words</h3>
            <div className="space-y-2">
              {getExampleWords().length > 0 ? (
                getExampleWords().map((example, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="font-japanese text-lg text-gray-800 dark:text-gray-200">{example.word}</span>
                    <span className="text-gray-500 dark:text-gray-400">({example.reading})</span>
                    <span className="text-gray-600 dark:text-gray-300">- {example.meaning}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No examples available</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Romaji Toggle */}
      <div className="flex items-center justify-center mt-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('kana.study.showRomaji')}</span>
          <button
            onClick={async () => {
              setShowRomaji(!showRomaji)
              // Track hint interaction
              if (!showRomaji && user) {
                const script = displayScript as 'hiragana' | 'katakana'
                await kanaProgressManagerV2.trackCharacterInteraction(
                  script,
                  character.id,
                  'hint',
                  user,
                  isPremium
                )
              }
            }}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                     bg-gray-200 dark:bg-gray-700 data-[checked=true]:bg-primary-500"
            data-checked={showRomaji}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                           ${showRomaji ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <button
          onClick={handleSkip}
          className="px-6 py-3 min-w-[120px] rounded-xl bg-gray-100 dark:bg-dark-700
                   hover:bg-gray-200 dark:hover:bg-dark-600 transition-all
                   transform hover:scale-105 active:scale-95"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            {t('kana.study.skip') || 'Skip'}
          </span>
        </button>


        <button
          onClick={handleMarkAsLearned}
          className="px-6 py-3 min-w-[120px] rounded-xl bg-green-500 text-white
                   hover:bg-green-600 transition-all shadow-lg
                   transform hover:scale-105 active:scale-95"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('kana.study.markAsLearned')}
          </span>
        </button>
      </div>
      
      {/* Navigation */}
      <div className="flex items-center justify-between w-full max-w-2xl mt-8">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          ← {t('kana.navigation.backToGrid')}
        </button>
        
        {totalCharacters > 1 && (
          <div className="flex items-center gap-4">
            <button
              onClick={onPrevious}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={onNext}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showStrokeOrder && (
        <StrokeOrderModal
          character={displayScript === 'hiragana' ? character.hiragana : character.katakana}
          isOpen={showStrokeOrder}
          onClose={() => setShowStrokeOrder(false)}
        />
      )}

      {showDrawingPractice && (
        <DrawingPracticeModal
          character={displayScript === 'hiragana' ? character.hiragana : character.katakana}
          isOpen={showDrawingPractice}
          onClose={() => setShowDrawingPractice(false)}
          characterType="kana"
        />
      )}

    </div>
  )
}