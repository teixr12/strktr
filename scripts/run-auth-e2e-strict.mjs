#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const STRICT_ENV_KEYS = [
  'E2E_BEARER_TOKEN',
  'E2E_OBRA_ID',
  'E2E_MANAGER_BEARER_TOKEN',
  'E2E_USER_BEARER_TOKEN',
  'E2E_FOREIGN_OBRA_ID',
]

const PREPARE_SOURCE_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'E2E_USER_EMAIL',
  'E2E_USER_PASSWORD',
  'E2E_MANAGER_EMAIL',
  'E2E_MANAGER_PASSWORD',
  'E2E_ROLE_USER_EMAIL',
  'E2E_ROLE_USER_PASSWORD',
  'E2E_FOREIGN_EMAIL',
  'E2E_FOREIGN_PASSWORD',
]

const AUTO_PREPARE = String(process.env.E2E_AUTO_PREPARE || '').trim() === '1'

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = path.join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = path.join(reportsDir, `auth-e2e-strict-${stamp}.md`)

function present(key, env) {
  return Boolean(String(env[key] || '').trim())
}

function writeReport(lines) {
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')
}

function parsePreparedEnv(raw) {
  const nextEnv = {}
  for (const line of raw.split('\n')) {
    if (!/^[A-Z0-9_]+=/.test(line)) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    nextEnv[line.slice(0, idx)] = line.slice(idx + 1)
  }
  return nextEnv
}

function asJsonBlock(value) {
  return ['```json', JSON.stringify(value, null, 2), '```']
}

let workingEnv = { ...process.env }
const reportLines = [
  '# Auth E2E Strict Execution',
  '',
  `- GeneratedAt: ${new Date().toISOString()}`,
  `- AutoPrepare: ${AUTO_PREPARE}`,
]

let missingStrict = STRICT_ENV_KEYS.filter((key) => !present(key, workingEnv))
const missingPrepare = PREPARE_SOURCE_KEYS.filter((key) => !present(key, workingEnv))

if (missingStrict.length > 0 && AUTO_PREPARE) {
  if (missingPrepare.length > 0) {
    reportLines.push('- Status: fail')
    reportLines.push(`- Reason: missing prepare source envs: ${missingPrepare.join(', ')}`)
    writeReport(reportLines)
    console.error(`Auth E2E strict failed: ${reportPath}`)
    process.exit(1)
  }

  const prepareEnv = { ...workingEnv }
  delete prepareEnv.GITHUB_ENV

  const prepareRun = spawnSync('node', ['scripts/prepare-e2e-role-matrix.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: prepareEnv,
    maxBuffer: 20 * 1024 * 1024,
  })

  reportLines.push(`- PrepareExitCode: ${prepareRun.status ?? 1}`)
  if (prepareRun.status !== 0) {
    reportLines.push('- Status: fail')
    reportLines.push('- Reason: prepare-e2e-role-matrix failed')
    reportLines.push('')
    reportLines.push('## Prepare stdout')
    reportLines.push('```text')
    reportLines.push((prepareRun.stdout || '').trim())
    reportLines.push('```')
    reportLines.push('')
    reportLines.push('## Prepare stderr')
    reportLines.push('```text')
    reportLines.push((prepareRun.stderr || '').trim())
    reportLines.push('```')
    writeReport(reportLines)
    console.error(`Auth E2E strict failed: ${reportPath}`)
    process.exit(1)
  }

  const preparedEnv = parsePreparedEnv(prepareRun.stdout || '')
  workingEnv = { ...workingEnv, ...preparedEnv }
  missingStrict = STRICT_ENV_KEYS.filter((key) => !present(key, workingEnv))
  reportLines.push(`- PreparedKeys: ${Object.keys(preparedEnv).sort().join(', ') || 'none'}`)
}

reportLines.push(`- MissingStrictCount: ${missingStrict.length}`)
if (missingStrict.length > 0) {
  reportLines.push('- Status: fail')
  reportLines.push(`- Reason: missing strict envs: ${missingStrict.join(', ')}`)
  writeReport(reportLines)
  console.error(`Auth E2E strict failed: ${reportPath}`)
  process.exit(1)
}

const run = spawnSync(
  'npx',
  ['playwright', 'test', 'tests/e2e/business-flow.spec.ts', 'tests/e2e/performance-core.spec.ts', '--reporter=json'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...workingEnv, CI: '1' },
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['inherit', 'pipe', 'inherit'],
  }
)

const rawJson = String(run.stdout || '').trim()
if (!rawJson) {
  reportLines.push('- Status: fail')
  reportLines.push('- Reason: no Playwright JSON output captured')
  writeReport(reportLines)
  console.error(`Auth E2E strict failed: ${reportPath}`)
  process.exit(run.status || 1)
}

let report = null
try {
  report = JSON.parse(rawJson)
} catch (error) {
  reportLines.push('- Status: fail')
  reportLines.push(`- Reason: invalid Playwright JSON output: ${error instanceof Error ? error.message : String(error)}`)
  writeReport(reportLines)
  console.error(`Auth E2E strict failed: ${reportPath}`)
  process.exit(run.status || 1)
}

const skipped = Number(report?.stats?.skipped || 0)
const unexpected = Number(report?.stats?.unexpected || 0)
const failures = Number(report?.stats?.failed || 0)

reportLines.push(`- PlaywrightExitCode: ${run.status ?? 0}`)
reportLines.push(`- Skipped: ${skipped}`)
reportLines.push(`- Failed: ${failures}`)
reportLines.push(`- Unexpected: ${unexpected}`)
reportLines.push('')
reportLines.push('## Playwright Stats')
reportLines.push(...asJsonBlock(report?.stats || {}))

if ((run.status && run.status !== 0) || skipped > 0 || failures > 0 || unexpected > 0) {
  reportLines.unshift('- Status: fail')
  writeReport(reportLines)
  console.error(`Auth E2E strict failed: ${reportPath}`)
  process.exit(run.status || 1)
}

reportLines.unshift('- Status: pass')
writeReport(reportLines)
console.log(`Auth E2E strict passed: ${reportPath}`)
