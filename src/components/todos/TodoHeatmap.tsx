// Todo Heatmap Calendar Component
// Shows a GitHub-style activity calendar of when todos are due

'use client'

import { useMemo } from 'react'
import { Todo } from '@/types/todos'
import { useI18n } from '@/i18n/I18nContext'
import ActivityCalendar, { Activity, ThemeInput } from 'react-activity-calendar'

interface TodoHeatmapProps {
  todos: Todo[]
}

export function TodoHeatmap({ todos }: TodoHeatmapProps) {
  const { t } = useI18n()

  // Generate activity data from todos
  const activityData = useMemo(() => {
    // Create a map of due dates to todos
    const dateMap = new Map<string, { count: number; todos: Todo[] }>()

    todos.forEach(todo => {
      if (todo.dueDate && !todo.completed) {
        const dueDate = new Date(todo.dueDate)
        const dateKey = dueDate.toISOString().split('T')[0]

        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { count: 0, todos: [] })
        }

        const entry = dateMap.get(dateKey)!
        entry.count++
        entry.todos.push(todo)
      }
    })

    // Find date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 1) // Show 1 month before

    let endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3) // Show 3 months ahead by default

    // Extend if there are todos beyond
    dateMap.forEach((_, dateStr) => {
      const date = new Date(dateStr)
      if (date > endDate) {
        endDate = new Date(date)
        endDate.setDate(endDate.getDate() + 7) // Add padding
      }
    })

    // Generate all dates in range
    const activities: Activity[] = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const dayData = dateMap.get(dateStr)

      activities.push({
        date: dateStr,
        count: dayData?.count || 0,
        level: dayData ? Math.min(4, Math.ceil(dayData.count / 2)) : 0
      } as Activity)

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return { activities, dateMap }
  }, [todos])

  // Count todos with due dates
  const totalDueTodos = todos.filter(t => t.dueDate && !t.completed).length

  if (totalDueTodos === 0) {
    return null // Don't show heatmap if no todos have due dates
  }

  // Custom theme for the calendar
  const theme: ThemeInput = {
    light: ['#f3f4f6', '#e9d5ff', '#c084fc', '#9333ea', '#6b21a8'],
    dark: ['#1f2937', '#581c87', '#7c3aed', '#a855f7', '#d8b4fe']
  }

  return (
    <div className="mb-8 p-6 bg-gradient-to-br from-soft-white/95 to-gray-50/95 dark:from-dark-800/95 dark:to-dark-900/95 backdrop-blur-lg rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              📅 Upcoming Deadlines
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {totalDueTodos} task{totalDueTodos !== 1 ? 's' : ''} with due dates
            </p>
          </div>

          {/* Priority legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-600 dark:text-gray-400">High</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-gray-600 dark:text-gray-400">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Calendar */}
      <div className="overflow-x-auto">
        <div className="min-w-fit">
          <ActivityCalendar
            data={activityData.activities}
            theme={theme}
            showWeekdayLabels
            blockSize={15}
            blockMargin={5}
            fontSize={14}
            labels={{
              months: [
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
              ],
              weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
              totalCount: '{{count}} tasks due in {{year}}',
              legend: {
                less: 'Less',
                more: 'More'
              }
            }}
          />
        </div>
      </div>

      {/* Stats summary */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">This week: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {activityData.activities
                .filter(a => {
                  const date = new Date(a.date)
                  const today = new Date()
                  const weekStart = new Date(today.setDate(today.getDate() - today.getDay()))
                  const weekEnd = new Date(weekStart)
                  weekEnd.setDate(weekEnd.getDate() + 6)
                  return date >= weekStart && date <= weekEnd
                })
                .reduce((sum, a) => sum + a.count, 0)} tasks
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">This month: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {activityData.activities
                .filter(a => {
                  const date = new Date(a.date)
                  const today = new Date()
                  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
                })
                .reduce((sum, a) => sum + a.count, 0)} tasks
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}