import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Left panel — hero/branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12 overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/strktr-hero-bg.jpg"
            alt=""
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-sand-900/90 via-sand-800/85 to-sand-700/80" />
        </div>

        <div className="relative z-10 text-white max-w-md">
          <Image
            src="/strktr-logo-white.png"
            alt="STRKTR"
            width={160}
            height={29}
            className="mb-8"
          />
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Gestão Premium de Obras
          </h2>
          <p className="text-white/70 text-sm leading-relaxed mb-8">
            Gerencie obras, leads, finanças e equipe em um sistema completo, inteligente e bonito.
          </p>

          {/* Testimonial card */}
          <div className="rounded-2xl p-5 bg-white/10 backdrop-blur-xl border border-white/10">
            <p className="text-sm italic text-white/90 leading-relaxed">
              &ldquo;O STRKTR transformou a gestão da minha construtora. Controlo tudo em um só lugar — do lead ao pós-obra.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                R
              </div>
              <div>
                <p className="text-sm font-semibold">Rodrigo T.</p>
                <p className="text-xs text-white/50">CEO · Construtora</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-6 text-white/40 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <span>99.9% uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <span>Dados criptografados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {children}
        </div>
      </div>
    </div>
  )
}
