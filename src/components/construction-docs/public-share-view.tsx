'use client'

import { useEffect, useState } from 'react'
import { Loader2, Lock, RefreshCw } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface SharePayload {
  document: {
    id: string
    type: 'INSPECTION' | 'SOP' | 'SCHEDULE'
    status: 'DRAFT' | 'FINAL'
    payload: Record<string, unknown>
    rendered_html: string | null
    updated_at: string
  }
  expiresAt: string
}

export function ConstructionDocsPublicShareView({ token }: { token: string }) {
  const [data, setData] = useState<SharePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')

  async function load(currentPassword?: string) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/construction-docs/share/${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(currentPassword ? { 'x-share-password': currentPassword } : {}),
        },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Não foi possível acessar o documento')
      }

      setData(payload.data as SharePayload)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Erro ao carregar compartilhamento')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function submitPassword() {
    if (!password.trim()) {
      toast('Informe a senha do link', 'error')
      return
    }
    void load(password.trim())
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-8 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">STRKTR Construction Docs</h1>
          <p className="mt-1 text-sm text-gray-500">Visualização pública de documento compartilhado</p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <div className="inline-flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando documento...
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Senha do link (se necessário)"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <button
                type="button"
                onClick={submitPassword}
                className="rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600"
              >
                Acessar
              </button>
              <button
                type="button"
                onClick={() => void load(password.trim() || undefined)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Tipo: <span className="font-semibold">{data.document.type}</span> · Status:{' '}
                <span className="font-semibold">{data.document.status}</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Link expira em {new Date(data.expiresAt).toLocaleString('pt-BR')}
              </p>
            </div>

            {data.document.rendered_html ? (
              <iframe
                title="Documento compartilhado"
                srcDoc={data.document.rendered_html}
                className="h-[70vh] w-full rounded-2xl border border-gray-200 bg-white dark:border-gray-700"
              />
            ) : (
              <pre className="max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                {JSON.stringify(data.document.payload, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
