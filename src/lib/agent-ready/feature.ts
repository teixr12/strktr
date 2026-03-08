import { featureFlags } from '@/lib/feature-flags'

export function isAgentReadyEnabled() {
  return featureFlags.agentReadyV1
}
