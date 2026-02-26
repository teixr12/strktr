export default function FinanceiroLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-7 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="glass-card rounded-3xl p-6">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
        <div className="h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Table skeleton */}
      <div className="glass-card rounded-3xl p-6 space-y-3">
        <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    </div>
  )
}
