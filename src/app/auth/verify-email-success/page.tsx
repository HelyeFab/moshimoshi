'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function VerifyEmailSuccessPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Redirect when countdown reaches 0
  useEffect(() => {
    if (countdown <= 0) {
      router.push('/dashboard')
    }
  }, [countdown, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Success Icon with Animation */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 animate-bounce-subtle">
          <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
        </div>

        {/* Title */}
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Email Verified! 🎉
        </h2>

        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Your email has been successfully verified
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-lg py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-200 dark:border-gray-700">

          {/* Success Message */}
          <div className="space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  You're all set!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your account is now fully activated. You can access all features of Moshimoshi and start your Japanese learning journey.
                </p>
              </div>
            </div>

            {/* Auto-redirect countdown */}
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Redirecting to your dashboard in{' '}
                <span className="font-bold text-primary-600 dark:text-primary-400">
                  {countdown}
                </span>{' '}
                {countdown === 1 ? 'second' : 'seconds'}...
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 transition-all duration-1000 ease-linear"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>

            {/* Manual action */}
            <div className="space-y-3">
              <Link
                href="/dashboard"
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white
                  bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700
                  dark:from-primary-600 dark:to-primary-700 dark:hover:from-primary-700 dark:hover:to-primary-800
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                  transition-all duration-200 hover:shadow-lg"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                or continue exploring
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/kanji-browser"
                  className="flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200
                    bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                    transition-colors"
                >
                  📝 Kanji Browser
                </Link>
                <Link
                  href="/vocabulary"
                  className="flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200
                    bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                    transition-colors"
                >
                  💬 Vocabulary
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6">
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            The verification banner will no longer appear on your account.
          </p>
        </div>
      </div>

      {/* Add bounce animation */}
      <style jsx>{`
        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
