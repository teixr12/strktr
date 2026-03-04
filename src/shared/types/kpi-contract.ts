export type KpiMetricSource = 'api' | 'derived'

export type KpiCardDefinition = {
  key: string
  label: string
  description: string
  drilldownHref: string
  source: KpiMetricSource
}
