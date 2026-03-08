'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Gift, RefreshCcw, Send, UserPlus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import type { ReferralRecord, ReferralStatus, ReferralSummary } from '@/shared/types/referral'

type Meta = {
  summary?: ReferralSummary
}

type FormState = {
  invited_email: string
  referred_name: string
  status: ReferralStatus
  rewardDisplay: string
  notes: string
  expires_at: string
}

const STATUS_LABELS: Record<ReferralStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  activated: 'Ativada',
  rewarded: 'Recompensada',
  expired: 'Expirada',
}

function currencyFromCents(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
}

function emptyForm(): FormState {
  return {
    invited_email: '',
    referred_name: '',
    status: 'draft',
    rewardDisplay: '0',
    notes: '',
    expires_at: '',
  }
}

function formFromReferral(referral: ReferralRecord): FormState {
  return {
    invited_email: referral.invited_email || '',
    referred_name: referral.referred_name || '',
    status: referral.status,
    rewardDisplay: String((referral.reward_cents || 0) / 100),
    notes: referral.notes || '',
    expires_at: referral.expires_at ? referral.expires_at.slice(0, 10) : '',
  }
}

function toPayload(form: FormState) {
  const reward = Number.parseFloat((form.rewardDisplay || '0').replace(',', '.'))
  return {
    invited_email: form.invited_email.trim() || null,
    referred_name: form.referred_name.trim() || null,
    status: form.status,
    reward_cents: Number.isFinite(reward) ? Math.max(0, Math.round(reward * 100)) : 0,
    notes: form.notes.trim() || null,
    expires_at: form.expires_at ? `${form.expires_at}T23:59:59.000Z` : null,
  }
}

export function IndicacoesContent() {
  const [items, setItems] = useState<ReferralRecord[]>([])
  const [summary, setSummary] = useState<ReferralSummary>({
    total: 0,
    draft: 0,
    sent: 0,
    activated: 0,
    rewarded: 0,
    expired: 0,
    totalRewardCents: 0,
  })
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralStatus>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ReferralRecord | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return [item.code, item.invited_email || '', item.referred_name || '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [items, query, statusFilter])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const search = new URLSearchParams()
      if (appliedQuery.trim()) search.set('q', appliedQuery.trim())
      if (statusFilter !== 'all') search.set('status', statusFilter)
      const suffix = search.toString() ? `?${search.toString()}` : ''
      const payload = await apiRequestWithMeta<ReferralRecord[], Meta>(`/api/v1/referrals${suffix}`)
      setItems(payload.data)
      setSummary(
        payload.meta?.summary || {
          total: payload.data.length,
          draft: payload.data.filter((item) => item.status === 'draft').length,
          sent: payload.data.filter((item) => item.status === 'sent').length,
          activated: payload.data.filter((item) => item.status === 'activated').length,
          rewarded: payload.data.filter((item) => item.status === 'rewarded').length,
          expired: payload.data.filter((item) => item.status === 'expired').length,
          totalRewardCents: payload.data.reduce((sum, item) => sum + item.reward_cents, 0),
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar indicações'
      setError(message)
      toast(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [appliedQuery, statusFilter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    try {
      if (editing) {
        await apiRequest<ReferralRecord>(`/api/v1/referrals/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(toPayload(form)),
        })
        toast('Indicação atualizada com sucesso', 'success')
      } else {
        await apiRequest<ReferralRecord>('/api/v1/referrals', {
          method: 'POST',
          body: JSON.stringify(toPayload(form)),
        })
        toast('Indicação criada com sucesso', 'success')
      }
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm())
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar indicação', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast('Código copiado', 'success')
    } catch {
      toast('Não foi possível copiar o código', 'error')
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(item: ReferralRecord) {
    setEditing(item)
    setForm(formFromReferral(item))
    setShowForm(true)
  }

  if (!isLoading && items.length === 0 && !showForm) {
    return (
      <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
        <PageHeader
          title="Indicações"
          subtitle="Programa de indicação com backend real e rollout controlado"
          actions={
            <QuickActionBar
              actions={[
                { label: 'Nova indicação', icon: <UserPlus className="h-4 w-4" />, onClick: openCreate },
                { label: 'Atualizar', icon: <RefreshCcw className="h-4 w-4" />, onClick: () => void refresh() },
              ]}
            />
          }
        />
        <EmptyStateAction
          icon={<Gift className="h-5 w-5 text-sand-600" />}
          title="Nenhuma indicação cadastrada"
          description="Crie o primeiro código de indicação e acompanhe envios, ativações e recompensas sem depender de planilhas." 
          actionLabel="Criar primeira indicação"
          onAction={openCreate}
        />
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
      <PageHeader
        title="Indicações"
        subtitle="Acompanhe o pipeline de indicação da organização"
        actions={
          <QuickActionBar
            actions={[
              { label: 'Nova indicação', icon: <UserPlus className="h-4 w-4" />, onClick: openCreate },
              { label: 'Atualizar', icon: <RefreshCcw className="h-4 w-4" />, onClick: () => void refresh() },
            ]}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard className="p-4"><p className="text-xs uppercase tracking-wide text-gray-500">Total</p><p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.total}</p></SectionCard>
        <SectionCard className="p-4"><p className="text-xs uppercase tracking-wide text-gray-500">Ativadas</p><p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.activated}</p></SectionCard>
        <SectionCard className="p-4"><p className="text-xs uppercase tracking-wide text-gray-500">Recompensadas</p><p className="mt-2 text-2xl font-semibold text-blue-600">{summary.rewarded}</p></SectionCard>
        <SectionCard className="p-4"><p className="text-xs uppercase tracking-wide text-gray-500">Valor potencial</p><p className="mt-2 text-2xl font-semibold text-amber-600">{currencyFromCents(summary.totalRewardCents)}</p></SectionCard>
      </div>

      <SectionCard className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por código, email ou nome"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-sand-400 dark:border-gray-800 dark:bg-gray-950"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ReferralStatus)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-sand-400 dark:border-gray-800 dark:bg-gray-950"
          >
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAppliedQuery(query.trim())}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Aplicar
          </button>
        </div>
      </SectionCard>

      {showForm ? (
        <SectionCard className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editing ? 'Editar indicação' : 'Nova indicação'}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                O fluxo é interno por enquanto. Não existe landing pública nem payout automático nesta fase.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditing(null)
                setForm(emptyForm())
              }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 dark:border-gray-800 dark:text-gray-300"
            >
              Fechar
            </button>
          </div>

          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
            <input value={form.referred_name} onChange={(event) => setForm((current) => ({ ...current, referred_name: event.target.value }))} placeholder="Nome do indicado" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950" />
            <input value={form.invited_email} onChange={(event) => setForm((current) => ({ ...current, invited_email: event.target.value }))} placeholder="Email do indicado" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950" />
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ReferralStatus }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input value={form.rewardDisplay} onChange={(event) => setForm((current) => ({ ...current, rewardDisplay: event.target.value }))} placeholder="Valor da recompensa (R$)" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950" />
            <input type="date" value={form.expires_at} onChange={(event) => setForm((current) => ({ ...current, expires_at: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950" />
            <div className="md:col-span-2">
              <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notas internas" rows={4} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={isSaving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar indicação'}
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      {error ? (
        <SectionCard className="border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={() => void refresh()} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">Tentar novamente</button>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map((item) => (
          <SectionCard key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.referred_name || item.invited_email || 'Indicação sem nome'}</h3>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">{STATUS_LABELS[item.status]}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Código: <span className="font-semibold text-gray-900 dark:text-white">{item.code}</span></p>
                {item.invited_email ? <p className="text-sm text-gray-600 dark:text-gray-300">{item.invited_email}</p> : null}
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>{currencyFromCents(item.reward_cents)}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Expira em</p>
                <p className="mt-1 font-medium text-gray-900 dark:text-white">{item.expires_at ? new Date(item.expires_at).toLocaleDateString('pt-BR') : 'Sem prazo'}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Última atualização</p>
                <p className="mt-1 font-medium text-gray-900 dark:text-white">{new Date(item.updated_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
            {item.notes ? <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{item.notes}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void handleCopy(item.code)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:text-gray-200"><Copy className="h-3.5 w-3.5" />Copiar código</button>
              <button type="button" onClick={() => openEdit(item)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"><Send className="h-3.5 w-3.5" />Editar</button>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  )
}
