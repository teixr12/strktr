import { ok } from '@/lib/api/response'
import { withAgentReadyAuth } from '@/lib/agent-ready/api'
import type {
  AgentReadyActionDefinition,
  AgentReadyChecklistItem,
  AgentReadyScopeDefinition,
  AgentReadySummary,
  AgentReadySurface,
} from '@/shared/types/agent-ready'

type Meta = {
  summary: AgentReadySummary
  checklist: AgentReadyChecklistItem[]
  scopes: AgentReadyScopeDefinition[]
  actions: AgentReadyActionDefinition[]
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function buildChecklist(): AgentReadyChecklistItem[] {
  const webhookSigningReady = hasAnyEnv(['WEBHOOK_SHARED_TOKEN'])
  const distributedRateLimitReady = hasAnyEnv([
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'REDIS_URL',
  ])
  const promptDefenseReady = hasAnyEnv(['OPENAI_API_KEY'])

  return [
    {
      key: 'scoped-actions',
      label: 'Ações escopadas por tenant',
      status: 'ready',
      detail: 'A camada atual já tem auth, RLS e canário por organização para superfícies internas.',
    },
    {
      key: 'prompt-defense',
      label: 'Prompt injection / defense gateway',
      status: promptDefenseReady ? 'planned' : 'blocked',
      detail: promptDefenseReady
        ? 'Há base de provedor para evoluir policy engine, mas o gateway ainda não foi productizado.'
        : 'Sem provedor/config básica, o gateway de defesa de IA nem pode entrar em beta.',
    },
    {
      key: 'distributed-rate-limit',
      label: 'Rate limit distribuído para agentes externos',
      status: distributedRateLimitReady ? 'ready' : 'blocked',
      detail: distributedRateLimitReady
        ? 'A infraestrutura suporta limitação de chamadas externas por tenant.'
        : 'Sem rate limit distribuído, qualquer connector externo fica bloqueado.',
    },
    {
      key: 'audit-log',
      label: 'Audit log de actions agenticas',
      status: 'planned',
      detail: 'Ainda falta trilha explícita de tool use/push action por agente externo.',
    },
    {
      key: 'connector-signing',
      label: 'Assinatura e handshake de conectores',
      status: webhookSigningReady ? 'ready' : 'blocked',
      detail: webhookSigningReady
        ? 'Existe base de signing para evoluir handshake e replay protection.'
        : 'Sem segredo compartilhado, o handshake externo continua bloqueado.',
    },
  ]
}

function buildScopes(): AgentReadyScopeDefinition[] {
  return [
    {
      code: 'crm:leads:read',
      label: 'Leads leitura',
      description: 'Permite ler pipeline, SLA e próxima ação de leads do tenant.',
      level: 'read',
      domains: ['leads', 'crm'],
      rollout: 'internal_only',
    },
    {
      code: 'obras:context:read',
      label: 'Obras leitura',
      description: 'Permite ler contexto operacional, cronograma, alertas e intelligence da obra.',
      level: 'read',
      domains: ['obras', 'cronograma'],
      rollout: 'internal_only',
    },
    {
      code: 'finance:summary:read',
      label: 'Financeiro leitura',
      description: 'Permite ler saldos, DRE, anexos e visão resumida de despesas/receitas.',
      level: 'read',
      domains: ['financeiro'],
      rollout: 'general_blocked',
    },
    {
      code: 'tasks:write',
      label: 'Tarefas escrita',
      description: 'Permite criar ou atualizar tarefas gerais e atribuições controladas.',
      level: 'write',
      domains: ['tarefas'],
      rollout: 'beta',
    },
    {
      code: 'documents:generate',
      label: 'Documentos gerar',
      description: 'Permite disparar geração de SOPs e documentos estruturados por rotas internas.',
      level: 'write',
      domains: ['docs', 'construction-docs', 'sops'],
      rollout: 'general_blocked',
    },
    {
      code: 'portal:admin',
      label: 'Portal admin',
      description: 'Permite operar branding, invites e visão gerencial do portal do cliente.',
      level: 'admin',
      domains: ['portal'],
      rollout: 'general_blocked',
    },
  ]
}

function buildActions(): AgentReadyActionDefinition[] {
  return [
    {
      code: 'leads.list',
      label: 'Listar leads',
      description: 'Lê pipeline e contexto de leads do tenant.',
      domain: 'crm',
      kind: 'read',
      riskLevel: 'medium',
      requiredScopes: ['crm:leads:read'],
      rollout: 'internal_only',
    },
    {
      code: 'obras.intelligence.read',
      label: 'Ler intelligence da obra',
      description: 'Obtém resumo operacional da obra, alertas e prontidão.',
      domain: 'obras',
      kind: 'read',
      riskLevel: 'medium',
      requiredScopes: ['obras:context:read'],
      rollout: 'internal_only',
    },
    {
      code: 'tasks.create',
      label: 'Criar tarefa geral',
      description: 'Cria tarefa interna com atribuição e prazo no contexto do tenant.',
      domain: 'tarefas',
      kind: 'write',
      riskLevel: 'medium',
      requiredScopes: ['tasks:write'],
      rollout: 'beta',
    },
    {
      code: 'documents.generate.sop',
      label: 'Gerar SOP',
      description: 'Dispara geração controlada de SOP ou documento padrão do workspace.',
      domain: 'docs',
      kind: 'generate',
      riskLevel: 'high',
      requiredScopes: ['documents:generate'],
      rollout: 'general_blocked',
    },
    {
      code: 'portal.invite.regenerate',
      label: 'Regenerar invite do portal',
      description: 'Atualiza magic link e credenciais operacionais do portal do cliente.',
      domain: 'portal',
      kind: 'write',
      riskLevel: 'high',
      requiredScopes: ['portal:admin'],
      rollout: 'general_blocked',
    },
    {
      code: 'finance.summary.read',
      label: 'Ler resumo financeiro',
      description: 'Lê visão resumida de caixa, saldo e DRE sem expor escrita financeira.',
      domain: 'financeiro',
      kind: 'read',
      riskLevel: 'high',
      requiredScopes: ['finance:summary:read'],
      rollout: 'general_blocked',
    },
  ]
}

function buildSurfaces(): AgentReadySurface[] {
  return [
    {
      code: 'context-read',
      label: 'Contexto de leitura por tenant',
      description: 'Leitura segura de dados operacionais, CRM e documentos por workspace/org.',
      category: 'context',
      riskLevel: 'medium',
      exposureState: 'internal_only',
      complianceGated: true,
      recommendedAction: 'Abrir primeiro como leitura allowlisted com escopos mínimos e auditoria.',
    },
    {
      code: 'action-gateway',
      label: 'Action gateway para agentes',
      description: 'Camada intermediária para push actions seguras sem dar acesso bruto ao backend.',
      category: 'actions',
      riskLevel: 'high',
      exposureState: 'planned',
      complianceGated: true,
      recommendedAction: 'Criar executor escopado com idempotência e rollback por domínio antes do beta.',
    },
    {
      code: 'prompt-defense',
      label: 'Defense layer contra prompt injection',
      description: 'Políticas de sanitização, allowlists, validation e bloqueio de conteúdo malicioso.',
      category: 'security',
      riskLevel: 'high',
      exposureState: 'setup_required',
      complianceGated: true,
      recommendedAction: 'Fechar policy engine, redaction e filtros de saída antes de qualquer connector geral.',
    },
    {
      code: 'agent-observability',
      label: 'Observabilidade de agentes',
      description: 'Rastreamento de chamadas, falhas, tool selection e outcomes por tenant.',
      category: 'observability',
      riskLevel: 'medium',
      exposureState: 'beta_ready',
      complianceGated: false,
      recommendedAction: 'Usar health, analytics e gates atuais como base antes de abrir write paths.',
    },
    {
      code: 'external-connectors',
      label: 'Conectores externos de agentes/LLMs',
      description: 'MCP, apps externas e conectores de vendors como OpenAI, Claude e Gemini.',
      category: 'connectors',
      riskLevel: 'high',
      exposureState: 'planned',
      complianceGated: true,
      recommendedAction: 'Começar com allowlist por tenant e handshake assinado, nunca general release direto.',
    },
  ]
}

function buildSummary(
  items: AgentReadySurface[],
  checklist: AgentReadyChecklistItem[]
): AgentReadySummary {
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

export const GET = withAgentReadyAuth('can_manage_team', async (request) => {
  const checklist = buildChecklist()
  const items = buildSurfaces()
  const scopes = buildScopes()
  const actions = buildActions()
  return ok(request, items, {
    summary: buildSummary(items, checklist),
    checklist,
    scopes,
    actions,
  } satisfies Meta)
})
