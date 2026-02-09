export default function AdminDeckMarketLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-dark-700 rounded-xl animate-pulse" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-dark-700 animate-pulse" />
              <div className="space-y-2">
                <div className="h-7 w-12 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters skeleton */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-gray-200 dark:bg-dark-700 rounded-xl animate-pulse" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 w-20 bg-gray-200 dark:bg-dark-700 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* List skeleton */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 divide-y divide-gray-200 dark:divide-dark-700">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-5 w-2/3 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
              <div className="h-6 w-20 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
