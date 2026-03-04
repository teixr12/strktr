import type { KpiCardDefinition } from '@/shared/types/kpi-contract'

export function validateKpiCardDefinition(definition: KpiCardDefinition): string[] {
  const violations: string[] = []

  if (!definition.key?.trim()) violations.push('key obrigatório')
  if (!definition.label?.trim()) violations.push('label obrigatório')
  if (!definition.description?.trim()) violations.push('description obrigatório')
  if (!definition.drilldownHref?.trim()) violations.push('drilldownHref obrigatório')

  if (definition.drilldownHref && !definition.drilldownHref.startsWith('/')) {
    violations.push('drilldownHref deve começar com "/"')
  }

  return violations
}

export function assertKpiCardDefinition(definition: KpiCardDefinition) {
  const violations = validateKpiCardDefinition(definition)
  if (violations.length > 0) {
    throw new Error(`KPI contract inválido: ${violations.join(', ')}`)
  }
}
