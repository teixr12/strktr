'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Loader2, RefreshCcw, Save, ShieldCheck, Telescope, Wrench } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import type {
  AgentReadyActionDefinition,
  AgentReadyChecklistItem,
  AgentReadyProfile,
  AgentReadyProfileStatus,
  AgentReadyProfileSummary,
  AgentReadyProfileType,
  AgentReadyScopeDefinition,
  AgentReadySummary,
  AgentReadySurface,
} from '@/shared/types/agent-ready'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'

type Meta = {
  summary?: AgentReadySummary
  checklist?: AgentReadyChecklistItem[]
  scopes?: AgentReadyScopeDefinition[]
  actions?: AgentReadyActionDefinition[]
}

type ProfileListMeta = {
  summary?: AgentReadyProfileSummary
  page?: number
  pageSize?: number
  total?: number
  hasMore?: boolean
}

type ProfileDraft = {
  name: string
  agent_type: AgentReadyProfileType
  scope_codes: string[]
  action_codes: string[]
  notes: string
}

const EMPTY_SUMMARY: AgentReadySummary = {
  totalSurfaces: 0,
  internalOnly: 0,
  betaReady: 0,
  setupRequired: 0,
  planned: 0,
  complianceGated: 0,
  checklistReady: 0,
  checklistBlocked: 0,
}

const EMPTY_PROFILE_SUMMARY: AgentReadyProfileSummary = {
  total: 0,
  draft: 0,
  active: 0,
  paused: 0,
  revoked: 0,
}

const EMPTY_DRAFT: ProfileDraft = {
  name: '',
  agent_type: 'internal_assistant',
  scope_codes: [],
  action_codes: [],
  notes: '',
}

function tone(value: string) {
  if (value === 'ready' || value === 'beta_ready' || value === 'internal_only' || value === 'active') {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (value === 'blocked' || value === 'revoked') return 'bg-red-100 text-red-700'
  if (value === 'setup_required' || value === 'paused') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}

function rolloutTone(value: AgentReadyScopeDefinition['rollout'] | AgentReadyActionDefinition['rollout']) {
  if (value === 'beta') return 'bg-emerald-100 text-emerald-700'
  if (value === 'general_blocked') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function labelForProfileType(value: AgentReadyProfileType) {
  const labels: Record<AgentReadyProfileType, string> = {
    internal_assistant: 'Assistente interno',
    external_llm: 'LLM externo',
    workflow_agent: 'Agente de workflow',
    human_proxy: 'Proxy humano',
  }
  return labels[value]
}

export function AgentReadyOverviewContent() {
  const [items, setItems] = useState<AgentReadySurface[]>([])
  const [summary, setSummary] = useState<AgentReadySummary>(EMPTY_SUMMARY)
  const [checklist, setChecklist] = useState<AgentReadyChecklistItem[]>([])
  const [scopes, setScopes] = useState<AgentReadyScopeDefinition[]>([])
  const [actions, setActions] = useState<AgentReadyActionDefinition[]>([])
  const [profiles, setProfiles] = useState<AgentReadyProfile[]>([])
  const [profileSummary, setProfileSummary] = useState<AgentReadyProfileSummary>(EMPTY_PROFILE_SUMMARY)
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [payload, profilePayload] = await Promise.all([
        apiRequestWithMeta<AgentReadySurface[], Meta>('/api/v1/agent-ready/readiness'),
        apiRequestWithMeta<AgentReadyProfile[], ProfileListMeta>('/api/v1/agent-ready/profiles'),
      ])
      setItems(payload.data)
      setSummary(payload.meta?.summary || EMPTY_SUMMARY)
      setChecklist(payload.meta?.checklist || [])
      setScopes(payload.meta?.scopes || [])
      setActions(payload.meta?.actions || [])
      setProfiles(profilePayload.data)
      setProfileSummary(profilePayload.meta?.summary || EMPTY_PROFILE_SUMMARY)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar readiness agent-ready'
      setError(message)
      toast(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function createProfile() {
    setSaving(true)
    try {
      const created = await apiRequest<AgentReadyProfile>('/api/v1/agent-ready/profiles', {
        method: 'POST',
        body: {
          name: draft.name,
          agent_type: draft.agent_type,
          scope_codes: draft.scope_codes,
          action_codes: draft.action_codes,
          notes: draft.notes || null,
        },
      })
      setProfiles((current) => [created, ...current])
      setProfileSummary((current) => ({
        ...current,
        total: current.total + 1,
        draft: current.draft + 1,
      }))
      setDraft(EMPTY_DRAFT)
      toast('Perfil interno de agente criado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar perfil agent-ready'
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function updateProfileStatus(profileId: string, status: AgentReadyProfileStatus) {
    setBusyProfileId(profileId)
    try {
      const updated = await apiRequest<AgentReadyProfile>(`/api/v1/agent-ready/profiles/${profileId}`, {
        method: 'PATCH',
        body: { status },
      })
      setProfiles((current) => current.map((item) => (item.id === profileId ? updated : item)))
      await refresh()
      toast('Perfil agent-ready atualizado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar perfil agent-ready'
      toast(message, 'error')
    } finally {
      setBusyProfileId(null)
    }
  }

  function toggleScope(code: string) {
    setDraft((current) => ({
      ...current,
      scope_codes: current.scope_codes.includes(code)
        ? current.scope_codes.filter((item) => item !== code)
        : [...current.scope_codes, code],
    }))
  }

  function toggleAction(code: string) {
    setDraft((current) => ({
      ...current,
      action_codes: current.action_codes.includes(code)
        ? current.action_codes.filter((item) => item !== code)
        : [...current.action_codes, code],
    }))
  }

  if (!isLoading && items.length === 0) {
    return (
      <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
        <PageHeader
          title="Agent Ready"
          subtitle="Readiness interno para conexões seguras de agentes"
          actions={<QuickActionBar actions={[{ label: 'Atualizar', icon: <RefreshCcw className="h-4 w-4" />, onClick: () => void refresh() }]} />}
        />
        <EmptyStateAction
          icon={<Bot className="h-5 w-5 text-sand-600" />}
          title="Nenhuma superfície agent-ready mapeada"
          description="Assim que a camada agent-ready estiver pronta, esta tela exibirá readiness, bloqueios, escopos e perfis internos."
          actionLabel="Atualizar"
          onAction={() => void refresh()}
        />
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
      <PageHeader
        title="Agent Ready"
        subtitle="Governança interna para conectar agentes/LLMs por tenant sem abrir execução irrestrita"
        actions={<QuickActionBar actions={[{ label: 'Atualizar', icon: <RefreshCcw className="h-4 w-4" />, onClick: () => void refresh() }]} />}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard className="p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><Bot className="h-3.5 w-3.5" />Superfícies</div><p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalSurfaces}</p></SectionCard>
        <SectionCard className="p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><ShieldCheck className="h-3.5 w-3.5" />Compliance gated</div><p className="mt-2 text-2xl font-semibold text-red-600">{summary.complianceGated}</p></SectionCard>
        <SectionCard className="p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><Telescope className="h-3.5 w-3.5" />Beta ready</div><p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.betaReady}</p></SectionCard>
        <SectionCard className="p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><Wrench className="h-3.5 w-3.5" />Perfis internos</div><p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{profileSummary.total}</p></SectionCard>
      </div>

      {error ? (
        <SectionCard className="border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={() => void refresh()} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">Tentar novamente</button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Checklist mínimo para abrir conectores externos</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Nada aqui libera actions reais. Esta tela governa perfis, scopes e catálogo interno.</p>
          </div>
          <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            {summary.checklistReady} pronto(s) / {summary.checklistBlocked} bloqueado(s)
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {checklist.map((item) => (
            <div key={item.key} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.status)}`}>{item.status}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <SectionCard key={item.code} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.exposureState)}`}>{item.exposureState}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
              </div>
              <div className={`text-xs font-semibold uppercase tracking-wide ${item.riskLevel === 'high' ? 'text-red-600' : 'text-amber-600'}`}>risco {item.riskLevel}</div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-sand-200 bg-sand-50 px-3 py-3 text-sm text-sand-900 dark:border-sand-900/40 dark:bg-sand-950/20 dark:text-sand-100">
              <span className="font-semibold">Próximo passo:</span> {item.recommendedAction}
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.05fr_1fr]">
        <SectionCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Scopes planejados</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Capacidades mínimas por domínio antes de qualquer connector ou tool real.</p>
            </div>
            <div className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-200">
              {scopes.length} scope(s)
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {scopes.map((scope) => (
              <div key={scope.code} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{scope.label}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(scope.level)}`}>{scope.level}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rolloutTone(scope.rollout)}`}>{scope.rollout}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{scope.description}</p>
                <p className="mt-2 text-xs text-gray-500">Domínios: {scope.domains.join(', ')}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Actions planejadas</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Catálogo estático. Nenhuma action aqui executa algo no backend nesta fase.</p>
            </div>
            <div className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-200">
              {actions.length} action(s)
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {actions.map((action) => (
              <div key={action.code} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{action.label}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(action.kind)}`}>{action.kind}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rolloutTone(action.rollout)}`}>{action.rollout}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{action.description}</p>
                  </div>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${action.riskLevel === 'high' ? 'text-red-600' : 'text-amber-600'}`}>risco {action.riskLevel}</div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Scopes exigidos: {action.requiredScopes.join(', ')}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Perfis internos de agente"
        subtitle="Governança por tenant antes de qualquer action gateway write-capable"
        right={
          <button
            type="button"
            onClick={() => void createProfile()}
            disabled={saving || !draft.name.trim() || draft.scope_codes.length === 0 || draft.action_codes.length === 0}
            aria-busy={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Criar perfil
          </button>
        }
        className="p-4"
      >
        <div className="grid gap-3 xl:grid-cols-[1fr_1.15fr]">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Nome do perfil</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="Ex.: Assistente de Obra"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Tipo</span>
                <select
                  value={draft.agent_type}
                  onChange={(event) => setDraft((current) => ({ ...current, agent_type: event.target.value as AgentReadyProfileType }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="internal_assistant">Assistente interno</option>
                  <option value="workflow_agent">Agente de workflow</option>
                  <option value="external_llm">LLM externo</option>
                  <option value="human_proxy">Proxy humano</option>
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Notas operacionais</span>
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="Restrições, objetivo do perfil, quem aprova uso..."
              />
            </label>

            <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-900 dark:border-sand-900/40 dark:bg-sand-950/20 dark:text-sand-100">
              Este cadastro é só de governança. Não cria token, secret, sessão externa nem execução automática.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Selecionar scopes</h3>
              <div className="mt-3 space-y-2">
                {scopes.map((scope) => (
                  <label key={scope.code} className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-gray-800">
                    <input
                      type="checkbox"
                      checked={draft.scope_codes.includes(scope.code)}
                      onChange={() => toggleScope(scope.code)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-gray-900 dark:text-white">{scope.label}</span>
                      <span className="block text-xs text-gray-500">{scope.code}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Selecionar actions</h3>
              <div className="mt-3 space-y-2">
                {actions.map((action) => (
                  <label key={action.code} className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-gray-800">
                    <input
                      type="checkbox"
                      checked={draft.action_codes.includes(action.code)}
                      onChange={() => toggleAction(action.code)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-gray-900 dark:text-white">{action.label}</span>
                      <span className="block text-xs text-gray-500">{action.code}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900"><p className="text-[11px] uppercase tracking-wide text-gray-500">Draft</p><p className="mt-1 font-semibold text-gray-900 dark:text-white">{profileSummary.draft}</p></div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900"><p className="text-[11px] uppercase tracking-wide text-gray-500">Ativos</p><p className="mt-1 font-semibold text-emerald-600">{profileSummary.active}</p></div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900"><p className="text-[11px] uppercase tracking-wide text-gray-500">Pausados</p><p className="mt-1 font-semibold text-amber-600">{profileSummary.paused}</p></div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900"><p className="text-[11px] uppercase tracking-wide text-gray-500">Revogados</p><p className="mt-1 font-semibold text-red-600">{profileSummary.revoked}</p></div>
        </div>

        <div className="mt-4 space-y-3">
          {profiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
              Nenhum perfil interno de agente foi criado ainda.
            </div>
          ) : (
            profiles.map((profile) => (
              <div key={profile.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{profile.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(profile.status)}`}>{profile.status}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{labelForProfileType(profile.agent_type)}</span>
                    </div>
                    {profile.notes ? <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{profile.notes}</p> : null}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Scopes</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {profile.scope_codes.map((code) => (
                            <span key={code} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{code}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Actions</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {profile.action_codes.map((code) => (
                            <span key={code} className="rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-semibold text-sand-700">{code}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void updateProfileStatus(profile.id, 'active')}
                      disabled={busyProfileId === profile.id}
                      className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                    >
                      {busyProfileId === profile.id ? 'Atualizando...' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateProfileStatus(profile.id, 'paused')}
                      disabled={busyProfileId === profile.id}
                      className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-60"
                    >
                      Pausar
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateProfileStatus(profile.id, 'revoked')}
                      disabled={busyProfileId === profile.id}
                      className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-60"
                    >
                      Revogar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  )
}
