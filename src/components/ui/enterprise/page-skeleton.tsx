'use client'

type PageSkeletonVariant = 'dashboard' | 'list' | 'grid' | 'detail' | 'kanban'

interface PageSkeletonProps {
  variant?: PageSkeletonVariant
}

/* ------------------------------------------------------------------ */
/*  Primitive skeleton building blocks                                 */
/* ------------------------------------------------------------------ */

function Bone({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

function SkeletonCard({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`enterprise-card p-5 ${className}`}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared page header skeleton                                        */
/* ------------------------------------------------------------------ */

function HeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Bone className="h-7 w-48" />
        <Bone className="h-4 w-72" />
      </div>
      <div className="flex items-center gap-3">
        <Bone className="h-10 w-28 rounded-xl" />
        <Bone className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Filter bar skeleton                                                */
/* ------------------------------------------------------------------ */

function FilterBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Bone className="h-10 w-64 rounded-xl" />
      <Bone className="h-10 w-32 rounded-xl" />
      <Bone className="h-10 w-32 rounded-xl" />
      <div className="ml-auto">
        <Bone className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Variant: Dashboard                                                 */
/*  4 KPI cards + large chart + 2 side-by-side section cards          */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="mb-4 flex items-start justify-between">
              <Bone className="h-11 w-11 rounded-xl" />
              <Bone className="h-5 w-14" />
            </div>
            <Bone className="h-8 w-24" />
            <Bone className="mt-2 h-4 w-36" />
            <Bone className="mt-4 h-2 w-full rounded-full" />
          </SkeletonCard>
        ))}
      </div>

      {/* Large chart area */}
      <SkeletonCard className="!p-6">
        <div className="mb-5 flex items-center justify-between">
          <Bone className="h-6 w-40" />
          <div className="flex gap-2">
            <Bone className="h-8 w-20 rounded-lg" />
            <Bone className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        <Bone className="h-64 w-full rounded-xl" />
      </SkeletonCard>

      {/* Two section cards side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} className="!p-6">
            <Bone className="mb-4 h-6 w-36" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Bone className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Bone className="h-4 w-3/4" />
                    <Bone className="h-3 w-1/2" />
                  </div>
                  <Bone className="h-5 w-16" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Variant: List                                                      */
/*  Page header + filter bar + table with 8 rows                      */
/* ------------------------------------------------------------------ */

function ListSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <FilterBarSkeleton />

      {/* Table */}
      <SkeletonCard className="!p-0 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 border-b border-gray-200/60 px-5 py-3 dark:border-gray-800/60">
          <Bone className="h-4 w-4 rounded" />
          <Bone className="h-4 w-32" />
          <Bone className="h-4 w-24" />
          <Bone className="h-4 w-28 hidden sm:block" />
          <Bone className="h-4 w-20 hidden md:block" />
          <Bone className="ml-auto h-4 w-16" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-gray-100/80 px-5 py-4 last:border-b-0 dark:border-gray-800/40"
          >
            <Bone className="h-4 w-4 rounded" />
            <Bone className="h-4 w-40" />
            <Bone className="h-6 w-20 rounded-full" />
            <Bone className="h-4 w-24 hidden sm:block" />
            <Bone className="h-4 w-16 hidden md:block" />
            <Bone className="ml-auto h-8 w-8 rounded-lg" />
          </div>
        ))}

        {/* Table footer / pagination */}
        <div className="flex items-center justify-between border-t border-gray-200/60 px-5 py-3 dark:border-gray-800/60">
          <Bone className="h-4 w-32" />
          <div className="flex gap-2">
            <Bone className="h-8 w-8 rounded-lg" />
            <Bone className="h-8 w-8 rounded-lg" />
            <Bone className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </SkeletonCard>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Variant: Grid                                                      */
/*  Page header + filter bar + 3x2 grid of cards                      */
/* ------------------------------------------------------------------ */

function GridSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <FilterBarSkeleton />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="mb-4 flex items-center gap-3">
              <Bone className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-5 w-3/5" />
                <Bone className="h-3 w-2/5" />
              </div>
              <Bone className="h-6 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              <Bone className="h-3.5 w-full" />
              <Bone className="h-3.5 w-4/5" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Bone className="h-4 w-20" />
              <Bone className="h-4 w-24" />
            </div>
            <Bone className="mt-3 h-2 w-full rounded-full" />
          </SkeletonCard>
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Variant: Detail                                                    */
/*  Page header + hero section + 3 section blocks                     */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <>
      <HeaderSkeleton />

      {/* Hero section */}
      <SkeletonCard className="!p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <Bone className="h-20 w-20 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Bone className="h-7 w-64" />
            <Bone className="h-4 w-96 max-w-full" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Bone className="h-7 w-24 rounded-full" />
              <Bone className="h-7 w-20 rounded-full" />
              <Bone className="h-7 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </SkeletonCard>

      {/* Section blocks */}
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} className="!p-6">
          <div className="mb-5 flex items-center justify-between">
            <Bone className="h-6 w-36" />
            <Bone className="h-8 w-24 rounded-xl" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-4">
                <Bone className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Bone className="h-4 w-3/4" />
                  <Bone className="h-3 w-1/2" />
                </div>
                <Bone className="h-4 w-20" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Variant: Kanban                                                    */
/*  Page header + 4 columns with 3 cards each                        */
/* ------------------------------------------------------------------ */

function KanbanSkeleton() {
  return (
    <>
      <HeaderSkeleton />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="space-y-3">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Bone className="h-5 w-24" />
                <Bone className="h-5 w-7 rounded-full" />
              </div>
              <Bone className="h-6 w-6 rounded-lg" />
            </div>

            {/* Column cards */}
            {Array.from({ length: 3 }).map((_, card) => (
              <SkeletonCard key={card} className="!p-4">
                <div className="mb-3 flex items-start justify-between">
                  <Bone className="h-5 w-3/4" />
                  <Bone className="h-5 w-5 rounded" />
                </div>
                <div className="space-y-1.5">
                  <Bone className="h-3 w-full" />
                  <Bone className="h-3 w-2/3" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Bone className="h-6 w-16 rounded-full" />
                  <div className="flex -space-x-1.5">
                    <Bone className="h-6 w-6 rounded-full" />
                    <Bone className="h-6 w-6 rounded-full" />
                  </div>
                </div>
              </SkeletonCard>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

const VARIANT_MAP: Record<PageSkeletonVariant, React.FC> = {
  dashboard: DashboardSkeleton,
  list: ListSkeleton,
  grid: GridSkeleton,
  detail: DetailSkeleton,
  kanban: KanbanSkeleton,
}

export function PageSkeleton({ variant = 'list' }: PageSkeletonProps) {
  const Variant = VARIANT_MAP[variant]
  return (
    <div className="tailadmin-page space-y-5 animate-slide-up">
      <Variant />
    </div>
  )
}
