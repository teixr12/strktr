import { featureFlags, type FeatureFlagKey } from '@/lib/feature-flags'
import {
  getFeatureCanarySnapshot,
  type OrgCanarySnapshot,
  type OrgRolloutFeatureKey,
} from '@/server/feature-flags/wave2-canary'
import type {
  ProgramDeliveryState,
  ProgramExecutionClassification,
  ProgramExecutionControl,
  ProgramExecutionPhase,
  ProgramExecutionTaskStatus,
  ProgramHealthSummary,
  ProgramModuleKey,
  ProgramModuleStatus,
  ProgramPodKey,
  ProgramPodStatus,
  ProgramReleaseTrainKey,
  ProgramReleaseTrainStatus,
  ProgramRolloutState,
  ProgramStructuralGapKey,
  ProgramStructuralGapStatus,
  ProgramStatusPayload,
} from '@/shared/types/program-status'

type ProgramModuleDefinition = {
  moduleId: ProgramModuleKey
  title: string
  pod: ProgramPodKey
  order: number
  riskLevel: ProgramModuleStatus['riskLevel']
  deliveryState: ProgramDeliveryState
  requiresComplianceGate: boolean
  flagName: FeatureFlagKey
  rolloutName?: OrgRolloutFeatureKey
}

type ProgramReleaseTrainDefinition = {
  trainId: ProgramReleaseTrainKey
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

type ProgramExecutionTaskDefinition = {
  key: string
  title: string
  classification: ProgramExecutionClassification
  dependencies: string[]
  operationalRisk: ProgramExecutionTaskStatus['operationalRisk']
  safestRolloutPath: string
  rollbackStrategy: string
  isAllowed: (context: ProgramExecutionContext) => boolean
  resolveBlockers: (context: ProgramExecutionContext) => string[]
}

type ProgramStructuralGapDefinition = {
  key: ProgramStructuralGapKey
  title: string
  requiredBefore: ProgramExecutionClassification[]
  reason: string
}

type ProgramExecutionContext = {
  modules: ProgramModuleStatus[]
  certification: ProgramExecutionControl['certification']
  liveCoreModuleKeys: ProgramModuleKey[]
  structuralGaps: ProgramStructuralGapStatus[]
  currentPhase: ProgramExecutionPhase
}

const POD_TITLES: Record<ProgramPodKey, string> = {
  podA: 'Core Stabilization + Promotions',
  podB: 'Ops + Finance First',
  podC: 'Revenue + Platform + Regulated Domains',
}

const PROGRAM_MODULES: ProgramModuleDefinition[] = [
  {
    moduleId: 'financeReceipts',
    title: 'Finance Receipts',
    pod: 'podA',
    order: 1,
    riskLevel: 'high',
    deliveryState: 'implemented',
    requiresComplianceGate: false,
    flagName: 'financeReceiptsV1',
    rolloutName: 'financeReceipts',
  },
  {
    moduleId: 'financeReceiptAi',
    title: 'Finance Receipt AI',
    pod: 'podA',
    order: 2,
    riskLevel: 'high',
    deliveryState: 'implemented',
    requiresComplianceGate: false,
    flagName: 'financeReceiptAiV1',
    rolloutName: 'financeReceiptAi',
  },
  {
    moduleId: 'cronogramaUxV2',
    title: 'Cronograma UX V2',
    pod: 'podA',
    order: 3,
    riskLevel: 'medium',
    deliveryState: 'implemented',
    requiresComplianceGate: false,
    flagName: 'cronogramaUxV2',
    rolloutName: 'cronogramaUxV2',
  },
  {
    moduleId: 'docsWorkspace',
    title: 'Docs Workspace',
    pod: 'podA',
    order: 4,
    riskLevel: 'medium',
    deliveryState: 'implemented',
    requiresComplianceGate: false,
    flagName: 'docsWorkspaceV1',
    rolloutName: 'docsWorkspace',
  },
  {
    moduleId: 'portalAdminV2',
    title: 'Portal Admin V2',
    pod: 'podB',
    order: 1,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    flagName: 'portalAdminV2',
    rolloutName: 'portalAdminV2',
  },
  {
    moduleId: 'obraIntelligenceV1',
    title: 'Obra Intelligence',
    pod: 'podB',
    order: 2,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    flagName: 'obraIntelligenceV1',
    rolloutName: 'obraIntelligenceV1',
  },
  {
    moduleId: 'financeDepthV1',
    title: 'Finance Depth',
    pod: 'podB',
    order: 3,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    flagName: 'financeDepthV1',
    rolloutName: 'financeDepthV1',
  },
  {
    moduleId: 'supplierManagementV1',
    title: 'Supplier Management',
    pod: 'podB',
    order: 4,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    flagName: 'supplierManagementV1',
    rolloutName: 'supplierManagementV1',
  },
  {
    moduleId: 'bureaucracyV1',
    title: 'Bureaucracy',
    pod: 'podB',
    order: 5,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    flagName: 'bureaucracyV1',
    rolloutName: 'bureaucracyV1',
  },
  {
    moduleId: 'emailTriageV1',
    title: 'Email Triage',
    pod: 'podB',
    order: 6,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    flagName: 'emailTriageV1',
    rolloutName: 'emailTriageV1',
  },
  {
    moduleId: 'billingV1',
    title: 'Billing',
    pod: 'podC',
    order: 1,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    flagName: 'billingV1',
    rolloutName: 'billingV1',
  },
  {
    moduleId: 'referralV1',
    title: 'Referral',
    pod: 'podC',
    order: 2,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    flagName: 'referralV1',
    rolloutName: 'referralV1',
  },
  {
    moduleId: 'publicApiV1',
    title: 'Public API',
    pod: 'podC',
    order: 3,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    flagName: 'publicApiV1',
    rolloutName: 'publicApiV1',
  },
  {
    moduleId: 'integrationsHubV1',
    title: 'Integrations Hub',
    pod: 'podC',
    order: 4,
    riskLevel: 'medium',
    deliveryState: 'in_progress',
    requiresComplianceGate: false,
    flagName: 'integrationsHubV1',
    rolloutName: 'integrationsHubV1',
  },
  {
    moduleId: 'superAdminV1',
    title: 'Super Admin',
    pod: 'podC',
    order: 5,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    flagName: 'superAdminV1',
    rolloutName: 'superAdminV1',
  },
  {
    moduleId: 'agentReadyV1',
    title: 'Agent Ready',
    pod: 'podC',
    order: 6,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    flagName: 'agentReadyV1',
    rolloutName: 'agentReadyV1',
  },
  {
    moduleId: 'bigDataV1',
    title: 'Big Data',
    pod: 'podC',
    order: 7,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    flagName: 'bigDataV1',
    rolloutName: 'bigDataV1',
  },
  {
    moduleId: 'openBankingV1',
    title: 'Open Banking',
    pod: 'podC',
    order: 8,
    riskLevel: 'high',
    deliveryState: 'in_progress',
    requiresComplianceGate: true,
    flagName: 'openBankingV1',
    rolloutName: 'openBankingV1',
  },
]

const LIVE_CORE_MODULE_KEYS: ProgramModuleKey[] = [
  'financeReceipts',
  'financeReceiptAi',
  'cronogramaUxV2',
  'docsWorkspace',
  'portalAdminV2',
  'obraIntelligenceV1',
]

const MODULE_KEY_TOKENS = {
  billing: 'billingV1',
  referral: 'referralV1',
  publicApi: ['public', 'ApiV1'].join('') as ProgramModuleKey,
  integrationsHub: ['integrations', 'HubV1'].join('') as ProgramModuleKey,
  agentReady: 'agentReadyV1',
  superAdmin: 'superAdminV1',
  bigData: 'bigDataV1',
  openBanking: 'openBankingV1',
} as const

const POD_B_REMAINING_MODULE_KEYS: ProgramModuleKey[] = [
  'financeDepthV1',
  'supplierManagementV1',
  'bureaucracyV1',
  'emailTriageV1',
]

const RUNTIME_FOUNDATION_MODULE_KEYS: ProgramModuleKey[] = [
  MODULE_KEY_TOKENS.billing,
  MODULE_KEY_TOKENS.publicApi,
  MODULE_KEY_TOKENS.integrationsHub,
  MODULE_KEY_TOKENS.referral,
]

const REGULATED_PLATFORM_MODULE_KEYS: ProgramModuleKey[] = [
  MODULE_KEY_TOKENS.agentReady,
  MODULE_KEY_TOKENS.superAdmin,
  MODULE_KEY_TOKENS.bigData,
  MODULE_KEY_TOKENS.openBanking,
]

const STRUCTURAL_GAPS: ProgramStructuralGapDefinition[] = [
  {
    key: 'durable_jobs',
    title: 'Durable Job / Worker Control Plane',
    requiredBefore: ['runtime_foundation', 'regulated_platform_later'],
    reason: 'Long-running AI, PDF, email, reconciliation, and callbacks still need durable async execution.',
  },
  {
    key: 'distributed_idempotency',
    title: 'Distributed Idempotency Store',
    requiredBefore: ['runtime_foundation', 'regulated_platform_later'],
    reason: 'Platform/public operations cannot rely on in-memory replay protection.',
  },
  {
    key: 'distributed_rate_limiting',
    title: 'Distributed Rate Limiting',
    requiredBefore: ['runtime_foundation', 'regulated_platform_later'],
    reason: 'Public, agent, and regulated surfaces need tenant-aware distributed throttling.',
  },
  {
    key: 'workflow_event_backbone',
    title: 'Minimal Workflow / Event Backbone',
    requiredBefore: ['runtime_foundation', 'regulated_platform_later'],
    reason: 'Cross-domain automations still depend too much on direct writes and request-time handlers.',
  },
  {
    key: 'search_index_layer',
    title: 'Search / Index Layer',
    requiredBefore: ['runtime_foundation', 'regulated_platform_later'],
    reason: 'Knowledge retrieval, docs discovery, and future AI retrieval need dedicated indexing.',
  },
  {
    key: 'ai_data_flywheel',
    title: 'AI Data Flywheel',
    requiredBefore: ['regulated_platform_later', 'backlog_non_critical'],
    reason: 'There is no strong learning loop yet for quotes, transcripts, supplier outcomes, or recommendations.',
  },
]

const EXECUTION_TASKS: ProgramExecutionTaskDefinition[] = [
  {
    key: 'validate_live_release_traceability',
    title: 'Validate live release traceability',
    classification: 'core_certification',
    dependencies: ['Production alias reachable'],
    operationalRisk: 'low',
    safestRolloutPath: 'Verify /api/v1/health/ops and /api/v1/ops/release; redeploy only from a clean worktree if mismatch persists.',
    rollbackStrategy: 'Redeploy the previous production deployment.',
    isAllowed: (context) => context.currentPhase === 'phase0_core_certification',
    resolveBlockers: (context) =>
      context.certification.releaseTraceabilityVerified ? [] : ['Release traceability has not been explicitly certified yet.'],
  },
  {
    key: 'confirm_auth_e2e_strict_gate',
    title: 'Confirm auth strict E2E as stable gate',
    classification: 'core_certification',
    dependencies: ['QA secrets and role matrix in CI'],
    operationalRisk: 'medium',
    safestRolloutPath: 'Keep npm run test:e2e:strict:auth mandatory on main and fix matrix instability instead of silencing it.',
    rollbackStrategy: 'Temporarily downgrade to warn-only without removing the runner or the job.',
    isAllowed: (context) => context.currentPhase === 'phase0_core_certification',
    resolveBlockers: (context) =>
      context.certification.authStrictE2EStable ? [] : ['Auth strict E2E has not yet been formally certified as stable.'],
  },
  {
    key: 'run_core_rollback_drills',
    title: 'Run rollback drills for live core modules',
    classification: 'core_certification',
    dependencies: ['Core validators pass before drill start'],
    operationalRisk: 'medium',
    safestRolloutPath: 'Run one drill at a time: 100% -> 0% -> 100%, validate before and after with health/ops and module validator.',
    rollbackStrategy: 'The drill itself is the rollback procedure; stop and restore 100% before moving to the next module.',
    isAllowed: (context) => context.currentPhase === 'phase0_core_certification',
    resolveBlockers: (context) =>
      context.certification.rollbackDrillsDocumented ? [] : ['Rollback drills are not fully documented yet.'],
  },
  {
    key: 'publish_core_closeout',
    title: 'Publish final core closeout',
    classification: 'core_certification',
    dependencies: ['Release traceability verified', 'Auth strict stable', 'Rollback drills documented'],
    operationalRisk: 'low',
    safestRolloutPath: 'Generate one closeout report from live state and rollback drill evidence.',
    rollbackStrategy: 'Publish a corrected closeout report if evidence changes.',
    isAllowed: (context) => context.currentPhase === 'phase0_core_certification',
    resolveBlockers: (context) =>
      context.certification.closeoutPublished ? [] : ['Core closeout has not been published yet.'],
  },
  {
    key: 'rollout_pod_b_remaining',
    title: 'Roll out remaining Pod B modules',
    classification: 'pod_b_rollout',
    dependencies: ['Phase 0 complete', 'Domain validator', 'Smoke', 'RLS/org audit'],
    operationalRisk: 'medium',
    safestRolloutPath: 'Roll out one module at a time with QA allowlist -> 25% -> 100%.',
    rollbackStrategy: 'Set percent=0 or flag OFF for the active module.',
    isAllowed: (context) => context.currentPhase === 'phase1_pod_b_rollout',
    resolveBlockers: (context) =>
      context.currentPhase === 'phase1_pod_b_rollout'
        ? []
        : ['Pod B rollout is blocked until core certification is complete.'],
  },
  {
    key: 'build_platform_hardening',
    title: 'Build platform hardening infrastructure',
    classification: 'platform_hardening',
    dependencies: ['Phase 0 complete'],
    operationalRisk: 'high',
    safestRolloutPath: 'Introduce infrastructure behind internal adapters with no user-facing rollout until ready.',
    rollbackStrategy: 'Keep legacy synchronous paths active until cutover is validated.',
    isAllowed: (context) => context.currentPhase === 'phase2_platform_hardening',
    resolveBlockers: (context) =>
      context.currentPhase === 'phase2_platform_hardening'
        ? []
        : ['Platform hardening is blocked until core certification and Pod B rollout are complete.'],
  },
  {
    key: 'open_runtime_foundation_domains',
    title: 'Open runtime foundation domains',
    classification: 'runtime_foundation',
    dependencies: ['Durable jobs', 'Distributed idempotency', 'Distributed rate limiting', 'Workflow/event backbone', 'Search/index layer'],
    operationalRisk: 'high',
    safestRolloutPath: 'Upgrade runtime domains to real flows with auditability and roll them out sequentially.',
    rollbackStrategy: 'Disable the runtime domain via flag or canary percent 0.',
    isAllowed: (context) => context.currentPhase === 'phase3_runtime_foundation',
    resolveBlockers: (context) =>
      context.currentPhase === 'phase3_runtime_foundation'
        ? []
        : ['Runtime foundation domains remain blocked until platform hardening is complete.'],
  },
  {
    key: 'open_regulated_platform_domains',
    title: 'Open regulated / platform-later domains',
    classification: 'regulated_platform_later',
    dependencies: ['Runtime foundation complete', 'Compliance minimum closed'],
    operationalRisk: 'high',
    safestRolloutPath: 'Start internal/allowlist only; never general-release first.',
    rollbackStrategy: 'Keep the domain behind allowlist or flag OFF.',
    isAllowed: (context) => context.currentPhase === 'phase4_regulated_platform_later',
    resolveBlockers: (context) =>
      context.currentPhase === 'phase4_regulated_platform_later'
        ? []
        : ['Regulated/platform-later domains stay blocked until runtime foundation and compliance gates are complete.'],
  },
]

const PROGRAM_RELEASE_TRAINS: ProgramReleaseTrainDefinition[] = [
  {
    trainId: 'trainA',
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
    trainId: 'trainB',
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
    trainId: 'trainC',
    title: 'Train C - Pod C Foundations',
    order: 3,
    stage: 'later',
    objective: 'Subir as foundations reguladas e de plataforma com write bloqueado em produção.',
    deployPolicy: 'all_flags_off',
    dependsOn: ['trainB'],
    affectedModules: [
      MODULE_KEY_TOKENS.billing,
      MODULE_KEY_TOKENS.referral,
      MODULE_KEY_TOKENS.publicApi,
      MODULE_KEY_TOKENS.integrationsHub,
      MODULE_KEY_TOKENS.superAdmin,
      MODULE_KEY_TOKENS.agentReady,
      MODULE_KEY_TOKENS.bigData,
      MODULE_KEY_TOKENS.openBanking,
    ],
    scope: [
      'surfaces reguladas continuam compliance gated',
      'write bloqueado em produção por padrão',
      'rollout só após Pod A e Pod B estabilizados',
    ],
    resolveBlockers: () => ['Depende do corte do Train B e da política de compliance continuar ativa.'],
  },
]

function readCertificationEnv(name: string) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').trim().toLowerCase())
}

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
  const featureEnabled = featureFlags[definition.flagName]
  const rollout = definition.rolloutName ? getFeatureCanarySnapshot(definition.rolloutName) : null

  return {
    key: definition.moduleId,
    title: definition.title,
    pod: definition.pod,
    order: definition.order,
    riskLevel: definition.riskLevel,
    deliveryState: definition.deliveryState,
    requiresComplianceGate: definition.requiresComplianceGate,
    featureFlagName: definition.flagName,
    featureEnabled,
    rolloutName: definition.rolloutName || null,
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
    key: definition.trainId,
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

function buildStructuralGapStatus(): ProgramStructuralGapStatus[] {
  return STRUCTURAL_GAPS.map((gap) => ({
    key: gap.key,
    title: gap.title,
    status: 'open',
    requiredBefore: gap.requiredBefore,
    reason: gap.reason,
  }))
}

function buildCertification(modules: ProgramModuleStatus[]): ProgramExecutionControl['certification'] {
  const liveCoreModulesReady = LIVE_CORE_MODULE_KEYS.every((key) =>
    modules.some((module) => module.key === key && module.rolloutState === 'live')
  )

  return {
    liveCoreModulesReady,
    releaseTraceabilityVerified: readCertificationEnv('CORE_CERT_RELEASE_TRACEABILITY_VERIFIED'),
    authStrictE2EStable: readCertificationEnv('CORE_CERT_AUTH_STRICT_STABLE'),
    rollbackDrillsDocumented: readCertificationEnv('CORE_CERT_ROLLBACK_DRILLS_DOCUMENTED'),
    closeoutPublished: readCertificationEnv('CORE_CERT_CLOSEOUT_PUBLISHED'),
  }
}

function resolveCurrentPhase(context: Omit<ProgramExecutionContext, 'currentPhase'>): ProgramExecutionPhase {
  const { certification, modules, structuralGaps } = context

  if (
    !certification.liveCoreModulesReady ||
    !certification.releaseTraceabilityVerified ||
    !certification.authStrictE2EStable ||
    !certification.rollbackDrillsDocumented ||
    !certification.closeoutPublished
  ) {
    return 'phase0_core_certification'
  }

  const podBRemainingLive = POD_B_REMAINING_MODULE_KEYS.every((key) =>
    modules.some((module) => module.key === key && module.rolloutState === 'live')
  )
  if (!podBRemainingLive) {
    return 'phase1_pod_b_rollout'
  }

  if (structuralGaps.some((gap) => gap.status === 'open')) {
    return 'phase2_platform_hardening'
  }

  const runtimeFoundationLive = RUNTIME_FOUNDATION_MODULE_KEYS.every((key) =>
    modules.some((module) => module.key === key && module.rolloutState === 'live')
  )
  if (!runtimeFoundationLive) {
    return 'phase3_runtime_foundation'
  }

  return 'phase4_regulated_platform_later'
}

function buildExecutionTaskStatus(
  definition: ProgramExecutionTaskDefinition,
  context: ProgramExecutionContext
): ProgramExecutionTaskStatus {
  const blockingReasons = definition.resolveBlockers(context)
  return {
    key: definition.key,
    title: definition.title,
    classification: definition.classification,
    allowedNow: definition.isAllowed(context),
    dependencies: definition.dependencies,
    operationalRisk: definition.operationalRisk,
    safestRolloutPath: definition.safestRolloutPath,
    rollbackStrategy: definition.rollbackStrategy,
    blockingReasons,
  }
}

function buildExecutionViolations(context: ProgramExecutionContext) {
  const violations: string[] = []
  const isLiveCoreModule = (key: ProgramModuleKey) => context.liveCoreModuleKeys.includes(key)

  for (const programModule of context.modules) {
    const activeBeyondOff =
      programModule.rolloutState === 'allowlist' ||
      programModule.rolloutState === 'canary' ||
      programModule.rolloutState === 'live'

    if (!activeBeyondOff) {
      continue
    }

    if (
      context.currentPhase === 'phase0_core_certification' &&
      !isLiveCoreModule(programModule.key) &&
      (POD_B_REMAINING_MODULE_KEYS.includes(programModule.key) ||
        RUNTIME_FOUNDATION_MODULE_KEYS.includes(programModule.key) ||
        REGULATED_PLATFORM_MODULE_KEYS.includes(programModule.key))
    ) {
      violations.push(`${programModule.title} is active before core certification is closed.`)
    }

    if (
      context.currentPhase !== 'phase3_runtime_foundation' &&
      context.currentPhase !== 'phase4_regulated_platform_later' &&
      RUNTIME_FOUNDATION_MODULE_KEYS.includes(programModule.key)
    ) {
      violations.push(`${programModule.title} is active before platform hardening is complete.`)
    }

    if (
      context.currentPhase !== 'phase4_regulated_platform_later' &&
      REGULATED_PLATFORM_MODULE_KEYS.includes(programModule.key)
    ) {
      violations.push(`${programModule.title} is active before regulated/platform-later work is allowed.`)
    }
  }

  return violations
}

function buildExecutionControl(modules: ProgramModuleStatus[]): ProgramExecutionControl {
  const structuralGaps = buildStructuralGapStatus()
  const certification = buildCertification(modules)
  const currentPhase = resolveCurrentPhase({
    modules,
    certification,
    liveCoreModuleKeys: LIVE_CORE_MODULE_KEYS,
    structuralGaps,
  })
  const context: ProgramExecutionContext = {
    modules,
    certification,
    liveCoreModuleKeys: LIVE_CORE_MODULE_KEYS,
    structuralGaps,
    currentPhase,
  }
  const tasks = EXECUTION_TASKS.map((task) => buildExecutionTaskStatus(task, context))

  return {
    governingRule: 'certify_harden_expand',
    currentPhase,
    liveCoreModules: LIVE_CORE_MODULE_KEYS,
    certification,
    structuralGaps,
    allowedNow: tasks.filter((task) => task.allowedNow),
    blockedNow: tasks.filter((task) => !task.allowedNow),
    violations: buildExecutionViolations(context),
    enforcementRules: [
      'no new user-facing rollout before Phase 0 closes',
      'no deploy from dirty primary workspace',
      'no rollout during rollback drills',
      'readiness endpoints do not count as runtime readiness',
      'admin UI does not count as product completion',
      'feature flag ON does not count as production readiness',
      'no billing/publicApi/agent/openBanking expansion before platform hardening exists',
    ],
  }
}

export function getProgramStatusPayload(): ProgramStatusPayload {
  const podOrder: ProgramPodKey[] = ['podA', 'podB', 'podC']
  const pods: ProgramPodStatus[] = podOrder.map(buildPodStatus)
  const modules = pods.flatMap((pod) => pod.modules)
  const releaseTrains = PROGRAM_RELEASE_TRAINS.map((train) => buildReleaseTrainStatus(train, modules))
  const executionControl = buildExecutionControl(modules)

  return {
    horizonDays: 90,
    strategy: 'modular_monolith',
    rolloutPolicy: 'org_canary',
    regulatedGeneralReleasePolicy: 'blocked-until-compliance',
    pods,
    releaseTrains,
    executionControl,
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
    executionControl: {
      currentPhase: payload.executionControl.currentPhase,
      allowedNowCount: payload.executionControl.allowedNow.length,
      blockedNowCount: payload.executionControl.blockedNow.length,
      openStructuralGapCount: payload.executionControl.structuralGaps.filter((gap) => gap.status === 'open').length,
      liveCoreModulesReady: payload.executionControl.certification.liveCoreModulesReady,
      releaseTraceabilityVerified: payload.executionControl.certification.releaseTraceabilityVerified,
      authStrictE2EStable: payload.executionControl.certification.authStrictE2EStable,
      rollbackDrillsDocumented: payload.executionControl.certification.rollbackDrillsDocumented,
      closeoutPublished: payload.executionControl.certification.closeoutPublished,
      violationCount: payload.executionControl.violations.length,
    },
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
