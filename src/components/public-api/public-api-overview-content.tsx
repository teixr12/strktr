'use client'

import { useEffect, useState } from 'react'
import { Activity, BookOpen, KeyRound, Loader2, RefreshCcw, Save, ShieldCheck, Webhook } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import type {
  PublicApiChecklistItem,
  PublicApiClientExposure,
  PublicApiClientProfile,
  PublicApiClientQuotaEvaluation,
  PublicApiClientTokenBlockPreviewPayload,
  PublicApiClientStatus,
  PublicApiClientToken,
  PublicApiClientTokenCreatePayload,
  PublicApiClientTokenUsagePayload,
  PublicApiClientTokensPayload,
  PublicApiClientUsagePayload,
  PublicApiClientUsageSummary,
  PublicApiReadinessSummary,
  PublicApiRuntimeStage,
  PublicApiScopeDefinition,
  PublicApiSurface,
  PublicApiSurfaceCategory,
} from '@/shared/types/public-api'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'

type Meta = {
  summary?: PublicApiReadinessSummary
  checklist?: PublicApiChecklistItem[]
  scopes?: PublicApiScopeDefinition[]
}

type ClientDraft = {
  name: string
  status: PublicApiClientStatus
  exposure: PublicApiClientExposure
  scope_codes: string[]
  rate_limit_per_minute: number
  daily_quota: number
  monthly_call_budget: number
  owner_email: string
  notes: string
}

type TokenDraft = {
  label: string
  exposure: PublicApiClientExposure
  rate_limit_per_minute_override: string
  daily_quota_override: string
  monthly_call_budget_override: string
  expires_at: string
  notes: string
}

type TokenPolicyDraft = {
  exposure: PublicApiClientExposure
  rate_limit_per_minute_override: string
  daily_quota_override: string
  monthly_call_budget_override: string
  expires_at: string
  notes: string
}

type TokenBlockPreviewDraft = {
  endpoint_family: string
  call_count: string
}

const EMPTY_CLIENT_DRAFT: ClientDraft = {
  name: '',
  status: 'draft',
  exposure: 'internal_only',
  scope_codes: [],
  rate_limit_per_minute: 120,
  daily_quota: 10000,
  monthly_call_budget: 250000,
  owner_email: '',
  notes: '',
}

const EMPTY_TOKEN_DRAFT: TokenDraft = {
  label: '',
  exposure: 'internal_only',
  rate_limit_per_minute_override: '',
  daily_quota_override: '',
  monthly_call_budget_override: '',
  expires_at: '',
  notes: '',
}

const EMPTY_TOKEN_POLICY_DRAFT: TokenPolicyDraft = {
  exposure: 'internal_only',
  rate_limit_per_minute_override: '',
  daily_quota_override: '',
  monthly_call_budget_override: '',
  expires_at: '',
  notes: '',
}

const EMPTY_TOKEN_BLOCK_PREVIEW_DRAFT: TokenBlockPreviewDraft = {
  endpoint_family: 'crm.read',
  call_count: '1',
}

const CATEGORY_LABELS: Record<PublicApiSurfaceCategory, string> = {
  crm: 'CRM',
  operations: 'Operações',
  finance: 'Financeiro',
  documents: 'Documentos',
  automation: 'Automação',
  platform: 'Plataforma',
}

const CLIENT_EXPOSURE_OPTIONS: Array<{ value: PublicApiClientExposure; label: string }> = [
  { value: 'internal_only', label: 'Internal only' },
  { value: 'allowlist', label: 'Allowlist' },
  { value: 'beta', label: 'Beta' },
  { value: 'general_blocked', label: 'General blocked' },
]

function createClientDraftFromProfile(client: PublicApiClientProfile): ClientDraft {
  return {
    name: client.name,
    status: client.status,
    exposure: client.exposure,
    scope_codes: client.scope_codes,
    rate_limit_per_minute: client.rate_limit_per_minute,
    daily_quota: client.daily_quota,
    monthly_call_budget: client.monthly_call_budget,
    owner_email: client.owner_email || '',
    notes: client.notes || '',
  }
}

function createEmptyUsageSummary(
  client: Pick<PublicApiClientProfile, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>
): PublicApiClientUsageSummary {
  return {
    current_minute_calls: 0,
    daily_calls: 0,
    monthly_calls: 0,
    rate_limit_remaining: client.rate_limit_per_minute,
    daily_quota_remaining: client.daily_quota,
    monthly_budget_remaining: client.monthly_call_budget,
    last_activity_at: null,
  }
}

function formatDateTimeLocalInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function parseOptionalQuotaInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return Number(trimmed)
}

function quotaSourceLabel(value: string | undefined) {
  if (value === 'token_override_full') return 'Quota 100% customizada por token'
  if (value === 'token_override_partial') return 'Quota parcialmente customizada'
  return 'Quota herdada do cliente'
}

function createTokenPolicyDraft(token: PublicApiClientToken): TokenPolicyDraft {
  return {
    exposure: token.exposure,
    rate_limit_per_minute_override:
      token.rate_limit_per_minute_override !== null ? String(token.rate_limit_per_minute_override) : '',
    daily_quota_override: token.daily_quota_override !== null ? String(token.daily_quota_override) : '',
    monthly_call_budget_override:
      token.monthly_call_budget_override !== null ? String(token.monthly_call_budget_override) : '',
    expires_at: formatDateTimeLocalInput(token.expires_at),
    notes: token.notes || '',
  }
}

function quotaTone(value: PublicApiClientQuotaEvaluation['status']) {
  if (value === 'healthy') return 'bg-emerald-100 text-emerald-700'
  if (value === 'warning') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function normalizeClientProfile(
  client: PublicApiClientProfile,
  usage?: PublicApiClientUsageSummary | null
): PublicApiClientProfile {
  const baseUsage = usage || client.usage || createEmptyUsageSummary(client)
  return {
    ...client,
    usage: {
      ...baseUsage,
      rate_limit_remaining: Math.max(0, client.rate_limit_per_minute - baseUsage.current_minute_calls),
      daily_quota_remaining: Math.max(0, client.daily_quota - baseUsage.daily_calls),
      monthly_budget_remaining: Math.max(0, client.monthly_call_budget - baseUsage.monthly_calls),
    },
  }
}

function tokenUsageKey(clientId: string, tokenId: string) {
  return `${clientId}:${tokenId}`
}

function createTokenUsageSummary(
  token: Pick<PublicApiClientToken, 'usage' | 'effective_quota'>,
  client: Pick<PublicApiClientProfile, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>
) {
  const usage = token.usage
  if (usage) return usage
  const effectiveQuota = token.effective_quota || {
    rate_limit_per_minute: client.rate_limit_per_minute,
    daily_quota: client.daily_quota,
    monthly_call_budget: client.monthly_call_budget,
  }
  return {
    current_minute_calls: 0,
    daily_calls: 0,
    monthly_calls: 0,
    rate_limit_remaining: effectiveQuota.rate_limit_per_minute,
    daily_quota_remaining: effectiveQuota.daily_quota,
    monthly_budget_remaining: effectiveQuota.monthly_call_budget,
    last_activity_at: null,
  }
}

function formatMetric(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatLastActivity(value: string | null) {
  if (!value) return 'Sem uso'
  return new Date(value).toLocaleString('pt-BR')
}

function exposureTone(value: PublicApiSurface['exposureState']) {
  if (value === 'beta_ready') return 'bg-emerald-100 text-emerald-700'
  if (value === 'setup_required') return 'bg-amber-100 text-amber-700'
  if (value === 'internal_only') return 'bg-slate-100 text-slate-700'
  return 'bg-gray-100 text-gray-700'
}

function clientExposureTone(value: PublicApiClientExposure) {
  if (value === 'beta') return 'bg-emerald-100 text-emerald-700'
  if (value === 'allowlist') return 'bg-sky-100 text-sky-700'
  if (value === 'general_blocked') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function checklistTone(value: PublicApiChecklistItem['status']) {
  if (value === 'ready') return 'bg-emerald-100 text-emerald-700'
  if (value === 'blocked') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

function tone(value: string) {
  if (value === 'ready' || value === 'beta_ready') return 'bg-emerald-100 text-emerald-700'
  if (value === 'blocked') return 'bg-red-100 text-red-700'
  if (value === 'setup_required') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}

function scopeTone(value: PublicApiScopeDefinition['rollout']) {
  if (value === 'beta') return 'bg-emerald-100 text-emerald-700'
  if (value === 'general_blocked') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function updateDraftCollection(
  current: Record<string, ClientDraft>,
  clientId: string,
  updater: (draft: ClientDraft) => ClientDraft
) {
  const base = current[clientId]
  if (!base) return current
  return {
    ...current,
    [clientId]: updater(base),
  }
}

export function PublicApiOverviewContent() {
  const [items, setItems] = useState<PublicApiSurface[]>([])
  const [summary, setSummary] = useState<PublicApiReadinessSummary>({
    totalSurfaces: 0,
    internalOnly: 0,
    betaReady: 0,
    setupRequired: 0,
    planned: 0,
    complianceGated: 0,
    checklistReady: 0,
    checklistBlocked: 0,
  })
  const [checklist, setChecklist] = useState<PublicApiChecklistItem[]>([])
  const [scopes, setScopes] = useState<PublicApiScopeDefinition[]>([])
  const [clients, setClients] = useState<PublicApiClientProfile[]>([])
  const [draft, setDraft] = useState<ClientDraft>(EMPTY_CLIENT_DRAFT)
  const [clientDrafts, setClientDrafts] = useState<Record<string, ClientDraft>>({})
  const [clientTokens, setClientTokens] = useState<Record<string, PublicApiClientToken[]>>({})
  const [clientUsageDetails, setClientUsageDetails] = useState<Record<string, PublicApiClientUsagePayload>>({})
  const [tokenUsageDetails, setTokenUsageDetails] = useState<Record<string, PublicApiClientTokenUsagePayload>>({})
  const [tokenBlockPreviewDetails, setTokenBlockPreviewDetails] = useState<
    Record<string, PublicApiClientTokenBlockPreviewPayload>
  >({})
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, TokenDraft>>({})
  const [tokenPolicyDrafts, setTokenPolicyDrafts] = useState<Record<string, TokenPolicyDraft>>({})
  const [tokenBlockPreviewDrafts, setTokenBlockPreviewDrafts] = useState<Record<string, TokenBlockPreviewDraft>>({})
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>({})
  const [publicApiWriteEnabled, setPublicApiWriteEnabled] = useState(false)
  const [publicApiRuntimeStage, setPublicApiRuntimeStage] = useState<PublicApiRuntimeStage>('unknown')
  const [saving, setSaving] = useState(false)
  const [busyClientId, setBusyClientId] = useState<string | null>(null)
  const [busyTokenClientId, setBusyTokenClientId] = useState<string | null>(null)
  const [busyTokenId, setBusyTokenId] = useState<string | null>(null)
  const [busyUsageClientId, setBusyUsageClientId] = useState<string | null>(null)
  const [busyTokenUsageId, setBusyTokenUsageId] = useState<string | null>(null)
  const [busyTokenPreviewId, setBusyTokenPreviewId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setIsLoading(true)
    setError(null)
    try {
      const [payload, clientsPayload] = await Promise.all([
        apiRequestWithMeta<PublicApiSurface[], Meta>('/api/v1/public-api/readiness'),
        apiRequest<PublicApiClientProfile[]>('/api/v1/public-api/clients'),
      ])
      const tokenPayloads = await Promise.all(
        clientsPayload.map(async (client) => {
          const response = await apiRequest<PublicApiClientTokensPayload>(
            `/api/v1/public-api/clients/${client.id}/tokens`
          )
          return [client.id, response] as const
        })
      )
      setItems(payload.data)
      setSummary(
        payload.meta?.summary || {
          totalSurfaces: payload.data.length,
          internalOnly: payload.data.filter((item) => item.exposureState === 'internal_only').length,
          betaReady: payload.data.filter((item) => item.exposureState === 'beta_ready').length,
          setupRequired: payload.data.filter((item) => item.exposureState === 'setup_required').length,
          planned: payload.data.filter((item) => item.exposureState === 'planned').length,
          complianceGated: payload.data.filter((item) => item.complianceGated).length,
          checklistReady: 0,
          checklistBlocked: 0,
        }
      )
      setChecklist(payload.meta?.checklist || [])
      setScopes(payload.meta?.scopes || [])
      setClients(clientsPayload.map((client) => normalizeClientProfile(client)))
      setClientDrafts(
        Object.fromEntries(clientsPayload.map((client) => [client.id, createClientDraftFromProfile(client)]))
      )
      setClientTokens(
        Object.fromEntries(tokenPayloads.map(([clientId, tokenPayload]) => [clientId, tokenPayload.tokens]))
      )
      setTokenDrafts(
        Object.fromEntries(clientsPayload.map((client) => [client.id, { ...EMPTY_TOKEN_DRAFT }]))
      )
      setTokenPolicyDrafts(
        Object.fromEntries(
          tokenPayloads.flatMap(([, tokenPayload]) =>
            tokenPayload.tokens.map((token) => [token.id, createTokenPolicyDraft(token)] as const)
          )
        )
      )
      setTokenBlockPreviewDrafts(
        Object.fromEntries(
          tokenPayloads.flatMap(([, tokenPayload]) =>
            tokenPayload.tokens.map((token) => [token.id, { ...EMPTY_TOKEN_BLOCK_PREVIEW_DRAFT }] as const)
          )
        )
      )
      setClientUsageDetails({})
      setTokenUsageDetails({})
      setTokenBlockPreviewDetails({})
      setPublicApiWriteEnabled(tokenPayloads[0]?.[1]?.writeEnabled ?? false)
      setPublicApiRuntimeStage(tokenPayloads[0]?.[1]?.runtimeStage ?? 'unknown')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar readiness da API pública'
      setError(message)
      toast(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  async function createClientProfile() {
    setSaving(true)
    try {
      const created = await apiRequest<PublicApiClientProfile>('/api/v1/public-api/clients', {
        method: 'POST',
        body: {
          name: draft.name,
          exposure: draft.exposure,
          scope_codes: draft.scope_codes,
          rate_limit_per_minute: draft.rate_limit_per_minute,
          daily_quota: draft.daily_quota,
          monthly_call_budget: draft.monthly_call_budget,
          owner_email: draft.owner_email || null,
          notes: draft.notes || null,
        },
      })
      setClients((current) => [normalizeClientProfile(created), ...current])
      setClientDrafts((current) => ({
        ...current,
        [created.id]: createClientDraftFromProfile(created),
      }))
      setClientTokens((current) => ({
        ...current,
        [created.id]: [],
      }))
      setTokenDrafts((current) => ({
        ...current,
        [created.id]: { ...EMPTY_TOKEN_DRAFT },
      }))
      setDraft(EMPTY_CLIENT_DRAFT)
      toast('Cliente interno de API criado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar cliente de API'
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveClientProfile(clientId: string) {
    const clientDraft = clientDrafts[clientId]
    if (!clientDraft) return

    setBusyClientId(clientId)
    try {
      const updated = await apiRequest<PublicApiClientProfile>(`/api/v1/public-api/clients/${clientId}`, {
        method: 'PATCH',
        body: {
          name: clientDraft.name,
          status: clientDraft.status,
          exposure: clientDraft.exposure,
          scope_codes: clientDraft.scope_codes,
          rate_limit_per_minute: clientDraft.rate_limit_per_minute,
          daily_quota: clientDraft.daily_quota,
          monthly_call_budget: clientDraft.monthly_call_budget,
          owner_email: clientDraft.owner_email || null,
          notes: clientDraft.notes || null,
        },
      })
      setClients((current) =>
        current.map((item) =>
          item.id === clientId ? normalizeClientProfile(updated, item.usage) : item
        )
      )
      setClientDrafts((current) => ({
        ...current,
        [clientId]: createClientDraftFromProfile(updated),
      }))
      toast('Cliente de API atualizado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar cliente de API'
      toast(message, 'error')
    } finally {
      setBusyClientId(null)
    }
  }

  async function updateClientStatus(clientId: string, status: PublicApiClientStatus) {
    setClientDrafts((current) =>
      updateDraftCollection(current, clientId, (draftState) => ({ ...draftState, status }))
    )
    setBusyClientId(clientId)
    try {
      const updated = await apiRequest<PublicApiClientProfile>(`/api/v1/public-api/clients/${clientId}`, {
        method: 'PATCH',
        body: { status },
      })
      setClients((current) =>
        current.map((item) =>
          item.id === clientId ? normalizeClientProfile(updated, item.usage) : item
        )
      )
      setClientDrafts((current) => ({
        ...current,
        [clientId]: createClientDraftFromProfile(updated),
      }))
      toast('Status do cliente de API atualizado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar cliente de API'
      toast(message, 'error')
      setClientDrafts((current) =>
        updateDraftCollection(current, clientId, (draftState) => ({
          ...draftState,
          status: clients.find((item) => item.id === clientId)?.status || 'draft',
        }))
      )
    } finally {
      setBusyClientId(null)
    }
  }

  async function createClientToken(clientId: string) {
    const tokenDraft = tokenDrafts[clientId]
    if (!tokenDraft) return

    setBusyTokenClientId(clientId)
    try {
      const created = await apiRequest<PublicApiClientTokenCreatePayload>(
        `/api/v1/public-api/clients/${clientId}/tokens`,
        {
          method: 'POST',
          body: {
            label: tokenDraft.label,
            exposure: tokenDraft.exposure,
            rate_limit_per_minute_override: parseOptionalQuotaInput(tokenDraft.rate_limit_per_minute_override),
            daily_quota_override: parseOptionalQuotaInput(tokenDraft.daily_quota_override),
            monthly_call_budget_override: parseOptionalQuotaInput(tokenDraft.monthly_call_budget_override),
            expires_at: tokenDraft.expires_at || null,
            notes: tokenDraft.notes || null,
          },
        }
      )
      setClientTokens((current) => ({
        ...current,
        [clientId]: [created.item, ...(current[clientId] || [])],
      }))
      setTokenDrafts((current) => ({
        ...current,
        [clientId]: { ...EMPTY_TOKEN_DRAFT },
      }))
      setTokenPolicyDrafts((current) => ({
        ...current,
        [created.item.id]: createTokenPolicyDraft(created.item),
      }))
      setTokenBlockPreviewDrafts((current) => ({
        ...current,
        [created.item.id]: { ...EMPTY_TOKEN_BLOCK_PREVIEW_DRAFT },
      }))
      setRevealedTokens((current) => ({
        ...current,
        [created.item.id]: created.plainToken,
      }))
      setPublicApiWriteEnabled(created.writeEnabled)
      setPublicApiRuntimeStage(created.runtimeStage)
      toast('Token interno criado. O segredo só é exibido agora.', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar token interno'
      toast(message, 'error')
    } finally {
      setBusyTokenClientId(null)
    }
  }

  async function loadClientUsage(clientId: string) {
    setBusyUsageClientId(clientId)
    try {
      const payload = await apiRequest<PublicApiClientUsagePayload>(`/api/v1/public-api/clients/${clientId}/usage`)
      setClientUsageDetails((current) => ({
        ...current,
        [clientId]: payload,
      }))
      setClients((current) =>
        current.map((item) =>
          item.id === clientId
            ? {
                ...normalizeClientProfile(item, payload.summary),
                quota_status: payload.quota,
              }
            : item
        )
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar uso do cliente de API'
      toast(message, 'error')
    } finally {
      setBusyUsageClientId(null)
    }
  }

  async function loadTokenUsage(clientId: string, tokenId: string) {
    const usageKey = tokenUsageKey(clientId, tokenId)
    setBusyTokenUsageId(usageKey)
    try {
      const payload = await apiRequest<PublicApiClientTokenUsagePayload>(
        `/api/v1/public-api/clients/${clientId}/tokens/${tokenId}/usage`
      )
      setTokenUsageDetails((current) => ({
        ...current,
        [usageKey]: payload,
      }))
      setClientTokens((current) => ({
        ...current,
        [clientId]: (current[clientId] || []).map((item) =>
          item.id === tokenId
            ? {
                ...item,
                effective_quota: payload.effective_quota,
                quota_source: payload.quota_source,
                usage: payload.summary,
                quota_status: payload.quota,
              }
            : item
        ),
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar uso do token'
      toast(message, 'error')
    } finally {
      setBusyTokenUsageId(null)
    }
  }

  async function loadTokenBlockPreview(clientId: string, tokenId: string) {
    const usageKey = tokenUsageKey(clientId, tokenId)
    const previewDraft = tokenBlockPreviewDrafts[tokenId] || EMPTY_TOKEN_BLOCK_PREVIEW_DRAFT

    setBusyTokenPreviewId(usageKey)
    try {
      const payload = await apiRequest<PublicApiClientTokenBlockPreviewPayload>(
        `/api/v1/public-api/clients/${clientId}/tokens/${tokenId}/block-preview`,
        {
          method: 'POST',
          body: {
            endpoint_family: previewDraft.endpoint_family,
            call_count: Number(previewDraft.call_count || '1'),
          },
        }
      )

      setTokenBlockPreviewDetails((current) => ({
        ...current,
        [usageKey]: payload,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao simular bloqueio do token'
      toast(message, 'error')
    } finally {
      setBusyTokenPreviewId(null)
    }
  }

  async function updateClientTokenStatus(
    clientId: string,
    tokenId: string,
    status: 'active' | 'revoked'
  ) {
    setBusyTokenId(tokenId)
    try {
      const payload = await apiRequest<{ item: PublicApiClientToken; writeEnabled: boolean; runtimeStage: PublicApiRuntimeStage }>(
        `/api/v1/public-api/clients/${clientId}/tokens/${tokenId}`,
        {
          method: 'PATCH',
          body: { status },
        }
      )
      setClientTokens((current) => ({
        ...current,
        [clientId]: (current[clientId] || []).map((item) =>
          item.id === tokenId
            ? {
                ...payload.item,
                effective_quota: payload.item.effective_quota || item.effective_quota,
                quota_source: payload.item.quota_source || item.quota_source,
                usage: item.usage,
                quota_status: item.quota_status,
              }
            : item
        ),
      }))
      setTokenPolicyDrafts((current) => ({
        ...current,
        [tokenId]: createTokenPolicyDraft(payload.item),
      }))
      setPublicApiWriteEnabled(payload.writeEnabled)
      setPublicApiRuntimeStage(payload.runtimeStage)
      toast('Token interno atualizado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar token interno'
      toast(message, 'error')
    } finally {
      setBusyTokenId(null)
    }
  }

  async function saveClientTokenPolicy(clientId: string, tokenId: string) {
    const tokenDraft = tokenPolicyDrafts[tokenId]
    if (!tokenDraft) return

    setBusyTokenId(tokenId)
    try {
      const payload = await apiRequest<{ item: PublicApiClientToken; writeEnabled: boolean; runtimeStage: PublicApiRuntimeStage }>(
        `/api/v1/public-api/clients/${clientId}/tokens/${tokenId}`,
        {
          method: 'PATCH',
          body: {
            exposure: tokenDraft.exposure,
            rate_limit_per_minute_override: parseOptionalQuotaInput(tokenDraft.rate_limit_per_minute_override),
            daily_quota_override: parseOptionalQuotaInput(tokenDraft.daily_quota_override),
            monthly_call_budget_override: parseOptionalQuotaInput(tokenDraft.monthly_call_budget_override),
            expires_at: tokenDraft.expires_at || null,
            notes: tokenDraft.notes || null,
          },
        }
      )
      setClientTokens((current) => ({
        ...current,
        [clientId]: (current[clientId] || []).map((item) =>
          item.id === tokenId
            ? {
                ...item,
                ...payload.item,
                effective_quota: payload.item.effective_quota || item.effective_quota,
                quota_source: payload.item.quota_source || item.quota_source,
              }
            : item
        ),
      }))
      setTokenPolicyDrafts((current) => ({
        ...current,
        [tokenId]: createTokenPolicyDraft(payload.item),
      }))
      setPublicApiWriteEnabled(payload.writeEnabled)
      setPublicApiRuntimeStage(payload.runtimeStage)
      await loadTokenUsage(clientId, tokenId)
      toast('Governança do token atualizada', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar governança do token'
      toast(message, 'error')
    } finally {
      setBusyTokenId(null)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  if (!isLoading && items.length === 0) {
    return (
      <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
        <PageHeader
          title="API Pública"
          subtitle="Readiness interno para futura abertura externa"
          actions={
            <QuickActionBar
              actions={[
                {
                  label: 'Atualizar',
                  icon: <RefreshCcw className="h-4 w-4" />,
                  onClick: () => void refresh(),
                },
              ]}
            />
          }
        />
        <EmptyStateAction
          icon={<BookOpen className="h-5 w-5 text-sand-600" />}
          title="Nenhuma superfície mapeada"
          description="Assim que o readiness da API pública for calculado, esta tela exibirá escopos, bloqueios e próximos passos."
          actionLabel="Atualizar"
          onAction={() => void refresh()}
        />
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
      <PageHeader
        title="API Pública"
        subtitle="Readiness interno para abrir integrações externas sem quebrar o core"
        actions={
          <QuickActionBar
            actions={[
              {
                label: 'Atualizar',
                icon: <RefreshCcw className="h-4 w-4" />,
                onClick: () => void refresh(),
              },
            ]}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <BookOpen className="h-3.5 w-3.5" />
            Superfícies
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalSurfaces}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Webhook className="h-3.5 w-3.5" />
            Beta ready
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.betaReady}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <KeyRound className="h-3.5 w-3.5" />
            Setup required
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.setupRequired}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compliance gate
          </div>
          <p className="mt-2 text-2xl font-semibold text-red-600">{summary.complianceGated}</p>
        </SectionCard>
      </div>

      {error ? (
        <SectionCard className="border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Checklist mínimo para general release</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Esta tela não emite API keys. Ela só mostra o que já existe e o que ainda bloqueia a abertura geral.
            </p>
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
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${checklistTone(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Scopes planejados"
        subtitle="Matriz mínima para abrir terceiros com blast radius controlado"
        className="p-4"
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {scopes.map((scope) => (
            <div key={scope.code} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{scope.label}</h3>
                  <p className="mt-1 text-xs text-gray-500">{scope.code}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {scope.level}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${scopeTone(scope.rollout)}`}>
                    {scope.rollout}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{scope.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {scope.domains.map((domain) => (
                  <span
                    key={`${scope.code}:${domain}`}
                    className="rounded-full bg-sand-50 px-2 py-1 text-[11px] font-semibold text-sand-800 dark:bg-sand-950/20 dark:text-sand-100"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Clientes internos de API"
        subtitle="Perfis, ownership e quotas antes da emissão real de credenciais"
        className="p-4"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Governança de tokens internos</p>
            <p className="mt-1 text-xs text-gray-500">
              Escrita {publicApiWriteEnabled ? 'habilitada' : 'bloqueada'} em {publicApiRuntimeStage}.
            </p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${publicApiWriteEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {publicApiWriteEnabled ? 'write enabled' : 'write blocked'}
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3 rounded-2xl border border-sand-200 bg-sand-50/70 p-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Novo perfil interno</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Use isto para preparar clientes externos com ownership e budgets antes da camada real de API keys.
              </p>
            </div>

            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome do cliente ou integração"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Exposure</span>
                <select
                  value={draft.exposure}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exposure: event.target.value as PublicApiClientExposure,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {CLIENT_EXPOSURE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Owner email</span>
                <input
                  type="email"
                  value={draft.owner_email}
                  onChange={(event) => setDraft((current) => ({ ...current, owner_email: event.target.value }))}
                  placeholder="owner@strktr.com"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {scopes.map((scope) => (
                <label
                  key={scope.code}
                  className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <input
                    type="checkbox"
                    checked={draft.scope_codes.includes(scope.code)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        scope_codes: event.target.checked
                          ? Array.from(new Set([...current.scope_codes, scope.code]))
                          : current.scope_codes.filter((item) => item !== scope.code),
                      }))
                    }
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{scope.label}</p>
                    <p className="mt-1 text-xs text-gray-500">{scope.code}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Quota/min</span>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={draft.rate_limit_per_minute}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      rate_limit_per_minute: Number(event.target.value || 120),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Quota/dia</span>
                <input
                  type="number"
                  min={100}
                  max={10000000}
                  value={draft.daily_quota}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      daily_quota: Number(event.target.value || 10000),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Budget/mês</span>
                <input
                  type="number"
                  min={1000}
                  max={100000000}
                  value={draft.monthly_call_budget}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      monthly_call_budget: Number(event.target.value || 250000),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Notas</span>
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>

            <button
              type="button"
              onClick={() => void createClientProfile()}
              disabled={saving || !draft.name.trim() || draft.scope_codes.length === 0}
              aria-busy={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar perfil
            </button>
          </div>

          <div className="space-y-3">
            {clients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                Nenhum cliente interno de API criado ainda.
              </div>
            ) : (
              clients.map((client) => {
                const clientDraft = clientDrafts[client.id] || createClientDraftFromProfile(client)
                const tokenDraft = tokenDrafts[client.id] || EMPTY_TOKEN_DRAFT
                const tokens = clientTokens[client.id] || []
                const usage = client.usage || createEmptyUsageSummary(client)
                const usageDetail = clientUsageDetails[client.id]
                const quotaStatus = client.quota_status

                return (
                  <div key={client.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{client.name}</h3>
                        <p className="mt-1 text-xs text-gray-500">
                          Quota {client.rate_limit_per_minute}/min · {client.daily_quota}/dia · {client.monthly_call_budget}/mês
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${clientExposureTone(client.exposure)}`}
                        >
                          {client.exposure}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(
                            client.status === 'active' ? 'ready' : client.status === 'revoked' ? 'blocked' : 'planned'
                          )}`}
                        >
                          {client.status}
                        </span>
                        {quotaStatus ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${quotaTone(quotaStatus.status)}`}>
                            {quotaStatus.status}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Uso e quotas</h4>
                          <p className="mt-1 text-xs text-gray-500">
                            Janela diária/mensal para validar consumo e ownership antes de abrir terceiros.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void loadClientUsage(client.id)}
                          disabled={busyUsageClientId === client.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-gray-950 dark:text-emerald-300"
                        >
                          {busyUsageClientId === client.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Activity className="h-4 w-4" />
                          )}
                          Atualizar uso
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Min atual</p>
                          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {formatMetric(usage.current_minute_calls)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Hoje</p>
                          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {formatMetric(usage.daily_calls)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Restante hoje</p>
                          <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                            {formatMetric(usage.daily_quota_remaining)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Restante min</p>
                          <p className="mt-1 text-lg font-semibold text-sky-700 dark:text-sky-300">
                            {formatMetric(usage.rate_limit_remaining)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Mês</p>
                          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {formatMetric(usage.monthly_calls)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Última atividade</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                            {formatLastActivity(usage.last_activity_at)}
                          </p>
                        </div>
                      </div>

                      {quotaStatus ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/70 bg-white px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${quotaTone(quotaStatus.status)}`}>
                            {quotaStatus.status}
                          </span>
                          <span className="text-gray-600 dark:text-gray-300">
                            {quotaStatus.would_block ? 'Este cliente seria bloqueado agora pela política de quotas.' : 'Este cliente ainda está dentro da política de quotas.'}
                          </span>
                          {quotaStatus.reasons.length > 0 ? (
                            <span className="text-xs text-gray-500">
                              Motivos: {quotaStatus.reasons.join(', ')}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {usageDetail ? (
                        <div className="mt-4 rounded-2xl border border-white/70 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                          <div className="flex items-center justify-between gap-3">
                            <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Atividade recente</h5>
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {usageDetail.events.length} evento(s)
                            </span>
                          </div>
                          {usageDetail.events.length === 0 ? (
                            <div className="mt-3 rounded-xl border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500">
                              Nenhum evento de uso registrado ainda para este cliente.
                            </div>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {usageDetail.events.slice(0, 6).map((event) => (
                                <div
                                  key={event.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-gray-800"
                                >
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{event.endpoint_family}</p>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {event.source} · {event.outcome} · {new Date(event.created_at).toLocaleString('pt-BR')}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                    {formatMetric(event.call_count)} chamada(s)
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Nome</span>
                        <input
                          value={clientDraft.name}
                          onChange={(event) =>
                            setClientDrafts((current) =>
                              updateDraftCollection(current, client.id, (draftState) => ({
                                ...draftState,
                                name: event.target.value,
                              }))
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Owner email</span>
                        <input
                          type="email"
                          value={clientDraft.owner_email}
                          onChange={(event) =>
                            setClientDrafts((current) =>
                              updateDraftCollection(current, client.id, (draftState) => ({
                                ...draftState,
                                owner_email: event.target.value,
                              }))
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Exposure</span>
                        <select
                          value={clientDraft.exposure}
                          onChange={(event) =>
                            setClientDrafts((current) =>
                              updateDraftCollection(current, client.id, (draftState) => ({
                                ...draftState,
                                exposure: event.target.value as PublicApiClientExposure,
                              }))
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        >
                          {CLIENT_EXPOSURE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Quota/min</span>
                        <input
                          type="number"
                          min={10}
                          max={10000}
                          value={clientDraft.rate_limit_per_minute}
                          onChange={(event) =>
                            setClientDrafts((current) =>
                              updateDraftCollection(current, client.id, (draftState) => ({
                                ...draftState,
                                rate_limit_per_minute: Number(event.target.value || 120),
                              }))
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Quota/dia</span>
                        <input
                          type="number"
                          min={100}
                          max={10000000}
                          value={clientDraft.daily_quota}
                          onChange={(event) =>
                            setClientDrafts((current) =>
                              updateDraftCollection(current, client.id, (draftState) => ({
                                ...draftState,
                                daily_quota: Number(event.target.value || 10000),
                              }))
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Budget/mês</span>
                        <input
                          type="number"
                          min={1000}
                          max={100000000}
                          value={clientDraft.monthly_call_budget}
                          onChange={(event) =>
                            setClientDrafts((current) =>
                              updateDraftCollection(current, client.id, (draftState) => ({
                                ...draftState,
                                monthly_call_budget: Number(event.target.value || 250000),
                              }))
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {scopes.map((scope) => (
                        <label
                          key={`${client.id}:${scope.code}`}
                          className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-900"
                        >
                          <input
                            type="checkbox"
                            checked={clientDraft.scope_codes.includes(scope.code)}
                            onChange={(event) =>
                              setClientDrafts((current) =>
                                updateDraftCollection(current, client.id, (draftState) => ({
                                  ...draftState,
                                  scope_codes: event.target.checked
                                    ? Array.from(new Set([...draftState.scope_codes, scope.code]))
                                    : draftState.scope_codes.filter((item) => item !== scope.code),
                                }))
                              )
                            }
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{scope.label}</p>
                            <p className="mt-1 text-xs text-gray-500">{scope.code}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <label className="mt-3 block space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Notas</span>
                      <textarea
                        rows={3}
                        value={clientDraft.notes}
                        onChange={(event) =>
                          setClientDrafts((current) =>
                            updateDraftCollection(current, client.id, (draftState) => ({
                              ...draftState,
                              notes: event.target.value,
                            }))
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyClientId === client.id}
                        onClick={() => void updateClientStatus(client.id, 'active')}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        Ativar
                      </button>
                      <button
                        type="button"
                        disabled={busyClientId === client.id}
                        onClick={() => void updateClientStatus(client.id, 'draft')}
                        className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        Draft
                      </button>
                      <button
                        type="button"
                        disabled={busyClientId === client.id}
                        onClick={() => void updateClientStatus(client.id, 'revoked')}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                      >
                        Revogar
                      </button>
                      <button
                        type="button"
                        disabled={busyClientId === client.id || !clientDraft.name.trim() || clientDraft.scope_codes.length === 0}
                        onClick={() => void saveClientProfile(client.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                      >
                        {busyClientId === client.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar governança
                      </button>
                    </div>

                    <div className="mt-5 rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/40 dark:bg-sky-950/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Tokens internos</h4>
                          <p className="mt-1 text-xs text-gray-500">
                            Segredos só são exibidos na criação. O hash persiste, o valor bruto não.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                          {tokens.length} token(s)
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_180px_1fr]">
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Label</span>
                          <input
                            value={tokenDraft.label}
                            onChange={(event) =>
                              setTokenDrafts((current) => ({
                                ...current,
                                [client.id]: {
                                  ...(current[client.id] || EMPTY_TOKEN_DRAFT),
                                  label: event.target.value,
                                },
                              }))
                            }
                            placeholder="Ex.: CRM Sandbox"
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Exposure</span>
                          <select
                            value={tokenDraft.exposure}
                            onChange={(event) =>
                              setTokenDrafts((current) => ({
                                ...current,
                                [client.id]: {
                                  ...(current[client.id] || EMPTY_TOKEN_DRAFT),
                                  exposure: event.target.value as PublicApiClientExposure,
                                },
                              }))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          >
                            {CLIENT_EXPOSURE_OPTIONS.map((option) => (
                              <option key={`${client.id}:${option.value}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Expira em</span>
                          <input
                            type="datetime-local"
                            value={tokenDraft.expires_at}
                            onChange={(event) =>
                              setTokenDrafts((current) => ({
                                ...current,
                                [client.id]: {
                                  ...(current[client.id] || EMPTY_TOKEN_DRAFT),
                                  expires_at: event.target.value,
                                },
                              }))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </label>
                      </div>

                      <label className="mt-3 block space-y-1 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Notas do token</span>
                        <textarea
                          rows={2}
                          value={tokenDraft.notes}
                          onChange={(event) =>
                            setTokenDrafts((current) => ({
                              ...current,
                              [client.id]: {
                                ...(current[client.id] || EMPTY_TOKEN_DRAFT),
                                notes: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </label>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Override / min</span>
                          <input
                            type="number"
                            min={1}
                            max={client.rate_limit_per_minute}
                            value={tokenDraft.rate_limit_per_minute_override}
                            onChange={(event) =>
                              setTokenDrafts((current) => ({
                                ...current,
                                [client.id]: {
                                  ...(current[client.id] || EMPTY_TOKEN_DRAFT),
                                  rate_limit_per_minute_override: event.target.value,
                                },
                              }))
                            }
                            placeholder={`Herdar (${client.rate_limit_per_minute})`}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Override / dia</span>
                          <input
                            type="number"
                            min={1}
                            max={client.daily_quota}
                            value={tokenDraft.daily_quota_override}
                            onChange={(event) =>
                              setTokenDrafts((current) => ({
                                ...current,
                                [client.id]: {
                                  ...(current[client.id] || EMPTY_TOKEN_DRAFT),
                                  daily_quota_override: event.target.value,
                                },
                              }))
                            }
                            placeholder={`Herdar (${client.daily_quota})`}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Override / mês</span>
                          <input
                            type="number"
                            min={1}
                            max={client.monthly_call_budget}
                            value={tokenDraft.monthly_call_budget_override}
                            onChange={(event) =>
                              setTokenDrafts((current) => ({
                                ...current,
                                [client.id]: {
                                  ...(current[client.id] || EMPTY_TOKEN_DRAFT),
                                  monthly_call_budget_override: event.target.value,
                                },
                              }))
                            }
                            placeholder={`Herdar (${client.monthly_call_budget})`}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </label>
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        Deixe em branco para herdar a quota do cliente. Overrides só podem reduzir o blast radius.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyTokenClientId === client.id || !tokenDraft.label.trim()}
                          onClick={() => void createClientToken(client.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                        >
                          {busyTokenClientId === client.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                          Gerar token interno
                        </button>
                      </div>

                      {tokens.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500">
                          Nenhum token criado para este cliente ainda.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {tokens.map((token) => (
                            <div key={token.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                              {(() => {
                                const usageKey = tokenUsageKey(client.id, token.id)
                                const tokenUsage = createTokenUsageSummary(token, client)
                                const tokenUsageDetail = tokenUsageDetails[usageKey]
                                const tokenBlockPreview = tokenBlockPreviewDetails[usageKey]
                                const tokenQuotaStatus = token.quota_status
                                const effectiveQuota = token.effective_quota
                                const tokenPolicyDraft = tokenPolicyDrafts[token.id] || createTokenPolicyDraft(token)
                                const tokenBlockPreviewDraft =
                                  tokenBlockPreviewDrafts[token.id] || EMPTY_TOKEN_BLOCK_PREVIEW_DRAFT

                                return (
                                  <>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{token.label}</p>
                                        <p className="mt-1 text-xs text-gray-500">
                                          {token.token_prefix}••••{token.token_last_four}
                                          {token.expires_at
                                            ? ` · expira ${new Date(token.expires_at).toLocaleString('pt-BR')}`
                                            : ' · sem expiração'}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${clientExposureTone(token.exposure)}`}>
                                          {token.exposure}
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(token.status === 'active' ? 'ready' : 'blocked')}`}>
                                          {token.status}
                                        </span>
                                        {tokenQuotaStatus ? (
                                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${quotaTone(tokenQuotaStatus.status)}`}>
                                            {tokenQuotaStatus.status}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    {revealedTokens[token.id] ? (
                                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                                        <span className="font-semibold">Segredo visível só agora:</span> {revealedTokens[token.id]}
                                      </div>
                                    ) : null}

                                    {token.notes ? (
                                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{token.notes}</p>
                                    ) : null}

                                    {effectiveQuota ? (
                                      <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/70 p-3 dark:border-sky-900/40 dark:bg-sky-950/10">
                                        <div className="flex items-center justify-between gap-3">
                                          <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quota efetiva herdada</p>
                                            <p className="mt-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                              {quotaSourceLabel(token.quota_source)}
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                              {formatMetric(effectiveQuota.rate_limit_per_minute)}/min · {formatMetric(effectiveQuota.daily_quota)}/dia · {formatMetric(effectiveQuota.monthly_call_budget)}/mês
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            disabled={busyTokenUsageId === usageKey}
                                            onClick={() => void loadTokenUsage(client.id, token.id)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60 dark:border-sky-900/40 dark:bg-gray-950 dark:text-sky-300"
                                          >
                                            {busyTokenUsageId === usageKey ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Activity className="h-4 w-4" />
                                            )}
                                            Atualizar uso do token
                                          </button>
                                        </div>

                                        <div className="mt-3 grid gap-3 md:grid-cols-4">
                                          <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Min atual</p>
                                            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                              {formatMetric(tokenUsage.current_minute_calls)}
                                            </p>
                                          </div>
                                          <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Hoje</p>
                                            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                              {formatMetric(tokenUsage.daily_calls)}
                                            </p>
                                          </div>
                                          <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Restante min</p>
                                            <p className="mt-1 text-lg font-semibold text-sky-700 dark:text-sky-300">
                                              {formatMetric(tokenUsage.rate_limit_remaining)}
                                            </p>
                                          </div>
                                          <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Restante hoje</p>
                                            <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                                              {formatMetric(tokenUsage.daily_quota_remaining)}
                                            </p>
                                          </div>
                                        </div>

                                        {tokenQuotaStatus ? (
                                          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/70 bg-white px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
                                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${quotaTone(tokenQuotaStatus.status)}`}>
                                              {tokenQuotaStatus.status}
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-300">
                                              {tokenQuotaStatus.would_block
                                                ? 'Este token seria bloqueado agora pela política herdada do cliente.'
                                                : 'Este token ainda está dentro da política herdada do cliente.'}
                                            </span>
                                            {tokenQuotaStatus.reasons.length > 0 ? (
                                              <span className="text-xs text-gray-500">Motivos: {tokenQuotaStatus.reasons.join(', ')}</span>
                                            ) : null}
                                          </div>
                                        ) : null}

                                        {tokenUsageDetail ? (
                                          <div className="mt-3 rounded-2xl border border-white/70 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                            <div className="flex items-center justify-between gap-3">
                                              <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Atividade recente do token</h5>
                                              <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                                                {tokenUsageDetail.events.length} evento(s)
                                              </span>
                                            </div>
                                            {tokenUsageDetail.events.length === 0 ? (
                                              <div className="mt-3 rounded-xl border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500">
                                                Nenhum evento de uso registrado ainda para este token.
                                              </div>
                                            ) : (
                                              <div className="mt-3 space-y-2">
                                                {tokenUsageDetail.events.slice(0, 6).map((event) => (
                                                  <div
                                                    key={event.id}
                                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-gray-800"
                                                  >
                                                    <div>
                                                      <p className="font-medium text-gray-900 dark:text-white">{event.endpoint_family}</p>
                                                      <p className="mt-1 text-xs text-gray-500">
                                                        {event.source} · {event.outcome} · {new Date(event.created_at).toLocaleString('pt-BR')}
                                                      </p>
                                                    </div>
                                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                                      {formatMetric(event.call_count)} chamada(s)
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ) : null}

                                        <div className="mt-3 rounded-2xl border border-white/70 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Simular bloqueio por request</h5>
                                              <p className="mt-1 text-xs text-gray-500">
                                                Preview interno sem gravar evento real. Use para validar blast radius do token antes de abrir terceiros.
                                              </p>
                                            </div>
                                            <button
                                              type="button"
                                              disabled={
                                                busyTokenPreviewId === usageKey ||
                                                !tokenBlockPreviewDraft.endpoint_family.trim() ||
                                                Number(tokenBlockPreviewDraft.call_count || '0') < 1
                                              }
                                              onClick={() => void loadTokenBlockPreview(client.id, token.id)}
                                              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60 dark:border-sky-900/40 dark:bg-gray-950 dark:text-sky-300"
                                            >
                                              {busyTokenPreviewId === usageKey ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <ShieldCheck className="h-4 w-4" />
                                              )}
                                              Simular agora
                                            </button>
                                          </div>

                                          <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_180px]">
                                            <label className="space-y-1 text-sm">
                                              <span className="text-gray-600 dark:text-gray-300">Endpoint family</span>
                                              <input
                                                value={tokenBlockPreviewDraft.endpoint_family}
                                                onChange={(event) =>
                                                  setTokenBlockPreviewDrafts((current) => ({
                                                    ...current,
                                                    [token.id]: {
                                                      ...(current[token.id] || EMPTY_TOKEN_BLOCK_PREVIEW_DRAFT),
                                                      endpoint_family: event.target.value,
                                                    },
                                                  }))
                                                }
                                                placeholder="crm.read"
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                              />
                                            </label>
                                            <label className="space-y-1 text-sm">
                                              <span className="text-gray-600 dark:text-gray-300">Qtd. de chamadas</span>
                                              <input
                                                type="number"
                                                min={1}
                                                max={1000}
                                                value={tokenBlockPreviewDraft.call_count}
                                                onChange={(event) =>
                                                  setTokenBlockPreviewDrafts((current) => ({
                                                    ...current,
                                                    [token.id]: {
                                                      ...(current[token.id] || EMPTY_TOKEN_BLOCK_PREVIEW_DRAFT),
                                                      call_count: event.target.value,
                                                    },
                                                  }))
                                                }
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                              />
                                            </label>
                                          </div>

                                          {tokenBlockPreview ? (
                                            <div className="mt-3 space-y-3">
                                              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-900/40">
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${quotaTone(tokenBlockPreview.current_quota.status)}`}>
                                                  agora: {tokenBlockPreview.current_quota.status}
                                                </span>
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${quotaTone(tokenBlockPreview.projected_quota.status)}`}>
                                                  depois: {tokenBlockPreview.projected_quota.status}
                                                </span>
                                                <span className="text-gray-600 dark:text-gray-300">
                                                  {tokenBlockPreview.current_quota.would_block
                                                    ? 'Este request seria bloqueado imediatamente pela política atual.'
                                                    : tokenBlockPreview.projected_quota.would_block
                                                      ? 'O request ainda passa agora, mas consumiria quota suficiente para bloquear em seguida.'
                                                      : 'O request ainda ficaria dentro da quota após a simulação.'}
                                                </span>
                                              </div>

                                              <div className="grid gap-3 md:grid-cols-4">
                                                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40">
                                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Família</p>
                                                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                                    {tokenBlockPreview.endpoint_family}
                                                  </p>
                                                </div>
                                                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40">
                                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Chamadas</p>
                                                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                                    {formatMetric(tokenBlockPreview.call_count)}
                                                  </p>
                                                </div>
                                                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40">
                                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Restante min</p>
                                                  <p className="mt-1 text-sm font-semibold text-sky-700 dark:text-sky-300">
                                                    {formatMetric(tokenBlockPreview.projected_summary.rate_limit_remaining)}
                                                  </p>
                                                </div>
                                                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40">
                                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Restante dia</p>
                                                  <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                                    {formatMetric(tokenBlockPreview.projected_summary.daily_quota_remaining)}
                                                  </p>
                                                </div>
                                              </div>

                                              {(tokenBlockPreview.current_quota.reasons.length > 0 ||
                                                tokenBlockPreview.projected_quota.reasons.length > 0) ? (
                                                <div className="rounded-xl border border-dashed border-gray-300 px-3 py-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                                  {tokenBlockPreview.current_quota.reasons.length > 0 ? (
                                                    <p>Motivos atuais: {tokenBlockPreview.current_quota.reasons.join(', ')}</p>
                                                  ) : null}
                                                  {tokenBlockPreview.projected_quota.reasons.length > 0 ? (
                                                    <p className={tokenBlockPreview.current_quota.reasons.length > 0 ? 'mt-1' : ''}>
                                                      Motivos projetados: {tokenBlockPreview.projected_quota.reasons.join(', ')}
                                                    </p>
                                                  ) : null}
                                                </div>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    ) : null}

                                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Governança do token</h5>
                                          <p className="mt-1 text-xs text-gray-500">
                                            Ajuste exposure, expiração e overrides específicos sem mudar a quota do cliente.
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={busyTokenId === token.id}
                                          onClick={() => void saveClientTokenPolicy(client.id, token.id)}
                                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                                        >
                                          {busyTokenId === token.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Save className="h-4 w-4" />
                                          )}
                                          Salvar governança
                                        </button>
                                      </div>

                                      <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                                        <label className="space-y-1 text-sm">
                                          <span className="text-gray-600 dark:text-gray-300">Exposure</span>
                                          <select
                                            value={tokenPolicyDraft.exposure}
                                            onChange={(event) =>
                                              setTokenPolicyDrafts((current) => ({
                                                ...current,
                                                [token.id]: {
                                                  ...(current[token.id] || EMPTY_TOKEN_POLICY_DRAFT),
                                                  exposure: event.target.value as PublicApiClientExposure,
                                                },
                                              }))
                                            }
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                          >
                                            {CLIENT_EXPOSURE_OPTIONS.map((option) => (
                                              <option key={`${token.id}:${option.value}`} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label className="space-y-1 text-sm">
                                          <span className="text-gray-600 dark:text-gray-300">Expira em</span>
                                          <input
                                            type="datetime-local"
                                            value={tokenPolicyDraft.expires_at}
                                            onChange={(event) =>
                                              setTokenPolicyDrafts((current) => ({
                                                ...current,
                                                [token.id]: {
                                                  ...(current[token.id] || EMPTY_TOKEN_POLICY_DRAFT),
                                                  expires_at: event.target.value,
                                                },
                                              }))
                                            }
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                          />
                                        </label>
                                      </div>

                                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                                        <label className="space-y-1 text-sm">
                                          <span className="text-gray-600 dark:text-gray-300">Override / min</span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={client.rate_limit_per_minute}
                                            value={tokenPolicyDraft.rate_limit_per_minute_override}
                                            onChange={(event) =>
                                              setTokenPolicyDrafts((current) => ({
                                                ...current,
                                                [token.id]: {
                                                  ...(current[token.id] || EMPTY_TOKEN_POLICY_DRAFT),
                                                  rate_limit_per_minute_override: event.target.value,
                                                },
                                              }))
                                            }
                                            placeholder={`Herdar (${client.rate_limit_per_minute})`}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                          />
                                        </label>
                                        <label className="space-y-1 text-sm">
                                          <span className="text-gray-600 dark:text-gray-300">Override / dia</span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={client.daily_quota}
                                            value={tokenPolicyDraft.daily_quota_override}
                                            onChange={(event) =>
                                              setTokenPolicyDrafts((current) => ({
                                                ...current,
                                                [token.id]: {
                                                  ...(current[token.id] || EMPTY_TOKEN_POLICY_DRAFT),
                                                  daily_quota_override: event.target.value,
                                                },
                                              }))
                                            }
                                            placeholder={`Herdar (${client.daily_quota})`}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                          />
                                        </label>
                                        <label className="space-y-1 text-sm">
                                          <span className="text-gray-600 dark:text-gray-300">Override / mês</span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={client.monthly_call_budget}
                                            value={tokenPolicyDraft.monthly_call_budget_override}
                                            onChange={(event) =>
                                              setTokenPolicyDrafts((current) => ({
                                                ...current,
                                                [token.id]: {
                                                  ...(current[token.id] || EMPTY_TOKEN_POLICY_DRAFT),
                                                  monthly_call_budget_override: event.target.value,
                                                },
                                              }))
                                            }
                                            placeholder={`Herdar (${client.monthly_call_budget})`}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                          />
                                        </label>
                                      </div>

                                      <label className="mt-3 block space-y-1 text-sm">
                                        <span className="text-gray-600 dark:text-gray-300">Notas</span>
                                        <textarea
                                          rows={2}
                                          value={tokenPolicyDraft.notes}
                                          onChange={(event) =>
                                            setTokenPolicyDrafts((current) => ({
                                              ...current,
                                              [token.id]: {
                                                ...(current[token.id] || EMPTY_TOKEN_POLICY_DRAFT),
                                                notes: event.target.value,
                                              },
                                            }))
                                          }
                                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                        />
                                      </label>

                                      <p className="mt-2 text-xs text-gray-500">
                                        Deixe campos vazios para herdar a política do cliente. Este preview ainda não emite bloqueio externo real.
                                      </p>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={busyTokenId === token.id || token.status === 'active'}
                                        onClick={() => void updateClientTokenStatus(client.id, token.id, 'active')}
                                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                                      >
                                        Ativar
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyTokenId === token.id || token.status === 'revoked'}
                                        onClick={() => void updateClientTokenStatus(client.id, token.id, 'revoked')}
                                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                                      >
                                        Revogar
                                      </button>
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <SectionCard key={item.code} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${exposureTone(item.exposureState)}`}>
                    {item.exposureState}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
              </div>
              <div
                className={`text-xs font-semibold uppercase tracking-wide ${
                  item.riskLevel === 'high' ? 'text-red-600' : item.riskLevel === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                risco {item.riskLevel}
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Famílias de endpoint</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.endpointFamilies.map((endpoint) => (
                    <span
                      key={endpoint}
                      className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                    >
                      {endpoint}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Auth atual</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    {item.sessionBacked ? 'Sessão interna' : 'Sem sessão interna'}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">API key externa</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    {item.requiresApiKey ? 'Necessária' : 'Não obrigatória'}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-sand-200 bg-sand-50 px-3 py-3 text-sm text-sand-900 dark:border-sand-900/40 dark:bg-sand-950/20 dark:text-sand-100">
                <span className="font-semibold">Próximo passo:</span> {item.recommendedAction}
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  )
}
