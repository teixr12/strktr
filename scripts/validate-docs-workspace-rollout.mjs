#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.STRKTR_BASE_URL || 'https://strktr.vercel.app').replace(/\/$/, '')
const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const EXPECT_ENABLED = (process.env.DOCS_WORKSPACE_EXPECT_ENABLED || 'auto').trim().toLowerCase()

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `docs-workspace-rollout-validate-${stamp}.md`)

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

function validateDocsPayload(payload) {
  if (!Array.isArray(payload?.data?.items)) return false
  if (!payload?.meta?.pagination) return false
  return (
    typeof payload.meta.pagination.page === 'number' &&
    typeof payload.meta.pagination.pageSize === 'number' &&
    typeof payload.meta.pagination.total === 'number' &&
    typeof payload.meta.pagination.hasMore === 'boolean' &&
    typeof payload.meta.pagination.count === 'number'
  )
}

async function main() {
  const lines = [
    '# Docs Workspace Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
  ]

  if (!E2E_BEARER_TOKEN) {
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN')
    writeReport(lines)
    console.log(`Docs workspace rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  const healthFlags = health.json?.data?.flags || {}
  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagDocsWorkspace: ${String(Boolean(healthFlags.docsWorkspaceV1))}`)
  lines.push(`- HealthFlagSopBuilder: ${String(Boolean(healthFlags.sopBuilderV1))}`)
  lines.push(`- HealthFlagConstructionDocs: ${String(Boolean(healthFlags.constructionDocs))}`)
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  const docs = await api('/api/v1/docs?page=1&pageSize=10')
  lines.push(`- DocsStatus: ${docs.response.status}`)

  if (docs.response.status === 404) {
    const hiddenButRequired = isExpectedEnabled()
    lines.push(`- Status: ${hiddenButRequired ? 'fail' : 'skip'}`)
    lines.push(
      `- Reason: ${
        hiddenButRequired ? 'docsWorkspaceV1 hidden for validation org' : 'docsWorkspaceV1 hidden for org/token used'
      }`
    )
    lines.push('')
    lines.push('## Docs Payload')
    lines.push(...asJsonBlock(docs.json))
    writeReport(lines)
    if (hiddenButRequired) process.exit(1)
    console.log(`Docs workspace rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (docs.response.status !== 200 || !validateDocsPayload(docs.json)) {
    lines.push('- Status: fail')
    lines.push('- Reason: docs workspace payload failed contract validation')
    lines.push('')
    lines.push('## Docs Payload')
    lines.push(...asJsonBlock(docs.json))
    writeReport(lines)
    console.error(`Docs workspace rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const sops = await api('/api/v1/sops?page=1&pageSize=5')
  lines.push(`- LegacySopsStatus: ${sops.response.status}`)
  if (healthFlags.sopBuilderV1 && sops.response.status !== 200) {
    lines.push('- Status: fail')
    lines.push('- Reason: legacy sops route regressed while docs workspace validation ran')
    lines.push('')
    lines.push('## Legacy Sops Payload')
    lines.push(...asJsonBlock(sops.json))
    writeReport(lines)
    console.error(`Docs workspace rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const constructionProjects = await api('/api/v1/construction-docs/projects?page=1&pageSize=5')
  lines.push(`- LegacyConstructionDocsProjectsStatus: ${constructionProjects.response.status}`)
  if (healthFlags.constructionDocs && constructionProjects.response.status !== 200) {
    lines.push('- Status: fail')
    lines.push('- Reason: construction docs projects route regressed while docs workspace validation ran')
    lines.push('')
    lines.push('## Legacy Construction Docs Projects Payload')
    lines.push(...asJsonBlock(constructionProjects.json))
    writeReport(lines)
    console.error(`Docs workspace rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const items = docs.json?.data?.items || []
  const sourceModules = Array.from(new Set(items.map((item) => item.source_module).filter(Boolean)))
  lines.push(`- DocsItemsCount: ${String(items.length)}`)
  lines.push(`- DocsSourceModules: ${sourceModules.join(', ') || 'none'}`)
  lines.push('- Status: pass')
  lines.push('')
  lines.push('## Docs Payload')
  lines.push(...asJsonBlock(docs.json))
  lines.push('')
  lines.push('## Legacy Sops Payload')
  lines.push(...asJsonBlock(sops.json))
  lines.push('')
  lines.push('## Legacy Construction Docs Projects Payload')
  lines.push(...asJsonBlock(constructionProjects.json))

  writeReport(lines)
  console.log(`Docs workspace rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Docs Workspace Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
