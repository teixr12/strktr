import { ok } from '@/lib/api/response'
import { withPublicApiAuth } from '@/lib/public-api/api'
import type {
  PublicApiChecklistItem,
  PublicApiReadinessSummary,
  PublicApiScopeDefinition,
  PublicApiSurface,
} from '@/shared/types/public-api'

type Meta = {
  summary: PublicApiReadinessSummary
  checklist: PublicApiChecklistItem[]
  scopes: PublicApiScopeDefinition[]
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function buildChecklist(): PublicApiChecklistItem[] {
  const webhookSigningReady = hasAnyEnv(['WEBHOOK_SHARED_TOKEN'])
  const distributedRateLimitReady = hasAnyEnv([
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'REDIS_URL',
  ])

  return [
    {
      key: 'canonical-envelope',
      label: 'Envelope canônico /api/v1',
      status: 'ready',
      detail: 'Rotas v1 já retornam envelope consistente e contratos validados em CI.',
    },
    {
      key: 'api-keys',
      label: 'API keys e escopos externos',
      status: 'blocked',
      detail: 'Ainda não existe emissão e rotação segura de API keys para terceiros.',
    },
    {
      key: 'webhook-signing',
      label: 'Webhook signing e replay protection',
      status: webhookSigningReady ? 'ready' : 'blocked',
      detail: webhookSigningReady
        ? 'Base de webhook assinado está configurada por token compartilhado.'
        : 'Webhook assinado ainda precisa de segredo configurado para general release.',
    },
    {
      key: 'distributed-rate-limit',
      label: 'Rate limit distribuído para uso externo',
      status: distributedRateLimitReady ? 'ready' : 'blocked',
      detail: distributedRateLimitReady
        ? 'Existe backend de rate limit disponível para rollout externo.'
        : 'Sem backend distribuído de rate limit, a API pública não deve abrir geral.',
    },
    {
      key: 'developer-docs',
      label: 'Documentação externa versionada',
      status: 'planned',
      detail: 'Contratos internos existem, mas a docs pública ainda não foi productizada.',
    },
  ]
}

function buildSurfaces(): PublicApiSurface[] {
  return [
    {
      code: 'crm-leads',
      label: 'CRM e Leads',
      description: 'Superfícies de leads, pipeline e próximas ações com contratos internos já estáveis.',
      category: 'crm',
      riskLevel: 'medium',
      exposureState: 'setup_required',
      complianceGated: false,
      sessionBacked: true,
      requiresApiKey: true,
      endpointFamilies: ['/api/v1/leads', '/api/v1/dashboard/summary'],
      recommendedAction: 'Adicionar API keys e escopos read/write antes de qualquer abertura externa.',
    },
    {
      code: 'operations-obras',
      label: 'Obras, cronograma e execução',
      description: 'Operação de obra com risco maior por impacto em planejamento, alertas e cronograma.',
      category: 'operations',
      riskLevel: 'high',
      exposureState: 'setup_required',
      complianceGated: false,
      sessionBacked: true,
      requiresApiKey: true,
      endpointFamilies: ['/api/v1/obras', '/api/v1/obras/:id/cronograma', '/api/v1/obras/:id/alerts'],
      recommendedAction: 'Abrir primeiro como leitura externa com quota conservadora e scopes mínimos.',
    },
    {
      code: 'finance-transactions',
      label: 'Financeiro e transações',
      description: 'Domínio sensível com exigência de trilha de auditoria, limites e autenticação forte.',
      category: 'finance',
      riskLevel: 'high',
      exposureState: 'planned',
      complianceGated: true,
      sessionBacked: true,
      requiresApiKey: true,
      endpointFamilies: ['/api/v1/transacoes', '/api/v1/financeiro/dre'],
      recommendedAction: 'Bloquear general release até fechar API keys, audit log e rate limit distribuído.',
    },
    {
      code: 'documents-exports',
      label: 'Documentos, exports e portal',
      description: 'PDFs, SOPs, Construction Docs e portal exigem contratos claros de share e acesso.',
      category: 'documents',
      riskLevel: 'medium',
      exposureState: 'setup_required',
      complianceGated: false,
      sessionBacked: true,
      requiresApiKey: true,
      endpointFamilies: ['/api/v1/sops', '/api/v1/docs', '/api/v1/construction-docs/*'],
      recommendedAction: 'Consolidar docs externas e separar superfícies privadas antes de expor terceiros.',
    },
    {
      code: 'webhooks-events',
      label: 'Webhooks e eventos',
      description: 'Entrega de eventos externos e ingestão assinada são a superfície mais próxima de beta.',
      category: 'automation',
      riskLevel: 'medium',
      exposureState: hasAnyEnv(['WEBHOOK_SHARED_TOKEN']) ? 'beta_ready' : 'setup_required',
      complianceGated: false,
      sessionBacked: false,
      requiresApiKey: false,
      endpointFamilies: ['/api/webhooks', '/api/v1/integrations/hub'],
      recommendedAction: hasAnyEnv(['WEBHOOK_SHARED_TOKEN'])
        ? 'Abrir primeiro via allowlist com retries e replay window observados.'
        : 'Configurar segredo compartilhado e política de assinatura antes do beta.',
    },
    {
      code: 'developer-platform',
      label: 'API keys, quotas e docs de desenvolvedor',
      description: 'Camada de produto para terceiros ainda não existe como interface real.',
      category: 'platform',
      riskLevel: 'high',
      exposureState: 'planned',
      complianceGated: true,
      sessionBacked: false,
      requiresApiKey: false,
      endpointFamilies: ['/api/v1/public-api/*'],
      recommendedAction: 'Criar gestão de API keys, quotas, versionamento e consentimento antes do release geral.',
    },
  ]
}

function buildScopes(): PublicApiScopeDefinition[] {
  return [
    {
      code: 'leads.read',
      label: 'Leads leitura',
      description: 'Permite listar leads, pipeline e próximas ações sem operações destrutivas.',
      level: 'read',
      domains: ['crm', 'dashboard'],
      rollout: 'beta',
    },
    {
      code: 'obras.read',
      label: 'Obras leitura',
      description: 'Acesso de leitura a obras, cronograma, KPIs e alertas operacionais.',
      level: 'read',
      domains: ['obras', 'cronograma', 'alerts'],
      rollout: 'beta',
    },
    {
      code: 'documents.read',
      label: 'Documentos leitura',
      description: 'Consulta a SOPs, Docs e exports sem mutações externas.',
      level: 'read',
      domains: ['sops', 'docs', 'construction-docs'],
      rollout: 'beta',
    },
    {
      code: 'finance.read',
      label: 'Financeiro leitura',
      description: 'Consulta financeira externa bloqueada até fechar audit log e política de acesso.',
      level: 'read',
      domains: ['transacoes', 'dre'],
      rollout: 'general_blocked',
    },
    {
      code: 'webhooks.manage',
      label: 'Webhooks administração',
      description: 'Configuração e rotação de segredos de webhooks externos.',
      level: 'admin',
      domains: ['webhooks', 'integrations'],
      rollout: 'internal_only',
    },
  ]
}

function buildSummary(
  items: PublicApiSurface[],
  checklist: PublicApiChecklistItem[]
): PublicApiReadinessSummary {
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

export const GET = withPublicApiAuth('can_manage_team', async (request) => {
  const checklist = buildChecklist()
  const items = buildSurfaces()
  const scopes = buildScopes()
  return ok(request, items, {
    summary: buildSummary(items, checklist),
    checklist,
    scopes,
  } satisfies Meta)
})
