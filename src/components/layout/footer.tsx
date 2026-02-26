export function Footer() {
  return (
    <footer className="border-t border-gray-200/70 bg-white/80 px-6 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 text-xs text-gray-500 sm:flex-row dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-2">
          <span>&copy; {new Date().getFullYear()} STRKTR</span>
          <span>·</span>
          <span>DBE11 LTDA</span>
          <span>·</span>
          <span>CNPJ: 53.903.617/0001-83</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Termos</button>
          <button className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Privacidade</button>
          <button className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Suporte</button>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <span>Powered by <span className="font-semibold text-sand-600 dark:text-sand-400">APXLBS</span></span>
        </div>
      </div>
    </footer>
  )
}
