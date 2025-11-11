'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import CelebrationScreen from '@/components/gamification/CelebrationScreen'
import SessionSummary from '@/components/review-engine/SessionSummary'

export default function TestModalPage() {
  const [showModal, setShowModal] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showSessionSummary, setShowSessionSummary] = useState(false)

  // Mock session statistics for SessionSummary
  const mockStatistics = {
    sessionId: 'test-123',
    totalItems: 20,
    completedItems: 20,
    correctItems: 16,
    incorrectItems: 4,
    skippedItems: 0,
    accuracy: 80,
    averageResponseTime: 2500,
    totalTime: 120000, // 2 minutes
    currentStreak: 5,
    bestStreak: 12,
    performanceByDifficulty: {
      easy: { correct: 8, total: 10, avgTime: 2000 },
      medium: { correct: 5, total: 7, avgTime: 3000 },
      hard: { correct: 3, total: 3, avgTime: 4000 }
    },
    performanceByMode: {
      recognition: { correct: 16, total: 20, avgTime: 2500 }
    },
    totalScore: 1600,
    maxPossibleScore: 2000,
    totalHintsUsed: 2,
    averageHintsPerItem: 0.1
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-900 dark:to-dark-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Modal Component Test Page</h1>

        <p className="text-center mb-8 text-gray-600 dark:text-gray-400">
          Test all modals with the SessionSummary mobile-perfect centering pattern
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Test Regular Modal */}
          <button
            onClick={() => setShowModal(true)}
            className="p-6 bg-white dark:bg-dark-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-bold mb-2">Regular Modal</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Test the standard Modal component with random content
            </p>
          </button>

          {/* Test Celebration Screen */}
          <button
            onClick={() => setShowCelebration(true)}
            className="p-6 bg-white dark:bg-dark-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">🎉</div>
            <h3 className="font-bold mb-2">Celebration Screen</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Universal success screen used for XP, payments, achievements
            </p>
          </button>

          {/* Test Command Palette */}
          <button
            onClick={() => {
              // Dispatch keyboard event to trigger command palette
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                ctrlKey: true,
                bubbles: true
              })
              document.dispatchEvent(event)
            }}
            className="p-6 bg-white dark:bg-dark-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">⌘</div>
            <h3 className="font-bold mb-2">Command Palette</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Dashboard navigation menu (Cmd/Ctrl+K)
            </p>
          </button>

          {/* Test Session Summary */}
          <button
            onClick={() => setShowSessionSummary(true)}
            className="p-6 bg-white dark:bg-dark-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-bold mb-2">Session Summary</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The reference component with perfect mobile centering
            </p>
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <h3 className="font-bold mb-2 flex items-center gap-2">
            <span>📱</span>
            Mobile Testing Instructions
          </h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>✓ All modals should be perfectly centered on mobile</li>
            <li>✓ Max width should be <code className="px-1 py-0.5 bg-white dark:bg-dark-700 rounded">max-w-md</code> (448px)</li>
            <li>✓ Outer wrapper has <code className="px-1 py-0.5 bg-white dark:bg-dark-700 rounded">p-4</code> padding</li>
            <li>✓ Content should not touch screen edges on small devices</li>
            <li>✓ Backdrop should blur background content</li>
          </ul>
        </div>

        {/* Pattern Reference */}
        <div className="mt-6 p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <h3 className="font-bold mb-2 flex items-center gap-2">
            <span>✨</span>
            SessionSummary Pattern
          </h3>
          <pre className="text-xs bg-white dark:bg-dark-700 p-4 rounded-lg overflow-x-auto">
{`// Outer wrapper
<div className="fixed inset-0 flex items-center justify-center p-4">

  // Inner card
  <div className="bg-white dark:bg-dark-800 max-w-md w-full">
    Content here
  </div>
</div>`}
          </pre>
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Test Modal"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            This is a test modal with random content to verify the mobile centering pattern.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">42</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Random Stat</div>
            </div>
            <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">87%</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Accuracy</div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 This modal should be perfectly centered on mobile with max-w-md width!
            </p>
          </div>

          <button
            onClick={() => setShowModal(false)}
            className="w-full py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
          >
            Close Modal
          </button>
        </div>
      </Modal>

      <CelebrationScreen
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        userName="Tester"
        xpGained={250}
        accuracy={85}
        duration={180000}
        itemsCompleted={15}
      />

      {showSessionSummary && (
        <SessionSummary
          statistics={mockStatistics}
          onClose={() => setShowSessionSummary(false)}
        />
      )}

      {/* Command Palette is now global - rendered in root layout */}
    </div>
  )
}
