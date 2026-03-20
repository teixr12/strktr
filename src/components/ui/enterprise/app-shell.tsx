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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-sand-500 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Pular para conteúdo
      </a>
      {sidebar}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {header}
        <main id="main-content" className="flex-1 overflow-y-auto px-0 pb-0">
          {children}
          {footer}
        </main>
      </div>
    </div>
  )
}
