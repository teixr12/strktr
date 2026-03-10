#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const reportsDir = path.join(cwd, 'docs', 'reports')
fs.mkdirSync(reportsDir, { recursive: true })

const baseUrl = process.env.CORE_CERT_BASE_URL ?? 'https://strktr.vercel.app'
const expectedBranch = process.env.CORE_CERT_EXPECT_BRANCH ?? 'main'
const expectedVersion = process.env.CORE_CERT_EXPECT_VERSION ?? ''
const authStrictStatus = (process.env.CORE_CERT_AUTH_STRICT_STATUS ?? 'unknown').toLowerCase()
const healthSnapshotPath = process.env.CORE_CERT_HEALTH_JSON ?? ''
const releaseSnapshotPath = process.env.CORE_CERT_RELEASE_JSON ?? ''

function readJsonSnapshot(snapshotPath) {
  if (!snapshotPath) return null
  try {
    return fs.readFileSync(snapshotPath, 'utf8').trim()
  } catch {
    return null
  }
}

async function fetchJson(endpoint) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch ${endpoint}: ${response.status}`)
  }

  return response.text()
}

function parseJson(text) {
  try {
    return JSON.parse(text)
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

const rollbackPrefixes = [
  'finance-receipt-ai-rollback-drill-',
  'cronograma-ux-v2-rollback-drill-',
  'docs-workspace-rollback-drill-',
  'portal-admin-v2-rollback-drill-',
  'obra-intelligence-v1-rollback-drill-',
]

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportPath = path.join(reportsDir, `core-operational-certification-${stamp}.md`)

const healthRaw = readJsonSnapshot(healthSnapshotPath) ?? (await fetchJson('/api/v1/health/ops'))
const releaseRaw = readJsonSnapshot(releaseSnapshotPath) ?? (await fetchJson('/api/v1/ops/release'))

const health = parseJson(healthRaw)
const release = parseJson(releaseRaw)

const liveVersion = health?.data?.version ?? 'unknown'
const liveBranch = health?.data?.branch ?? 'unknown'
const releaseVersion = release?.data?.version ?? 'unknown'
const releaseBranch = release?.data?.branch ?? 'unknown'
const deploymentUrl = health?.data?.deploymentUrl ?? release?.data?.deploymentUrl ?? 'unknown'
const releaseSource = health?.data?.releaseSource ?? release?.data?.releaseSource ?? 'unknown'

const releaseStatus = release?.data?.status ?? (release?.data?.version ? 'ok' : 'unknown')

const releaseTraceabilityPass =
  health?.data?.status === 'ok' &&
  releaseStatus === 'ok' &&
  liveVersion !== 'unknown' &&
  liveVersion === releaseVersion &&
  liveBranch === expectedBranch &&
  releaseBranch === expectedBranch &&
  deploymentUrl !== 'unknown' &&
  releaseSource !== 'unknown' &&
  (expectedVersion ? liveVersion === expectedVersion : true)

const rollbackReports = rollbackPrefixes.map((prefix) => findLatest(prefix))
const rollbackDrillsPass = rollbackReports.every(Boolean)
const authStrictPass = authStrictStatus === 'pass'

const status = releaseTraceabilityPass && rollbackDrillsPass && authStrictPass ? 'pass' : 'fail'

const lines = [
  '# Core Operational Certification',
  '',
  `- GeneratedAt: ${new Date().toISOString()}`,
  `- BaseUrl: ${baseUrl}`,
  `- Status: ${status}`,
  '',
  '## Release Traceability',
  `- HealthStatus: ${health?.data?.status ?? 'unknown'}`,
  `- ReleaseStatus: ${releaseStatus}`,
  `- LiveVersion: ${liveVersion}`,
  `- ReleaseVersion: ${releaseVersion}`,
  `- LiveBranch: ${liveBranch}`,
  `- ReleaseBranch: ${releaseBranch}`,
  `- DeploymentUrl: ${deploymentUrl}`,
  `- ReleaseSource: ${releaseSource}`,
  `- ExpectedBranch: ${expectedBranch}`,
  `- ExpectedVersion: ${expectedVersion || '[not provided]'}`,
  `- ReleaseTraceabilityPass: ${String(releaseTraceabilityPass)}`,
  '',
  '## Auth Strict Gate',
  `- AuthStrictStatus: ${authStrictStatus}`,
  `- AuthStrictPass: ${String(authStrictPass)}`,
  '',
  '## Rollback Drill Evidence',
]

for (const [index, prefix] of rollbackPrefixes.entries()) {
  const report = rollbackReports[index]
  lines.push(`- ${prefix}: ${report ? `docs/reports/${report}` : '[missing]'}`)
}

lines.push(`- RollbackDrillsPass: ${String(rollbackDrillsPass)}`, '', '## Conclusion')

if (status === 'pass') {
  lines.push('- Core-operational certification checks are complete.')
} else {
  if (!releaseTraceabilityPass) {
    lines.push('- Release traceability is incomplete or inconsistent.')
  }
  if (!authStrictPass) {
    lines.push('- Auth strict gate is not marked as stable.')
  }
  if (!rollbackDrillsPass) {
    lines.push('- One or more rollback drill reports are missing.')
  }
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
console.log(reportPath)

if (status !== 'pass') {
  process.exit(1)
}
