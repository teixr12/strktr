export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-sand-100 via-white to-ocean-50 dark:from-gray-900 dark:via-gray-950 dark:to-slate-950 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
