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
  X
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'

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
  const router = useRouter()
  const { strings } = useI18n()
  const { user, logout } = useAuth()
  const { showToast } = useToast()

  // Define all available commands
  const allCommands: CommandItem[] = useMemo(() => [
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
      shortcut: 'g h'
    },
    {
      id: 'hiragana',
      title: 'Hiragana',
      subtitle: 'Learn hiragana characters',
      icon: <span className="text-lg">あ</span>,
      action: () => {
        router.push('/learn/hiragana')
        setIsOpen(false)
      },
      keywords: ['hiragana', 'kana', 'characters', 'learn', 'ひらがな'],
      category: 'learning',
      shortcut: 'g ひ'
    },
    {
      id: 'katakana',
      title: 'Katakana',
      subtitle: 'Learn katakana characters',
      icon: <span className="text-lg">カ</span>,
      action: () => {
        router.push('/learn/katakana')
        setIsOpen(false)
      },
      keywords: ['katakana', 'kana', 'characters', 'learn', 'カタカナ'],
      category: 'learning',
      shortcut: 'g カ'
    },
    {
      id: 'kanji-browser',
      title: 'Kanji Browser',
      subtitle: 'Browse all JLPT kanji',
      icon: <span className="text-lg">漢</span>,
      action: () => {
        router.push('/kanji-browser')
        setIsOpen(false)
      },
      keywords: ['kanji', 'browser', 'jlpt', 'search', '漢字'],
      category: 'learning',
      shortcut: 'g k'
    },
    {
      id: 'vocabulary',
      title: 'Vocabulary',
      subtitle: 'Study vocabulary words',
      icon: <BookOpen className="w-5 h-5" />,
      action: () => {
        router.push('/vocabulary')
        setIsOpen(false)
      },
      keywords: ['vocabulary', 'words', 'vocab', 'study', '単語'],
      category: 'learning',
      shortcut: 'g v'
    },
    {
      id: 'drill',
      title: 'Drill Practice',
      subtitle: 'Quick drill exercises',
      icon: <span className="text-lg">⚡</span>,
      action: () => {
        router.push('/drill')
        setIsOpen(false)
      },
      keywords: ['drill', 'practice', 'exercise', 'quick', 'test'],
      category: 'practice',
      shortcut: 'g d'
    },
    {
      id: 'youtube',
      title: 'YouTube Shadowing',
      subtitle: 'Practice with YouTube videos',
      icon: <span className="text-lg">📺</span>,
      action: () => {
        router.push('/youtube-shadowing')
        setIsOpen(false)
      },
      keywords: ['youtube', 'video', 'shadowing', 'listening', 'watch'],
      category: 'practice',
      shortcut: 'g y'
    },
    {
      id: 'stories',
      title: 'Stories',
      subtitle: 'Read AI-generated stories',
      icon: <span className="text-lg">📚</span>,
      action: () => {
        router.push('/stories')
        setIsOpen(false)
      },
      keywords: ['stories', 'reading', 'ai', 'practice', '物語'],
      category: 'practice',
      shortcut: 'g s'
    },
    {
      id: 'games',
      title: 'Games',
      subtitle: 'Learn through games',
      icon: <Gamepad2 className="w-5 h-5" />,
      action: () => {
        router.push('/games')
        setIsOpen(false)
      },
      keywords: ['games', 'fun', 'play', 'learn', 'ゲーム'],
      category: 'practice',
      shortcut: 'g g'
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
      shortcut: 'g a'
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
      category: 'account'
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
      keywords: ['profile', 'account', 'settings', 'user'],
      category: 'account',
      shortcut: 'g p'
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
      shortcut: 'c l'
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
      category: 'quick-actions'
    },
    {
      id: 'logout',
      title: 'Sign Out',
      subtitle: 'Sign out of your account',
      icon: <LogOut className="w-5 h-5" />,
      action: async () => {
        await logout()
        setIsOpen(false)
        showToast('Signed out successfully', 'success')
      },
      keywords: ['logout', 'signout', 'sign', 'out', 'exit'],
      category: 'account'
    }
  ], [router, logout, showToast])

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery) return allCommands

    const query = searchQuery.toLowerCase()
    return allCommands.filter(command => {
      const titleMatch = command.title.toLowerCase().includes(query)
      const subtitleMatch = command.subtitle?.toLowerCase().includes(query)
      const keywordMatch = command.keywords.some(k => k.toLowerCase().includes(query))
      return titleMatch || subtitleMatch || keywordMatch
    })
  }, [searchQuery, allCommands])

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

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
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
    'quick-actions': 'Quick Actions'
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2
                   bg-white/90 dark:bg-dark-800/90 backdrop-blur-md
                   border border-gray-200 dark:border-dark-700
                   rounded-full shadow-lg hover:shadow-xl
                   transition-all duration-200 hover:scale-105
                   hidden md:flex"
        aria-label="Open command palette"
      >
        <Command className="w-4 h-4" />
        <span className="text-sm font-medium">Command</span>
        <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-dark-700 rounded">
          ⌘K
        </kbd>
      </button>
    )
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
        <div className="flex-1 overflow-y-auto overscroll-contain">
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
                  {commands.map((command) => {
                    const globalIndex = filteredCommands.findIndex(c => c.id === command.id)
                    return (
                      <button
                        key={command.id}
                        onClick={command.action}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 rounded-lg
                          transition-colors duration-150 text-left
                          ${globalIndex === selectedIndex
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
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-dark-700
                      bg-gray-50 dark:bg-dark-900/50">
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
    return createPortal(modalContent, document.body)
  }

  return null
}

// Export hook for programmatic control
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return { isOpen, open, close, toggle }
}
