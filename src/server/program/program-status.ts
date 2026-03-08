import { featureFlags, type FeatureFlagKey } from '@/lib/feature-flags'
import {
  getFeatureCanarySnapshot,
  type OrgCanarySnapshot,
  type OrgRolloutFeatureKey,
} from '@/server/feature-flags/wave2-canary'
import type {
  ProgramDeliveryState,
  ProgramHealthSummary,
  ProgramReleaseTrainKey,
  ProgramReleaseTrainStatus,
  ProgramModuleKey,
  ProgramModuleStatus,
  ProgramPodKey,
  ProgramPodStatus,
  ProgramRolloutState,
  ProgramStatusPayload,
} from '@/shared/types/program-status'

type ProgramModuleDefinition = {
  key: ProgramModuleKey
  title: string
  pod: ProgramPodKey
  order: number
  riskLevel: ProgramModuleStatus['riskLevel']
  deliveryState: ProgramDeliveryState
  requiresComplianceGate: boolean
  featureFlagKey: FeatureFlagKey
  canaryKey?: OrgRolloutFeatureKey
}

type ProgramReleaseTrainDefinition = {
  key: ProgramReleaseTrainKey
  title: string
  order: number
  stage: ProgramReleaseTrainStatus['stage']
  objective: string
  deployPolicy: 'all_flags_off'
  dependsOn: ProgramReleaseTrainKey[]
  affectedModules: ProgramModuleKey[]
  scope: string[]
  resolveBlockers: (modules: ProgramModuleStatus[]) => string[]
}

const POD_TITLES: Record<ProgramPodKey, string> = {
  podA: 'Core Stabilization + Promotions',
  podB: 'Ops + Finance First',
  podC: 'Revenue + Platform + Regulated Domains',
}

const PROGRAM_MODULES: ProgramModuleDefinition[] = [
  {
    key: 'financeReceipts',
    title: 'Finance Receipts',
    pod: 'podA',
    order: 1,
    riskLevel: 'high',
    deliveryState: 'implemented',
    requiresComplianceGate: false,
    featureFlagKey: 'financeReceiptsV1',
    canaryKey: 'financeReceipts',
  },
  {
    key: 'financeReceiptAi',
    title: 'Finance Receipt AI',
    pod: 'podA',
    order: 2,
    riskLevel: 'high',
    deliveryState: 'implemented',
    requiresComplianceGate: false,
    featureFlagKey: 'financeReceiptAiV1',
    canaryKey: 'financeReceiptAi',
  },
  {
    key: 'cronogramaUxV2',
    title: 'Cronograma UX V2',
    pod: 'podA',
    order: 3,
    riskLevel: 'medium',
    deliveryState: 'implemented',
    requiresComplianceGate: false,
    featureFlagKey: 'cronogramaUxV2',
    canaryKey: 'cronogramaUxV2',
  },
  {
    key: 'docsWorkspace',
    title: 'Docs Workspace',
    pod: 'podA',
    order: 4,
    riskLevel: 'medium',
    deliveryState: 'implemented',
    requiresComplianceGate: false,
    featureFlagKey: 'docsWorkspaceV1',
    canaryKey: 'docsWorkspace',
  },
  {
    key: 'portalAdminV2',
    title: 'Portal Admin V2',
    pod: 'podB',
    order: 1,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    featureFlagKey: 'portalAdminV2',
    canaryKey: 'portalAdminV2',
  },
  {
    key: 'obraIntelligenceV1',
    title: 'Obra Intelligence',
    pod: 'podB',
    order: 2,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    featureFlagKey: 'obraIntelligenceV1',
    canaryKey: 'obraIntelligenceV1',
  },
  {
    key: 'financeDepthV1',
    title: 'Finance Depth',
    pod: 'podB',
    order: 3,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    featureFlagKey: 'financeDepthV1',
    canaryKey: 'financeDepthV1',
  },
  {
    key: 'supplierManagementV1',
    title: 'Supplier Management',
    pod: 'podB',
    order: 4,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    featureFlagKey: 'supplierManagementV1',
    canaryKey: 'supplierManagementV1',
  },
  {
    key: 'bureaucracyV1',
    title: 'Bureaucracy',
    pod: 'podB',
    order: 5,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    featureFlagKey: 'bureaucracyV1',
    canaryKey: 'bureaucracyV1',
  },
  {
    key: 'emailTriageV1',
    title: 'Email Triage',
    pod: 'podB',
    order: 6,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    featureFlagKey: 'emailTriageV1',
    canaryKey: 'emailTriageV1',
  },
  {
    key: 'billingV1',
    title: 'Billing',
    pod: 'podC',
    order: 1,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    featureFlagKey: 'billingV1',
    canaryKey: 'billingV1',
  },
  {
    key: 'referralV1',
    title: 'Referral',
    pod: 'podC',
    order: 2,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    featureFlagKey: 'referralV1',
    canaryKey: 'referralV1',
  },
  {
    key: 'publicApiV1',
    title: 'Public API',
    pod: 'podC',
    order: 3,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    featureFlagKey: 'publicApiV1',
    canaryKey: 'publicApiV1',
  },
  {
    key: 'integrationsHubV1',
    title: 'Integrations Hub',
    pod: 'podC',
    order: 4,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    featureFlagKey: 'integrationsHubV1',
    canaryKey: 'integrationsHubV1',
  },
  {
    key: 'superAdminV1',
    title: 'Super Admin',
    pod: 'podC',
    order: 5,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    featureFlagKey: 'superAdminV1',
    canaryKey: 'superAdminV1',
  },
  {
    key: 'agentReadyV1',
    title: 'Agent Ready',
    pod: 'podC',
    order: 6,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    featureFlagKey: 'agentReadyV1',
    canaryKey: 'agentReadyV1',
  },
  {
    key: 'bigDataV1',
    title: 'Big Data',
    pod: 'podC',
    order: 7,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    featureFlagKey: 'bigDataV1',
    canaryKey: 'bigDataV1',
  },
  {
    key: 'openBankingV1',
    title: 'Open Banking',
    pod: 'podC',
    order: 8,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    featureFlagKey: 'openBankingV1',
    canaryKey: 'openBankingV1',
  },
]

const PROGRAM_RELEASE_TRAINS: ProgramReleaseTrainDefinition[] = [
  {
    key: 'trainA',
    title: 'Train A - Foundation',
    order: 1,
    stage: 'current',
    objective: 'Separar a fundação do programa em um PR único, com tudo novo OFF e sem drift local.',
    deployPolicy: 'all_flags_off',
    dependsOn: [],
    affectedModules: [],
    scope: [
      'Control plane de rollout e canário por organização',
      'Program status e manifests operacionais',
      'health/ops e /ops/program como fonte de verdade',
      'shell, smoke e gates preparados para módulos novos',
      'higiene de branch para excluir artefatos gerados',
    ],
    resolveBlockers: (modules) => {
      const financeReceipts = modules.find((module) => module.key === 'financeReceipts')
      if (
        financeReceipts &&
        (financeReceipts.rolloutState === 'allowlist' || financeReceipts.rolloutState === 'canary')
      ) {
        return ['financeReceipts ainda está em rollout operacional em produção.']
      }
      return []
    },
  },
  {
    key: 'trainB',
    title: 'Train B - Pod B Foundations',
    order: 2,
    stage: 'next',
    objective: 'Subir as foundations read-only do Pod B com tudo OFF, sem abrir blast radius funcional.',
    deployPolicy: 'all_flags_off',
    dependsOn: ['trainA'],
    affectedModules: [
      'portalAdminV2',
      'obraIntelligenceV1',
      'financeDepthV1',
      'supplierManagementV1',
      'bureaucracyV1',
      'emailTriageV1',
    ],
    scope: [
      'UI e APIs additivas read-only ou internal-first',
      'migrations aditivas com org_id, RLS e audits',
      'gates 404-safe por flag e canário',
    ],
    resolveBlockers: () => ['Depende do corte e deploy do Train A com tudo novo OFF.'],
  },
  {
    key: 'trainC',
    title: 'Train C - Pod C Foundations',
    order: 3,
    stage: 'later',
    objective: 'Subir as foundations reguladas e de plataforma com write bloqueado em produção.',
    deployPolicy: 'all_flags_off',
    dependsOn: ['trainB'],
    affectedModules: [
      'billingV1',
      'referralV1',
      'publicApiV1',
      'integrationsHubV1',
      'superAdminV1',
      'agentReadyV1',
      'bigDataV1',
      'openBankingV1',
    ],
    scope: [
      'surfaces reguladas continuam compliance gated',
      'write bloqueado em produção por padrão',
      'rollout só após Pod A e Pod B estabilizados',
    ],
    resolveBlockers: () => ['Depende do corte do Train B e da política de compliance continuar ativa.'],
  },
]

function resolveRolloutState(
  featureEnabled: boolean,
  snapshot: OrgCanarySnapshot | null
): ProgramRolloutState {
  if (!featureEnabled) return 'off'
  if (!snapshot || !snapshot.configured) return 'live'
  if (snapshot.percent <= 0 && snapshot.allowlistCount <= 0) return 'blocked'
  if (snapshot.percent <= 0 && snapshot.allowlistCount > 0) return 'allowlist'
  if (snapshot.percent >= 100) return 'live'
  return 'canary'
}

function buildModuleStatus(definition: ProgramModuleDefinition): ProgramModuleStatus {
  const featureEnabled = featureFlags[definition.featureFlagKey]
  const rollout = definition.canaryKey ? getFeatureCanarySnapshot(definition.canaryKey) : null

  return {
    key: definition.key,
    title: definition.title,
    pod: definition.pod,
    order: definition.order,
    riskLevel: definition.riskLevel,
    deliveryState: definition.deliveryState,
    requiresComplianceGate: definition.requiresComplianceGate,
    featureFlagKey: definition.featureFlagKey,
    featureEnabled,
    canaryKey: definition.canaryKey || null,
    rolloutState: resolveRolloutState(featureEnabled, rollout),
    rollout: rollout
      ? {
          configured: rollout.configured,
          percent: rollout.percent,
          allowlistCount: rollout.allowlistCount,
          source: rollout.source,
        }
      : null,
  }
}

function buildPodStatus(pod: ProgramPodKey): ProgramPodStatus {
  const modules = PROGRAM_MODULES
    .filter((module) => module.pod === pod)
    .sort((left, right) => left.order - right.order)
    .map(buildModuleStatus)

  return {
    key: pod,
    title: POD_TITLES[pod],
    summary: {
      totalModules: modules.length,
      implementedModules: modules.filter((module) => module.deliveryState === 'implemented').length,
      inProgressModules: modules.filter((module) => module.deliveryState === 'in_progress').length,
      plannedModules: modules.filter((module) => module.deliveryState === 'planned').length,
      liveModules: modules.filter((module) => module.rolloutState === 'live').length,
      canaryModules: modules.filter((module) => module.rolloutState === 'canary').length,
      allowlistModules: modules.filter((module) => module.rolloutState === 'allowlist').length,
      blockedModules: modules.filter((module) => module.rolloutState === 'blocked').length,
    },
    modules,
  }
}

function buildReleaseTrainStatus(
  definition: ProgramReleaseTrainDefinition,
  modules: ProgramModuleStatus[]
): ProgramReleaseTrainStatus {
  return {
    key: definition.key,
    title: definition.title,
    order: definition.order,
    stage: definition.stage,
    objective: definition.objective,
    deployPolicy: definition.deployPolicy,
    dependsOn: definition.dependsOn,
    affectedModules: definition.affectedModules,
    scope: definition.scope,
    blockers: definition.resolveBlockers(modules),
  }
}

export function getProgramStatusPayload(): ProgramStatusPayload {
  const podOrder: ProgramPodKey[] = ['podA', 'podB', 'podC']
  const pods: ProgramPodStatus[] = podOrder.map(buildPodStatus)
  const modules = pods.flatMap((pod) => pod.modules)
  const releaseTrains = PROGRAM_RELEASE_TRAINS.map((train) => buildReleaseTrainStatus(train, modules))

  return {
    horizonDays: 90,
    strategy: 'modular_monolith',
    rolloutPolicy: 'org_canary',
    regulatedGeneralReleasePolicy: 'blocked-until-compliance',
    pods,
    releaseTrains,
    summary: {
      totalModules: modules.length,
      implementedModules: modules.filter((module) => module.deliveryState === 'implemented').length,
      inProgressModules: modules.filter((module) => module.deliveryState === 'in_progress').length,
      plannedModules: modules.filter((module) => module.deliveryState === 'planned').length,
      liveModules: modules.filter((module) => module.rolloutState === 'live').length,
      canaryModules: modules.filter((module) => module.rolloutState === 'canary').length,
      allowlistModules: modules.filter((module) => module.rolloutState === 'allowlist').length,
      blockedModules: modules.filter((module) => module.rolloutState === 'blocked').length,
      complianceGatedModules: modules.filter((module) => module.requiresComplianceGate).length,
    },
  }
}

export function getProgramHealthSummary(): ProgramHealthSummary {
  const payload = getProgramStatusPayload()

  return {
    horizonDays: payload.horizonDays,
    rolloutPolicy: payload.rolloutPolicy,
    regulatedGeneralReleasePolicy: payload.regulatedGeneralReleasePolicy,
    pods: payload.pods.map((pod) => ({
      key: pod.key,
      title: pod.title,
      totalModules: pod.summary.totalModules,
      liveModules: pod.summary.liveModules,
      canaryModules: pod.summary.canaryModules,
      allowlistModules: pod.summary.allowlistModules,
      blockedModules: pod.summary.blockedModules,
    })),
    releaseTrains: payload.releaseTrains.map((train) => ({
      key: train.key,
      title: train.title,
      stage: train.stage,
      affectedModuleCount: train.affectedModules.length,
      blockerCount: train.blockers.length,
    })),
    totals: {
      totalModules: payload.summary.totalModules,
      liveModules: payload.summary.liveModules,
      canaryModules: payload.summary.canaryModules,
      allowlistModules: payload.summary.allowlistModules,
      blockedModules: payload.summary.blockedModules,
      complianceGatedModules: payload.summary.complianceGatedModules,
    },
  }
}
