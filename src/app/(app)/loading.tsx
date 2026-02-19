export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg skeleton" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded mt-2 skeleton" />
        </div>
        <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-full skeleton" />
      </div>

      {/* KPI skeletons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-xl skeleton" />
            <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded skeleton" />
            <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded skeleton" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="glass-card rounded-3xl p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-11 w-11 bg-gray-200 dark:bg-gray-700 rounded-xl skeleton flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded skeleton" />
              <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded skeleton" />
            </div>
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full skeleton" />
          </div>
        ))}
      </div>
    </div>
  )
}
