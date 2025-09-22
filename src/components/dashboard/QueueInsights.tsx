'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  Clock, 
  TrendingDown, 
  AlertTriangle, 
  Sparkles, 
  Target,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react'

interface QueueInsightsProps {
  items: QueueItem[]
  showTitle?: boolean
  maxItems?: number
  compact?: boolean
}

interface QueueItem {
  id: string
  content: {
    primaryDisplay: string
    contentType: string
    source?: string
  }
  priority: number
  priorityBreakdown: {
    overdue?: number
    priorityLevel?: number
    newItem?: number
    learning?: number
    lowSuccess?: number
    recentReview?: number
    leech?: number
  }
  nextReviewDate: Date
  lastReviewDate?: Date
  successRate: number
  failureCount: number
  state: 'new' | 'learning' | 'review' | 'mastered'
}

interface PriorityReason {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  description: string
}

function getPriorityReasons(breakdown: QueueItem['priorityBreakdown']): PriorityReason[] {
  const reasons: PriorityReason[] = []
  
  if (breakdown.overdue && breakdown.overdue > 0) {
    const days = Math.floor(breakdown.overdue / 10)
    reasons.push({
      label: `Overdue by ${days} day${days > 1 ? 's' : ''}`,
      value: breakdown.overdue,
      icon: <Clock className="w-4 h-4" />,
      color: 'text-red-600 bg-red-100 dark:bg-red-900/20',
      description: 'This item needs immediate review'
    })
  }
  
  if (breakdown.leech && breakdown.leech > 0) {
    reasons.push({
      label: 'Leech detected',
      value: breakdown.leech,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20',
      description: 'Failed 8+ times - needs special attention'
    })
  }
  
  if (breakdown.lowSuccess && breakdown.lowSuccess > 0) {
    reasons.push({
      label: 'Low success rate',
      value: breakdown.lowSuccess,
      icon: <TrendingDown className="w-4 h-4" />,
      color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20',
      description: 'Success rate below 60%'
    })
  }
  
  if (breakdown.newItem && breakdown.newItem > 0) {
    reasons.push({
      label: 'New item',
      value: breakdown.newItem,
      icon: <Sparkles className="w-4 h-4" />,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
      description: 'First time reviewing this item'
    })
  }
  
  if (breakdown.learning && breakdown.learning > 0) {
    reasons.push({
      label: 'Still learning',
      value: breakdown.learning,
      icon: <Target className="w-4 h-4" />,
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
      description: 'In early learning phase'
    })
  }
  
  if (breakdown.recentReview && breakdown.recentReview < 0) {
    reasons.push({
      label: 'Recently reviewed',
      value: breakdown.recentReview,
      icon: <Calendar className="w-4 h-4" />,
      color: 'text-gray-600 bg-gray-100 dark:bg-gray-800',
      description: 'Reviewed within the last hour'
    })
  }
  
  return reasons.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
}

function QueueItemCard({ item, compact }: { item: QueueItem; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const reasons = getPriorityReasons(item.priorityBreakdown)
  const topReason = reasons[0]
  
  const getDaysUntilReview = () => {
    const now = new Date()
    const next = new Date(item.nextReviewDate)
    const diff = next.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    if (days < 0) return `${Math.abs(days)} days overdue`
    if (days === 0) return 'Due today'
    if (days === 1) return 'Due tomorrow'
    return `Due in ${days} days`
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "p-4 transition-all hover:shadow-md",
        item.failureCount >= 8 && "border-orange-300 dark:border-orange-700"
      )}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {item.content.primaryDisplay}
                </span>
                <Badge variant="outline" className="text-xs">
                  {item.content.contentType}
                </Badge>
              </div>
              {item.content.source && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  From: {item.content.source}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {item.priority}
              </div>
              <div className="text-xs text-gray-500">priority</div>
            </div>
          </div>
          
          {/* Top Priority Reason */}
          {topReason && (
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              topReason.color
            )}>
              {topReason.icon}
              <span>{topReason.label}</span>
              <span className="text-xs opacity-75">
                ({topReason.value > 0 ? '+' : ''}{topReason.value} pts)
              </span>
            </div>
          )}
          
          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Success:</span>
                <span className={cn(
                  "ml-1 font-medium",
                  item.successRate < 0.6 ? "text-red-600" : 
                  item.successRate < 0.8 ? "text-yellow-600" : 
                  "text-green-600"
                )}>
                  {(item.successRate * 100).toFixed(0)}%
                </span>
              </div>
              {item.failureCount > 0 && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Failures:</span>
                  <span className={cn(
                    "ml-1 font-medium",
                    item.failureCount >= 8 ? "text-orange-600" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {item.failureCount}
                  </span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {getDaysUntilReview()}
            </div>
          </div>
          
          {/* Expandable Details */}
          {!compact && reasons.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="w-full justify-between"
              >
                <span>View all priority factors</span>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
              
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {reasons.slice(1).map((reason, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                          reason.color
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {reason.icon}
                          <span>{reason.label}</span>
                        </div>
                        <span className="text-xs font-medium">
                          {reason.value > 0 ? '+' : ''}{reason.value}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

export default function QueueInsights({ 
  items, 
  showTitle = true,
  maxItems = 10,
  compact = false 
}: QueueInsightsProps) {
  const [showAll, setShowAll] = useState(false)
  
  // Sort by priority
  const sortedItems = [...items].sort((a, b) => b.priority - a.priority)
  const displayItems = showAll ? sortedItems : sortedItems.slice(0, maxItems)
  
  // Calculate statistics
  const stats = {
    overdueCount: items.filter(item => 
      item.priorityBreakdown.overdue && item.priorityBreakdown.overdue > 0
    ).length,
    leechCount: items.filter(item => item.failureCount >= 8).length,
    newCount: items.filter(item => item.state === 'new').length,
    avgPriority: items.reduce((sum, item) => sum + item.priority, 0) / items.length || 0
  }
  
  return (
    <div className="space-y-6">
      {showTitle && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Queue Insights
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Understanding why items appear in your review queue
          </p>
        </div>
      )}
      
      {/* Statistics Summary */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-red-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Overdue</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stats.overdueCount}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Leeches</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stats.leechCount}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">New</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stats.newCount}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg Priority</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stats.avgPriority.toFixed(0)}
            </div>
          </div>
        </div>
      </Card>
      
      {/* Priority Algorithm Explanation */}
      {!compact && (
        <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                How Queue Priority Works
              </h3>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>• Overdue items: +10 points per day (max +100)</p>
                <p>• High priority items: +50 points</p>
                <p>• New items: +30 points boost</p>
                <p>• Learning phase: +20 points</p>
                <p>• Low success rate (&lt;60%): +40 points</p>
                <p>• Leech items (8+ failures): +35 points</p>
                <p>• Recently reviewed (1hr): -60 points penalty</p>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Queue Items */}
      <div className="space-y-3">
        {displayItems.map((item) => (
          <QueueItemCard key={item.id} item={item} compact={compact} />
        ))}
      </div>
      
      {/* Show More Button */}
      {items.length > maxItems && !showAll && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setShowAll(true)}
            className="w-full sm:w-auto"
          >
            Show {items.length - maxItems} more items
          </Button>
        </div>
      )}
    </div>
  )
}