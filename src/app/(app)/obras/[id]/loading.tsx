export default function ObraDetailLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-2">
              <div className="h-6 w-48 rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-32 rounded-lg bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
          <div className="h-8 w-24 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-6 w-28 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="glass-card rounded-3xl p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    </div>
  )
}
