import { ok } from '@/lib/api/response'
import { withSuperAdminAuth } from '@/lib/super-admin/api'
import { getProgramStatusPayload } from '@/server/program/program-status'
import type {
  SuperAdminRolloutGovernanceModule,
  SuperAdminRolloutGovernancePayload,
  SuperAdminRolloutGovernanceSummary,
} from '@/shared/types/super-admin'

function priorityWeight(module: SuperAdminRolloutGovernanceModule) {
  const rolloutWeight =
    module.rolloutState === 'blocked'
      ? 5
      : module.rolloutState === 'off'
        ? 4
        : module.rolloutState === 'allowlist'
          ? 3
          : module.rolloutState === 'canary'
            ? 2
            : 1
  const riskWeight = module.riskLevel === 'high' ? 2 : module.riskLevel === 'medium' ? 1 : 0
  const complianceWeight = module.requiresComplianceGate && module.rolloutState !== 'live' ? 2 : 0
  return rolloutWeight * 10 + riskWeight + complianceWeight
}

export const GET = withSuperAdminAuth('can_manage_team', async (request) => {
  const program = getProgramStatusPayload()

  const modules: SuperAdminRolloutGovernanceModule[] = program.pods
    .flatMap((pod) =>
      pod.modules.map((module) => ({
        key: module.key,
        title: module.title,
        podKey: pod.key,
        podTitle: pod.title,
        riskLevel: module.riskLevel,
        deliveryState: module.deliveryState,
        rolloutState: module.rolloutState,
        requiresComplianceGate: module.requiresComplianceGate,
        featureEnabled: module.featureEnabled,
        rolloutConfigured: Boolean(module.rollout?.configured),
        rolloutPercent: module.rollout?.percent || 0,
        allowlistCount: module.rollout?.allowlistCount || 0,
      }))
    )
    .sort((a, b) => priorityWeight(b) - priorityWeight(a))

  const summary: SuperAdminRolloutGovernanceSummary = {
    totalModules: modules.length,
    liveModules: modules.filter((module) => module.rolloutState === 'live').length,
    canaryModules: modules.filter((module) => module.rolloutState === 'canary').length,
    allowlistModules: modules.filter((module) => module.rolloutState === 'allowlist').length,
    blockedModules: modules.filter((module) => module.rolloutState === 'blocked').length,
    offModules: modules.filter((module) => module.rolloutState === 'off').length,
    complianceGatedModules: modules.filter((module) => module.requiresComplianceGate).length,
    complianceGatedNotLive: modules.filter(
      (module) => module.requiresComplianceGate && module.rolloutState !== 'live'
    ).length,
  }

  return ok(request, { summary, modules } satisfies SuperAdminRolloutGovernancePayload)
})
