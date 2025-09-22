'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  RotateCcw, 
  Settings2, 
  Bookmark, 
  History,
  TrendingDown,
  X,
  ChevronRight,
  Info,
  Target,
  Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeechManagerProps {
  leeches: LeechItem[]
  onResetItem?: (itemId: string) => void
  onAdjustDifficulty?: (itemId: string, newDifficulty: number) => void
  onAddToSpecialPractice?: (itemId: string) => void
  showTitle?: boolean
  compact?: boolean
}

interface LeechItem {
  id: string
  content: {
    primaryDisplay: string
    secondaryDisplay?: string
    contentType: string
    difficulty: number
  }
  failureCount: number
  successRate: number
  lastFailureDate: Date
  firstSeenDate: Date
  errorHistory: ErrorEntry[]
  srsData: {
    easeFactor: number
    interval: number
    consecutiveFailures: number
  }
}

interface ErrorEntry {
  date: Date
  userAnswer: string
  correctAnswer: string
  errorType: 'typo' | 'confusion' | 'forgotten' | 'other'
}

function getLeechSeverity(item: LeechItem): {
  level: 'mild' | 'moderate' | 'severe'
  color: string
  bgColor: string
  borderColor: string
  description: string
} {
  if (item.failureCount >= 15) {
    return {
      level: 'severe',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      borderColor: 'border-red-300 dark:border-red-700',
      description: 'Critical leech - needs immediate attention'
    }
  } else if (item.failureCount >= 10) {
    return {
      level: 'moderate',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      borderColor: 'border-orange-300 dark:border-orange-700',
      description: 'Moderate leech - struggling significantly'
    }
  } else {
    return {
      level: 'mild',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-300 dark:border-yellow-700',
      description: 'Mild leech - needs extra practice'
    }
  }
}

function getErrorPattern(errors: ErrorEntry[]): string {
  const typeCounts = errors.reduce((acc, error) => {
    acc[error.errorType] = (acc[error.errorType] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const mostCommon = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)[0]
  
  if (!mostCommon) return 'Mixed errors'
  
  switch (mostCommon[0]) {
    case 'typo': return 'Frequent typos'
    case 'confusion': return 'Conceptual confusion'
    case 'forgotten': return 'Memory retention issue'
    default: return 'Mixed errors'
  }
}

function LeechCard({ 
  item, 
  onReset, 
  onAdjustDifficulty, 
  onAddToPractice,
  compact 
}: {
  item: LeechItem
  onReset?: () => void
  onAdjustDifficulty?: (difficulty: number) => void
  onAddToPractice?: () => void
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const severity = getLeechSeverity(item)
  const errorPattern = getErrorPattern(item.errorHistory)
  
  const daysSinceFirstSeen = Math.floor(
    (Date.now() - new Date(item.firstSeenDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "p-4 border-2 transition-all hover:shadow-lg",
        severity.borderColor
      )}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={cn("w-5 h-5", severity.color)} />
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {item.content.primaryDisplay}
              </span>
              <Badge variant="outline" className="text-xs">
                {item.content.contentType}
              </Badge>
            </div>
            {item.content.secondaryDisplay && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.content.secondaryDisplay}
              </p>
            )}
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            severity.bgColor,
            severity.color
          )}>
            {item.failureCount} failures
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
            <div className="text-lg font-bold text-red-600">
              {(item.successRate * 100).toFixed(0)}%
            </div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Ease Factor</div>
            <div className="text-lg font-bold text-orange-600">
              {item.srsData.easeFactor.toFixed(2)}
            </div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">Days Seen</div>
            <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
              {daysSinceFirstSeen}
            </div>
          </div>
        </div>
        
        {/* Error Pattern */}
        <div className={cn(
          "px-3 py-2 rounded-lg mb-3 flex items-center justify-between",
          severity.bgColor
        )}>
          <div className="flex items-center gap-2">
            <Brain className={cn("w-4 h-4", severity.color)} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Pattern: {errorPattern}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs"
          >
            {showHistory ? 'Hide' : 'Show'} History
            <ChevronRight className={cn(
              "w-3 h-3 ml-1 transition-transform",
              showHistory && "rotate-90"
            )} />
          </Button>
        </div>
        
        {/* Error History */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-3 space-y-1 overflow-hidden"
            >
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Recent Errors (Last 5)
              </div>
              {item.errorHistory.slice(0, 5).map((error, index) => (
                <div
                  key={index}
                  className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500">
                      {new Date(error.date).toLocaleDateString()}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {error.errorType}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-gray-500">Your answer:</span>
                      <span className="ml-2 text-red-600">{error.userAnswer || 'No answer'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Correct:</span>
                      <span className="ml-2 text-green-600">{error.correctAnswer}</span>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Suggestions */}
        {!compact && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-3">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="font-medium mb-1">Suggestions:</div>
                {errorPattern === 'Frequent typos' && (
                  <p>Practice writing this item slowly and carefully.</p>
                )}
                {errorPattern === 'Conceptual confusion' && (
                  <p>Review related items and focus on distinguishing features.</p>
                )}
                {errorPattern === 'Memory retention issue' && (
                  <p>Create mnemonics or use memory palace technique.</p>
                )}
                {errorPattern === 'Mixed errors' && (
                  <p>This item needs comprehensive review and practice.</p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset to New
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAdjustDifficulty?.(Math.max(0, item.content.difficulty - 0.2))}
            className="flex-1"
          >
            <Settings2 className="w-4 h-4 mr-1" />
            Lower Difficulty
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onAddToPractice}
            className="flex-1"
          >
            <Bookmark className="w-4 h-4 mr-1" />
            Special Practice
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

export default function LeechManager({
  leeches,
  onResetItem,
  onAdjustDifficulty,
  onAddToSpecialPractice,
  showTitle = true,
  compact = false
}: LeechManagerProps) {
  const [filter, setFilter] = useState<'all' | 'mild' | 'moderate' | 'severe'>('all')
  
  const filteredLeeches = leeches.filter(item => {
    if (filter === 'all') return true
    const severity = getLeechSeverity(item)
    return severity.level === filter
  })
  
  const stats = {
    total: leeches.length,
    severe: leeches.filter(l => l.failureCount >= 15).length,
    moderate: leeches.filter(l => l.failureCount >= 10 && l.failureCount < 15).length,
    mild: leeches.filter(l => l.failureCount < 10).length,
    avgFailures: leeches.reduce((sum, l) => sum + l.failureCount, 0) / leeches.length || 0
  }
  
  if (leeches.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Leeches Detected!
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Great job! You don't have any problem items right now.
        </p>
      </Card>
    )
  }
  
  return (
    <div className="space-y-6">
      {showTitle && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Leech Manager
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Items that need special attention (failed 8+ times)
          </p>
        </div>
      )}
      
      {/* Statistics */}
      <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Leeches</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.total}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Severe</div>
            <div className="text-2xl font-bold text-red-600">
              {stats.severe}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Moderate</div>
            <div className="text-2xl font-bold text-orange-600">
              {stats.moderate}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Mild</div>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.mild}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Failures</div>
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
              {stats.avgFailures.toFixed(1)}
            </div>
          </div>
        </div>
      </Card>
      
      {/* Filter Buttons */}
      <div className="flex gap-2">
        {(['all', 'severe', 'moderate', 'mild'] as const).map((level) => (
          <Button
            key={level}
            variant={filter === level ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(level)}
            className="capitalize"
          >
            {level}
            {level !== 'all' && (
              <span className="ml-2 text-xs">
                ({stats[level]})
              </span>
            )}
          </Button>
        ))}
      </div>
      
      {/* Leech Cards */}
      <div className="space-y-4">
        {filteredLeeches.map((leech) => (
          <LeechCard
            key={leech.id}
            item={leech}
            onReset={() => onResetItem?.(leech.id)}
            onAdjustDifficulty={(d) => onAdjustDifficulty?.(leech.id, d)}
            onAddToPractice={() => onAddToSpecialPractice?.(leech.id)}
            compact={compact}
          />
        ))}
      </div>
      
      {/* Bulk Actions */}
      {filteredLeeches.length > 0 && !compact && (
        <Card className="p-4 border-dashed">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Bulk Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => filteredLeeches.forEach(l => onResetItem?.(l.id))}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset All to New
            </Button>
            <Button
              variant="outline"
              onClick={() => filteredLeeches.forEach(l => 
                onAdjustDifficulty?.(l.id, Math.max(0, l.content.difficulty - 0.2))
              )}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Lower All Difficulties
            </Button>
            <Button
              variant="outline"
              onClick={() => filteredLeeches.forEach(l => onAddToSpecialPractice?.(l.id))}
            >
              <Bookmark className="w-4 h-4 mr-2" />
              Add All to Practice List
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}