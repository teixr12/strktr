#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.STRKTR_BASE_URL || 'https://strktr.vercel.app').replace(/\/$/, '')
const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''
const EXPECT_ENABLED = (process.env.OBRA_INTELLIGENCE_V1_EXPECT_ENABLED || 'auto').trim().toLowerCase()

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `obra-intelligence-v1-rollout-validate-${stamp}.md`)

function writeReport(lines) {
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')
}

function asJsonBlock(value) {
  return ['```json', JSON.stringify(value, null, 2), '```']
}

async function api(path, init = {}) {
  const headers = new Headers(init.headers || {})
  if (E2E_BEARER_TOKEN) headers.set('Authorization', `Bearer ${E2E_BEARER_TOKEN}`)
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }
  return { response, json }
}

function validatePayload(payload) {
  return Boolean(
    payload?.data?.obra &&
      payload?.data?.risk &&
      typeof payload.data.risk.score === 'number' &&
      typeof payload.data.risk.level === 'string' &&
      payload?.data?.kpis &&
      typeof payload.data.kpis.etapasTotal === 'number' &&
      typeof payload.data.kpis.receitas === 'number' &&
      typeof payload.data.kpis.despesas === 'number' &&
      typeof payload.data.kpis.saldo === 'number' &&
      Array.isArray(payload.data.alerts) &&
      payload?.data?.totals &&
      typeof payload.data.totals.total === 'number' &&
      payload?.data?.readiness &&
      typeof payload.data.readiness.obraLocationConfigured === 'boolean' &&
      typeof payload.data.readiness.orgHqConfigured === 'boolean' &&
      typeof payload.data.readiness.weatherAvailable === 'boolean' &&
      typeof payload.data.readiness.logisticsReady === 'boolean' &&
      payload?.data?.context?.finance &&
      typeof payload.data.context.finance.receitas === 'number' &&
      typeof payload.data.context.finance.despesas === 'number' &&
      typeof payload.data.context.finance.saldo === 'number' &&
      Array.isArray(payload.data.timeline) &&
      typeof payload.data.generatedAt === 'string'
  )
}

async function main() {
  const lines = [
    '# Obra Intelligence V1 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
  ]

  if (!E2E_BEARER_TOKEN || !E2E_OBRA_ID) {
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN and/or E2E_OBRA_ID')
    writeReport(lines)
    console.log(`Obra Intelligence V1 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  const healthFlags = health.json?.data?.flags || {}
  const healthRollout = health.json?.data?.rollout || {}
  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagObraIntelligenceV1: ${String(Boolean(healthFlags.obraIntelligenceV1))}`)
  lines.push(
    `- HealthObraIntelligenceV1CanaryPercent: ${String(healthRollout.obraIntelligenceV1Canary?.percent ?? 'n/a')}`
  )
  lines.push(
    `- HealthObraIntelligenceV1AllowlistCount: ${String(
      healthRollout.obraIntelligenceV1Canary?.allowlistCount ?? 'n/a'
    )}`
  )
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  if (EXPECT_ENABLED === 'true' && !healthFlags.obraIntelligenceV1) {
    lines.push('- Status: fail')
    lines.push('- Reason: obraIntelligenceV1 flag expected enabled but health flag is false')
    writeReport(lines)
    console.error(`Obra Intelligence V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const intelligence = await api(`/api/v1/obras/${E2E_OBRA_ID}/intelligence`)
  lines.push(`- IntelligenceStatus: ${intelligence.response.status}`)

  if (intelligence.response.status === 404) {
    const hiddenButRequired = EXPECT_ENABLED === 'true'
    lines.push(`- Status: ${hiddenButRequired ? 'fail' : 'skip'}`)
    lines.push(
      `- Reason: ${
        hiddenButRequired
          ? 'obraIntelligenceV1 hidden for validation org'
          : 'obraIntelligenceV1 hidden for org/token used'
      }`
    )
    lines.push('')
    lines.push('## Intelligence Payload')
    lines.push(...asJsonBlock(intelligence.json))
    writeReport(lines)
    if (hiddenButRequired) process.exit(1)
    console.log(`Obra Intelligence V1 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (intelligence.response.status !== 200 || !validatePayload(intelligence.json)) {
    lines.push('- Status: fail')
    lines.push('- Reason: obra intelligence failed contract validation')
    lines.push('')
    lines.push('## Intelligence Payload')
    lines.push(...asJsonBlock(intelligence.json))
    writeReport(lines)
    console.error(`Obra Intelligence V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  lines.push(`- AlertCount: ${String(intelligence.json?.data?.totals?.total ?? 'n/a')}`)
  lines.push(`- RiskLevel: ${String(intelligence.json?.data?.risk?.level ?? 'n/a')}`)
  lines.push(`- LogisticsReady: ${String(intelligence.json?.data?.readiness?.logisticsReady ?? 'n/a')}`)
  lines.push(`- TimelineCount: ${String(intelligence.json?.data?.timeline?.length ?? 'n/a')}`)
  lines.push('- Status: pass')
  lines.push('')
  lines.push('## Intelligence Payload')
  lines.push(...asJsonBlock(intelligence.json))

  writeReport(lines)
  console.log(`Obra Intelligence V1 rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Obra Intelligence V1 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
