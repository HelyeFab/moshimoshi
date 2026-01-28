import { DoshiMascot } from '@/components/ui/DoshiMascot'

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center p-4">
      <div className="text-center">
        {/* Animated Mascot */}
        <div className="mb-6 flex justify-center">
          <DoshiMascot size="large" mood="loading" variant="animated" />
        </div>

        {/* Loading Text */}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Loading Admin Dashboard
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Please wait while we prepare your data...
        </p>

        {/* Spinner */}
        <div className="flex justify-center">
          <div className="w-12 h-12 border-4 border-primary-200 dark:border-primary-900 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  )
}
