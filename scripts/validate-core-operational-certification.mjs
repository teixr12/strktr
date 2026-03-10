#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const reportsDir = path.join(cwd, 'docs', 'reports')
fs.mkdirSync(reportsDir, { recursive: true })

const baseUrl = process.env.CORE_CERT_BASE_URL ?? 'https://strktr.vercel.app'
const expectedBranch = process.env.CORE_CERT_EXPECT_BRANCH ?? 'main'
const expectedVersion = process.env.CORE_CERT_EXPECT_VERSION ?? ''
const authStrictStatusOverride = (process.env.CORE_CERT_AUTH_STRICT_STATUS ?? '').trim().toLowerCase()
const healthSnapshotPath = process.env.CORE_CERT_HEALTH_JSON ?? ''
const releaseSnapshotPath = process.env.CORE_CERT_RELEASE_JSON ?? ''
const githubRepo = process.env.CORE_CERT_GITHUB_REPO ?? 'teixr12/strktr'

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

async function fetchGithubJson(url) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'strktr-core-certification',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`Unable to fetch GitHub API ${url}: ${response.status}`)
  }

  return response.json()
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

async function inferAuthStrictStatus(sha) {
  if (!sha || sha === 'unknown') {
    return {
      status: 'unknown',
      source: 'missing_sha',
      details: 'Live SHA is unavailable.',
    }
  }

  try {
    const data = await fetchGithubJson(`https://api.github.com/repos/${githubRepo}/commits/${sha}/check-runs?per_page=100`)
    const checkRuns = Array.isArray(data.check_runs) ? data.check_runs : []

    const ciRun = checkRuns.find((checkRun) => checkRun.name === 'CI')
    if (ciRun?.conclusion === 'success') {
      return {
        status: 'pass',
        source: 'github_check_run_ci',
        details: 'CI check run succeeded for the live SHA.',
      }
    }

    if (ciRun) {
      return {
        status: ciRun.conclusion === 'failure' ? 'fail' : 'unknown',
        source: 'github_check_run_ci',
        details: `CI conclusion: ${ciRun.conclusion ?? 'unknown'}`,
      }
    }

    const qualityRun = checkRuns.find((checkRun) => checkRun.name === 'quality')
    if (qualityRun?.conclusion === 'success') {
      return {
        status: 'pass',
        source: 'github_check_run_quality',
        details: 'Quality check run succeeded for the live SHA.',
      }
    }

    if (qualityRun) {
      return {
        status: qualityRun.conclusion === 'failure' ? 'fail' : 'unknown',
        source: 'github_check_run_quality',
        details: `Quality conclusion: ${qualityRun.conclusion ?? 'unknown'}`,
      }
    }

    const strictRun = checkRuns.find((checkRun) => checkRun.name.toLowerCase().includes('auth strict'))
    if (strictRun?.conclusion === 'success') {
      return {
        status: 'pass',
        source: 'github_check_run_auth_strict',
        details: 'Auth strict check run succeeded for the live SHA.',
      }
    }

    if (strictRun) {
      return {
        status: strictRun.conclusion === 'failure' ? 'fail' : 'unknown',
        source: 'github_check_run_auth_strict',
        details: `Auth strict conclusion: ${strictRun.conclusion ?? 'unknown'}`,
      }
    }

    return {
      status: 'unknown',
      source: 'github_check_run_missing',
      details: 'No CI or auth strict check run found for the live SHA.',
    }
  } catch (error) {
    return {
      status: 'unknown',
      source: 'github_check_run_error',
      details: error instanceof Error ? error.message : 'Unknown GitHub API error.',
    }
  }
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
const inferredAuthStrict = authStrictStatusOverride
  ? {
      status: authStrictStatusOverride,
      source: 'env_override',
      details: 'Auth strict status was provided explicitly.',
    }
  : await inferAuthStrictStatus(liveVersion)
const authStrictStatus = inferredAuthStrict.status
const authStrictSource = inferredAuthStrict.source
const authStrictDetails = inferredAuthStrict.details
const authStrictPass = authStrictStatus === 'pass' || authStrictStatus === 'success'

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
  `- AuthStrictSource: ${authStrictSource}`,
  `- AuthStrictDetails: ${authStrictDetails}`,
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
