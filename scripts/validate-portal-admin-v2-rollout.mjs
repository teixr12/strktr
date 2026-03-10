#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.STRKTR_BASE_URL || 'https://strktr.vercel.app').replace(/\/$/, '')
const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''
const E2E_PROJECT_ID = process.env.E2E_PROJECT_ID || ''
const EXPECT_ENABLED = (process.env.PORTAL_ADMIN_V2_EXPECT_ENABLED || 'auto').trim().toLowerCase()

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `portal-admin-v2-rollout-validate-${stamp}.md`)

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

function isExpectedEnabled() {
  return EXPECT_ENABLED === 'true'
}

function validateOverviewPayload(payload) {
  return Boolean(
    Array.isArray(payload?.data) &&
      payload?.meta &&
      typeof payload.meta.page === 'number' &&
      typeof payload.meta.pageSize === 'number' &&
      typeof payload.meta.total === 'number' &&
      typeof payload.meta.hasMore === 'boolean' &&
      typeof payload.meta.count === 'number' &&
      payload.meta.summary &&
      typeof payload.meta.summary.totalObras === 'number'
  )
}

function validateObraActivityPayload(payload) {
  return Boolean(
    payload?.data?.summary &&
      typeof payload.data.summary.totalClients === 'number' &&
      Array.isArray(payload.data.clients) &&
      Array.isArray(payload.data.recentSessions)
  )
}

function validateClientActivityPayload(payload) {
  return Boolean(
    payload?.data?.client &&
      payload?.data?.summary &&
      typeof payload.data.summary.totalSessions === 'number' &&
      Array.isArray(payload.data.recentSessions) &&
      Array.isArray(payload.data.recentComments) &&
      Array.isArray(payload.data.recentDecisions) &&
      Array.isArray(payload.data.recentPendingApprovals)
  )
}

function validateProjectPayload(payload) {
  return Boolean(
    payload?.data?.projeto &&
      Object.prototype.hasOwnProperty.call(payload.data, 'linkedObra') &&
      Object.prototype.hasOwnProperty.call(payload.data, 'overview') &&
      Object.prototype.hasOwnProperty.call(payload.data, 'activity')
  )
}

async function main() {
  const lines = [
    '# Portal Admin V2 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
  ]

  if (!E2E_BEARER_TOKEN || !E2E_OBRA_ID) {
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN and/or E2E_OBRA_ID')
    writeReport(lines)
    console.log(`Portal Admin V2 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  const healthFlags = health.json?.data?.flags || {}
  const healthRollout = health.json?.data?.rollout || {}
  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagPortalAdminV2: ${String(Boolean(healthFlags.portalAdminV2))}`)
  lines.push(`- HealthPortalAdminV2CanaryPercent: ${String(healthRollout.portalAdminV2Canary?.percent ?? 'n/a')}`)
  lines.push(
    `- HealthPortalAdminV2AllowlistCount: ${String(healthRollout.portalAdminV2Canary?.allowlistCount ?? 'n/a')}`
  )
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  const overview = await api('/api/v1/portal/admin/overview?page=1&pageSize=5')
  lines.push(`- OverviewStatus: ${overview.response.status}`)

  if (overview.response.status === 404) {
    const hiddenButRequired = isExpectedEnabled()
    lines.push(`- Status: ${hiddenButRequired ? 'fail' : 'skip'}`)
    lines.push(
      `- Reason: ${
        hiddenButRequired ? 'portalAdminV2 hidden for validation org' : 'portalAdminV2 hidden for org/token used'
      }`
    )
    lines.push('')
    lines.push('## Overview Payload')
    lines.push(...asJsonBlock(overview.json))
    writeReport(lines)
    if (hiddenButRequired) process.exit(1)
    console.log(`Portal Admin V2 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (overview.response.status !== 200 || !validateOverviewPayload(overview.json)) {
    lines.push('- Status: fail')
    lines.push('- Reason: portal admin overview failed contract validation')
    lines.push('')
    lines.push('## Overview Payload')
    lines.push(...asJsonBlock(overview.json))
    writeReport(lines)
    console.error(`Portal Admin V2 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const obraActivity = await api(`/api/v1/portal/admin/obras/${E2E_OBRA_ID}/activity`)
  lines.push(`- ObraActivityStatus: ${obraActivity.response.status}`)
  if (obraActivity.response.status !== 200 || !validateObraActivityPayload(obraActivity.json)) {
    lines.push('- Status: fail')
    lines.push('- Reason: obra activity failed contract validation')
    lines.push('')
    lines.push('## Obra Activity Payload')
    lines.push(...asJsonBlock(obraActivity.json))
    writeReport(lines)
    console.error(`Portal Admin V2 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const firstClient = obraActivity.json?.data?.clients?.[0] || null
  let clientActivity = null
  if (firstClient?.id) {
    clientActivity = await api(`/api/v1/portal/admin/obras/${E2E_OBRA_ID}/clients/${firstClient.id}/activity`)
    lines.push(`- ClientActivityStatus: ${clientActivity.response.status}`)
    if (clientActivity.response.status !== 200 || !validateClientActivityPayload(clientActivity.json)) {
      lines.push('- Status: fail')
      lines.push('- Reason: client activity failed contract validation')
      lines.push('')
      lines.push('## Client Activity Payload')
      lines.push(...asJsonBlock(clientActivity.json))
      writeReport(lines)
      console.error(`Portal Admin V2 rollout validation failed: ${reportPath}`)
      process.exit(1)
    }
  } else {
    lines.push('- ClientActivityStatus: skip')
    lines.push('- ClientActivityReason: no portal client available for this obra')
  }

  let projectOverview = null
  if (E2E_PROJECT_ID) {
    projectOverview = await api(`/api/v1/portal/admin/projects/${E2E_PROJECT_ID}/overview`)
    lines.push(`- ProjectOverviewStatus: ${projectOverview.response.status}`)
    if (projectOverview.response.status !== 200 || !validateProjectPayload(projectOverview.json)) {
      lines.push('- Status: fail')
      lines.push('- Reason: project overview failed contract validation')
      lines.push('')
      lines.push('## Project Overview Payload')
      lines.push(...asJsonBlock(projectOverview.json))
      writeReport(lines)
      console.error(`Portal Admin V2 rollout validation failed: ${reportPath}`)
      process.exit(1)
    }
  } else {
    lines.push('- ProjectOverviewStatus: skip')
    lines.push('- ProjectOverviewReason: missing E2E_PROJECT_ID')
  }

  lines.push('- Status: pass')
  lines.push('')
  lines.push('## Overview Payload')
  lines.push(...asJsonBlock(overview.json))
  lines.push('')
  lines.push('## Obra Activity Payload')
  lines.push(...asJsonBlock(obraActivity.json))
  if (clientActivity) {
    lines.push('')
    lines.push('## Client Activity Payload')
    lines.push(...asJsonBlock(clientActivity.json))
  }
  if (projectOverview) {
    lines.push('')
    lines.push('## Project Overview Payload')
    lines.push(...asJsonBlock(projectOverview.json))
  }

  writeReport(lines)
  console.log(`Portal Admin V2 rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Portal Admin V2 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
