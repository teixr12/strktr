'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { track } from '@/lib/analytics/client'

type PortalAprovacao = {
  id: string
  tipo: 'compra' | 'orcamento'
  status: 'pendente' | 'aprovado' | 'reprovado'
  solicitado_em: string
  decisao_comentario: string | null
  decidido_em: string | null
  compra: { id: string; descricao: string; status: string; valor_estimado: number; valor_real: number | null } | null
  orcamento: { id: string; titulo: string; status: string; valor_total: number } | null
}

type PortalComentario = {
  id: string
  origem: 'cliente' | 'interno' | 'sistema'
  mensagem: string
  created_at: string
  aprovacao_id: string | null
  autor_nome: string
}

type PortalPayload = {
  portalCliente: { id: string; nome: string; email: string } | null
  obra: {
    id: string
    nome: string
    cliente: string
    local: string
    status: string
    progresso: number
    data_previsao: string | null
  }
  cronograma: {
    id: string
    nome: string
    data_inicio_planejada: string | null
    data_fim_planejada: string | null
  } | null
  cronogramaItens: Array<{
    id: string
    nome: string
    status: string
    empresa_responsavel: string | null
    responsavel: string | null
    data_inicio_planejada: string | null
    data_fim_planejada: string | null
    atraso_dias: number
    progresso: number
  }>
  diario: Array<{
    id: string
    tipo: string
    titulo: string
    descricao: string | null
    created_at: string
  }>
  aprovacoes: PortalAprovacao[]
  comentarios: PortalComentario[]
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

function fmtCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  token: string
}

export function PortalClientView({ token }: Props) {
  const [data, setData] = useState<PortalPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingComment, setSendingComment] = useState(false)
  const [comment, setComment] = useState('')
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null)
  const [rejectApprovalId, setRejectApprovalId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadSession = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/portal/session/${token}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Não foi possível abrir o portal do cliente')
      }

      setData(payload.data as PortalPayload)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Erro ao carregar portal')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  async function sendComment() {
    if (!comment.trim()) return
    setSendingComment(true)

    try {
      const response = await fetch('/api/v1/portal/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mensagem: comment.trim() }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Falha ao enviar comentário')
      }

      setComment('')
      await loadSession()
      track('portal_comment_created', {
        source: 'portal',
        entity_type: 'portal_comment',
        entity_id: (payload?.data?.id as string | undefined) || data?.obra.id || null,
        outcome: 'success',
      }).catch(() => undefined)
      toast('Comentário enviado', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao enviar comentário', 'error')
    } finally {
      setSendingComment(false)
    }
  }

  async function decideApproval(
    aprovacaoId: string,
    action: 'approve' | 'reject',
    reason?: string
  ) {
    let body: { token: string; comentario?: string } = { token }
    if (action === 'reject') {
      if (!reason?.trim()) {
        toast('Informe o motivo da reprovação', 'error')
        return
      }
      body = { token, comentario: reason.trim() }
    }

    setBusyApprovalId(aprovacaoId)
    try {
      const response = await fetch(`/api/v1/portal/aprovacoes/${aprovacaoId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Falha ao atualizar aprovação')
      }

      await loadSession()
      track('portal_approval_decision', {
        source: 'portal',
        entity_type: 'portal_approval',
        entity_id: aprovacaoId,
        outcome: 'success',
        decision: action,
      }).catch(() => undefined)
      if (action === 'approve') {
        toast('Aprovação registrada', 'success')
      } else {
        toast('Reprovação registrada', 'info')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao processar aprovação', 'error')
    } finally {
      setBusyApprovalId(null)
    }
  }

  async function submitRejectDecision() {
    if (!rejectApprovalId) return
    await decideApproval(rejectApprovalId, 'reject', rejectReason)
    setRejectApprovalId(null)
    setRejectReason('')
  }

  const pendingApprovals = useMemo(
    () => (data?.aprovacoes || []).filter((item) => item.status === 'pendente'),
    [data?.aprovacoes]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 text-center text-sm text-slate-500">
        Carregando portal do cliente...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-700">Acesso indisponível</h1>
          <p className="mt-2 text-sm text-red-600">{error || 'Este link é inválido ou expirou.'}</p>
          <button
            type="button"
            onClick={() => void loadSession()}
            className="mt-4 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Portal do Cliente</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{data.obra.nome}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.obra.cliente} · {data.obra.local} · previsão {fmtDate(data.obra.data_previsao)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Status: {data.obra.status}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">Progresso: {data.obra.progresso || 0}%</span>
            <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">Cliente: {data.portalCliente?.nome || 'Portal'}</span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Cronograma</h2>
              <span className="text-xs text-slate-500">{data.cronogramaItens.length} itens</span>
            </div>
            {data.cronogramaItens.length === 0 ? (
              <p className="text-sm text-slate-500">Cronograma ainda não definido.</p>
            ) : (
              <div className="space-y-2">
                {data.cronogramaItens.slice(0, 10).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{item.nome}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.atraso_dias > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.atraso_dias > 0 ? `Atraso ${item.atraso_dias}d` : item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {fmtDate(item.data_inicio_planejada)} → {fmtDate(item.data_fim_planejada)} · {item.empresa_responsavel || 'Equipe interna'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Aprovações pendentes</h2>
            <p className="mt-1 text-xs text-slate-500">Ações que precisam da sua decisão.</p>
            <div className="mt-3 space-y-2">
              {pendingApprovals.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma aprovação pendente.</p>
              ) : (
                pendingApprovals.map((approval) => (
                  <div key={approval.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-slate-900">
                      {approval.tipo === 'compra' ? approval.compra?.descricao : approval.orcamento?.titulo}
                    </p>
                    <p className="text-xs text-slate-600">
                      {approval.tipo === 'compra'
                        ? fmtCurrency(approval.compra?.valor_real ?? approval.compra?.valor_estimado)
                        : fmtCurrency(approval.orcamento?.valor_total)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => void decideApproval(approval.id, 'approve')}
                        disabled={busyApprovalId === approval.id}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => {
                          setRejectApprovalId(approval.id)
                          setRejectReason('')
                        }}
                        disabled={busyApprovalId === approval.id}
                        className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Reprovar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-base font-semibold text-slate-900">Diário da obra</h2>
            <div className="mt-3 space-y-2">
              {data.diario.length === 0 ? (
                <p className="text-sm text-slate-500">Sem atualizações no diário.</p>
              ) : (
                data.diario.slice(0, 12).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">{entry.titulo}</p>
                    {entry.descricao ? <p className="mt-1 text-xs text-slate-600">{entry.descricao}</p> : null}
                    <p className="mt-1 text-[11px] text-slate-400">{fmtDateTime(entry.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Chat da obra</h2>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
              {data.comentarios.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum comentário ainda.</p>
              ) : (
                data.comentarios.map((item) => (
                  <div key={item.id} className="rounded-xl bg-white p-2.5 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-700">{item.autor_nome}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.mensagem}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{fmtDateTime(item.created_at)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Escreva uma mensagem..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
            <button
              onClick={sendComment}
              disabled={sendingComment || !comment.trim()}
              className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sendingComment ? 'Enviando...' : 'Enviar comentário'}
            </button>
          </div>
        </section>
      </div>

      {rejectApprovalId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Reprovar solicitação
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Explique o motivo da reprovação para o time interno enviar a nova versão.
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Digite o motivo da reprovação..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectApprovalId(null)
                  setRejectReason('')
                }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitRejectDecision()}
                disabled={busyApprovalId === rejectApprovalId}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busyApprovalId === rejectApprovalId ? 'Enviando...' : 'Confirmar reprovação'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
