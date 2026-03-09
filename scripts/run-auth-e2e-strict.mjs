#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
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

function asTextBlock(value) {
  return ['```text', String(value || '').trim() || '(empty)', '```']
}

function asJsonBlock(value) {
  return ['```json', JSON.stringify(value, null, 2), '```']
}

async function stopServer(serverProcess, serverState, timeoutMs = 5_000) {
  if (!serverProcess || serverState?.exited) return

  try {
    serverProcess.kill('SIGTERM')
  } catch {}

  const startedAt = Date.now()
  while (!serverState?.exited && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  if (serverState?.exited) return

  try {
    serverProcess.kill('SIGKILL')
  } catch {}

  const killStartedAt = Date.now()
  while (!serverState?.exited && Date.now() - killStartedAt < 2_000) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

async function waitForBaseUrl({ baseURL, timeoutMs, serverState }) {
  const startedAt = Date.now()
  let lastError = null
  const candidates = ['/api/v1/health/ops', '/']

  while (Date.now() - startedAt < timeoutMs) {
    if (serverState?.exited) {
      return {
        ok: false,
        error: `app server exited early with code ${serverState.code ?? 'unknown'}`,
      }
    }
    for (const candidate of candidates) {
      try {
        const response = await fetch(`${baseURL}${candidate}`, {
          headers: { Accept: 'application/json,text/html' },
        })
        if (response.ok || response.status === 401 || response.status === 404) {
          return { ok: true, path: candidate, status: response.status }
        }
        lastError = new Error(`Unexpected status ${response.status} at ${candidate}`)
      } catch (error) {
        lastError = error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return {
    ok: false,
    error: lastError instanceof Error ? lastError.message : String(lastError || 'Unknown startup error'),
  }
}

async function requestJson({ baseURL, pathname, method = 'GET', headers = {}, body }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(`${baseURL}${pathname}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await response.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return {
      status: response.status,
      ok: response.ok,
      json,
      text,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function runStrictChecks({ baseURL, env }) {
  const results = []

  async function record(name, fn) {
    try {
      await fn()
      results.push({ name, status: 'pass' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ name, status: 'fail', error: message })
      throw error
    }
  }

  const primaryHeaders = { Authorization: `Bearer ${env.E2E_BEARER_TOKEN}` }
  const managerHeaders = { Authorization: `Bearer ${env.E2E_MANAGER_BEARER_TOKEN}` }
  const userHeaders = { Authorization: `Bearer ${env.E2E_USER_BEARER_TOKEN}` }

  await record('pagination meta stability', async () => {
    const routes = [
      '/api/v1/leads?page=1&pageSize=5',
      '/api/v1/compras?page=1&pageSize=5',
      '/api/v1/transacoes?page=1&pageSize=5',
      '/api/v1/projetos?page=1&pageSize=5',
      '/api/v1/orcamentos?page=1&pageSize=5',
    ]

    for (const route of routes) {
      const response = await requestJson({ baseURL, pathname: route, headers: primaryHeaders })
      ensure(response.status === 200, `${route} expected 200, received ${response.status}`)
      ensure(Array.isArray(response.json?.data), `${route} expected data array`)
      ensure(response.json?.meta?.page === 1, `${route} expected meta.page=1`)
      ensure(response.json?.meta?.pageSize === 5, `${route} expected meta.pageSize=5`)
      ensure(typeof response.json?.meta?.total === 'number', `${route} expected numeric meta.total`)
      ensure(typeof response.json?.meta?.hasMore === 'boolean', `${route} expected boolean meta.hasMore`)
      ensure(typeof response.json?.meta?.count === 'number', `${route} expected numeric meta.count`)
    }
  })

  await record('role matrix enforcement', async () => {
    const managerFinance = await requestJson({
      baseURL,
      pathname: '/api/v1/transacoes?page=1&pageSize=5',
      headers: managerHeaders,
    })
    ensure(managerFinance.status === 200, `manager finance expected 200, received ${managerFinance.status}`)

    const managerProjects = await requestJson({
      baseURL,
      pathname: '/api/v1/projetos?page=1&pageSize=5',
      headers: managerHeaders,
    })
    ensure(managerProjects.status === 200, `manager projects expected 200, received ${managerProjects.status}`)

    const managerTeam = await requestJson({
      baseURL,
      pathname: '/api/v1/equipe',
      headers: managerHeaders,
    })
    ensure(managerTeam.status === 200, `manager team expected 200, received ${managerTeam.status}`)

    const userLeads = await requestJson({
      baseURL,
      pathname: '/api/v1/leads?page=1&pageSize=5',
      headers: userHeaders,
    })
    ensure(userLeads.status === 200, `user leads expected 200, received ${userLeads.status}`)

    const userFinance = await requestJson({
      baseURL,
      pathname: '/api/v1/transacoes?page=1&pageSize=5',
      headers: userHeaders,
    })
    ensure(userFinance.status === 403, `user finance expected 403, received ${userFinance.status}`)

    const userProjects = await requestJson({
      baseURL,
      pathname: '/api/v1/projetos?page=1&pageSize=5',
      headers: userHeaders,
    })
    ensure(userProjects.status === 403, `user projects expected 403, received ${userProjects.status}`)

    const userTeam = await requestJson({
      baseURL,
      pathname: '/api/v1/equipe',
      headers: userHeaders,
    })
    ensure(userTeam.status === 403, `user team expected 403, received ${userTeam.status}`)
  })

  await record('tenant isolation', async () => {
    const obraResponse = await requestJson({
      baseURL,
      pathname: `/api/v1/obras/${env.E2E_FOREIGN_OBRA_ID}`,
      headers: primaryHeaders,
    })
    ensure([403, 404].includes(obraResponse.status), `foreign obra expected 403/404, received ${obraResponse.status}`)

    const summaryResponse = await requestJson({
      baseURL,
      pathname: `/api/v1/obras/${env.E2E_FOREIGN_OBRA_ID}/execution-summary`,
      headers: primaryHeaders,
    })
    ensure(
      [403, 404].includes(summaryResponse.status),
      `foreign execution summary expected 403/404, received ${summaryResponse.status}`
    )
  })

  return results
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

const canPrepare = PREPARE_SOURCE_KEYS.every((key) => present(key, workingEnv))
if (AUTO_PREPARE && canPrepare) {
  const prepareEnv = { ...workingEnv }
  delete prepareEnv.GITHUB_ENV

  const prepareRun = spawnSync('node', ['scripts/prepare-e2e-role-matrix.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: prepareEnv,
    maxBuffer: 20 * 1024 * 1024,
  })

  reportLines.push(`- RefreshPrepareExitCode: ${prepareRun.status ?? 1}`)
  if (prepareRun.status !== 0) {
    reportLines.push('- Status: fail')
    reportLines.push('- Reason: refresh prepare-e2e-role-matrix failed')
    reportLines.push('')
    reportLines.push('## Refresh prepare stdout')
    reportLines.push(...asTextBlock(prepareRun.stdout))
    reportLines.push('')
    reportLines.push('## Refresh prepare stderr')
    reportLines.push(...asTextBlock(prepareRun.stderr))
    writeReport(reportLines)
    console.error(`Auth E2E strict failed: ${reportPath}`)
    process.exit(1)
  }

  const preparedEnv = parsePreparedEnv(prepareRun.stdout || '')
  workingEnv = { ...workingEnv, ...preparedEnv }
  missingStrict = STRICT_ENV_KEYS.filter((key) => !present(key, workingEnv))
  reportLines.push(`- RefreshedKeys: ${Object.keys(preparedEnv).sort().join(', ') || 'none'}`)
}

reportLines.push(`- MissingStrictCount: ${missingStrict.length}`)
if (missingStrict.length > 0) {
  reportLines.push('- Status: fail')
  reportLines.push(`- Reason: missing strict envs: ${missingStrict.join(', ')}`)
  writeReport(reportLines)
  console.error(`Auth E2E strict failed: ${reportPath}`)
  process.exit(1)
}

const port = Number.parseInt(String(workingEnv.PORT || 3000), 10) || 3000
const baseURL = String(workingEnv.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`)
let serverProcess = null
const serverStdout = []
const serverStderr = []
const serverState = { exited: false, code: null }

if (!workingEnv.PLAYWRIGHT_BASE_URL) {
  serverProcess = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    env: { ...workingEnv, CI: '1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stdout?.on('data', (chunk) => {
    serverStdout.push(String(chunk))
    if (serverStdout.length > 200) serverStdout.shift()
  })
  serverProcess.stderr?.on('data', (chunk) => {
    serverStderr.push(String(chunk))
    if (serverStderr.length > 200) serverStderr.shift()
  })
  serverProcess.on('exit', (code) => {
    serverState.exited = true
    serverState.code = code
  })

  const startup = await waitForBaseUrl({ baseURL, timeoutMs: 120_000, serverState })
  reportLines.push(`- BaseURL: ${baseURL}`)
  if (!startup.ok) {
    reportLines.push('- Status: fail')
    reportLines.push(`- Reason: app server failed to become ready (${startup.error})`)
    reportLines.push('')
    reportLines.push('## Server stdout tail')
    reportLines.push(...asTextBlock(serverStdout.join('')))
    reportLines.push('')
    reportLines.push('## Server stderr tail')
    reportLines.push(...asTextBlock(serverStderr.join('')))
    writeReport(reportLines)
    await stopServer(serverProcess, serverState)
    console.error(`Auth E2E strict failed: ${reportPath}`)
    process.exit(1)
  }
  reportLines.push(`- ServerReadyPath: ${startup.path}`)
  reportLines.push(`- ServerReadyStatus: ${startup.status}`)
} else {
  reportLines.push(`- BaseURL: ${baseURL}`)
}

let strictResults = []

try {
  strictResults = await runStrictChecks({ baseURL, env: workingEnv })
} catch (error) {
  if (serverProcess) {
    await stopServer(serverProcess, serverState)
  }

  reportLines.push('- Status: fail')
  reportLines.push(`- Reason: ${error instanceof Error ? error.message : String(error)}`)
  reportLines.push('')
  reportLines.push('## Strict checks')
  reportLines.push(...asJsonBlock(strictResults))

  if (serverStdout.length || serverStderr.length) {
    reportLines.push('')
    reportLines.push('## Server stdout tail')
    reportLines.push(...asTextBlock(serverStdout.join('')))
    reportLines.push('')
    reportLines.push('## Server stderr tail')
    reportLines.push(...asTextBlock(serverStderr.join('')))
  }

  writeReport(reportLines)
  console.error(`Auth E2E strict failed: ${reportPath}`)
  process.exit(1)
}

if (serverProcess) {
  await stopServer(serverProcess, serverState)
}

reportLines.unshift('- Status: pass')
reportLines.push('')
reportLines.push('## Strict checks')
reportLines.push(...asJsonBlock(strictResults))

if (serverStdout.length || serverStderr.length) {
  reportLines.push('')
  reportLines.push('## Server stdout tail')
  reportLines.push(...asTextBlock(serverStdout.join('')))
  reportLines.push('')
  reportLines.push('## Server stderr tail')
  reportLines.push(...asTextBlock(serverStderr.join('')))
}

writeReport(reportLines)
console.log(`Auth E2E strict passed: ${reportPath}`)
