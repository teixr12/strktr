'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Mail, Lock, Waves } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Preencha email e senha')
      return
    }

    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : authError.message
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="glass rounded-3xl p-8 md:p-10 shadow-2xl animate-scale-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sand-400 to-sand-600 flex items-center justify-center shadow-xl">
          <Waves className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1 bg-gradient-to-r from-sand-700 to-sand-500 bg-clip-text text-transparent dark:from-sand-400 dark:to-sand-200">
          STRKTR
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">
          Sistema de Gestão Premium
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-3">
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
            placeholder="Email"
            className="w-full px-4 py-3.5 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 transition-all dark:text-white"
          />
          <Mail className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="relative">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full px-4 py-3.5 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 transition-all dark:text-white"
          />
          <Lock className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3.5 bg-gradient-to-r from-sand-500 to-sand-700 hover:from-sand-600 hover:to-sand-800 text-white font-medium rounded-2xl shadow-lg shadow-sand-500/25 transition-all btn-press flex items-center justify-center gap-2 group disabled:opacity-60"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin-slow" />
          ) : (
            <>
              <span>Acessar Sistema</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 text-center">
        <Link
          href="/register"
          className="text-sm text-gray-500 hover:text-sand-600 transition-colors"
        >
          Criar conta &rarr;
        </Link>
      </div>
    </div>
  )
}
