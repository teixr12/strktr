'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Informe seu email')
      return
    }

    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/perfil`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="animate-scale-in">
      <div className="text-center mb-8">
        <Image
          src="/strktr-logo-black.png"
          alt="STRKTR"
          width={140}
          height={25}
          className="mx-auto mb-4 dark:hidden"
        />
        <Image
          src="/strktr-logo-white.png"
          alt="STRKTR"
          width={140}
          height={25}
          className="mx-auto mb-4 hidden dark:block"
        />
        <h1 className="text-2xl font-semibold tracking-tight mb-1 text-gray-900 dark:text-white">
          Recuperar Senha
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Enviaremos um link de redefinicao para seu email
        </p>
      </div>

      {sent ? (
        <div className="text-center space-y-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              Email enviado com sucesso!
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-sand-600 hover:text-sand-700 dark:text-sand-400 dark:hover:text-sand-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleReset} className="space-y-3">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl">
              {error}
            </div>
          )}

          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu email cadastrado"
              className="w-full px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 transition-all dark:text-white pr-10"
            />
            <Mail className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-sand-500 to-sand-700 hover:from-sand-600 hover:to-sand-800 text-white font-medium rounded-2xl shadow-lg shadow-sand-500/25 transition-all btn-press flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin-slow" />
            ) : (
              <span>Enviar Link de Recuperacao</span>
            )}
          </button>

          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-sand-600 dark:text-gray-400 dark:hover:text-sand-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao login
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
