export function Footer() {
  return (
    <footer className="border-t border-gray-200/50 dark:border-gray-800/50 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm px-4 py-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-1.5">
          <span>&copy; {new Date().getFullYear()} STRKTR</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">DBE11 LTDA</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">CNPJ: 53.903.617/0001-83</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Termos</button>
          <button className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Privacidade</button>
          <button className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Suporte</button>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <span>Powered by <span className="font-semibold text-sand-500">APXLBS</span></span>
        </div>
      </div>
    </footer>
  )
}
