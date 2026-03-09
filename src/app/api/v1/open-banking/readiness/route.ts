import { ok } from '@/lib/api/response'
import { withOpenBankingAuth } from '@/lib/open-banking/api'
import type {
  OpenBankingChecklistItem,
  OpenBankingReadinessSummary,
  OpenBankingSurface,
} from '@/shared/types/open-banking'

type Meta = {
  summary: OpenBankingReadinessSummary
  checklist: OpenBankingChecklistItem[]
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function buildChecklist(): OpenBankingChecklistItem[] {
  const distributedRateLimitReady = hasAnyEnv([
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'REDIS_URL',
  ])
  const webhookSigningReady = hasAnyEnv(['WEBHOOK_SHARED_TOKEN'])

  return [
    {
      key: 'tenant-financial-boundaries',
      label: 'Isolamento financeiro por tenant',
      status: 'ready',
      detail: 'A base atual já trabalha com auth, RLS e rollout por organização para bloquear exposição indevida.',
    },
    {
      key: 'bank-consent-flow',
      label: 'Consentimento e vínculo bancário',
      status: 'planned',
      detail: 'Ainda não existe fluxo seguro de consentimento, escopo bancário e revogação por organização.',
    },
    {
      key: 'signed-connectors',
      label: 'Connectors assinados e auditáveis',
      status: webhookSigningReady ? 'ready' : 'blocked',
      detail: webhookSigningReady
        ? 'Existe base de signing para evoluir handshakes e webhooks de reconciliação.'
        : 'Sem signing configurado, qualquer integração bancária continua bloqueada.',
    },
    {
      key: 'distributed-rate-limit',
      label: 'Rate limit distribuído para parceiros financeiros',
      status: distributedRateLimitReady ? 'ready' : 'blocked',
      detail: distributedRateLimitReady
        ? 'A infraestrutura já suporta limitação conservadora para superfícies regulatórias.'
        : 'Sem rate limit distribuído, o domínio não deve sair do ambiente interno.',
    },
    {
      key: 'audit-and-retention',
      label: 'Audit log e retenção de eventos bancários',
      status: 'planned',
      detail: 'Ainda falta trilha formal de auditoria, retenção e política de acesso para eventos bancários.',
    },
  ]
}

function buildSurfaces(): OpenBankingSurface[] {
  return [
    {
      code: 'account-linking',
      label: 'Vínculo de conta',
      description: 'Conectar contas bancárias da construtora com consentimento explícito e revogável.',
      category: 'consent',
      riskLevel: 'high',
      exposureState: 'planned',
      complianceGated: true,
      recommendedAction: 'Bloquear até consentimento, credenciais e revogação estarem definidos por contrato.',
    },
    {
      code: 'balances-and-transactions',
      label: 'Saldo e extrato',
      description: 'Leitura de saldo e movimentações para reconciliação e acompanhamento financeiro.',
      category: 'accounts',
      riskLevel: 'high',
      exposureState: 'setup_required',
      complianceGated: true,
      recommendedAction: 'Começar só com leitura allowlisted e reconciliação assistida, nunca com escrita automática.',
    },
    {
      code: 'bank-reconciliation',
      label: 'Conciliação bancária',
      description: 'Matching entre eventos bancários e transações internas do sistema.',
      category: 'reconciliation',
      riskLevel: 'high',
      exposureState: 'setup_required',
      complianceGated: true,
      recommendedAction: 'Abrir primeiro em modo sugestão/manual review, sem autopost financeiro.',
    },
    {
      code: 'security-controls',
      label: 'Controles de segurança regulatória',
      description: 'Camada de segredo, assinatura, rate limit e observabilidade para o domínio bancário.',
      category: 'security',
      riskLevel: 'high',
      exposureState: 'beta_ready',
      complianceGated: false,
      recommendedAction: 'Usar a infraestrutura atual como base antes de qualquer integração real.',
    },
    {
      code: 'connector-platform',
      label: 'Plataforma de conectores bancários',
      description: 'Fundação operacional para provedores, retries, status e governança do domínio.',
      category: 'platform',
      riskLevel: 'medium',
      exposureState: 'internal_only',
      complianceGated: false,
      recommendedAction: 'Manter interno até fechar termos, consentimento e reconciliação segura.',
    },
  ]
}

function buildSummary(
  items: OpenBankingSurface[],
  checklist: OpenBankingChecklistItem[]
): OpenBankingReadinessSummary {
  return {
    totalSurfaces: items.length,
    internalOnly: items.filter((item) => item.exposureState === 'internal_only').length,
    betaReady: items.filter((item) => item.exposureState === 'beta_ready').length,
    setupRequired: items.filter((item) => item.exposureState === 'setup_required').length,
    planned: items.filter((item) => item.exposureState === 'planned').length,
    complianceGated: items.filter((item) => item.complianceGated).length,
    checklistReady: checklist.filter((item) => item.status === 'ready').length,
    checklistBlocked: checklist.filter((item) => item.status === 'blocked').length,
  }
}

export const GET = withOpenBankingAuth('can_manage_team', async (request) => {
  const checklist = buildChecklist()
  const items = buildSurfaces()

  return ok(request, items, {
    summary: buildSummary(items, checklist),
    checklist,
  } satisfies Meta)
})
