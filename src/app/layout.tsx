import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import { ClientMonitoring } from '@/components/layout/client-monitoring'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#d4a373',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'STRKTR — Gestão Premium de Obras',
  description: 'Sistema de gestão premium para construtoras e obras',
  manifest: '/manifest.json',
  icons: {
    icon: '/strktr-favicon.png',
    apple: '/strktr-icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'STRKTR',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="scroll-smooth" suppressHydrationWarning>
      <body className="font-sans bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ClientMonitoring />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
