import type { ReactNode } from 'react'

interface AppShellProps {
  sidebar: ReactNode
  header: ReactNode
  footer?: ReactNode
  children: ReactNode
}

export function AppShell({ sidebar, header, footer, children }: AppShellProps) {
  return (
    <div className="h-screen flex flex-col md:flex-row bg-app-gradient text-app-foreground">
      {sidebar}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {header}
        <div className="flex-1 overflow-y-auto px-0 pb-0">
          {children}
          {footer}
        </div>
      </main>
    </div>
  )
}
