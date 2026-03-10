#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const reportsDir = path.join(cwd, 'docs', 'reports')
fs.mkdirSync(reportsDir, { recursive: true })
const healthSnapshotPath = process.env.CORE_CLOSEOUT_HEALTH_JSON ?? ''
const releaseSnapshotPath = process.env.CORE_CLOSEOUT_RELEASE_JSON ?? ''

function run(command, args = []) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  }).trim()
}

function fetchJsonWithFallback(endpoint) {
  try {
    return run('bash', [
      '-lc',
      `curl -sS --connect-timeout 5 -m 25 'https://strktr.vercel.app${endpoint}'`,
    ])
  } catch {}

  throw new Error(`Unable to fetch ${endpoint}`)
}

function readJsonSnapshot(snapshotPath) {
  if (!snapshotPath) {
    return null
  }

  try {
    return fs.readFileSync(snapshotPath, 'utf8').trim()
  } catch {
    return null
  }
}

function findLatest(prefix) {
  const files = fs
    .readdirSync(reportsDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.md'))
    .sort()
  return files.length ? files[files.length - 1] : null
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportPath = path.join(reportsDir, `core-operational-closeout-${stamp}.md`)

const healthRaw = readJsonSnapshot(healthSnapshotPath) ?? fetchJsonWithFallback('/api/v1/health/ops')
const releaseRaw = readJsonSnapshot(releaseSnapshotPath) ?? fetchJsonWithFallback('/api/v1/ops/release')

const health = parseJson(healthRaw)
const release = parseJson(releaseRaw)

const latestProductionAudit = findLatest('production-audit-')
const latestDrift = findLatest('analytics-drift-')
const latestProbe = findLatest('analytics-capture-probe-')

const rollbackReports = [
  findLatest('finance-receipt-ai-rollback-drill-'),
  findLatest('cronograma-ux-v2-rollback-drill-'),
  findLatest('docs-workspace-rollback-drill-'),
  findLatest('portal-admin-v2-rollback-drill-'),
  findLatest('obra-intelligence-v1-rollback-drill-'),
].filter(Boolean)

const lines = [
  '# Core Operational Closeout',
  '',
  `- GeneratedAt: ${new Date().toISOString()}`,
  `- LiveVersion: ${health?.data?.version ?? 'unknown'}`,
  `- LiveBranch: ${health?.data?.branch ?? 'unknown'}`,
  `- DeploymentUrl: ${health?.data?.deploymentUrl ?? 'unknown'}`,
  `- ReleaseSource: ${health?.data?.releaseSource ?? 'unknown'}`,
  '',
  '## Live Flags',
  `- financeReceiptsV1: ${String(health?.data?.flags?.financeReceiptsV1 ?? 'n/a')}`,
  `- financeReceiptAiV1: ${String(health?.data?.flags?.financeReceiptAiV1 ?? 'n/a')}`,
  `- cronogramaUxV2: ${String(health?.data?.flags?.cronogramaUxV2 ?? 'n/a')}`,
  `- docsWorkspaceV1: ${String(health?.data?.flags?.docsWorkspaceV1 ?? 'n/a')}`,
  `- portalAdminV2: ${String(health?.data?.flags?.portalAdminV2 ?? 'n/a')}`,
  `- obraIntelligenceV1: ${String(health?.data?.flags?.obraIntelligenceV1 ?? 'n/a')}`,
  '',
  '## Rollout Snapshots',
  `- financeReceiptAi: ${JSON.stringify(health?.data?.rollout?.financeReceiptAiCanary ?? null)}`,
  `- cronogramaUxV2: ${JSON.stringify(health?.data?.rollout?.cronogramaUxV2Canary ?? null)}`,
  `- docsWorkspace: ${JSON.stringify(health?.data?.rollout?.docsWorkspaceCanary ?? null)}`,
  `- portalAdminV2: ${JSON.stringify(health?.data?.rollout?.portalAdminV2Canary ?? null)}`,
  `- obraIntelligenceV1: ${JSON.stringify(health?.data?.rollout?.obraIntelligenceV1Canary ?? null)}`,
  '',
  '## Health / Release',
  `- HealthStatus: ${health?.data?.status ?? 'unknown'}`,
  `- ReleaseVersion: ${release?.data?.version ?? 'unknown'}`,
  `- ReleaseBranch: ${release?.data?.branch ?? 'unknown'}`,
  `- ReleaseDeploymentUrl: ${release?.data?.deploymentUrl ?? 'unknown'}`,
  '',
  '## Evidence',
  `- ProductionAudit: ${latestProductionAudit ? `docs/reports/${latestProductionAudit}` : '[missing]'}`,
  `- AnalyticsDrift: ${latestDrift ? `docs/reports/${latestDrift}` : '[missing]'}`,
  `- CaptureProbe: ${latestProbe ? `docs/reports/${latestProbe}` : '[missing]'}`,
  '',
  '## Rollback Drill Reports',
]

if (rollbackReports.length === 0) {
  lines.push('- [missing]')
} else {
  for (const report of rollbackReports) {
    lines.push(`- docs/reports/${report}`)
  }
}

lines.push('', '## Conclusion', '- [ ] Auth strict E2E stable', '- [ ] Rollback drills completed', '- [ ] Core live modules certified', '')

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
console.log(reportPath)
