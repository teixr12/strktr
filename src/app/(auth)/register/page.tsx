'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' }
    let score = 0
    if (password.length >= 6) score++
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-red-500' }
    if (score <= 2) return { score: 2, label: 'Razoável', color: 'bg-amber-500' }
    if (score <= 3) return { score: 3, label: 'Boa', color: 'bg-yellow-500' }
    if (score <= 4) return { score: 4, label: 'Forte', color: 'bg-emerald-500' }
    return { score: 5, label: 'Muito forte', color: 'bg-emerald-600' }
  }, [password])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!nome || !email || !password) {
      setError('Preencha todos os campos')
      return
    }
    if (password.length < 6) {
      setError('Senha deve ter ao menos 6 caracteres')
      return
    }

    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setMessage('Conta criada! Verifique seu email para confirmar.')
    setLoading(false)
  }

  async function handleGoogleSignUp() {
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) setError(oauthError.message)
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
          Criar Conta
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Preencha os dados para acessar o sistema
        </p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogleSignUp}
        type="button"
        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all shadow-sm hover:shadow-md"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continuar com Google
      </button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-gray-50 dark:bg-gray-950 text-gray-400">ou</span>
        </div>
      </div>

      <form onSubmit={handleRegister} className="space-y-3">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl">
            {message}
          </div>
        )}

        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome completo"
          className="w-full px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha (min. 6 caracteres)"
            className="w-full px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Password strength indicator */}
        {password && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    i <= passwordStrength.score ? passwordStrength.color : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Forca: <span className="font-medium">{passwordStrength.label}</span>
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-sand-500 to-sand-700 hover:from-sand-600 hover:to-sand-800 text-white font-medium rounded-2xl shadow-lg shadow-sand-500/25 btn-press transition-all disabled:opacity-60"
        >
          {loading ? 'Criando...' : 'Criar Conta'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ja tem conta?{' '}
          <Link
            href="/login"
            className="text-sand-600 hover:text-sand-700 dark:text-sand-400 dark:hover:text-sand-300 font-medium transition-colors"
          >
            &larr; Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}
