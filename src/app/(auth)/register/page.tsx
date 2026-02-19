'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RegisterPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()

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

  return (
    <div className="glass rounded-3xl p-8 md:p-10 shadow-2xl animate-scale-in">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Criar Conta
        </h2>
        <p className="text-gray-500 text-xs mt-1">
          Preencha os dados para acessar
        </p>
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
          placeholder="Seu nome"
          className="w-full px-4 py-3.5 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-3.5 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha (min. 6 caracteres)"
          className="w-full px-4 py-3.5 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-sand-500 to-sand-700 text-white font-medium rounded-2xl btn-press transition-all disabled:opacity-60"
        >
          {loading ? 'Criando...' : 'Criar Conta'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-sm text-gray-500 hover:text-sand-600 transition-colors"
        >
          &larr; Voltar ao login
        </Link>
      </div>
    </div>
  )
}
