'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'
import { useStallOrder } from '@/hooks/useStallOrder'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  return (
    <motion.div
      className="absolute pointer-events-none"
      initial={{ y: 100, opacity: 0 }}
      animate={{
        y: -800,
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: 20,
        delay,
        repeat: Infinity,
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

// Chinese lantern emoji component
function ChineseLantern({ delay = 0, size = 'medium' }) {
  const sizes = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-6xl',
    xlarge: 'text-8xl'
  }

  const duration = 25 + Math.random() * 10 // Varying speeds
  const horizontalDrift = Math.random() * 30 - 15 // Drift left or right

  return (
    <motion.div
      className={`absolute pointer-events-none ${sizes[size]}`}
      initial={{
        y: 800,
        x: 0,
        opacity: 0,
        rotate: -10
      }}
      animate={{
        y: -200,
        x: horizontalDrift,
        opacity: [0, 1, 1, 1, 0],
        rotate: 10
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
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

// Sortable stall card wrapper for edit mode
function SortableStallCard({ stall, index }: { stall: any, index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stall.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <StallCard stall={stall} index={index} isEditMode={true} dragListeners={listeners} />
    </div>
  )
}

// Stall card component
function StallCard({ stall, index, isEditMode, dragListeners }: { stall: any, index: number, isEditMode: boolean, dragListeners?: any }) {
  const [isHovered, setIsHovered] = useState(false)
  const { strings } = useI18n()
  const cardRef = useRef<HTMLDivElement>(null)

  const cardContent = (
    <div className={`
          relative overflow-hidden rounded-2xl
          bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm
          border-2 border-transparent hover:border-primary-400 dark:hover:border-primary-500
          shadow-xl hover:shadow-2xl ${stall.glow}
          transition-all duration-300 cursor-pointer
          group
        `}>
          {/* Animated gradient background */}
          <div className={`
            absolute inset-0 opacity-0 group-hover:opacity-100
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

          <Image
            src={stall.stallImage}
            alt="Stall Image"
            width={48}
            height={48}
            className="absolute top-2 right-2 opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          />

          {/* Content */}
          <div className="relative p-6 space-y-4">
            {/* Header with icon */}
            <div className="flex items-center gap-3">
              <span className="text-3xl filter drop-shadow-lg group-hover:animate-bounce">
                {stall.icon}
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-white transition-colors leading-tight">
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
                <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/90 transition-colors">
                  {stall.subtitle}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-white/90 transition-colors">
              {stall.description}
            </p>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 group-hover:text-white/80 transition-colors">
                  {strings.dashboard?.stats?.progress || 'Progress'}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-white transition-colors">
                  {stall.progress}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${stall.color} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${stall.progress}%` }}
                  transition={{ delay: index * 0.05 + 0.3, duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Hover indicator */}
            <motion.div
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              animate={{ x: isHovered ? [0, 5, 0] : 0 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <span className="text-white text-sm">→</span>
            </motion.div>

            {/* Drag Handle for Edit Mode */}
            {isEditMode && (
              <div
                className="absolute top-4 left-4 cursor-grab active:cursor-grabbing"
                {...dragListeners}
              >
                <div className="flex flex-col gap-1 p-2 bg-white/80 dark:bg-dark-700/80 rounded-lg shadow-md">
                  <span className="block w-4 h-0.5 bg-gray-400 dark:bg-gray-500"></span>
                  <span className="block w-4 h-0.5 bg-gray-400 dark:bg-gray-500"></span>
                  <span className="block w-4 h-0.5 bg-gray-400 dark:bg-gray-500"></span>
                </div>
              </div>
            )}
          </div>
        </div>
  )

  if (isEditMode) {
    return (
      <div
        ref={cardRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative cursor-move h-full"
      >
        {cardContent}
      </div>
    )
  }

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
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'evening' | 'night'>('day')
  const [activeId, setActiveId] = useState<string | null>(null)

  // Learning sections with festival stall themes - now with i18n
  const initialLearningStalls = useMemo(() => [
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
      id: 'kanji',
      title: strings.dashboard?.cards?.kanji?.title || 'Kanji',
      subtitle: strings.dashboard?.cards?.kanji?.subtitle || '漢字',
      description: strings.dashboard?.cards?.kanji?.description || 'Ancient Chinese characters',
      href: '/learn/kanji',
      icon: '🏯',
      stallType: 'temple',
      color: 'from-red-400 to-rose-600',
      glow: 'shadow-red-500/50',
      doshiMood: 'thinking' as const,
      progress: 0,
      lanternColor: '#ef4444',
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
      id: 'vocabulary',
      title: strings.dashboard?.cards?.vocabulary?.title || 'Vocabulary',
      subtitle: strings.dashboard?.cards?.vocabulary?.subtitle || '単語',
      description: strings.dashboard?.cards?.vocabulary?.description || 'Build your word power',
      href: '/learn/vocabulary',
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
      id: 'favourites',
      title: strings.dashboard?.cards?.favourites?.title || 'My Favourites',
      subtitle: strings.dashboard?.cards?.favourites?.subtitle || 'お気に入り',
      description: strings.dashboard?.cards?.favourites?.description || 'Your saved words and items',
      href: '/favourites',
      icon: '⭐',
      stallType: 'restaurant',
      color: 'from-amber-400 to-yellow-600',
      glow: 'shadow-amber-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#f59e0b',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'my-lists',
      title: strings.dashboard?.cards?.myLists?.title || 'My Lists',
      subtitle: strings.dashboard?.cards?.myLists?.subtitle || 'マイリスト',
      description: strings.dashboard?.cards?.myLists?.description || 'Manage your custom study lists',
      href: '/my-items',
      icon: '📋',
      stallType: 'library',
      color: 'from-teal-400 to-cyan-600',
      glow: 'shadow-teal-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#14b8a6',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'word-learning',
      title: strings.dashboard?.cards?.wordLearning?.title || 'Word Learning',
      subtitle: strings.dashboard?.cards?.wordLearning?.subtitle || '単語学習',
      description: strings.dashboard?.cards?.wordLearning?.description || 'Interactive multimodal vocabulary',
      href: '/tools/word-learning-session',
      icon: '🧠',
      stallType: 'theater',
      color: 'from-purple-400 to-pink-600',
      glow: 'shadow-purple-500/50',
      doshiMood: 'excited' as const,
      progress: 0,
      lanternColor: '#a855f7',
      stallImage: getRandomStallImage(),
    },
    {
      id: 'practice',
      title: strings.dashboard?.cards?.practice?.title || 'Practice',
      subtitle: strings.dashboard?.cards?.practice?.subtitle || '練習',
      description: strings.dashboard?.cards?.practice?.description || 'General practice mode',
      href: '/practice',
      icon: '📚',
      stallType: 'concert',
      color: 'from-pink-400 to-purple-600',
      glow: 'shadow-pink-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#ec4899',
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
    {
      id: 'youtube-series',
      title: strings.dashboard?.cards?.youtubeSeries?.title || 'YouTube Series',
      subtitle: strings.dashboard?.cards?.youtubeSeries?.subtitle || 'シリーズ',
      description: strings.dashboard?.cards?.youtubeSeries?.description || 'Track YouTube channels',
      href: '/tools/youtube-series',
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
      href: '/tools/my-videos',
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
      id: 'saved-items',
      title: strings.dashboard?.cards?.savedItems?.title || 'Saved Items',
      subtitle: strings.dashboard?.cards?.savedItems?.subtitle || '保存',
      description: strings.dashboard?.cards?.savedItems?.description || 'Your saved items',
      href: '/favourites',
      icon: '⭐',
      stallType: 'bookmark',
      color: 'from-blue-400 to-cyan-600',
      glow: 'shadow-blue-500/50',
      doshiMood: 'happy' as const,
      progress: 0,
      lanternColor: '#3b82f6',
      stallImage: getRandomStallImage(),
    },
  ], [strings])

  // Use the stall order hook
  const {
    stalls,
    isEditMode,
    isDirty,
    isSaving,
    lastSaved,
    canSync,
    handleReorder,
    toggleEditMode,
    resetToDefault
  } = useStallOrder(initialLearningStalls)

  // DnD Kit sensors for mouse, touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id && over) {
      const oldIndex = stalls.findIndex((s) => s.id === active.id)
      const newIndex = stalls.findIndex((s) => s.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newStalls = arrayMove(stalls, oldIndex, newIndex)
        handleReorder(newStalls)
      }
    }

    setActiveId(null)
  }

  const activeStall = activeId ? stalls.find(s => s.id === activeId) : null

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

        {/* Floating lanterns */}
        <div className="absolute inset-0 overflow-hidden">
          {stalls.slice(0, 5).map((stall, i) => (
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
                <motion.span
                  className="inline-block bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent animate-gradient bg-300%"
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
                    textShadow: "0 0 10px rgba(244, 63, 94, 0.2)"
                  }}
                >
                  学習村
                </motion.span>
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
                Welcome to the
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
                Learning Village
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
            className="text-lg md:text-xl text-gray-100 dark:text-gray-300 font-light max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            {strings.dashboard?.learningVillage?.subtitle || 'Choose your path to Japanese mastery'}
          </motion.p>

          {/* Doshi guide */}
          <motion.div
            className="inline-block mt-6"
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

        {/* Edit Mode Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleEditMode}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isEditMode
                  ? 'bg-primary-500 text-white shadow-lg'
                  : 'bg-white/70 dark:bg-dark-800/70 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-700'
              }`}
            >
              {isEditMode ? (
                <>
                  <span>✓</span>
                  <span className="hidden sm:inline ml-1">Done Editing</span>
                </>
              ) : (
                <>
                  <span>✏️</span>
                  <span className="hidden sm:inline ml-1">Edit Layout</span>
                </>
              )}
            </button>

            {isEditMode && (
              <>
                <button
                  onClick={resetToDefault}
                  className="px-4 py-2 rounded-lg font-medium bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 transition-all"
                >
                  ↺ Reset to Default
                </button>

                {canSync && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                      ☁️ Syncs to Cloud
                    </span>
                    <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded">
                      PREMIUM
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
              Saving...
            </div>
          )}

          {!isSaving && lastSaved && (
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Stalls grid with masonry layout */}
        {isEditMode ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/10 border-2 border-dashed border-yellow-300 dark:border-yellow-700 rounded-xl p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-4 text-center">
              🎯 Drag stalls by their handles to reorder - Changes save automatically
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={stalls.map(s => s.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {stalls.map((stall, index) => (
                    <SortableStallCard key={stall.id} stall={stall} index={index} />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeStall ? (
                  <div className="opacity-90">
                    <StallCard stall={activeStall} index={0} isEditMode={true} dragListeners={null} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {stalls.map((stall, index) => (
              <StallCard key={stall.id} stall={stall} index={index} isEditMode={isEditMode} dragListeners={null} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}