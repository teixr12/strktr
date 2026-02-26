import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sand-50 to-ocean-50 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-sand-400 dark:text-sand-600 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Página não encontrada</h2>
        <p className="text-sm text-gray-500 mb-6">A página que você procura não existe ou foi movida.</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-full transition-all btn-press text-sm"
        >
          Voltar ao Início
        </Link>
      </div>
    </div>
  )
}
