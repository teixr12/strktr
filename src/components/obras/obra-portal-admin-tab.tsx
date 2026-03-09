'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Loader2, Mail, RefreshCw, Save, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'
import { track } from '@/lib/analytics/client'
import type {
  PortalAdminRegenerateInviteResult,
  PortalAdminSessionSummary,
  PortalAdminSettings,
  PortalAdminSettingsPayload,
} from '@/shared/types/portal-admin'

type Props = {
  obraId: string
  v2Enabled?: boolean
}

type BrandingFormState = {
  branding_nome: string
  branding_logo_url: string
  branding_cor_primaria: string
  mensagem_boas_vindas: string
  notificar_por_email: boolean
}

function toBrandingForm(settings: PortalAdminSettings): BrandingFormState {
  return {
    branding_nome: settings.branding_nome || '',
    branding_logo_url: settings.branding_logo_url || '',
    branding_cor_primaria: settings.branding_cor_primaria || '#D4A574',
    mensagem_boas_vindas: settings.mensagem_boas_vindas || '',
    notificar_por_email: settings.notificar_por_email,
  }
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

function normalizeHexColor(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '#D4A574'
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

function sessionBadgeStyle(status: PortalAdminSessionSummary['status']): string {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700'
  if (status === 'expired') return 'bg-amber-100 text-amber-700'
  if (status === 'revoked') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function sessionLabel(status: PortalAdminSessionSummary['status']): string {
  if (status === 'active') return 'Ativa'
  if (status === 'expired') return 'Expirada'
  if (status === 'revoked') return 'Revogada'
  return 'Sem sessão'
}

export function ObraPortalAdminTab({ obraId, v2Enabled = false }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PortalAdminSettingsPayload | null>(null)
  const [form, setForm] = useState<BrandingFormState>({
    branding_nome: '',
    branding_logo_url: '',
    branding_cor_primaria: '#D4A574',
    mensagem_boas_vindas: '',
    notificar_por_email: true,
  })
  const [expiresInDays, setExpiresInDays] = useState(30)
  const [busyClientId, setBusyClientId] = useState<string | null>(null)
  const [inviteResultByClient, setInviteResultByClient] = useState<
    Record<string, PortalAdminRegenerateInviteResult>
  >({})

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = await apiRequest<PortalAdminSettingsPayload>(
        `/api/v1/portal/admin/settings?obra_id=${obraId}`
      )
      setData(payload)
      setForm(toBrandingForm(payload.settings))
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Erro ao carregar painel de portal')
    } finally {
      setLoading(false)
    }
  }, [obraId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const hasClients = useMemo(() => (data?.clients || []).length > 0, [data?.clients])
  const sessionSummary = useMemo(() => {
    const totals = {
      totalClients: data?.clients.length || 0,
      activeClients: 0,
      activeSessions: 0,
      expiredSessions: 0,
      revokedSessions: 0,
      neverActivated: 0,
    }

    for (const client of data?.clients || []) {
      if (client.ativo) totals.activeClients += 1
      const status = client.latest_session?.status || 'none'
      if (status === 'active') totals.activeSessions += 1
      if (status === 'expired') totals.expiredSessions += 1
      if (status === 'revoked') totals.revokedSessions += 1
      if (status === 'none') totals.neverActivated += 1
    }

    return totals
  }, [data?.clients])
  const brandPreview = useMemo(
    () => ({
      nome: form.branding_nome.trim() || data?.obra.nome || 'Portal do cliente',
      logo: form.branding_logo_url.trim() || null,
      cor: normalizeHexColor(form.branding_cor_primaria),
      mensagem:
        form.mensagem_boas_vindas.trim() ||
        'Acompanhe o andamento da obra, aprovações pendentes e atualizações recentes em um único lugar.',
    }),
    [data?.obra.nome, form.branding_cor_primaria, form.branding_logo_url, form.branding_nome, form.mensagem_boas_vindas]
  )

  async function saveSettings() {
    setSaving(true)
    try {
      const payload = await apiRequest<{ settings: PortalAdminSettings }>(
        `/api/v1/portal/admin/settings?obra_id=${obraId}`,
        {
          method: 'PATCH',
          body: {
            branding_nome: form.branding_nome.trim() || null,
            branding_logo_url: form.branding_logo_url.trim() || null,
            branding_cor_primaria: normalizeHexColor(form.branding_cor_primaria),
            mensagem_boas_vindas: form.mensagem_boas_vindas.trim() || null,
            notificar_por_email: form.notificar_por_email,
          },
        }
      )

      setData((current) => (current ? { ...current, settings: payload.settings } : current))
      setForm(toBrandingForm(payload.settings))
      track('portal_admin_updated', {
        source: 'obras',
        entity_type: 'portal_admin_settings',
        entity_id: payload.settings.id,
        outcome: 'success',
      }).catch(() => undefined)
      toast('Configurações do portal atualizadas', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar configurações', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function regenerateInvite(portalClienteId: string) {
    setBusyClientId(portalClienteId)
    try {
      const result = await apiRequest<PortalAdminRegenerateInviteResult>(
        `/api/v1/portal/admin/invites/${portalClienteId}/regenerate`,
        {
          method: 'POST',
          body: { expiresInDays },
        }
      )
      setInviteResultByClient((current) => ({ ...current, [portalClienteId]: result }))
      toast(result.emailSent ? 'Novo convite enviado por e-mail' : 'Novo magic link gerado', 'success')
      await loadData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao regenerar convite', 'error')
    } finally {
      setBusyClientId(null)
    }
  }

  async function copyInviteLink(portalClienteId: string) {
    const url = inviteResultByClient[portalClienteId]?.portalUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('Magic link copiado', 'success')
    } catch {
      toast('Não foi possível copiar o magic link', 'error')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-56 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{error || 'Falha ao carregar painel do portal'}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {v2Enabled && (
        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl border border-sand-200 bg-sand-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sand-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Portal Admin V2
                </div>
                <h3 className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  Governança do portal do cliente
                </h3>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {data.obra.nome} · {data.obra.cliente} · {data.obra.status}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/portal-admin/${obraId}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-sand-300 bg-white px-3 py-2 text-xs font-semibold text-sand-800 hover:bg-sand-100"
                >
                  Painel dedicado
                </Link>
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving}
                  aria-busy={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <Users className="h-3.5 w-3.5" />
                  Clientes
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{sessionSummary.totalClients}</p>
                <p className="text-[11px] text-gray-500">{sessionSummary.activeClients} ativos</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Sessões ativas
                </div>
                <p className="mt-2 text-2xl font-semibold text-emerald-600">{sessionSummary.activeSessions}</p>
                <p className="text-[11px] text-gray-500">{sessionSummary.neverActivated} sem acesso ainda</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sessões expiradas
                </div>
                <p className="mt-2 text-2xl font-semibold text-amber-600">{sessionSummary.expiredSessions}</p>
                <p className="text-[11px] text-gray-500">{sessionSummary.revokedSessions} revogadas</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <Mail className="h-3.5 w-3.5" />
                  Notificação
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  {form.notificar_por_email ? 'Email ativo' : 'Email desativado'}
                </p>
                <p className="text-[11px] text-gray-500">Regenera convite com o padrão atual da obra.</p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4 text-white"
            style={{ background: `linear-gradient(135deg, ${brandPreview.cor} 0%, #1f2937 100%)` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Preview do portal</p>
            <div className="mt-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-sm font-semibold">
                  {brandPreview.logo ? 'Logo' : brandPreview.nome.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{brandPreview.nome}</p>
                  <p className="text-xs text-white/70">Portal do cliente</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/90">{brandPreview.mensagem}</p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-white/70">
                <span className="rounded-full bg-white/15 px-2 py-1">Magic link seguro</span>
                <span className="rounded-full bg-white/15 px-2 py-1">Branding por obra</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Portal Admin</p>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Branding e governança do portal da obra
            </h3>
            <p className="text-xs text-gray-500">
              {data.obra.nome} · {data.obra.cliente} · {data.obra.status}
            </p>
          </div>
          {!v2Enabled && (
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              aria-busy={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Nome da marca</span>
            <input
              value={form.branding_nome}
              onChange={(event) => setForm((current) => ({ ...current, branding_nome: event.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Ex: STRKTR Engenharia"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Logo (URL)</span>
            <input
              value={form.branding_logo_url}
              onChange={(event) => setForm((current) => ({ ...current, branding_logo_url: event.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Cor primária</span>
            <input
              value={form.branding_cor_primaria}
              onChange={(event) => setForm((current) => ({ ...current, branding_cor_primaria: event.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="#D4A574"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Notificação por e-mail</span>
            <select
              value={form.notificar_por_email ? 'true' : 'false'}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notificar_por_email: event.target.value === 'true',
                }))
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="true">Ativada</option>
              <option value="false">Desativada</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-gray-500">Mensagem de boas-vindas</span>
            <textarea
              value={form.mensagem_boas_vindas}
              onChange={(event) =>
                setForm((current) => ({ ...current, mensagem_boas_vindas: event.target.value }))
              }
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Mensagem exibida ao cliente no portal..."
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Clientes do Portal</h3>
            <p className="text-xs text-gray-500">Gerencie sessões e regeneração de magic link por cliente.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Expiração (dias)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={expiresInDays}
              onChange={(event) => {
                const value = Number(event.target.value || 30)
                if (!Number.isFinite(value)) return
                setExpiresInDays(Math.max(1, Math.min(90, Math.round(value))))
              }}
              className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
            />
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RefreshCw className="h-3 w-3" />
              Atualizar
            </button>
          </div>
        </div>

        {!hasClients ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500">
            Nenhum cliente do portal cadastrado para esta obra ainda.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {data.clients.map((client) => {
              const latestInvite = inviteResultByClient[client.id]
              return (
                <div
                  key={client.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{client.nome}</p>
                      <p className="text-xs text-gray-500">{client.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sessionBadgeStyle(client.latest_session?.status || 'none')}`}
                        >
                          {sessionLabel(client.latest_session?.status || 'none')}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Último acesso: {fmtDateTime(client.latest_session?.last_accessed_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void regenerateInvite(client.id)}
                        disabled={busyClientId === client.id}
                        aria-busy={busyClientId === client.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                      >
                        {busyClientId === client.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Regenerar link
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyInviteLink(client.id)}
                        disabled={!latestInvite?.portalUrl}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </button>
                    </div>
                  </div>

                  {latestInvite ? (
                    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-[11px] text-blue-700">
                      Novo link gerado com validade até {fmtDateTime(latestInvite.expiresAt)}
                      {latestInvite.emailSent ? ' (enviado por e-mail).' : ' (e-mail não enviado).'}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
