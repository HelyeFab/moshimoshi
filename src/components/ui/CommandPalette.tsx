'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  Search,
  Command,
  Home,
  BookOpen,
  Gamepad2,
  Trophy,
  LogOut,
  User,
  ChevronRight,
  Sparkles,
  Clock,
  TrendingUp,
  X,
  Zap,
  Video,
  BookMarked,
  List,
  Target,
  Puzzle,
  Map,
  Type,
  Newspaper,
  Flame,
  Clapperboard,
  CreditCard,
  RotateCcw,
  Library,
  FileText,
  CheckSquare,
  Settings,
  Download,
  Share,
} from 'lucide-react'
import { RiTextSpacing, RiCharacterRecognitionLine, RiFontSize2 } from 'react-icons/ri'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import {
  HiraganaIcon,
  KatakanaIcon,
  KanjiIcon,
  VocabIcon,
  DrillIcon,
  NewsIcon,
  StoryIcon,
  GamesIcon,
  ListsIcon,
  ConjugationIcon,
  ResourcesIcon,
  BlogIcon,
  TodosIcon,
} from '@/components/ui/FontIcon'
import { a2hsManager } from '@/lib/pwa/a2hs'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
  category: 'navigation' | 'learning' | 'practice' | 'account' | 'quick-actions'
  shortcut?: string
}

interface CommandPaletteProps {
  onClose?: () => void
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canInstallApp, setCanInstallApp] = useState(false)
  const router = useRouter()
  const { strings } = useI18n()
  const { user, signOut } = useAuth()
  const { showToast } = useToast()

  // Track PWA install availability
  useEffect(() => {
    // Initial check
    setCanInstallApp(a2hsManager.canPrompt())

    // Subscribe to changes
    const unsubscribe = a2hsManager.onAvailabilityChange(available => {
      setCanInstallApp(available)
    })

    return unsubscribe
  }, [])

  // Define all available commands
  const allCommands: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: 'dashboard',
        title: 'Dashboard',
        subtitle: 'Go to main dashboard',
        icon: <Home className="w-5 h-5" />,
        action: () => {
          router.push('/dashboard')
          setIsOpen(false)
        },
        keywords: ['home', 'main', 'dashboard', 'start'],
        category: 'navigation',
        shortcut: 'g h',
      },
      {
        id: 'hiragana',
        title: 'Hiragana',
        subtitle: 'Learn hiragana characters',
        icon: <HiraganaIcon />,
        action: () => {
          router.push('/learn/hiragana')
          setIsOpen(false)
        },
        keywords: ['hiragana', 'kana', 'characters', 'learn', 'ひらがな'],
        category: 'learning',
        shortcut: 'g ひ',
      },
      {
        id: 'katakana',
        title: 'Katakana',
        subtitle: 'Learn katakana characters',
        icon: <KatakanaIcon />,
        action: () => {
          router.push('/learn/katakana')
          setIsOpen(false)
        },
        keywords: ['katakana', 'kana', 'characters', 'learn', 'カタカナ'],
        category: 'learning',
        shortcut: 'g カ',
      },
      {
        id: 'kanji-browser',
        title: 'Kanji Browser',
        subtitle: 'Browse all JLPT kanji',
        icon: <KanjiIcon />,
        action: () => {
          router.push('/kanji-browser')
          setIsOpen(false)
        },
        keywords: ['kanji', 'browser', 'jlpt', 'search', '漢字'],
        category: 'learning',
        shortcut: 'g k',
      },
      {
        id: 'vocabulary',
        title: 'Vocabulary',
        subtitle: 'Study vocabulary words',
        icon: <VocabIcon />,
        action: () => {
          router.push('/vocabulary')
          setIsOpen(false)
        },
        keywords: ['vocabulary', 'words', 'vocab', 'study', '単語'],
        category: 'learning',
        shortcut: 'g v',
      },
      {
        id: 'drill',
        title: 'Drill Practice',
        subtitle: 'Quick drill exercises',
        icon: <DrillIcon />,
        action: () => {
          router.push('/drill')
          setIsOpen(false)
        },
        keywords: ['drill', 'practice', 'exercise', 'quick', 'test'],
        category: 'practice',
        shortcut: 'g d',
      },
      {
        id: 'youtube',
        title: 'YouTube Shadowing',
        subtitle: 'Practice with YouTube videos',
        icon: <Video className="w-5 h-5" />,
        action: () => {
          router.push('/youtube-shadowing')
          setIsOpen(false)
        },
        keywords: ['youtube', 'video', 'shadowing', 'listening', 'watch'],
        category: 'practice',
        shortcut: 'g y',
      },
      {
        id: 'stories',
        title: 'Stories',
        subtitle: 'Read AI-generated stories',
        icon: <StoryIcon />,
        action: () => {
          router.push('/stories')
          setIsOpen(false)
        },
        keywords: ['stories', 'reading', 'ai', 'practice', '物語'],
        category: 'practice',
        shortcut: 'g s',
      },
      {
        id: 'comics',
        title: 'Moshi Comics',
        subtitle: 'Moshi Goes to Japan',
        icon: <BookOpen className="w-5 h-5" />,
        action: () => {
          router.push('/comics')
          setIsOpen(false)
        },
        keywords: ['comics', 'manga', 'moshi', 'reading', '漫画'],
        category: 'practice',
        shortcut: 'g co',
      },
      {
        id: 'games',
        title: 'Games',
        subtitle: 'Learn through games',
        icon: <GamesIcon />,
        action: () => {
          router.push('/games')
          setIsOpen(false)
        },
        keywords: ['games', 'fun', 'play', 'learn', 'ゲーム'],
        category: 'practice',
        shortcut: 'g g',
      },
      {
        id: 'achievements',
        title: 'Achievements',
        subtitle: 'View your achievements',
        icon: <Trophy className="w-5 h-5" />,
        action: () => {
          router.push('/achievements')
          setIsOpen(false)
        },
        keywords: ['achievements', 'progress', 'medals', 'rewards', '成果'],
        category: 'account',
        shortcut: 'g a',
      },
      {
        id: 'leaderboard',
        title: 'Leaderboard',
        subtitle: 'See top learners',
        icon: <TrendingUp className="w-5 h-5" />,
        action: () => {
          router.push('/leaderboard')
          setIsOpen(false)
        },
        keywords: ['leaderboard', 'ranking', 'top', 'compete', 'ランキング'],
        category: 'account',
      },
      {
        id: 'profile',
        title: 'Profile',
        subtitle: 'View your profile',
        icon: <User className="w-5 h-5" />,
        action: () => {
          router.push('/account')
          setIsOpen(false)
        },
        keywords: ['profile', 'account', 'user'],
        category: 'account',
        shortcut: 'g p',
      },
      {
        id: 'settings',
        title: 'Settings',
        subtitle: 'App preferences & notifications',
        icon: <Settings className="w-5 h-5" />,
        action: () => {
          router.push('/settings')
          setIsOpen(false)
        },
        keywords: ['settings', 'preferences', 'notifications', 'theme', 'language', '設定'],
        category: 'account',
        shortcut: 'g ,',
      },
      // Quick actions
      {
        id: 'new-list',
        title: 'Create New List',
        subtitle: 'Create a custom study list',
        icon: <Sparkles className="w-5 h-5" />,
        action: () => {
          router.push('/lists?action=new')
          setIsOpen(false)
        },
        keywords: ['new', 'create', 'list', 'custom', 'add'],
        category: 'quick-actions',
        shortcut: 'c l',
      },
      {
        id: 'recent',
        title: 'Recent Activity',
        subtitle: 'View recent study activity',
        icon: <Clock className="w-5 h-5" />,
        action: () => {
          router.push('/review-dashboard')
          setIsOpen(false)
        },
        keywords: ['recent', 'history', 'activity', 'log'],
        category: 'quick-actions',
      },
      {
        id: 'logout',
        title: 'Sign Out',
        subtitle: 'Sign out of your account',
        icon: <LogOut className="w-5 h-5" />,
        action: async () => {
          await signOut()
          setIsOpen(false)
          showToast('Signed out successfully', 'success')
        },
        keywords: ['logout', 'signout', 'sign', 'out', 'exit'],
        category: 'account',
      },
      // === Additional Learning Stalls ===
      {
        id: 'my-lists',
        title: 'My Lists',
        subtitle: 'Create custom study lists',
        icon: <ListsIcon />,
        action: () => {
          router.push('/lists')
          setIsOpen(false)
        },
        keywords: ['lists', 'custom', 'study', 'organize', 'リスト'],
        category: 'learning',
        shortcut: 'g l',
      },
      {
        id: 'kanji-mastery',
        title: 'Kanji Mastery',
        subtitle: 'Master kanji with SRS',
        icon: <Target className="w-5 h-5" />,
        action: () => {
          router.push('/tools/kanji-mastery')
          setIsOpen(false)
        },
        keywords: ['kanji', 'mastery', 'srs', 'spaced', 'repetition', '漢字習得'],
        category: 'learning',
        shortcut: 'g km',
      },
      {
        id: 'kanji-connections',
        title: 'Kanji Connections',
        subtitle: 'Families, Radicals & Patterns',
        icon: <Puzzle className="w-5 h-5" />,
        action: () => {
          router.push('/kanji-connection')
          setIsOpen(false)
        },
        keywords: ['kanji', 'connections', 'radicals', 'families', 'patterns', '漢字関連'],
        category: 'learning',
        shortcut: 'g kc',
      },
      {
        id: 'mood-boards',
        title: 'Mood Boards',
        subtitle: 'Learn kanji by themes',
        icon: <Map className="w-5 h-5" />,
        action: () => {
          router.push('/kanji-moods')
          setIsOpen(false)
        },
        keywords: ['mood', 'boards', 'themes', 'kanji', 'topics', 'ムード'],
        category: 'learning',
        shortcut: 'g m',
      },
      {
        id: 'conjugation',
        title: 'Conjugation',
        subtitle: 'Practice verb conjugations',
        icon: <ConjugationIcon />,
        action: () => {
          router.push('/learn/conjugation')
          setIsOpen(false)
        },
        keywords: ['conjugation', 'verbs', 'grammar', 'practice', '活用'],
        category: 'learning',
        shortcut: 'g c',
      },
      {
        id: 'textbook-vocab',
        title: 'Textbook Vocab',
        subtitle: 'Study textbook vocabulary',
        icon: <BookMarked className="w-5 h-5" />,
        action: () => {
          router.push('/tools/textbook-vocabulary')
          setIsOpen(false)
        },
        keywords: ['textbook', 'vocabulary', 'vocab', 'study', '教科書'],
        category: 'learning',
        shortcut: 'g tv',
      },
      {
        id: 'news',
        title: 'News',
        subtitle: 'Read Japanese news',
        icon: <NewsIcon />,
        action: () => {
          router.push('/news')
          setIsOpen(false)
        },
        keywords: ['news', 'articles', 'reading', 'current', 'events', 'ニュース'],
        category: 'practice',
        shortcut: 'g n',
      },
      {
        id: 'popular-videos',
        title: 'Trending Videos',
        subtitle: 'Most watched by community',
        icon: <Flame className="w-5 h-5" />,
        action: () => {
          router.push('/popular-videos')
          setIsOpen(false)
        },
        keywords: ['popular', 'trending', 'videos', 'community', 'watched', '人気動画'],
        category: 'practice',
        shortcut: 'g pv',
      },
      {
        id: 'youtube-series',
        title: 'YouTube Series',
        subtitle: 'Track YouTube channels',
        icon: <Video className="w-5 h-5" />,
        action: () => {
          router.push('/youtube-series')
          setIsOpen(false)
        },
        keywords: ['youtube', 'series', 'channels', 'follow', 'シリーズ'],
        category: 'practice',
        shortcut: 'g ys',
      },
      {
        id: 'my-videos',
        title: 'My Videos',
        subtitle: 'Your saved videos',
        icon: <Clapperboard className="w-5 h-5" />,
        action: () => {
          router.push('/my-videos')
          setIsOpen(false)
        },
        keywords: ['my', 'videos', 'saved', 'collection', 'ビデオ'],
        category: 'practice',
        shortcut: 'g mv',
      },
      {
        id: 'flashcards',
        title: 'Flashcards',
        subtitle: 'Study flashcard decks',
        icon: <CreditCard className="w-5 h-5" />,
        action: () => {
          router.push('/flashcards')
          setIsOpen(false)
        },
        keywords: ['flashcards', 'decks', 'study', 'memorize', 'フラッシュカード'],
        category: 'practice',
        shortcut: 'g f',
      },
      {
        id: 'review-hub',
        title: 'Review Hub',
        subtitle: 'Unified review system',
        icon: <RotateCcw className="w-5 h-5" />,
        action: () => {
          router.push('/review-dashboard')
          setIsOpen(false)
        },
        keywords: ['review', 'hub', 'dashboard', 'srs', 'レビュー'],
        category: 'practice',
        shortcut: 'g r',
      },
      {
        id: 'resources',
        title: 'Resources',
        subtitle: 'Learning resources',
        icon: <ResourcesIcon />,
        action: () => {
          router.push('/resources')
          setIsOpen(false)
        },
        keywords: ['resources', 'learning', 'materials', 'guides', 'リソース'],
        category: 'learning',
        shortcut: 'g re',
      },
      {
        id: 'blog',
        title: 'Blog',
        subtitle: 'Articles and updates',
        icon: <BlogIcon />,
        action: () => {
          router.push('/blog')
          setIsOpen(false)
        },
        keywords: ['blog', 'articles', 'updates', 'news', 'posts', 'ブログ'],
        category: 'account',
        shortcut: 'g b',
      },
      {
        id: 'todos',
        title: 'Task Manager',
        subtitle: 'Organize study tasks',
        icon: <TodosIcon />,
        action: () => {
          router.push('/todos')
          setIsOpen(false)
        },
        keywords: ['todos', 'tasks', 'checklist', 'organize', 'goals', 'タスク管理'],
        category: 'quick-actions',
        shortcut: 'g t',
      },
      {
        id: 'install-app',
        title: 'Install App',
        subtitle: 'Add to your home screen',
        icon: <Download className="w-5 h-5" />,
        action: async () => {
          const instructions = a2hsManager.getInstallInstructions()

          if (instructions.platform === 'ios') {
            // iOS: Show instructions in toast since we can't trigger native prompt
            showToast(`Tap the Share button, then "Add to Home Screen"`, 'info', 5000)
          } else {
            // Chrome/Android/Desktop: Trigger native install prompt
            const result = await a2hsManager.prompt()
            if (result === 'accepted') {
              showToast('App installed successfully!', 'success')
            } else if (result === 'not-available') {
              showToast('Install not available. Try the browser menu.', 'info')
            }
          }
          setIsOpen(false)
        },
        keywords: ['install', 'app', 'download', 'pwa', 'home', 'screen', 'add', 'インストール'],
        category: 'quick-actions',
      },
    ],
    [router, signOut, showToast]
  )

  // Filter out disabled features
  // Note: Features are DISABLED by default unless explicitly set to 'true'
  const isGamesEnabled = process.env.NEXT_PUBLIC_FEATURE_GAMES === 'true'
  const isReviewHubEnabled = process.env.NEXT_PUBLIC_FEATURE_REVIEW_HUB === 'true'
  const isAchievementsEnabled = process.env.NEXT_PUBLIC_FEATURE_ACHIEVEMENTS === 'true'
  const isLeaderboardEnabled = process.env.NEXT_PUBLIC_FEATURE_LEADERBOARD === 'true'
  const isTodosEnabled = process.env.NEXT_PUBLIC_FEATURE_TODOS === 'true'

  const enabledCommands = useMemo(() => {
    return allCommands.filter(command => {
      if (command.id === 'games' && !isGamesEnabled) return false
      if (command.id === 'review-hub' && !isReviewHubEnabled) return false
      if (command.id === 'achievements' && !isAchievementsEnabled) return false
      if (command.id === 'leaderboard' && !isLeaderboardEnabled) return false
      if (command.id === 'todos' && !isTodosEnabled) return false
      if (command.id === 'install-app' && !canInstallApp) return false
      return true
    })
  }, [
    allCommands,
    isGamesEnabled,
    isReviewHubEnabled,
    isAchievementsEnabled,
    isLeaderboardEnabled,
    isTodosEnabled,
    canInstallApp,
  ])

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery) return enabledCommands

    const query = searchQuery.toLowerCase()
    return enabledCommands.filter(command => {
      const titleMatch = command.title.toLowerCase().includes(query)
      const subtitleMatch = command.subtitle?.toLowerCase().includes(query)
      const keywordMatch = command.keywords.some(k => k.toLowerCase().includes(query))
      return titleMatch || subtitleMatch || keywordMatch
    })
  }, [searchQuery, enabledCommands])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    filteredCommands.forEach(command => {
      if (!groups[command.category]) {
        groups[command.category] = []
      }
      groups[command.category].push(command)
    })
    return groups
  }, [filteredCommands])

  // Global keyboard shortcut (Cmd/Ctrl+K) to open palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    const handleCustomOpen = () => {
      setIsOpen(true)
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    window.addEventListener('openCommandPalette', handleCustomOpen)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
      window.removeEventListener('openCommandPalette', handleCustomOpen)
    }
  }, [])

  // Command palette keyboard navigation (arrow keys, enter, esc)
  useEffect(() => {
    if (!isOpen) return

    const handleCommandKeyDown = (e: KeyboardEvent) => {
      // Close with Escape
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
      }

      // Navigate with arrow keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const direction = e.key === 'ArrowUp' ? -1 : 1
        setSelectedIndex(prev => {
          const newIndex = prev + direction
          if (newIndex < 0) return filteredCommands.length - 1
          if (newIndex >= filteredCommands.length) return 0
          return newIndex
        })
      }

      // Execute with Enter
      if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault()
        filteredCommands[selectedIndex].action()
      }
    }

    window.addEventListener('keydown', handleCommandKeyDown)
    return () => window.removeEventListener('keydown', handleCommandKeyDown)
  }, [isOpen, selectedIndex, filteredCommands])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Body scroll lock when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  const categoryLabels = {
    navigation: 'Navigation',
    learning: 'Learning',
    practice: 'Practice',
    account: 'Account',
    'quick-actions': 'Quick Actions',
  }

  // Desktop floating button
  const desktopButton = (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 left-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-full
                 bg-soft-white/20 dark:bg-dark-900/30
                 backdrop-blur-2xl backdrop-saturate-150
                 border border-gray-200/40 dark:border-gray-700/30
                 shadow-2xl shadow-japanese-sakura/20 dark:shadow-black/60
                 hover:bg-soft-white/30 dark:hover:bg-dark-900/40
                 transition-all duration-200 hover:scale-105
                 hidden md:flex"
      aria-label="Open command palette"
    >
      <Command className="w-5 h-5 text-primary-600 dark:text-primary-400" />
      <span className="text-sm font-medium text-primary-600 dark:text-primary-400">Command</span>
      <kbd className="px-1.5 py-0.5 text-xs bg-primary-100/50 dark:bg-primary-900/30 rounded text-primary-600 dark:text-primary-400 border border-primary-200/50 dark:border-primary-800/50">
        ⌘K
      </kbd>
    </button>
  )

  if (!isOpen) {
    return desktopButton
  }

  const modalContent = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Command Palette - Styled like SessionSummary for perfect mobile centering */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-dark-800 rounded-2xl shadow-2xl
                   border border-gray-200 dark:border-dark-700 overflow-hidden flex flex-col"
      >
        {/* Search Header */}
        <div className="flex-shrink-0 flex items-center gap-3 p-4 border-b border-gray-200 dark:border-dark-700">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100
                     placeholder-gray-400 dark:placeholder-gray-500"
            autoFocus
          />
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Commands List */}
        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No commands found for "{searchQuery}"
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedCommands).map(([category, commands]) => (
                <div key={category} className="mb-4 last:mb-0">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </div>
                  {commands.map(command => {
                    const globalIndex = filteredCommands.findIndex(c => c.id === command.id)
                    return (
                      <button
                        key={command.id}
                        onClick={command.action}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 rounded-lg
                          transition-colors duration-150 text-left
                          ${
                            globalIndex === selectedIndex
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                              : 'hover:bg-gray-50 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-300'
                          }
                        `}
                      >
                        <div className="flex-shrink-0">{command.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{command.title}</div>
                          {command.subtitle && (
                            <div className="text-xs opacity-75 truncate">{command.subtitle}</div>
                          )}
                        </div>
                        {command.shortcut && (
                          <kbd className="hidden sm:block px-2 py-1 text-xs bg-gray-100 dark:bg-dark-700 rounded flex-shrink-0">
                            {command.shortcut}
                          </kbd>
                        )}
                        <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-dark-700
                      bg-gray-50 dark:bg-dark-900/50"
        >
          <div className="flex items-center gap-2 sm:gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white dark:bg-dark-800 rounded">↑↓</kbd>
              <span className="hidden sm:inline">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white dark:bg-dark-800 rounded">↵</kbd>
              <span className="hidden sm:inline">Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white dark:bg-dark-800 rounded">esc</kbd>
              <span className="hidden sm:inline">Close</span>
            </span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {filteredCommands.length}
          </span>
        </div>
      </div>
    </div>
  )

  // Portal to body
  if (typeof document !== 'undefined') {
    return (
      <>
        {desktopButton}
        {createPortal(modalContent, document.body)}
      </>
    )
  }

  return desktopButton
}

// Export hook for programmatic control
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return { isOpen, open, close, toggle }
}
