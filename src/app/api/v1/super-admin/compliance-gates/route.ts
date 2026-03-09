import { ok } from '@/lib/api/response'
import { withSuperAdminAuth } from '@/lib/super-admin/api'
import { getProgramStatusPayload } from '@/server/program/program-status'
import type { ProgramModuleStatus } from '@/shared/types/program-status'
import type {
  SuperAdminComplianceGateCheck,
  SuperAdminComplianceGateModule,
  SuperAdminComplianceGatesPayload,
  SuperAdminComplianceGateSummary,
} from '@/shared/types/super-admin'

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function getCommonSignals() {
  return {
    distributedRateLimitReady: hasAnyEnv([
      'KV_REST_API_URL',
      'KV_REST_API_TOKEN',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'REDIS_URL',
    ]),
    webhookSigningReady: hasAnyEnv(['WEBHOOK_SHARED_TOKEN']),
    serviceRoleReady: hasAnyEnv(['SUPABASE_SERVICE_ROLE_KEY']),
    auditLogReady: false,
    consentWorkflowReady: false,
    anonymizationReady: false,
  }
}

function createCheck(
  key: string,
  label: string,
  ok: boolean,
  severity: 'warning' | 'blocker',
  detail: string
): SuperAdminComplianceGateCheck {
  return { key, label, ok, severity, detail }
}

function buildChecks(
  module: ProgramModuleStatus,
  signals: ReturnType<typeof getCommonSignals>
): SuperAdminComplianceGateCheck[] {
  const checks: SuperAdminComplianceGateCheck[] = [
    createCheck(
      'general_release_guard',
      'General release guard',
      module.rolloutState !== 'live',
      'blocker',
      module.rolloutState === 'live'
        ? 'Domínio regulado não deveria estar live sem fechar o gate de compliance.'
        : `Rollout atual ${module.rolloutState}; general release segue contido.`
    ),
    createCheck(
      'delivery_state',
      'Delivery state',
      module.deliveryState === 'implemented',
      'warning',
      module.deliveryState === 'implemented'
        ? 'Domínio já tem base implementada.'
        : `Domínio ainda está em ${module.deliveryState}.`
    ),
  ]

  switch (module.key) {
    case 'billingV1':
      checks.push(
        createCheck(
          'rate_limit',
          'Rate limit distribuído',
          signals.distributedRateLimitReady,
          'blocker',
          signals.distributedRateLimitReady
            ? 'Há infraestrutura para limitar checkout/webhooks.'
            : 'Sem rate limit distribuído, billing não deve abrir geral.'
        ),
        createCheck(
          'webhook_signing',
          'Webhook signing e rotação',
          signals.webhookSigningReady,
          'blocker',
          signals.webhookSigningReady
            ? 'Há base de signing para callbacks críticos.'
            : 'Sem signing mínimo, billing permanece contido.'
        ),
        createCheck(
          'consent_terms',
          'Consentimento e termos',
          signals.consentWorkflowReady,
          'warning',
          signals.consentWorkflowReady
            ? 'Fluxo formal de consentimento está fechado.'
            : 'Ainda falta o fluxo formal de consentimento e aceite operacional.'
        ),
        createCheck(
          'audit_log',
          'Audit log operacional',
          signals.auditLogReady,
          'warning',
          signals.auditLogReady
            ? 'Trilha operacional disponível.'
            : 'Ainda falta uma trilha formal de ações críticas para billing.'
        )
      )
      break
    case 'publicApiV1':
      checks.push(
        createCheck(
          'rate_limit',
          'Rate limit distribuído',
          signals.distributedRateLimitReady,
          'blocker',
          signals.distributedRateLimitReady
            ? 'Há infraestrutura para limitar abuso de API.'
            : 'Sem rate limit distribuído, a API pública não deve abrir geral.'
        ),
        createCheck(
          'signing_rotation',
          'Signing e rotação de credenciais',
          signals.webhookSigningReady,
          'blocker',
          signals.webhookSigningReady
            ? 'Há base de assinatura/rotação para webhooks e credenciais.'
            : 'Sem signing mínimo, o domínio permanece em preview interno.'
        ),
        createCheck(
          'audit_log',
          'Audit log de consumo',
          signals.auditLogReady,
          'warning',
          signals.auditLogReady
            ? 'Consumo e alterações podem ser auditados formalmente.'
            : 'Ainda falta auditoria explícita para chaves, quotas e revogações.'
        )
      )
      break
    case 'superAdminV1':
      checks.push(
        createCheck(
          'service_role',
          'Service role segregada',
          signals.serviceRoleReady,
          'blocker',
          signals.serviceRoleReady
            ? 'A base de leitura privilegiada existe no ambiente.'
            : 'Sem service role pronta, a superfície global deve permanecer bloqueada.'
        ),
        createCheck(
          'rate_limit',
          'Rate limit distribuído',
          signals.distributedRateLimitReady,
          'warning',
          signals.distributedRateLimitReady
            ? 'A superfície global pode ser protegida por limite forte.'
            : 'Ainda falta limitação distribuída para operações internas de maior impacto.'
        ),
        createCheck(
          'audit_log',
          'Audit log global',
          signals.auditLogReady,
          'blocker',
          signals.auditLogReady
            ? 'Ações globais ficam rastreáveis.'
            : 'Sem audit log global, o super-admin não deve abrir além do uso interno controlado.'
        )
      )
      break
    case 'agentReadyV1':
      checks.push(
        createCheck(
          'signing_rotation',
          'Signing e rotação',
          signals.webhookSigningReady,
          'blocker',
          signals.webhookSigningReady
            ? 'Há base mínima para segregar callbacks/credenciais.'
            : 'Sem signing mínimo, conectores de agentes ficam bloqueados.'
        ),
        createCheck(
          'audit_log',
          'Audit log de ações de agente',
          signals.auditLogReady,
          'blocker',
          signals.auditLogReady
            ? 'Ações de agente ficam rastreáveis.'
            : 'Ainda falta trilha formal para ações automatizadas.'
        )
      )
      break
    case 'bigDataV1':
      checks.push(
        createCheck(
          'anonymization',
          'Anonimização e agregação',
          signals.anonymizationReady,
          'blocker',
          signals.anonymizationReady
            ? 'Camada de anonimização foi fechada.'
            : 'Sem anonimização formal, insights globais permanecem bloqueados.'
        ),
        createCheck(
          'consent_legal_basis',
          'Base legal e consentimento',
          signals.consentWorkflowReady,
          'blocker',
          signals.consentWorkflowReady
            ? 'A base legal/consentimento está definida.'
            : 'Ainda falta formalização de base legal e retenção.'
        ),
        createCheck(
          'audit_log',
          'Audit log de extração',
          signals.auditLogReady,
          'warning',
          signals.auditLogReady
            ? 'Acesso agregado fica rastreável.'
            : 'Falta trilha explícita de consultas agregadas sensíveis.'
        )
      )
      break
    case 'openBankingV1':
      checks.push(
        createCheck(
          'consent',
          'Consentimento bancário',
          signals.consentWorkflowReady,
          'blocker',
          signals.consentWorkflowReady
            ? 'Fluxo formal de consentimento existe.'
            : 'Sem consentimento formal, Open Banking permanece bloqueado.'
        ),
        createCheck(
          'signing_rotation',
          'Signing e rotação',
          signals.webhookSigningReady,
          'blocker',
          signals.webhookSigningReady
            ? 'A base de signing existe.'
            : 'Sem signing mínimo, conectores bancários não devem abrir.'
        ),
        createCheck(
          'audit_log',
          'Audit log financeiro',
          signals.auditLogReady,
          'blocker',
          signals.auditLogReady
            ? 'Operações financeiras ficam rastreáveis.'
            : 'Ainda falta auditoria formal para operações financeiras reguladas.'
        ),
        createCheck(
          'rate_limit',
          'Rate limit distribuído',
          signals.distributedRateLimitReady,
          'warning',
          signals.distributedRateLimitReady
            ? 'Há proteção operacional de tráfego.'
            : 'Falta limitação distribuída antes de qualquer abertura maior.'
        )
      )
      break
    default:
      break
  }

  return checks
}

function priorityWeight(module: SuperAdminComplianceGateModule) {
  const statusWeight = module.status === 'blocked' ? 4 : module.status === 'attention' ? 3 : 1
  const rolloutWeight =
    module.rolloutState === 'live'
      ? 4
      : module.rolloutState === 'canary'
        ? 3
        : module.rolloutState === 'allowlist'
          ? 2
          : 1
  const riskWeight = module.riskLevel === 'high' ? 2 : module.riskLevel === 'medium' ? 1 : 0
  return statusWeight * 10 + rolloutWeight * 2 + riskWeight
}

export const GET = withSuperAdminAuth('can_manage_team', async (request) => {
  const signals = getCommonSignals()
  const program = getProgramStatusPayload()

  const modules: SuperAdminComplianceGateModule[] = program.pods
    .flatMap((pod) =>
      pod.modules
        .filter((module) => module.requiresComplianceGate)
        .map((module) => {
          const checks = buildChecks(module, signals)
          const blockers = checks.filter((check) => check.severity === 'blocker' && !check.ok)
          const warnings = checks.filter((check) => check.severity === 'warning' && !check.ok)
          const status: SuperAdminComplianceGateModule['status'] =
            module.rolloutState === 'live' && blockers.length > 0
              ? 'blocked'
              : blockers.length > 0 || warnings.length > 0
                ? 'attention'
                : 'ready'

          const failing = [...blockers, ...warnings]
          const gateReason =
            failing[0]?.detail ||
            (status === 'ready'
              ? 'Gate mínimo fechado para o estágio atual.'
              : 'Gate ainda exige ajustes antes da próxima promoção.')

          const recommendedAction =
            status === 'blocked'
              ? 'Voltar o domínio para allowlist/canary e fechar blockers antes de qualquer general release.'
              : status === 'attention'
                ? 'Manter o domínio contido e fechar blockers/warnings de compliance antes de avançar.'
                : module.rolloutState === 'live'
                  ? 'Pode permanecer live com observação operacional padrão.'
                  : 'Pode avançar para o próximo estágio de rollout quando houver demanda.'

          return {
            key: module.key,
            title: module.title,
            podKey: pod.key,
            podTitle: pod.title,
            riskLevel: module.riskLevel,
            deliveryState: module.deliveryState,
            rolloutState: module.rolloutState,
            status,
            gateReason,
            recommendedAction,
            blockerCount: blockers.length,
            warningCount: warnings.length,
            checks,
          }
        })
    )
    .sort((a, b) => priorityWeight(b) - priorityWeight(a))

  const summary: SuperAdminComplianceGateSummary = {
    totalRegulatedModules: modules.length,
    ready: modules.filter((module) => module.status === 'ready').length,
    attention: modules.filter((module) => module.status === 'attention').length,
    blocked: modules.filter((module) => module.status === 'blocked').length,
    safelyContained: modules.filter(
      (module) => module.rolloutState === 'off' || module.rolloutState === 'allowlist' || module.rolloutState === 'blocked'
    ).length,
    liveWithOpenBlockers: modules.filter(
      (module) => module.rolloutState === 'live' && module.status === 'blocked'
    ).length,
  }

  return ok(request, { summary, modules } satisfies SuperAdminComplianceGatesPayload)
})
