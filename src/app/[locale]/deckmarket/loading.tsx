export default function DeckMarketLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="container mx-auto px-4 py-8 pb-24 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
        </div>

        {/* Search bar skeleton */}
        <div className="h-11 w-full bg-gray-200 dark:bg-dark-700 rounded-xl animate-pulse" />

        {/* Filter pills skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-14 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              <div className="h-20 bg-gray-200 dark:bg-dark-700 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="h-4 w-full bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-5 w-10 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
                  <div className="h-5 w-16 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
