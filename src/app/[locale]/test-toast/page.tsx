'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast/ToastContext';
import type { ToastType, ToastPosition } from '@/components/ui/Toast/ToastContext';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';

export default function ToastTestPage() {
  const { user } = useAuth();
  const { showToast, setPosition, position, clearToasts } = useToast();
  const [customMessage, setCustomMessage] = useState('This is a test toast message');
  const [duration, setDuration] = useState(4000);

  const toastTypes: ToastType[] = ['success', 'error', 'warning', 'info'];
  const toastPositions: ToastPosition[] = [
    'top',
    'top-left',
    'top-right',
    'bottom',
    'bottom-left',
    'bottom-right',
  ];

  const handleShowToast = (type: ToastType, withAction = false) => {
    if (withAction) {
      showToast(
        customMessage,
        type,
        duration,
        {
          label: 'Action',
          onClick: () => alert('Action clicked!'),
        }
      );
    } else {
      showToast(customMessage, type, duration);
    }
  };

  const handleShowMultiple = () => {
    showToast('First toast - Success', 'success', 6000);
    setTimeout(() => showToast('Second toast - Warning', 'warning', 6000), 500);
    setTimeout(() => showToast('Third toast - Error', 'error', 6000), 1000);
    setTimeout(() => showToast('Fourth toast - Info', 'info', 6000), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground dark:text-dark-100 mb-2">
            Toast Component Test Page
          </h1>
          <p className="text-muted-foreground dark:text-dark-400">
            Test all toast variants, positions, and features
          </p>
        </div>

        {/* Global Controls */}
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-foreground dark:text-dark-100 mb-4">
            Global Controls
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Custom Message */}
            <div>
              <label className="block text-sm font-medium text-foreground dark:text-dark-200 mb-2">
                Custom Message
              </label>
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
                placeholder="Enter custom message"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-foreground dark:text-dark-200 mb-2">
                Duration (ms)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
                min="0"
                step="1000"
              />
              <p className="text-xs text-muted-foreground dark:text-dark-400 mt-1">
                Set to 0 for no auto-dismiss
              </p>
            </div>
          </div>

          {/* Clear All Button */}
          <button
            onClick={clearToasts}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md font-medium transition-colors"
          >
            Clear All Toasts
          </button>
        </div>

        {/* Toast Position Selector */}
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-foreground dark:text-dark-100 mb-4">
            Toast Position
          </h2>
          <p className="text-sm text-muted-foreground dark:text-dark-400 mb-4">
            Current position: <span className="font-semibold text-primary">{position}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {toastPositions.map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  position === pos
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-foreground dark:text-dark-100 hover:bg-gray-200 dark:hover:bg-dark-600'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Toast Types */}
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-foreground dark:text-dark-100 mb-4">
            Toast Types
          </h2>

          <div className="space-y-6">
            {toastTypes.map((type) => (
              <div key={type} className="border-b border-gray-200 dark:border-dark-700 pb-4 last:border-b-0">
                <h3 className="text-lg font-medium text-foreground dark:text-dark-100 mb-3 capitalize">
                  {type}
                </h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleShowToast(type, false)}
                    className={`px-4 py-2 rounded-md font-medium text-white transition-colors ${
                      type === 'success'
                        ? 'bg-green-500 hover:bg-green-600'
                        : type === 'error'
                        ? 'bg-red-500 hover:bg-red-600'
                        : type === 'warning'
                        ? 'bg-yellow-500 hover:bg-yellow-600'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    Show {type}
                  </button>
                  <button
                    onClick={() => handleShowToast(type, true)}
                    className={`px-4 py-2 rounded-md font-medium text-white transition-colors ${
                      type === 'success'
                        ? 'bg-green-600 hover:bg-green-700'
                        : type === 'error'
                        ? 'bg-red-600 hover:bg-red-700'
                        : type === 'warning'
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Show {type} with Action
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Special Tests */}
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-foreground dark:text-dark-100 mb-4">
            Special Tests
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleShowMultiple}
              className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium transition-colors"
            >
              Show Multiple Toasts (Queue Test)
            </button>

            <button
              onClick={() => showToast('This is a very long toast message that should wrap properly and test how the toast component handles longer content without breaking the layout', 'info', 8000)}
              className="px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md font-medium transition-colors"
            >
              Show Long Message
            </button>

            <button
              onClick={() => showToast('Persistent toast (no auto-dismiss)', 'warning', 0)}
              className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-medium transition-colors"
            >
              Show Persistent Toast
            </button>

            <button
              onClick={() => {
                showToast('Testing iOS Dynamic Island positioning', 'info', 6000);
                setPosition('top');
              }}
              className="px-4 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-md font-medium transition-colors"
            >
              Test iOS Top Position
            </button>
          </div>
        </div>

        {/* Documentation */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-4">
            Toast API Reference
          </h2>

          <div className="space-y-4 text-sm text-blue-800 dark:text-blue-200">
            <div>
              <strong>Types:</strong> success, error, warning, info
            </div>
            <div>
              <strong>Positions:</strong> top, bottom, top-left, top-right, bottom-left, bottom-right
            </div>
            <div>
              <strong>Features:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li>Auto-dismiss with configurable duration</li>
                <li>Optional action buttons</li>
                <li>Manual close button</li>
                <li>Animated enter/exit transitions</li>
                <li>Dark mode support</li>
                <li>iOS Dynamic Island safe area handling</li>
                <li>Multiple toast queue (max 5)</li>
              </ul>
            </div>
            <div>
              <strong>Usage:</strong>
              <pre className="bg-white dark:bg-dark-900 p-3 rounded mt-2 overflow-x-auto">
{`const { showToast } = useToast();

// Basic toast
showToast('Message', 'success');

// With custom duration
showToast('Message', 'error', 5000);

// With action button
showToast('Message', 'warning', 4000, {
  label: 'Undo',
  onClick: () => { /* ... */ }
});`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
