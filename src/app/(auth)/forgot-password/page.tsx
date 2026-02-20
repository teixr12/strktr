'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
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
    <div className="glass rounded-3xl p-8 md:p-10 shadow-2xl animate-scale-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sand-400 to-sand-600 flex items-center justify-center shadow-xl">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4C7 4 8 4 12 4C16 4 17 7 17 9C17 11 15 12 12 12C9 12 7 13 7 15C7 17 8 20 12 20C16 20 17 20 17 20" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1 bg-gradient-to-r from-sand-700 to-sand-500 bg-clip-text text-transparent dark:from-sand-400 dark:to-sand-200">
          Recuperar Senha
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">
          Enviaremos um link de redefinição para seu email
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
              className="w-full px-4 py-3.5 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 transition-all dark:text-white"
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
              <span>Enviar Link de Recuperação</span>
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
