'use client'

import { useState, useEffect } from 'react'
import { useVirtualClock } from '@/hooks/useVirtualClock'
import { Beaker, Clock, X } from 'lucide-react'

export default function TimeMachineButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Show TimeMachine for all users in development mode
    const checkVisibility = () => {
      // Always show in development mode
      if (process.env.NODE_ENV === 'development') {
        return true
      }

      // In production, check for admin flag (optional - can be removed)
      const adminFlag = localStorage.getItem('isAdmin')
      if (adminFlag === 'true') {
        return true
      }

      return false
    }

    const shouldShow = checkVisibility()
    setIsAdmin(shouldShow)
    setIsVisible(shouldShow)
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-6 left-6 z-50 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-all hover:scale-110 will-change-transform"
        title="Time Machine (Dev Only)"
        style={{ contain: 'layout style paint' }}
      >
        <Beaker className="w-6 h-6" />
      </button>

      {/* Time Machine Modal */}
      {isOpen && (
        <TimeMachineModal onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}

function TimeMachineModal({ onClose }: { onClose: () => void }) {
  const { state, info, actions } = useVirtualClock()
  const [travelDays, setTravelDays] = useState(1)
  const [travelHours, setTravelHours] = useState(0)
  const [jumpToDate, setJumpToDate] = useState('')

  useEffect(() => {
    // Set initial jump date to current virtual time
    const date = info.virtualTime.toISOString().split('T')[0]
    setJumpToDate(date)
  }, [info.virtualTime])

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ contain: 'layout style paint' }}>
      <div className="bg-soft-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-soft-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold">Time Machine (Dev Tool)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Virtual Time Status</h3>
              <button
                onClick={() => state.isEnabled ? actions.disable() : actions.enable()}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  state.isEnabled
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                }`}
              >
                {state.isEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Real Time:</span>
                <span className="font-mono">{formatDate(info.realTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Virtual Time:</span>
                <span className="font-mono font-bold text-purple-600">
                  {formatDate(info.virtualTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Offset:</span>
                <span className="font-mono">
                  {info.offset.days !== 0 && `${Math.abs(info.offset.days)}d `}
                  {info.offset.hours !== 0 && `${Math.abs(info.offset.hours)}h `}
                  {info.offset.minutes !== 0 && `${Math.abs(info.offset.minutes)}m`}
                  {info.offset.totalMs === 0 && 'None'}
                  {info.offset.totalMs < 0 && ' (past)'}
                  {info.offset.totalMs > 0 && ' (future)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`font-medium ${info.isFrozen ? 'text-blue-600' : 'text-green-600'}`}>
                  {info.isFrozen ? '❄️ Frozen' : '▶️ Running'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <h3 className="font-semibold">Quick Actions</h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => actions.travelDays(1)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                +1 Day
              </button>
              <button
                onClick={() => actions.travelDays(-1)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                -1 Day
              </button>
              <button
                onClick={() => actions.travelDays(7)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                +1 Week
              </button>
              <button
                onClick={() => actions.travelDays(-7)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                -1 Week
              </button>
              <button
                onClick={() => actions.travelDays(30)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                +1 Month
              </button>
              <button
                onClick={() => actions.travelDays(-30)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                -1 Month
              </button>
            </div>
          </div>

          {/* Custom Travel */}
          <div className="space-y-4">
            <h3 className="font-semibold">Custom Time Travel</h3>

            <div className="flex gap-3">
              <input
                type="number"
                value={travelDays}
                onChange={(e) => setTravelDays(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="Days"
              />
              <input
                type="number"
                value={travelHours}
                onChange={(e) => setTravelHours(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="Hours"
              />
              <button
                onClick={() => {
                  actions.travelDays(travelDays)
                  actions.travelHours(travelHours)
                }}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                Travel
              </button>
            </div>
          </div>

          {/* Jump to Date */}
          <div className="space-y-4">
            <h3 className="font-semibold">Jump to Specific Date</h3>

            <div className="flex gap-3">
              <input
                type="date"
                value={jumpToDate}
                onChange={(e) => setJumpToDate(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={() => {
                  if (jumpToDate) {
                    actions.jumpTo(new Date(jumpToDate))
                  }
                }}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Jump
              </button>
            </div>
          </div>

          {/* Freeze Controls */}
          <div className="space-y-4">
            <h3 className="font-semibold">Freeze Controls</h3>

            <div className="flex gap-3">
              <button
                onClick={() => info.isFrozen ? actions.unfreeze() : actions.freeze(info.virtualTime)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  info.isFrozen
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {info.isFrozen ? 'Unfreeze Time' : 'Freeze Time'}
              </button>
              <button
                onClick={() => actions.reset()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
              >
                Reset to Real Time
              </button>
            </div>
          </div>

          {/* History */}
          {state.history.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Recent History</h3>
                <button
                  onClick={() => actions.clearHistory()}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto">
                <div className="space-y-1 text-xs font-mono">
                  {state.history.slice(-10).reverse().map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {item.action}
                      </span>
                      <span className="text-gray-500">
                        {new Date(item.realTime).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div className="text-sm">
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Development Tool Only
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                  This time machine affects the Review Engine and Achievement System.
                  Changes persist in localStorage until reset.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}