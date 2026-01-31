'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import Link from 'next/link'
import Masonry from 'react-masonry-css'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { isFeatureEnabled } from '@/lib/features/featureFlags'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useAnimationControl } from '@/components/ui/AnimationControl'
import AnimationControl from '@/components/ui/AnimationControl'
import Image from 'next/image'
import { useLearningVillageConfig } from '@/hooks/useLearningVillageConfig'
import {
  StallId,
  STALL_OFFLINE_SUPPORT,
  OfflineSupport,
  DistrictId,
  DEFAULT_DISTRICT_ORDER,
} from '@/config/learning-village-types'
import { ChevronDown, Wifi, WifiOff } from 'lucide-react'
import { ReactNode } from 'react'
import Tooltip from '@/components/ui/Tooltip'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

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

type OnboardingGoal = 'jlpt' | 'travel' | 'anime' | 'conversation'

const GOAL_TO_PRIORITY: Partial<Record<OnboardingGoal, DistrictId>> = {
  conversation: 'immersion',
  anime: 'immersion',
  travel: 'immersion',
  jlpt: 'study', // Changed from 'foundation' to make JLPT personalization visually distinct
}

function buildDistrictOrder(goal: OnboardingGoal | null): DistrictId[] {
  const priority = goal ? GOAL_TO_PRIORITY[goal] : null
  if (!priority) {
    return DEFAULT_DISTRICT_ORDER
  }

  // Move the priority district to the front, keep others in baseline order
  const rest = DEFAULT_DISTRICT_ORDER.filter(district => district !== priority)
  return [priority, ...rest]
}

// Floating lantern component
function FloatingLantern({ delay = 0, color = '#ef4444' }) {
  const animationsEnabled = useAnimationControl()

  return (
    <motion.div
      className="absolute pointer-events-none floating-element"
      initial={{ y: '120vh', opacity: 0 }}
      animate={
        animationsEnabled
          ? {
              y: '-20vh',
              opacity: [0, 1, 1, 0],
            }
          : { y: '120vh', opacity: 0 }
      }
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
      animate={
        animationsEnabled
          ? {
              opacity: [0, 1, 0.3, 1, 0],
              scale: [0, 1.2, 0.8, 1.5, 0],
            }
          : { opacity: 0, scale: 0 }
      }
      transition={{
        duration: animationsEnabled ? 2 + Math.random() * 2 : 0,
        delay: animationsEnabled ? delay + Math.random() * 0.5 : 0,
        repeat: animationsEnabled ? Infinity : 0,
        repeatDelay: animationsEnabled ? Math.random() * 3 : 0,
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
function ChineseLantern({
  delay = 0,
  size = 'medium',
}: {
  delay?: number
  size?: 'small' | 'medium' | 'large' | 'xlarge'
}) {
  const animationsEnabled = useAnimationControl()

  const sizes = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-6xl',
    xlarge: 'text-8xl',
  } as const

  const duration = 25 + Math.random() * 10 // Varying speeds
  const horizontalDrift = Math.random() * 30 - 15 // Drift left or right

  // Start from very bottom of the Learning Village (after all 5 rows)
  // Using vh units for better responsiveness
  const startY = '120vh' // Start 120% of viewport height (well below all content)
  const endY = '-20vh' // End above the viewport

  return (
    <motion.div
      className={`absolute pointer-events-none lantern-float ${sizes[size]}`}
      initial={{
        y: startY,
        x: 0,
        opacity: 0,
        rotate: -10,
      }}
      animate={
        animationsEnabled
          ? {
              y: endY,
              x: horizontalDrift,
              opacity: [0, 1, 1, 1, 0],
              rotate: 10,
            }
          : {
              y: startY,
              x: 0,
              opacity: 0,
              rotate: -10,
            }
      }
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
function StallCard({
  stall,
  index,
  isPopular,
  isOnline,
  lowPower,
}: {
  stall: any
  index: number
  isPopular: boolean
  isOnline: boolean
  lowPower: boolean
}) {
  const [isHovered, setIsHovered] = useState(false)
  const { strings } = useI18n()
  const cardRef = useRef<HTMLDivElement>(null)

  // Get offline support level for this stall
  const offlineSupport = STALL_OFFLINE_SUPPORT[stall.id] || 'partial'
  const showOfflineWarning = !isOnline && offlineSupport === 'none'

  // Determine variant for masonry variety
  // Popular stalls (from admin config) get featured styling
  // Compact IDs remain hardcoded for UI layout purposes
  const compactIds = ['drill', 'resources', 'todos', 'blog', 'my-lists', 'textbook-vocab']

  const isFeatured = isPopular
  const isCompact = compactIds.includes(stall.id)

  const heightClass = isFeatured ? 'min-h-[280px]' : isCompact ? 'min-h-[200px]' : 'min-h-[240px]'
  const spacingClass = isFeatured ? 'space-y-6' : isCompact ? 'space-y-2' : 'space-y-4'

  const cardContent = (
    <div
      className={`
          relative overflow-hidden rounded-2xl
          bg-white/5 dark:bg-dark-800/5 ${lowPower ? '' : 'backdrop-blur-md'}
          border border-white/40 dark:border-white/20
          hover:border-primary-400/80 dark:hover:border-primary-500/80
          ${lowPower ? '' : `shadow-xl hover:shadow-2xl ${stall.glow}`}
          transition-all duration-300 cursor-pointer
          group flex flex-col
          ${heightClass}
          before:absolute before:inset-0
          before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent
          before:pointer-events-none
          ${lowPower ? '' : 'after:absolute after:inset-0 after:shadow-inner after:rounded-2xl after:pointer-events-none'}
        `}
    >
      {/* Animated gradient background */}
      <div
        className={`
            absolute inset-0 opacity-0 group-hover:opacity-20
            bg-gradient-to-br ${stall.color}
            transition-opacity duration-500
          `}
      />

      {/* Lantern glow effect */}
      {!lowPower && (
        <div
          className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, ${stall.lanternColor}40 0%, transparent 70%)`,
            filter: `blur(20px)`,
          }}
        />
      )}

      {/* Content background for better readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-white/5 dark:from-black/20 dark:to-black/10 pointer-events-none" />

      {/* Content */}
      <div className={`relative px-4 py-6 sm:p-6 ${spacingClass} flex-1 flex flex-col`}>
        {/* Badge for featured items - Moved to bottom right to avoid overlap */}
        {isFeatured && (
          <div className="absolute bottom-3 right-3 px-2 py-1 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/10 z-10">
            <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
              Popular
            </span>
          </div>
        )}

        {/* Offline warning indicator - shown when offline and stall requires network */}
        {showOfflineWarning && (
          <div className="absolute top-3 right-3 p-1.5 bg-amber-500/80 dark:bg-amber-600/80 backdrop-blur-md rounded-full border border-amber-400/50 z-10">
            <WifiOff className="w-3 h-3 text-white" />
          </div>
        )}

        {/* NEW: Content Wrapper to add padding if featured */}
        <div className={`flex-1 flex flex-col ${isFeatured ? 'pb-10' : ''}`}>
          {/* Emoji icon and stall image in a single row with space between */}
          <div className="flex items-center justify-between mb-2">
            <span
              className={`${lowPower ? '' : 'filter drop-shadow-lg group-hover:animate-bounce'} flex-shrink-0 ${isFeatured ? 'text-xl sm:text-4xl' : 'text-lg sm:text-3xl'}`}
            >
              {stall.icon}
            </span>
            <Image
              src={stall.stallImage}
              alt="Stall Image"
              width={isFeatured ? 56 : 48}
              height={isFeatured ? 56 : 48}
              className="opacity-60 group-hover:opacity-80 transition-opacity duration-300 flex-shrink-0 w-8 h-8 sm:w-auto sm:h-auto"
            />
          </div>

          {/* Title */}
          <h3
            className={`font-bold text-gray-900 dark:text-white group-hover:text-white transition-colors leading-tight ${isFeatured ? 'text-xl' : 'text-lg'}`}
          >
            {/* Split title if it contains multiple words */}
            {stall.title.split(' ').length > 1 ? (
              <>
                {stall.title.split(' ').map((word: string, index: number) => (
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
          {!isCompact && (
            <p className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-white/90 transition-colors font-medium mt-1">
              {stall.subtitle}
            </p>
          )}

          {/* Description */}
          <p className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-white/90 transition-colors flex-1 mt-1">
            {stall.description}
          </p>
        </div>

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
      <Link href={stall.href}>{cardContent}</Link>
    </motion.div>
  )
}

// Mobile Stall Card Component (for vertical list view)
function MobileStallCard({
  stall,
  isPopular,
  isOnline,
  lowPower,
}: {
  stall: any
  isPopular: boolean
  isOnline: boolean
  lowPower: boolean
}) {
  const { strings } = useI18n()

  // Get offline support level for this stall
  const offlineSupport = STALL_OFFLINE_SUPPORT[stall.id] || 'partial'
  const showOfflineWarning = !isOnline && offlineSupport === 'none'

  return (
    <Link href={stall.href} className="block w-full group">
      {' '}
      {/* Added group for hover effects */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        className={`relative flex items-center p-3 sm:p-4 rounded-xl bg-white/10 dark:bg-dark-800/10 ${lowPower ? '' : 'backdrop-blur-md'}
                   border border-white/40 dark:border-white/20 hover:border-primary-400/80 dark:hover:border-primary-500/80
                   shadow-none ${lowPower ? '' : `group-hover:${stall.glow}`} transition-all duration-300 cursor-pointer h-20 sm:h-24 overflow-hidden
                   group-hover:scale-[1.01] gap-x-2`} // Added subtle lift on hover and glow effect, and gap-x-2
      >
        {/* Top-left curved white border accent */}
        <div
          className="absolute inset-0 rounded-xl border-2 border-white/30 pointer-events-none z-20"
          style={{
            maskImage: 'linear-gradient(135deg, black 0%, black 5%, transparent 15%)',
            WebkitMaskImage: 'linear-gradient(135deg, black 0%, black 5%, transparent 15%)',
          }}
        />

        {/* Bottom-right curved white border accent */}
        <div
          className="absolute inset-0 rounded-xl border-2 border-white/30 pointer-events-none z-20"
          style={{
            maskImage: 'linear-gradient(-45deg, black 0%, black 5%, transparent 15%)',
            WebkitMaskImage: 'linear-gradient(-45deg, black 0%, black 5%, transparent 15%)',
          }}
        />

        {/* Animated gradient background */}
        <div
          className={`
              absolute inset-0 opacity-20 group-hover:opacity-50
              bg-gradient-to-br ${stall.color}
              transition-opacity duration-500
            `}
        />

        {/* Offline warning indicator for mobile - top right */}
        {showOfflineWarning && (
          <div className="absolute top-1 right-1 p-1 bg-amber-500/80 rounded-full z-10">
            <WifiOff className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Content */}
        <div className="flex items-center space-x-3 sm:space-x-4 z-10 flex-1 min-w-0">
          {/* Emoji icon only on mobile, stall image hidden */}
          <div className="flex-shrink-0 relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
            <span className={`text-2xl sm:text-3xl ${lowPower ? '' : 'filter drop-shadow-lg group-hover:scale-110 group-hover:rotate-6'} transition-transform duration-200`}>
              {stall.icon}
            </span>
          </div>

          <div className="flex-grow min-w-0 overflow-hidden">
            <h3 className="font-bold text-gray-900 dark:text-white leading-tight text-base sm:text-lg truncate">
              {stall.title}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{stall.subtitle}</p>
          </div>
        </div>

        {/* Optional: Popular badge (smaller) */}
        {isPopular && (
          <div className="flex-shrink-0 px-2 py-0.5 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/10 ml-auto z-10">
            <span className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
              Pop
            </span>
          </div>
        )}

        {/* Arrow indicator */}
        <motion.div
          className="ml-2 sm:ml-4 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 z-10"
          initial={{ x: 0 }}
          whileHover={{ x: 5 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-xl sm:text-2xl">→</span>
        </motion.div>
      </motion.div>
    </Link>
  )
}

// Type helper for i18n cards with dynamic keys
type CardStrings =
  | Record<string, { title?: string; subtitle?: string; description?: string }>
  | undefined

interface WelcomeData {
  userName: string
  level: number
  totalXP: number
  streak: number
  streakWarning: string | null
  isActiveToday: boolean
  gamificationEnabled: boolean
  minXPForStreak?: number
}

interface LearningVillageProps {
  welcomeCard?: ReactNode
  welcomeData?: WelcomeData
}

export default function LearningVillage({ welcomeCard, welcomeData }: LearningVillageProps = {}) {
  const { resolvedTheme } = useTheme()
  const { strings } = useI18n()
  const { getLocalePath } = useLocalePath()
  const animationsEnabled = useAnimationControl()
  const lowPower = !animationsEnabled
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'evening' | 'night'>('day')
  const [districtOrder, setDistrictOrder] = useState<DistrictId[]>(DEFAULT_DISTRICT_ORDER)

  // Auto-collapse timers for each district (1 minute = 60000ms)
  const autoCollapseTimers = useRef<Map<DistrictId, NodeJS.Timeout>>(new Map())
  const AUTO_COLLAPSE_DELAY = 60000 // 1 minute

  // Collapsed sections state for mobile (only applies to mobile view)
  // Default: ALL COLLAPSED (all category keys in the Set)
  const [collapsedSections, setCollapsedSections] = useState<Set<DistrictId>>(() => {
    // Load from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('learningVillageCollapsedSections')
      if (saved) {
        try {
          return new Set(JSON.parse(saved) as DistrictId[])
        } catch {
          // If parsing fails, default to all collapsed
          return new Set(DEFAULT_DISTRICT_ORDER)
        }
      }
    }
    // Default: all sections collapsed
    return new Set(DEFAULT_DISTRICT_ORDER)
  })

  // Learning Village configuration from Firestore (real-time updates)
  const {
    config,
    isPopular,
    getStallOrder,
    isStallEnabled,
    loading: configLoading,
    isOffline: configIsOffline,
  } = useLearningVillageConfig()

  // Personalize district order based on onboarding goal; persist per-user
  useEffect(() => {
    let isCancelled = false

    async function loadDistrictOrder() {
      try {
        let userOrder: DistrictId[] | null = null

        // Try to load any saved layout first
        try {
          const layoutRes = await fetch('/api/user/village-layout', { cache: 'no-store' })
          if (layoutRes.ok) {
            const layoutData = await layoutRes.json()
            const maybeOrder = layoutData?.data?.districtOrder as DistrictId[] | undefined
            if (Array.isArray(maybeOrder) && maybeOrder.length > 0) {
              const sanitized = maybeOrder.filter((district): district is DistrictId =>
                (DEFAULT_DISTRICT_ORDER as readonly DistrictId[]).includes(district)
              )
              if (sanitized.length > 0) {
                const unique = Array.from(new Set(sanitized)) as DistrictId[]
                const completedOrder: DistrictId[] = [
                  ...unique,
                  ...DEFAULT_DISTRICT_ORDER.filter(d => !unique.includes(d)),
                ]
                userOrder = completedOrder
              }
            }
          }
        } catch (err) {
          console.error('[LearningVillage] Failed to load saved district order', err)
        }

        let onboardingGoal: OnboardingGoal | null = null

        // Only fetch onboarding if we need to derive a new order
        if (!userOrder) {
          try {
            const onboardingRes = await fetch('/api/user/onboarding', { cache: 'no-store' })
            if (onboardingRes.ok) {
              const onboardingData = await onboardingRes.json()
              onboardingGoal = (onboardingData?.data?.learningGoal as OnboardingGoal | undefined) ?? null
            }
          } catch (err) {
            console.error('[LearningVillage] Failed to load onboarding data for personalization', err)
          }
        }

        const nextOrder =
          userOrder && userOrder.length > 0 ? userOrder : buildDistrictOrder(onboardingGoal)

        if (!isCancelled) {
          setDistrictOrder(nextOrder)
        }

        // Persist derived order when none existed yet
        if (!userOrder) {
          try {
            await fetch('/api/user/village-layout', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ districtOrder: nextOrder }),
            })
          } catch (err) {
            console.error('[LearningVillage] Failed to persist district order', err)
          }
        }
      } catch (err) {
        console.error('[LearningVillage] Unexpected error determining district order', err)
      }
    }

    loadDistrictOrder()
    return () => {
      isCancelled = true
    }
  }, [])

  // Track online/offline status for showing offline indicators
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine)

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Cast cards to allow dynamic key access with fallbacks
  const cards = strings.dashboard?.cards as CardStrings

  // Learning sections with festival stall themes - now with i18n
  // Reordered in a logical progression for learners
  const learningStalls = useMemo(
    () => [
      // === FOUNDATION (Basics) ===
      {
        id: 'hiragana',
        title: strings.dashboard?.cards?.hiragana?.title || 'Hiragana',
        subtitle: strings.dashboard?.cards?.hiragana?.subtitle || 'ひらがな',
        description: strings.dashboard?.cards?.hiragana?.description || 'Master the flowing script',
        href: getLocalePath('/learn/hiragana'),
        icon: (
          <Image
            src="/ui/flat-icons/village/hiragana.svg"
            alt="Hiragana"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
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
        description:
          strings.dashboard?.cards?.katakana?.description || 'Sharp and angular characters',
        href: getLocalePath('/learn/katakana'),
        icon: (
          <Image
            src="/ui/flat-icons/village/katakana.svg"
            alt="Katakana"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
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
        href: getLocalePath('/drill'),
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
        href: getLocalePath('/vocabulary'),
        icon: (
          <Image
            src="/ui/flat-icons/village/dictionary.svg"
            alt="Vocabulary"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
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
        href: getLocalePath('/lists'),
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
        title: cards?.kanjiBrowser?.title || 'Kanji Browser',
        subtitle: cards?.kanjiBrowser?.subtitle || '漢字辞典',
        description: cards?.kanjiBrowser?.description || 'Browse all JLPT kanji levels',
        href: getLocalePath('/kanji-browser'),
        icon: (
          <Image
            src="/ui/flat-icons/village/kanji.svg"
            alt="Kanji Browser"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
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
        title: cards?.kanjiMastery?.title || 'Kanji Mastery',
        subtitle: cards?.kanjiMastery?.subtitle || '漢字習得',
        description: cards?.kanjiMastery?.description || 'Master kanji with SRS',
        href: getLocalePath('/tools/kanji-mastery'),
        icon: (
          <Image
            src="/ui/flat-icons/village/mastery.svg"
            alt="Kanji Mastery"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
        stallType: 'bridge',
        color: 'from-teal-400 to-cyan-600',
        glow: 'shadow-teal-500/50',
        doshiMood: 'excited' as const,
        progress: 0,
        lanternColor: '#14b8a6',
        stallImage: getRandomStallImage(),
      },
      {
        id: 'blast-mode',
        title: cards?.blastMode?.title || 'Blast Mode',
        subtitle: cards?.blastMode?.subtitle || 'ブラス ト',
        description: cards?.blastMode?.description || 'Fast, no-typing mixed drills',
        href: getLocalePath('/tools/blast-mode'),
        icon: (
          <Image
            src="/ui/flat-icons/village/blast.svg"
            alt="Blast Mode"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
        stallType: 'bridge',
        color: 'from-amber-400 to-orange-600',
        glow: 'shadow-amber-500/50',
        doshiMood: 'excited' as const,
        progress: 0,
        lanternColor: '#f59e0b',
        stallImage: getRandomStallImage(),
      },
      {
        id: 'kanji-connections',
        title: cards?.kanjiConnections?.title || 'Kanji Connections',
        subtitle: cards?.kanjiConnections?.subtitle || '漢字関連',
        description:
          cards?.kanjiConnections?.description || 'Premium: Families, Radicals & Patterns',
        href: getLocalePath('/kanji-connection'),
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
        title: cards?.moodBoards?.title || 'Mood Boards',
        subtitle: cards?.moodBoards?.subtitle || 'ムード',
        description: cards?.moodBoards?.description || 'Learn kanji by themes',
        href: getLocalePath('/kanji-moods'),
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
        title: cards?.conjugation?.title || 'Conjugation',
        subtitle: cards?.conjugation?.subtitle || '活用',
        description: cards?.conjugation?.description || 'Practice verb conjugations',
        href: getLocalePath('/learn/conjugation'),
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
        title: cards?.textbookVocab?.title || 'Textbook Vocab',
        subtitle: cards?.textbookVocab?.subtitle || '教科書',
        description: cards?.textbookVocab?.description || 'Study textbook vocabulary',
        href: getLocalePath('/textbook-vocabulary'),
        icon: (
          <Image
            src="/ui/flat-icons/village/book.svg"
            alt="Textbook Vocab"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
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
        title: cards?.stories?.title || 'Stories',
        subtitle: cards?.stories?.subtitle || '物語',
        description: cards?.stories?.description || 'AI-generated stories',
        href: getLocalePath('/stories'),
        icon: (
          <Image
            src="/ui/flat-icons/village/stories.svg"
            alt="Stories"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
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
        href: getLocalePath('/news'),
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
        href: getLocalePath('/library'),
        icon: (
          <Image
            src="/ui/flat-icons/village/library.svg"
            alt="Library"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
        stallType: 'scroll',
        color: 'from-amber-400 to-orange-600',
        glow: 'shadow-amber-500/50',
        doshiMood: 'reading' as const,
        progress: 0,
        lanternColor: '#f59e0b',
        stallImage: getRandomStallImage(),
      },
      {
        id: 'comics',
        title: strings.dashboard?.cards?.comics?.title || 'Moshi Comics',
        subtitle: strings.dashboard?.cards?.comics?.subtitle || 'もしの漫画',
        description: strings.dashboard?.cards?.comics?.description || 'Moshi Goes to Japan',
        href: getLocalePath('/comics'),
        icon: (
          <span className="inline-block scale-[0.35] sm:scale-100 origin-center">
            <DoshiMascot size="medium" variant={lowPower ? 'static' : 'animated'} />
          </span>
        ),
        stallType: 'stage',
        color: 'from-rose-400 to-orange-500',
        glow: 'shadow-rose-500/50',
        doshiMood: 'excited' as const,
        progress: 0,
        lanternColor: '#f97316',
        stallImage: getRandomStallImage(),
      },
      {
        id: 'youtube-shadowing',
        title: cards?.youtubeShadowing?.title || 'MoshiPlayer',
        subtitle: cards?.youtubeShadowing?.subtitle || 'YouTube',
        description: cards?.youtubeShadowing?.description || 'Practice with YouTube',
        href: getLocalePath('/youtube-shadowing'),
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
        title: cards?.popularVideos?.title || 'Trending Videos',
        subtitle: cards?.popularVideos?.subtitle || '人気動画',
        description: cards?.popularVideos?.description || 'Most watched by the community',
        href: getLocalePath('/popular-videos'),
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
        description:
          strings.dashboard?.cards?.youtubeSeries?.description || 'Track YouTube channels',
        href: getLocalePath('/youtube-series'),
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
        href: getLocalePath('/my-videos'),
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
        description:
          strings.dashboard?.cards?.flashcards?.description || 'Create and study flashcard decks',
        href: getLocalePath('/flashcards'),
        icon: (
          <Image
            src="/ui/flat-icons/village/flash-cards.svg"
            alt="Flashcards"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
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
        href: getLocalePath('/games'),
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
        title: cards?.reviewHub?.title || 'Review Hub',
        subtitle: cards?.reviewHub?.subtitle || 'レビュー',
        description: cards?.reviewHub?.description || 'Unified review system',
        href: getLocalePath('/review-dashboard'),
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
        href: getLocalePath('/achievements'),
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
        title:
          (strings as Record<string, { title?: string; subtitle?: string; description?: string }>)
            .leaderboard?.title || 'Leaderboard',
        subtitle:
          (strings as Record<string, { title?: string; subtitle?: string; description?: string }>)
            .leaderboard?.subtitle || 'ランキング',
        description:
          (strings as Record<string, { title?: string; subtitle?: string; description?: string }>)
            .leaderboard?.description || 'Compete with other learners',
        href: getLocalePath('/leaderboard'),
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
        href: getLocalePath('/resources'),
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
        id: 'grammar',
        title: strings.dashboard?.cards?.grammar?.title || 'Grammar',
        subtitle: strings.dashboard?.cards?.grammar?.subtitle || '文法',
        description:
          strings.dashboard?.cards?.grammar?.description || 'Browse N5 and N4 grammar points',
        href: getLocalePath('/learn/grammar'),
        icon: (
          <Image
            src="/ui/flat-icons/village/grammar.svg"
            alt="Grammar"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
          />
        ),
        stallType: 'scroll',
        color: 'from-sky-400 to-blue-600',
        glow: 'shadow-sky-500/50',
        doshiMood: 'thinking' as const,
        progress: 0,
        lanternColor: '#0ea5e9',
        stallImage: getRandomStallImage(),
      },
      {
        id: 'blog',
        title: strings.dashboard?.cards?.blog?.title || 'Blog',
        subtitle: strings.dashboard?.cards?.blog?.subtitle || 'ブログ',
        description: strings.dashboard?.cards?.blog?.description || 'Read articles and updates',
        href: getLocalePath('/blog'),
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
        description:
          strings.dashboard?.cards?.todos?.description || 'Organize your study tasks and goals',
        href: getLocalePath('/todos'),
        icon: '✅',
        stallType: 'utility',
        color: 'from-purple-400 to-indigo-600',
        glow: 'shadow-purple-500/50',
        doshiMood: 'thinking' as const,
        progress: 0,
        lanternColor: '#a855f7',
        stallImage: getRandomStallImage(),
      },
      // === COMMUNITY ===
      {
        id: 'qa',
        title: strings.dashboard?.cards?.qa?.title || 'Tea House',
        subtitle: strings.dashboard?.cards?.qa?.subtitle || '茶屋',
        description:
          strings.dashboard?.cards?.qa?.description || 'Share wisdom, ask questions, help others',
        href: getLocalePath('/village/tea-house'),
        icon: '🍵',
        stallType: 'community',
        color: 'from-green-400 to-teal-600',
        glow: 'shadow-green-500/50',
        doshiMood: 'happy' as const,
        progress: 0,
        lanternColor: '#10b981',
        stallImage: getRandomStallImage(),
      },
    ],
    [strings]
  )

  // Feature flags from environment variables (inlined at build time by Next.js)
  // Features are DISABLED by default unless explicitly set to 'true'
  const featureFlags = useMemo(
    () => ({
      games: process.env.NEXT_PUBLIC_FEATURE_GAMES === 'true',
      'review-hub': process.env.NEXT_PUBLIC_FEATURE_REVIEW_HUB === 'true',
      achievements: process.env.NEXT_PUBLIC_FEATURE_ACHIEVEMENTS === 'true',
      leaderboard: process.env.NEXT_PUBLIC_FEATURE_LEADERBOARD === 'true',
      todos: process.env.NEXT_PUBLIC_FEATURE_TODOS === 'true',
      qa: process.env.NEXT_PUBLIC_FEATURE_QA === 'true',
      'blast-mode': true,
    }),
    []
  )

  const filteredStalls = useMemo(() => {
    return (
      learningStalls
        .filter(stall => {
          // Feature flag checks (from env vars) - these take absolute precedence
          const stallId = stall.id as keyof typeof featureFlags
          if (stallId in featureFlags && !featureFlags[stallId]) {
            return false
          }
          // Admin config enabled check (from Firestore)
          if (!isStallEnabled(stall.id as StallId)) {
            return false
          }
          return true
        })
        // Sort by admin-configured order
        .sort((a, b) => getStallOrder(a.id as StallId) - getStallOrder(b.id as StallId))
    )
  }, [learningStalls, featureFlags, config.stalls, isStallEnabled, getStallOrder])

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

  // Save collapsed sections to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'learningVillageCollapsedSections',
        JSON.stringify(Array.from(collapsedSections))
      )
    }
  }, [collapsedSections])

  // Toggle section collapse (mobile only) with auto-collapse after 1 minute
  const toggleSection = (sectionKey: DistrictId) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionKey)) {
        // Opening the section
        next.delete(sectionKey)

        // Clear any existing timer for this section
        const existingTimer = autoCollapseTimers.current.get(sectionKey)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        // Set auto-collapse timer
        const timer = setTimeout(() => {
          setCollapsedSections(current => {
            const updated = new Set(current)
            updated.add(sectionKey)
            return updated
          })
          autoCollapseTimers.current.delete(sectionKey)
        }, AUTO_COLLAPSE_DELAY)

        autoCollapseTimers.current.set(sectionKey, timer)
      } else {
        // Closing the section manually - clear timer
        next.add(sectionKey)
        const existingTimer = autoCollapseTimers.current.get(sectionKey)
        if (existingTimer) {
          clearTimeout(existingTimer)
          autoCollapseTimers.current.delete(sectionKey)
        }
      }
      return next
    })
  }

  // Cleanup auto-collapse timers on unmount
  useEffect(() => {
    return () => {
      autoCollapseTimers.current.forEach(timer => clearTimeout(timer))
      autoCollapseTimers.current.clear()
    }
  }, [])

  // Define categories and their info for grouping
  const stallCategories = useMemo<Record<DistrictId, StallId[]>>(
    () => ({
      foundation: [
        'hiragana',
        'katakana',
        'kanji-browser',
        'kanji-mastery',
        'blast-mode',
        'kanji-connections',
        'conjugation',
      ] as StallId[],
      study: ['vocabulary', 'my-lists', 'textbook-vocab', 'flashcards', 'mood-boards', 'drill'] as StallId[],
      immersion: [
        'stories',
        'news',
        'library',
        'comics',
        'youtube-shadowing',
        'popular-videos',
        'youtube-series',
        'my-videos',
      ] as StallId[],
      play: ['games', 'review-hub'] as StallId[],
      community: [
        'grammar',
        'achievements',
        'leaderboard',
        'resources',
        'blog',
        'todos',
        'qa',
      ] as StallId[],
    }),
    []
  )

  const categoryInfo = useMemo<Record<DistrictId, { title: string; icon: string }>>(
    () => ({
      foundation: {
        title: (strings.dashboard as any)?.districts?.foundation || "Beginner's Plaza",
        icon: '⛩️',
      },
      study: {
        title: (strings.dashboard as any)?.districts?.study || 'Study Center',
        icon: '📚',
      },
      immersion: {
        title: (strings.dashboard as any)?.districts?.immersion || 'Immersion Alley',
        icon: '🏮',
      },
      play: {
        title: (strings.dashboard as any)?.districts?.play || 'Entertainment District',
        icon: '🎮',
      },
      community: {
        title: (strings.dashboard as any)?.districts?.community || 'Town Hall',
        icon: '🏯',
      },
    }),
    [strings]
  )

  const districtEntries = useMemo(
    () => districtOrder.map(district => [district, stallCategories[district]] as const),
    [districtOrder, stallCategories]
  )

  // Dynamic sky gradient based on time and theme
  const skyGradient = {
    day:
      resolvedTheme === 'dark'
        ? 'from-slate-800 via-slate-700 to-slate-600'
        : 'from-sky-200 via-sky-300 to-blue-400',
    evening:
      resolvedTheme === 'dark'
        ? 'from-indigo-900 via-purple-800 to-pink-700'
        : 'from-orange-300 via-pink-400 to-purple-500',
    night:
      resolvedTheme === 'dark'
        ? 'from-slate-900 via-indigo-900 to-purple-900'
        : 'from-indigo-700 via-purple-700 to-slate-800',
  }

  return (
    <MotionConfig reducedMotion={animationsEnabled ? 'never' : 'always'}>
      <div className="relative overflow-hidden rounded-none sm:rounded-2xl">
      {/* Animation Control - Top Left Corner */}
      <div className="absolute top-4 left-4 z-50">
        <AnimationControl position="top-left" variant="glassmorphism" />
      </div>
      {!animationsEnabled && (
        <div className="absolute top-4 left-[88px] z-50">
          <div className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-black/60 text-white border border-white/20">
            Low Power Mode
          </div>
        </div>
      )}

      {/* Bottom glow effect */}
      {!lowPower && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-500/30 via-primary-400/10 to-transparent blur-xl pointer-events-none z-20" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-primary-400/20 to-transparent blur-md pointer-events-none z-20" />
        </>
      )}

      {/* Floating lanterns distributed throughout the height */}
      {animationsEnabled && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Lanterns starting from different heights for continuous flow */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`distributed-lantern-${i}`}
              className="absolute text-3xl floating-element"
              initial={{
                bottom: `${(i * 25) % 100}%`,
                left: `${10 + i * 11}%`,
                opacity: 0,
                scale: 0.5,
              }}
              animate={{
                bottom: [`${(i * 25) % 100}%`, `${((i * 25) % 100) + 120}%`],
                opacity: [0, 1, 1, 1, 0],
                scale: [0.5, 1, 1, 1, 0.8],
                x: [0, Math.sin(i) * 20, Math.sin(i) * -15, Math.sin(i) * 25],
              }}
              transition={{
                duration: 45 + i * 2,
                delay: i * 3,
                repeat: Infinity,
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
                left: `${30 + i * 20}%`,
                opacity: 0,
                scale: 0.3,
              }}
              animate={{
                bottom: [-50, window.innerHeight * 1.2],
                opacity: [0, 0.8, 1, 0.9, 0],
                scale: [0.3, 1.2, 1, 1, 0.5],
                x: [0, Math.cos(i) * -20, Math.cos(i) * 30, Math.cos(i) * -25],
                rotate: [-10, 10, -5, 8, -10],
              }}
              transition={{
                duration: 55 + i * 3,
                delay: i * 7 + 2,
                repeat: Infinity,
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
      )}

      {/* Animated sky background */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${skyGradient[timeOfDay]} transition-all duration-1000 rounded-none sm:rounded-2xl`}
      >
        {/* Stars for night time */}
        {timeOfDay === 'night' && animationsEnabled && (
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
      {animationsEnabled && (
        <div className="absolute inset-0 h-full overflow-hidden pointer-events-none">
          {filteredStalls.slice(0, 5).map((stall, i) => (
            <FloatingLantern key={`lantern-${i}`} delay={i * 4} color={stall.lanternColor} />
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
      )}

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
              {animationsEnabled && (
                <>
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
                </>
              )}

              {/* Doshi above welcome text */}
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <DoshiMascot size="medium" variant={lowPower ? 'static' : 'animated'} />
              </motion.div>

              <motion.div
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-2 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  type: 'spring',
                  stiffness: 100,
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
                  type: 'spring',
                  stiffness: 100,
                }}
              >
                <span className="relative inline-block">
                  {/* White stroke layer behind */}
                  <span
                    className="absolute inset-0 text-white [-webkit-text-stroke:_0.25px_white]"
                    aria-hidden="true"
                  >
                    学習村
                  </span>
                  {/* Gradient text on top */}
                  {animationsEnabled ? (
                    <motion.span
                      className="relative inline-block bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent animate-gradient bg-300%"
                      animate={{
                        backgroundPosition: ['0%', '100%', '0%'],
                      }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      style={{
                        backgroundSize: '300%',
                      }}
                    >
                      学習村
                    </motion.span>
                  ) : (
                    <span className="relative inline-block bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent bg-300%">
                      学習村
                    </span>
                  )}
                </span>
              </motion.h2>
            </div>

            {/* Username + san */}
            {welcomeData && (
              <motion.div
                className="text-2xl md:text-3xl text-white font-bold mt-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                {welcomeData.userName}
                <span className="font-normal text-gray-200"> さん</span>
              </motion.div>
            )}

            {/* English subtitle - Welcome to the Learning Village */}
            <motion.div
              className="space-y-1 mt-4"
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
                  scale: [0.8, 1, 1, 1, 1],
                }}
                transition={{
                  duration: 1.5,
                  delay: 0.8,
                  times: [0, 0.2, 0.8, 0.9, 1],
                }}
              >
                {strings.dashboard?.villageHeader?.learningVillage || 'Learning Village'}
              </motion.div>
            </motion.div>
          </div>

          {/* Level + XP + Streak Stats */}
          {welcomeData?.gamificationEnabled && (
            <motion.div
              className="flex flex-col items-center gap-3 mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              {/* Level and XP row */}
              <div className="flex items-center justify-center gap-3">
                {/* Level */}
                <Tooltip
                  content={
                    <div className="max-w-[200px] p-1">
                      <div className="font-semibold mb-1">
                        {(strings.dashboard as any)?.stats?.levelTooltip?.title || 'Your Level'}
                      </div>
                      <div className="text-xs opacity-90">
                        {(strings.dashboard as any)?.stats?.levelTooltip?.description || 'Level up by earning XP. Each level requires 100 XP.'}
                      </div>
                    </div>
                  }
                  position="bottom"
                >
                  <div className="flex items-center justify-center gap-2 w-24 py-2 rounded-xl bg-violet-500/80 text-white font-semibold text-sm shadow-lg cursor-help">
                    <span className="text-base">🏆</span>
                    <span>Lv.{welcomeData.level}</span>
                  </div>
                </Tooltip>

                {/* XP */}
                <Tooltip
                  content={
                    <div className="max-w-[220px] p-1">
                      <div className="font-semibold mb-1">
                        {(strings.dashboard as any)?.stats?.xpTooltip?.title || 'Experience Points (XP)'}
                      </div>
                      <div className="text-xs opacity-90 mb-2">
                        {((strings.dashboard as any)?.stats?.xpTooltip?.streakRequirement || 'Earn {minXP} XP daily to maintain your streak!').replace('{minXP}', String(welcomeData.minXPForStreak || 150))}
                      </div>
                      <div className="text-xs font-medium mb-1">
                        {(strings.dashboard as any)?.stats?.xpTooltip?.howToEarn || 'How to earn XP:'}
                      </div>
                      <ul className="text-xs opacity-90 space-y-0.5">
                        {((strings.dashboard as any)?.stats?.xpTooltip?.activities || [
                          'Complete drills and flashcard sessions',
                          'Practice kanji mastery exercises',
                          'Watch YouTube shadowing videos',
                          'Read stories or comics',
                          'Accuracy and speed bonuses apply',
                        ]).map((activity: string, idx: number) => (
                          <li key={idx}>• {activity}</li>
                        ))}
                      </ul>
                    </div>
                  }
                  position="bottom"
                >
                  <div className="flex items-center justify-center gap-2 w-24 py-2 rounded-xl bg-amber-500/80 text-white font-semibold text-sm shadow-lg cursor-help">
                    <span className="text-base">⚡</span>
                    <span>{welcomeData.totalXP.toLocaleString()}</span>
                  </div>
                </Tooltip>
              </div>

              {/* Streak - own row on mobile */}
              {welcomeData.streak > 0 && (
                <Tooltip
                  content={
                    <div className="max-w-[220px] p-1">
                      <div className="font-semibold mb-1">
                        {(strings.dashboard as any)?.stats?.streakTooltip?.title || 'Daily Streak'}
                      </div>
                      <div className="text-xs opacity-90">
                        {welcomeData.isActiveToday
                          ? ((strings.dashboard as any)?.stats?.streakTooltip?.activeToday || "You've met today's goal!")
                          : ((strings.dashboard as any)?.stats?.streakTooltip?.description || 'Keep learning daily to maintain your streak! Earn {minXP} XP each day.').replace('{minXP}', String(welcomeData.minXPForStreak || 150))}
                      </div>
                    </div>
                  }
                  position="bottom"
                >
                  <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-500/80 text-white font-semibold text-sm shadow-lg relative cursor-help">
                    <span className="text-base">🔥</span>
                    <span>{((strings.dashboard as any)?.stats?.gamification?.streak?.current || '{{count}} day streak').replace('{{count}}', String(welcomeData.streak))}</span>
                    {welcomeData.isActiveToday && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white shadow-sm" />
                    )}
                  </div>
                </Tooltip>
              )}
            </motion.div>
          )}

          {/* Streak Warning */}
          {welcomeData?.streakWarning && (
            <motion.div
              className="flex items-center justify-center gap-2 mt-3 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 text-sm font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
            >
              <span>⏰</span>
              <span>Streak expires in {welcomeData.streakWarning}!</span>
            </motion.div>
          )}

          {/* Decorative divider */}
          <motion.div
            className="flex items-center justify-center gap-3 my-6"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-primary-400" />
            <span className="text-2xl">🏮</span>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-primary-400" />
          </motion.div>
        </motion.div>

        {/* Mobile View: Vertical List with Virtual Areas */}
        <div className="sm:hidden space-y-8 px-2 pb-12">
          {districtEntries.map(([catKey, stallIds]) => {
            // Filter stalls that belong to this category AND are currently enabled/visible
            const categoryStalls = filteredStalls.filter(s => stallIds.includes(s.id as StallId))
            const orderedStalls = [...categoryStalls].sort(
              (a, b) =>
                stallIds.indexOf(a.id as StallId) - stallIds.indexOf(b.id as StallId)
            )

            // Don't render empty sections
            if (categoryStalls.length === 0) return null

            const info = categoryInfo[catKey as keyof typeof categoryInfo]
            const isCollapsed = collapsedSections.has(catKey)

            return (
              <div key={catKey} className="space-y-3">
                {/* Area Title - Now clickable with chevron */}
                <motion.div
                  className="flex items-center gap-2 px-1 pb-1 cursor-pointer active:scale-[0.98] transition-transform"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  onClick={() => toggleSection(catKey)}
                >
                  <span className="text-xl">{info.icon}</span>
                  <h3 className="text-lg font-bold text-white/90 tracking-wide uppercase text-shadow-sm">
                    {info.title}
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/30 to-transparent ml-2" />
                  {/* Chevron indicator */}
                  <motion.div
                    initial={false}
                    animate={{ rotate: isCollapsed ? -90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="w-5 h-5 text-white/70" />
                  </motion.div>
                </motion.div>

                {/* Stalls in this area - with collapse animation */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="space-y-3 overflow-hidden"
                    >
                      {orderedStalls.map((stall, index) => (
                        <MobileStallCard
                          key={stall.id}
                          stall={stall}
                          isPopular={isPopular(stall.id as StallId)}
                          isOnline={isOnline}
                          lowPower={lowPower}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Desktop View: Masonry with Categories */}
        <div className="hidden sm:block w-full space-y-12">
          {districtEntries.map(([catKey, stallIds]) => {
            // Filter stalls that belong to this category AND are currently enabled/visible
            const categoryStalls = filteredStalls.filter(s => stallIds.includes(s.id as StallId))
            const orderedStalls = [...categoryStalls].sort(
              (a, b) =>
                stallIds.indexOf(a.id as StallId) - stallIds.indexOf(b.id as StallId)
            )

            // Don't render empty sections
            if (categoryStalls.length === 0) return null

            const info = categoryInfo[catKey as keyof typeof categoryInfo]

            return (
              <div key={catKey} className="space-y-6">
                {/* Category Header */}
                <motion.div
                  className="flex items-center gap-4 px-2"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6 }}
                >
                  <div className={`p-3 rounded-xl bg-white/10 border border-white/20 ${lowPower ? '' : 'backdrop-blur-md shadow-lg'}`}>
                    <span className={`text-3xl ${lowPower ? '' : 'filter drop-shadow-lg'}`}>{info.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white tracking-wide uppercase text-shadow-lg">
                      {info.title}
                    </h3>
                    <div className="h-px w-full bg-gradient-to-r from-white/40 via-white/10 to-transparent mt-2" />
                  </div>
                </motion.div>

                {/* Masonry Grid for this category */}
                <Masonry
                  breakpointCols={{
                    default: 5,
                    1280: 5, // xl
                    1024: 4, // lg
                    768: 3, // md
                    640: 2, // sm
                  }}
                  className="flex -ml-3 sm:-ml-6 w-auto"
                  columnClassName="pl-3 sm:pl-6 bg-clip-padding"
                >
                  {orderedStalls.map((stall, index) => (
                    <div key={stall.id} className="mb-3 sm:mb-6 break-inside-avoid">
                      <StallCard
                        stall={stall}
                        index={index}
                        isPopular={isPopular(stall.id as StallId)}
                        isOnline={isOnline}
                        lowPower={lowPower}
                      />
                    </div>
                  ))}
                </Masonry>
              </div>
            )
          })}
        </div>

        {/* Mobile bottom nav spacer */}
        <MobileNavSpacer />
      </div>
    </div>
    </MotionConfig>
  )
}
