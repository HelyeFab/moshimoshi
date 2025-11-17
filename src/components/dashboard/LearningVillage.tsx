'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'
import { useAnimationControl } from '@/components/ui/AnimationControl'
import AnimationControl from '@/components/ui/AnimationControl'
import Image from 'next/image'

const stallImages = [
  '/ui/flat-icons/stalls/ceramics.png',
  '/ui/flat-icons/stalls/food-cart (1).png',
  '/ui/flat-icons/stalls/food-cart.png',
  '/ui/flat-icons/stalls/food-stall (1).png',
  '/ui/flat-icons/stalls/food-stall (2).png',
  '/ui/flat-icons/stalls/food-stall.png',
  '/ui/flat-icons/stalls/food-stand (1).png',
  '/ui/flat-icons/stalls/food-stand.png',
  '/ui/flat-icons/stalls/stall (1).png',
  '/ui/flat-icons/stalls/stall-food.png',
  '/ui/flat-icons/stalls/stall.png',
  '/ui/flat-icons/stalls/stand.png',
  '/ui/flat-icons/stalls/street-food.png',
]

const getRandomStallImage = () => stallImages[Math.floor(Math.random() * stallImages.length)]

// Floating lantern component
function FloatingLantern({ delay = 0, color = '#ef4444' }) {
  const animationsEnabled = useAnimationControl()

  return (
    <motion.div
      className="absolute pointer-events-none floating-element"
      initial={{ y: '120vh', opacity: 0 }}
      animate={animationsEnabled ? {
        y: '-20vh',
        opacity: [0, 1, 1, 0],
      } : { y: '120vh', opacity: 0 }}
      transition={{
        duration: animationsEnabled ? 20 : 0,
        delay: animationsEnabled ? delay : 0,
        repeat: animationsEnabled ? Infinity : 0,
        ease: 'linear',
      }}
      style={{
        left: `${Math.random() * 100}%`,
        filter: `drop-shadow(0 0 20px ${color})`,
      }}
    >
      <div
        className="w-8 h-10 rounded-lg"
        style={{
          background: `linear-gradient(135deg, ${color}40, ${color}80)`,
          boxShadow: `inset 0 0 20px ${color}60`,
        }}
      />
    </motion.div>
  )
}

// Twinkling light component
function TwinklingLight({ delay = 0, x = '50%', y = '50%', color = '#fbbf24' }) {
  const animationsEnabled = useAnimationControl()

  return (
    <motion.div
      className="absolute pointer-events-none twinkling-light"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={animationsEnabled ? {
        opacity: [0, 1, 0.3, 1, 0],
        scale: [0, 1.2, 0.8, 1.5, 0],
      } : { opacity: 0, scale: 0 }}
      transition={{
        duration: animationsEnabled ? (2 + Math.random() * 2) : 0,
        delay: animationsEnabled ? (delay + Math.random() * 0.5) : 0,
        repeat: animationsEnabled ? Infinity : 0,
        repeatDelay: animationsEnabled ? (Math.random() * 3) : 0,
        ease: 'easeInOut',
      }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          boxShadow: `0 0 10px ${color}, 0 0 20px ${color}80, 0 0 30px ${color}40`,
        }}
      />
    </motion.div>
  )
}

// Chinese lantern emoji component
function ChineseLantern({ delay = 0, size = 'medium' }) {
  const animationsEnabled = useAnimationControl()

  const sizes = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-6xl',
    xlarge: 'text-8xl'
  }

  const duration = 25 + Math.random() * 10 // Varying speeds
  const horizontalDrift = Math.random() * 30 - 15 // Drift left or right

  // Start from very bottom of the Learning Village (after all 5 rows)
  // Using vh units for better responsiveness
  const startY = '120vh'  // Start 120% of viewport height (well below all content)
  const endY = '-20vh'    // End above the viewport

  return (
    <motion.div
      className={`absolute pointer-events-none lantern-float ${sizes[size]}`}
      initial={{
        y: startY,
        x: 0,
        opacity: 0,
        rotate: -10
      }}
      animate={animationsEnabled ? {
        y: endY,
        x: horizontalDrift,
        opacity: [0, 1, 1, 1, 0],
        rotate: 10
      } : {
        y: startY,
        x: 0,
        opacity: 0,
        rotate: -10
      }}
      transition={{
        duration: animationsEnabled ? duration : 0,
        delay: animationsEnabled ? delay : 0,
        repeat: animationsEnabled ? Infinity : 0,
        ease: 'easeInOut',
      }}
      style={{
        left: `${Math.random() * 100}%`,
        filter: 'drop-shadow(0 0 15px rgba(239, 68, 68, 0.5))',
      }}
    >
      🏮
    </motion.div>
  )
}


// Stall card component
function StallCard({ stall, index }: { stall: any, index: number }) {
  const [isHovered, setIsHovered] = useState(false)
  const { strings } = useI18n()
  const cardRef = useRef<HTMLDivElement>(null)

  const cardContent = (
    <div className={`
          relative overflow-hidden rounded-2xl
          bg-white/5 dark:bg-dark-800/5 backdrop-blur-md
          border border-white/40 dark:border-white/20
          hover:border-primary-400/80 dark:hover:border-primary-500/80
          shadow-xl hover:shadow-2xl ${stall.glow}
          transition-all duration-300 cursor-pointer
          group
          before:absolute before:inset-0
          before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent
          before:pointer-events-none
          after:absolute after:inset-0
          after:shadow-inner after:rounded-2xl
          after:pointer-events-none
        `}>
      {/* Animated gradient background */}
      <div className={`
            absolute inset-0 opacity-0 group-hover:opacity-20
            bg-gradient-to-br ${stall.color}
            transition-opacity duration-500
          `} />

      {/* Lantern glow effect */}
      <div
        className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${stall.lanternColor}40 0%, transparent 70%)`,
          filter: `blur(20px)`,
        }}
      />

      {/* Content background for better readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-white/5 dark:from-black/20 dark:to-black/10 pointer-events-none" />

      {/* Content */}
      <div className="relative p-6 space-y-4">
        {/* Emoji icon and stall image in a single row with space between */}
        <div className="flex items-center justify-between">
          <span className="text-3xl filter drop-shadow-lg group-hover:animate-bounce flex-shrink-0">
            {stall.icon}
          </span>
          <Image
            src={stall.stallImage}
            alt="Stall Image"
            width={48}
            height={48}
            className="opacity-60 group-hover:opacity-80 transition-opacity duration-300 flex-shrink-0"
          />
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-white transition-colors leading-tight">
          {/* Split title if it contains multiple words */}
          {stall.title.split(' ').length > 1 ? (
            <>
              {stall.title.split(' ').map((word, index) => (
                <span key={index} className="block">
                  {word}
                </span>
              ))}
            </>
          ) : (
            stall.title
          )}
        </h3>

        {/* Subtitle */}
        <p className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-white/90 transition-colors font-medium">
          {stall.subtitle}
        </p>

        {/* Description */}
        <p className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-white/90 transition-colors">
          {stall.description}
        </p>

        {/* Hover indicator */}
        <motion.div
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          animate={{ x: isHovered ? [0, 5, 0] : 0 }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <span className="text-white text-sm">→</span>
        </motion.div>
      </div>
    </div>
  )

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.5,
        type: 'spring',
        stiffness: 100,
      }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative"
    >
      <Link href={stall.href}>
        {cardContent}
      </Link>
    </motion.div>
  )
}

export default function LearningVillage() {
  const { resolvedTheme } = useTheme()
  const { strings } = useI18n()
  const animationsEnabled = useAnimationControl()
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'evening' | 'night'>('day')

  // Learning sections with festival stall themes - now with i18n
  // Reordered in a logical progression for learners
  const learningStalls = useMemo(() => [
    // === FOUNDATION (Basics) ===
    {
      id: 'hiragana',
      title: strings.dashboard?.cards?.hiragana?.title || 'Hiragana',
      subtitle: strings.dashboard?.cards?.hiragana?.subtitle || 'ひらがな',
      description: strings.dashboard?.cards?.hiragana?.description || 'Master the flowing script',
      href: '/learn/hiragana',
      icon: '🎋',
      stallType: 'bamboo',
      color: 'from-green-400 to-emerald-600',
      glow: 'shadow-green-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#10b981',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'katakana',
      title: strings.dashboard?.cards?.katakana?.title || 'Katakana',
      subtitle: strings.dashboard?.cards?.katakana?.subtitle || 'カタカナ',
      description: strings.dashboard?.cards?.katakana?.description || 'Sharp and angular characters',
      href: '/learn/katakana',
      icon: '⚡',
      stallType: 'thunder',
      color: 'from-blue-400 to-indigo-600',
      glow: 'shadow-blue-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#3b82f6',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'drill',
      title: strings.dashboard?.cards?.drill?.title || 'Drill',
      subtitle: strings.dashboard?.cards?.drill?.subtitle || 'ドリル',
      description: strings.dashboard?.cards?.drill?.description || 'Quick drill exercises',
      href: '/drill',
      icon: '⚡',
      stallType: 'school',
      color: 'from-indigo-400 to-purple-600',
      glow: 'shadow-indigo-500/50',
      doshiMood: 'thinking' as const,
      progress: 0,
      lanternColor: '#6366f1',
      stallImage: getRandomStallImage(),
    },
    // === CORE CONTENT ===
    {
      id: 'vocabulary',
      title: strings.dashboard?.cards?.vocabulary?.title || 'Vocabulary',
      subtitle: strings.dashboard?.cards?.vocabulary?.subtitle || '単語',
      description: strings.dashboard?.cards?.vocabulary?.description || 'Build your word power',
      href: '/vocabulary',
      icon: '📚',
      stallType: 'library',
      color: 'from-purple-400 to-violet-600',
      glow: 'shadow-purple-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#8b5cf6',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'my-lists',
      title: strings.lists?.title || 'My Lists',
      subtitle: strings.lists?.pageDescription || 'リスト',
      description: strings.lists?.pageDescription || 'Create and manage custom study lists',
      href: '/lists',
      icon: '📋',
      stallType: 'scroll',
      color: 'from-cyan-400 to-teal-600',
      glow: 'shadow-cyan-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#06b6d4',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'kanji-browser',
      title: strings.dashboard?.cards?.kanjiBrowser?.title || 'Kanji Browser',
      subtitle: strings.dashboard?.cards?.kanjiBrowser?.subtitle || '漢字辞典',
      description: strings.dashboard?.cards?.kanjiBrowser?.description || 'Browse all JLPT kanji levels',
      href: '/kanji-browser',
      icon: '📖',
      stallType: 'library',
      color: 'from-indigo-400 to-blue-600',
      glow: 'shadow-indigo-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#4f46e5',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'kanji-mastery',
      title: strings.dashboard?.cards?.kanjiMastery?.title || 'Kanji Mastery',
      subtitle: strings.dashboard?.cards?.kanjiMastery?.subtitle || '漢字習得',
      description: strings.dashboard?.cards?.kanjiMastery?.description || 'Master kanji with SRS',
      href: '/tools/kanji-mastery',
      icon: '🎯',
      stallType: 'bridge',
      color: 'from-teal-400 to-cyan-600',
      glow: 'shadow-teal-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#14b8a6',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'kanji-connections',
      title: strings.dashboard?.cards?.kanjiConnections?.title || 'Kanji Connections',
      subtitle: strings.dashboard?.cards?.kanjiConnections?.subtitle || '漢字関連',
      description: strings.dashboard?.cards?.kanjiConnections?.description || 'Premium: Families, Radicals & Patterns',
      href: '/kanji-connection',
      icon: '🔮',
      stallType: 'map',
      color: 'from-sky-400 to-blue-600',
      glow: 'shadow-sky-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#0ea5e9',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'mood-boards',
      title: strings.dashboard?.cards?.moodBoards?.title || 'Mood Boards',
      subtitle: strings.dashboard?.cards?.moodBoards?.subtitle || 'ムード',
      description: strings.dashboard?.cards?.moodBoards?.description || 'Learn kanji by themes',
      href: '/kanji-moods',
      icon: '🗺️',
      stallType: 'restaurant',
      color: 'from-yellow-400 to-orange-600',
      glow: 'shadow-yellow-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#eab308',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'conjugation',
      title: strings.dashboard?.cards?.conjugation?.title || 'Conjugation',
      subtitle: strings.dashboard?.cards?.conjugation?.subtitle || '活用',
      description: strings.dashboard?.cards?.conjugation?.description || 'Practice verb conjugations',
      href: '/learn/conjugation',
      icon: '🔤',
      stallType: 'archery',
      color: 'from-orange-400 to-amber-600',
      glow: 'shadow-orange-500/50',
      doshiMood: 'thinking' as const,
      progress: 0,
      lanternColor: '#f97316',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'textbook-vocab',
      title: strings.dashboard?.cards?.textbookVocab?.title || 'Textbook Vocab',
      subtitle: strings.dashboard?.cards?.textbookVocab?.subtitle || '教科書',
      description: strings.dashboard?.cards?.textbookVocab?.description || 'Study textbook vocabulary',
      href: '/tools/textbook-vocabulary',
      icon: '📚',
      stallType: 'calligraphy',
      color: 'from-gray-400 to-slate-600',
      glow: 'shadow-gray-500/50',
      doshiMood: 'thinking' as const,
      progress: 0,
      lanternColor: '#64748b',
      stallImage: getRandomStallImage(),
    },
    // === PRACTICE & IMMERSION ===
    {
      id: 'stories',
      title: strings.dashboard?.cards?.stories?.title || 'Stories',
      subtitle: strings.dashboard?.cards?.stories?.subtitle || '物語',
      description: strings.dashboard?.cards?.stories?.description || 'AI-generated stories',
      href: '/stories',
      icon: '📚',
      stallType: 'stage',
      color: 'from-indigo-400 to-blue-600',
      glow: 'shadow-indigo-500/50',
      doshiMood: 'waving' as const,
      progress: 0,
      lanternColor: '#6366f1',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'news',
      title: strings.dashboard?.cards?.news?.title || 'News',
      subtitle: strings.dashboard?.cards?.news?.subtitle || 'ニュース',
      description: strings.dashboard?.cards?.news?.description || 'Read Japanese news',
      href: '/news',
      icon: '🗞️',
      stallType: 'scroll',
      color: 'from-emerald-400 to-green-600',
      glow: 'shadow-emerald-500/50',
      doshiMood: 'thinking' as const,
      progress: 0,
      lanternColor: '#10b981',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'library',
      title: strings.dashboard?.cards?.library?.title || 'Library',
      subtitle: strings.dashboard?.cards?.library?.subtitle || '図書館',
      description: strings.dashboard?.cards?.library?.description || 'Read condensed books',
      href: '/library',
      icon: '📚',
      stallType: 'scroll',
      color: 'from-amber-400 to-orange-600',
      glow: 'shadow-amber-500/50',
      doshiMood: 'reading' as const,
      progress: 0,
      lanternColor: '#f59e0b',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'youtube-shadowing',
      title: strings.dashboard?.cards?.youtubeShadowing?.title || 'YouTube Shadowing',
      subtitle: strings.dashboard?.cards?.youtubeShadowing?.subtitle || 'YouTube',
      description: strings.dashboard?.cards?.youtubeShadowing?.description || 'Practice with YouTube',
      href: '/youtube-shadowing',
      icon: '📺',
      stallType: 'music',
      color: 'from-pink-400 to-rose-600',
      glow: 'shadow-pink-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#ec4899',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'popular-videos',
      title: strings.dashboard?.cards?.popularVideos?.title || 'Trending Videos',
      subtitle: strings.dashboard?.cards?.popularVideos?.subtitle || '人気動画',
      description: strings.dashboard?.cards?.popularVideos?.description || 'Most watched by the community',
      href: '/popular-videos',
      icon: '🔥',
      stallType: 'cinema',
      color: 'from-red-500 to-orange-600',
      glow: 'shadow-orange-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#f97316',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'youtube-series',
      title: strings.dashboard?.cards?.youtubeSeries?.title || 'YouTube Series',
      subtitle: strings.dashboard?.cards?.youtubeSeries?.subtitle || 'シリーズ',
      description: strings.dashboard?.cards?.youtubeSeries?.description || 'Track YouTube channels',
      href: '/youtube-series',
      icon: '📺',
      stallType: 'cards',
      color: 'from-amber-400 to-yellow-600',
      glow: 'shadow-amber-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#f59e0b',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'my-videos',
      title: strings.dashboard?.cards?.myVideos?.title || 'My Videos',
      subtitle: strings.dashboard?.cards?.myVideos?.subtitle || 'ビデオ',
      description: strings.dashboard?.cards?.myVideos?.description || 'Your saved videos',
      href: '/my-videos',
      icon: '🎬',
      stallType: 'theater',
      color: 'from-rose-400 to-pink-600',
      glow: 'shadow-rose-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#f43f5e',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'flashcards',
      title: strings.dashboard?.cards?.flashcards?.title || 'Flashcards',
      subtitle: strings.dashboard?.cards?.flashcards?.subtitle || 'フラッシュカード',
      description: strings.dashboard?.cards?.flashcards?.description || 'Create and study flashcard decks',
      href: '/flashcards',
      icon: '🎴',
      stallType: 'cards',
      color: 'from-violet-400 to-purple-600',
      glow: 'shadow-violet-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#8b5cf6',
      stallImage: getRandomStallImage(),
    },
    // === GAMES & REVIEW ===
    {
      id: 'games',
      title: strings.dashboard?.cards?.games?.title || 'Games',
      subtitle: strings.dashboard?.cards?.games?.subtitle || 'ゲーム',
      description: strings.dashboard?.cards?.games?.description || 'Learn through fun games',
      href: '/games',
      icon: '🎮',
      stallType: 'festival',
      color: 'from-red-400 to-pink-600',
      glow: 'shadow-red-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#ef4444',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'review-hub',
      title: strings.dashboard?.cards?.reviewHub?.title || 'Review Hub',
      subtitle: strings.dashboard?.cards?.reviewHub?.subtitle || 'レビュー',
      description: strings.dashboard?.cards?.reviewHub?.description || 'Unified review system',
      href: '/review-dashboard',
      icon: '📖',
      stallType: 'office',
      color: 'from-slate-400 to-gray-600',
      glow: 'shadow-slate-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#475569',
      stallImage: getRandomStallImage(),
    },
    // === PROGRESS & COMMUNITY ===
    {
      id: 'achievements',
      title: strings.dashboard?.cards?.achievements?.title || 'Achievements',
      subtitle: strings.dashboard?.cards?.achievements?.subtitle || '成果',
      description: strings.dashboard?.cards?.achievements?.description || 'Track your progress',
      href: '/achievements',
      icon: '🏆',
      stallType: 'trophy',
      color: 'from-yellow-400 to-amber-600',
      glow: 'shadow-yellow-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#eab308',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'leaderboard',
      title: strings.leaderboard?.title || 'Leaderboard',
      subtitle: strings.leaderboard?.subtitle || 'ランキング',
      description: strings.leaderboard?.description || 'Compete with other learners',
      href: '/leaderboard',
      icon: '🥇',
      stallType: 'podium',
      color: 'from-yellow-500 to-amber-500',
      glow: 'shadow-yellow-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#fbbf24',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'resources',
      title: strings.dashboard?.cards?.resources?.title || 'Resources',
      subtitle: strings.dashboard?.cards?.resources?.subtitle || 'リソース',
      description: strings.dashboard?.cards?.resources?.description || 'Learning resources',
      href: '/resources',
      icon: '🎌',
      stallType: 'library',
      color: 'from-purple-400 to-indigo-600',
      glow: 'shadow-purple-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#9333ea',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'blog',
      title: strings.dashboard?.cards?.blog?.title || 'Blog',
      subtitle: strings.dashboard?.cards?.blog?.subtitle || 'ブログ',
      description: strings.dashboard?.cards?.blog?.description || 'Read articles and updates',
      href: '/blog',
      icon: '✍️',
      stallType: 'scroll',
      color: 'from-teal-400 to-cyan-600',
      glow: 'shadow-teal-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#14b8a6',
      stallImage: getRandomStallImage(),
    },
    // === PRODUCTIVITY ===
    {
      id: 'todos',
      title: strings.dashboard?.cards?.todos?.title || 'Task Manager',
      subtitle: strings.dashboard?.cards?.todos?.subtitle || 'タスク管理',
      description: strings.dashboard?.cards?.todos?.description || 'Organize your study tasks and goals',
      href: '/todos',
      icon: '✅',
      stallType: 'utility',
      color: 'from-purple-400 to-indigo-600',
      glow: 'shadow-purple-500/50',
      doshiMood: 'thinking' as const,
      progress: 0,
      lanternColor: '#a855f7',
      stallImage: getRandomStallImage(),
    },
  ], [strings])

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 17) {
      setTimeOfDay('day')
    } else if (hour >= 17 && hour < 20) {
      setTimeOfDay('evening')
    } else {
      setTimeOfDay('night')
    }
  }, [])

  // Dynamic sky gradient based on time and theme
  const skyGradient = {
    day: resolvedTheme === 'dark'
      ? 'from-slate-800 via-slate-700 to-slate-600'
      : 'from-sky-200 via-sky-300 to-blue-400',
    evening: resolvedTheme === 'dark'
      ? 'from-indigo-900 via-purple-800 to-pink-700'
      : 'from-orange-300 via-pink-400 to-purple-500',
    night: resolvedTheme === 'dark'
      ? 'from-slate-900 via-indigo-900 to-purple-900'
      : 'from-indigo-700 via-purple-700 to-slate-800',
  }

  return (
    <div className="relative overflow-hidden">
      {/* Animation Control - Top Left Corner */}
      <div className="absolute top-4 left-4 z-50">
        <AnimationControl position="top-left" variant="glassmorphism" />
      </div>

      {/* Bottom glow effect */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-500/30 via-primary-400/10 to-transparent blur-xl pointer-events-none z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-primary-400/20 to-transparent blur-md pointer-events-none z-20" />

      {/* Floating lanterns distributed throughout the height */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Lanterns starting from different heights for continuous flow */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`distributed-lantern-${i}`}
            className="absolute text-3xl floating-element"
            initial={{
              bottom: `${(i * 25) % 100}%`,
              left: `${10 + (i * 11)}%`,
              opacity: 0,
              scale: 0.5,
            }}
            animate={animationsEnabled ? {
              bottom: [`${(i * 25) % 100}%`, `${((i * 25) % 100) + 120}%`],
              opacity: [0, 1, 1, 1, 0],
              scale: [0.5, 1, 1, 1, 0.8],
              x: [0, Math.sin(i) * 20, Math.sin(i) * -15, Math.sin(i) * 25],
            } : {
              bottom: `${(i * 25) % 100}%`,
              opacity: 0,
              scale: 0.5,
            }}
            transition={{
              duration: animationsEnabled ? (45 + (i * 2)) : 0,
              delay: animationsEnabled ? (i * 3) : 0,
              repeat: animationsEnabled ? Infinity : 0,
              ease: 'easeInOut',
            }}
            style={{
              filter: 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.5))',
            }}
          >
            🏮
          </motion.div>
        ))}

        {/* Additional lanterns from bottom for glow area effect */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={`bottom-glow-lantern-${i}`}
            className="absolute text-4xl floating-element"
            initial={{
              bottom: -50,
              left: `${30 + (i * 20)}%`,
              opacity: 0,
              scale: 0.3,
            }}
            animate={animationsEnabled ? {
              bottom: [-50, window.innerHeight * 1.2],
              opacity: [0, 0.8, 1, 0.9, 0],
              scale: [0.3, 1.2, 1, 1, 0.5],
              x: [0, Math.cos(i) * -20, Math.cos(i) * 30, Math.cos(i) * -25],
              rotate: [-10, 10, -5, 8, -10],
            } : {
              bottom: -50,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{
              duration: animationsEnabled ? (55 + (i * 3)) : 0,
              delay: animationsEnabled ? (i * 7 + 2) : 0,
              repeat: animationsEnabled ? Infinity : 0,
              ease: 'easeInOut',
            }}
            style={{
              filter: 'drop-shadow(0 0 15px rgba(251, 191, 36, 0.6))',
            }}
          >
            🏮
          </motion.div>
        ))}
      </div>

      {/* Animated sky background */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${skyGradient[timeOfDay]} transition-all duration-1000 rounded-2xl`}
      >
        {/* Stars for night time */}
        {timeOfDay === 'night' && (
          <div className="absolute inset-0">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 50}%`,
                }}
                animate={{
                  opacity: [0.2, 1, 0.2],
                }}
                transition={{
                  duration: 2 + Math.random() * 3,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating lanterns - moved to main container level */}
      <div className="absolute inset-0 h-full overflow-hidden pointer-events-none">
        {learningStalls.slice(0, 5).map((stall, i) => (
          <FloatingLantern
            key={`lantern-${i}`}
            delay={i * 4}
            color={stall.lanternColor}
          />
        ))}

        {/* Chinese lantern emojis of different sizes */}
        <ChineseLantern delay={0} size="small" />
        <ChineseLantern delay={3} size="large" />
        <ChineseLantern delay={6} size="medium" />
        <ChineseLantern delay={9} size="xlarge" />
        <ChineseLantern delay={12} size="small" />
        <ChineseLantern delay={15} size="medium" />
        <ChineseLantern delay={18} size="large" />
        <ChineseLantern delay={21} size="small" />
        <ChineseLantern delay={24} size="medium" />
        <ChineseLantern delay={27} size="xlarge" />
      </div>

      {/* Festival grounds */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Title section */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Main Title with Enhanced Typography */}
          <div className="mb-6">
            {/* Japanese Title */}
            <div className="relative mb-6">
              {/* Twinkling lights around the title */}
              <TwinklingLight delay={0} x="10%" y="20%" color="#fbbf24" />
              <TwinklingLight delay={0.3} x="15%" y="60%" color="#f59e0b" />
              <TwinklingLight delay={0.6} x="85%" y="25%" color="#fbbf24" />
              <TwinklingLight delay={0.9} x="90%" y="70%" color="#f59e0b" />
              <TwinklingLight delay={1.2} x="5%" y="40%" color="#fcd34d" />
              <TwinklingLight delay={1.5} x="95%" y="45%" color="#fcd34d" />
              <TwinklingLight delay={1.8} x="12%" y="80%" color="#fbbf24" />
              <TwinklingLight delay={2.1} x="88%" y="85%" color="#f59e0b" />
              <TwinklingLight delay={2.4} x="20%" y="15%" color="#fcd34d" />
              <TwinklingLight delay={2.7} x="80%" y="10%" color="#fbbf24" />
              <TwinklingLight delay={3.0} x="25%" y="90%" color="#f59e0b" />
              <TwinklingLight delay={3.3} x="75%" y="95%" color="#fcd34d" />

              <motion.div
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-2 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  type: "spring",
                  stiffness: 100
                }}
              >
                <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                  へようこそ
                </span>
              </motion.div>

              <motion.h2
                className="text-6xl md:text-7xl lg:text-8xl font-black mb-2 relative"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.2,
                  type: "spring",
                  stiffness: 100
                }}
              >
                <span className="relative inline-block">
                  {/* White stroke layer behind */}
                  <span className="absolute inset-0 text-white [-webkit-text-stroke:_0.25px_white]" aria-hidden="true">
                    学習村
                  </span>
                  {/* Gradient text on top */}
                  <motion.span
                    className="relative inline-block bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent animate-gradient bg-300%"
                    animate={{
                      backgroundPosition: ["0%", "100%", "0%"],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                    style={{
                      backgroundSize: "300%",
                    }}
                  >
                    学習村
                  </motion.span>
                </span>
              </motion.h2>
            </div>

            {/* English subtitle with typing effect - Outside the glow container */}
            <motion.div
              className="space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <motion.div
                className="text-lg md:text-xl text-gray-100 dark:text-gray-400 font-medium tracking-wide uppercase"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                {strings.dashboard?.villageHeader?.welcomeTo || 'Welcome to the'}
              </motion.div>
              <motion.div
                className="text-2xl md:text-3xl text-white dark:text-white font-bold uppercase tracking-wider"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: [0, 1, 1, 0, 1],
                  scale: [0.8, 1, 1, 1, 1]
                }}
                transition={{
                  duration: 1.5,
                  delay: 0.8,
                  times: [0, 0.2, 0.8, 0.9, 1]
                }}
              >
                {strings.dashboard?.villageHeader?.learningVillage || 'Learning Village'}
              </motion.div>
            </motion.div>
          </div>

          {/* Decorative divider */}
          <motion.div
            className="flex items-center justify-center gap-3 mb-4"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-primary-400" />
            <span className="text-2xl">🏮</span>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-primary-400" />
          </motion.div>

          {/* Description with fade-in words */}
          <motion.p
            className="hidden sm:block text-lg md:text-xl text-gray-100 dark:text-gray-300 font-light max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            {strings.dashboard?.learningVillage?.subtitle || 'Choose your path to Japanese mastery'}
          </motion.p>

          {/* Doshi guide - Hidden on mobile */}
          <motion.div
            className="hidden sm:inline-block mt-6"
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <DoshiMascot size="medium" variant="animated" />
            <motion.div
              className="mt-2 px-4 py-2 bg-white/90 dark:bg-dark-800/90 rounded-full shadow-lg"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {strings.dashboard?.learningVillage?.clickToStart || 'Click any stall to begin your journey!'}
              </p>
            </motion.div>
          </motion.div>
        </motion.div>


        {/* Stalls grid with masonry layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {learningStalls.map((stall, index) => (
            <StallCard key={stall.id} stall={stall} index={index} />
          ))}
        </div>

      </div>
    </div>
  )
}