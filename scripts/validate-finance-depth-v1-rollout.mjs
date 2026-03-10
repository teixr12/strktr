#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.STRKTR_BASE_URL || 'https://strktr.vercel.app').replace(/\/$/, '')
const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const EXPECT_ENABLED = (process.env.FINANCE_DEPTH_V1_EXPECT_ENABLED || 'auto').trim().toLowerCase()
const MONTHS = Math.max(3, Math.min(Number.parseInt(process.env.FINANCE_DEPTH_V1_MONTHS || '6', 10) || 6, 12))

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `finance-depth-v1-rollout-validate-${stamp}.md`)

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

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function validatePayload(payload) {
  const data = payload?.data
  return Boolean(
    data &&
      data.summary &&
      isNumber(data.summary.receitas) &&
      isNumber(data.summary.despesas) &&
      isNumber(data.summary.saldo) &&
      isNumber(data.summary.averageMonthlyNet) &&
      isNumber(data.summary.negativeMonths) &&
      isNumber(data.summary.monthsAnalyzed) &&
      Array.isArray(data.monthly) &&
      data.monthly.every(
        (item) =>
          typeof item?.month === 'string' &&
          typeof item?.label === 'string' &&
          isNumber(item.receitas) &&
          isNumber(item.despesas) &&
          isNumber(item.saldo)
      ) &&
      Array.isArray(data.topExpenseCategories) &&
      data.topExpenseCategories.every(
        (item) => typeof item?.categoria === 'string' && isNumber(item.total) && isNumber(item.count)
      ) &&
      Array.isArray(data.alerts) &&
      data.alerts.every(
        (item) =>
          typeof item?.code === 'string' &&
          typeof item?.title === 'string' &&
          ['low', 'medium', 'high'].includes(item?.severity) &&
          (item?.message == null || typeof item.message === 'string')
      ) &&
      typeof data.generatedAt === 'string'
  )
}

async function main() {
  const lines = [
    '# Finance Depth V1 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
    `- Months: ${MONTHS}`,
  ]

  if (!E2E_BEARER_TOKEN) {
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN')
    writeReport(lines)
    console.log(`Finance Depth V1 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  const healthFlags = health.json?.data?.flags || {}
  const healthRollout = health.json?.data?.rollout || {}
  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagFinanceDepthV1: ${String(Boolean(healthFlags.financeDepthV1))}`)
  lines.push(
    `- HealthFinanceDepthV1CanaryPercent: ${String(healthRollout.financeDepthV1Canary?.percent ?? 'n/a')}`
  )
  lines.push(
    `- HealthFinanceDepthV1AllowlistCount: ${String(healthRollout.financeDepthV1Canary?.allowlistCount ?? 'n/a')}`
  )
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  if (EXPECT_ENABLED === 'true' && !healthFlags.financeDepthV1) {
    lines.push('- Status: fail')
    lines.push('- Reason: financeDepthV1 expected enabled but health flag is false')
    writeReport(lines)
    console.error(`Finance Depth V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const dre = await api(`/api/v1/financeiro/dre?months=${MONTHS}`)
  lines.push(`- DREStatus: ${dre.response.status}`)

  if (dre.response.status === 404) {
    const hiddenButRequired = EXPECT_ENABLED === 'true'
    lines.push(`- Status: ${hiddenButRequired ? 'fail' : 'skip'}`)
    lines.push(
      `- Reason: ${
        hiddenButRequired ? 'financeDepthV1 hidden for validation org' : 'financeDepthV1 hidden for org/token used'
      }`
    )
    lines.push('')
    lines.push('## DRE Payload')
    lines.push(...asJsonBlock(dre.json))
    writeReport(lines)
    if (hiddenButRequired) process.exit(1)
    console.log(`Finance Depth V1 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (dre.response.status !== 200 || !validatePayload(dre.json)) {
    lines.push('- Status: fail')
    lines.push('- Reason: finance depth failed contract validation')
    lines.push('')
    lines.push('## DRE Payload')
    lines.push(...asJsonBlock(dre.json))
    writeReport(lines)
    console.error(`Finance Depth V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  lines.push(`- SummaryReceitas: ${String(dre.json?.data?.summary?.receitas ?? 'n/a')}`)
  lines.push(`- SummaryDespesas: ${String(dre.json?.data?.summary?.despesas ?? 'n/a')}`)
  lines.push(`- SummarySaldo: ${String(dre.json?.data?.summary?.saldo ?? 'n/a')}`)
  lines.push(`- MonthlyPoints: ${String(dre.json?.data?.monthly?.length ?? 'n/a')}`)
  lines.push(`- TopExpenseCategories: ${String(dre.json?.data?.topExpenseCategories?.length ?? 'n/a')}`)
  lines.push(`- AlertCount: ${String(dre.json?.data?.alerts?.length ?? 'n/a')}`)
  lines.push('- Status: pass')
  lines.push('')
  lines.push('## DRE Payload')
  lines.push(...asJsonBlock(dre.json))

  writeReport(lines)
  console.log(`Finance Depth V1 rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Finance Depth V1 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
