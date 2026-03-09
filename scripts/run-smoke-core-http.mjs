#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = path.join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = path.join(reportsDir, `smoke-core-http-${stamp}.md`)

function writeReport(lines) {
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')
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
  const candidates = ['/api/v1/health/ops', '/login']

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

async function requestText({ baseURL, pathname, method = 'GET', headers = {}, body }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch(`${baseURL}${pathname}`, {
      method,
      headers: {
        Accept: 'application/json,text/html',
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
      text,
      json,
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

async function runChecks({ baseURL }) {
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

  let healthPayload = null

  await record('health endpoint responde', async () => {
    const response = await requestText({ baseURL, pathname: '/api/v1/health/ops' })
    ensure(response.status === 200, `health expected 200, received ${response.status}`)
    healthPayload = response.json
    ensure(Boolean(healthPayload?.data?.status), 'health missing data.status')
    ensure(Boolean(healthPayload?.data?.ts), 'health missing data.ts')
    ensure(Boolean(healthPayload?.data?.rollout?.wave2Canary), 'health missing rollout.wave2Canary')
    ensure(Boolean(healthPayload?.data?.rollout?.addressHqCanary), 'health missing rollout.addressHqCanary')
    ensure(Boolean(healthPayload?.data?.rollout?.financeReceiptsCanary), 'health missing rollout.financeReceiptsCanary')
    ensure(Boolean(healthPayload?.data?.rollout?.financeReceiptAiCanary), 'health missing rollout.financeReceiptAiCanary')
  })

  await record('login renderiza sem erro fatal', async () => {
    const response = await requestText({ baseURL, pathname: '/login' })
    ensure(response.status === 200, `login expected 200, received ${response.status}`)
    ensure(/acessar|entrar/i.test(response.text), 'login page missing submit action text')
  })

  await record('api protegida retorna envelope sem token', async () => {
    const response = await requestText({ baseURL, pathname: '/api/v1/obras' })
    ensure(response.status === 401, `obras expected 401, received ${response.status}`)
    ensure(response.json?.error?.code === 'UNAUTHORIZED', 'obras missing UNAUTHORIZED code')
    ensure(Boolean(response.json?.requestId), 'obras missing requestId')
  })

  await record('docs workspace respeita gate por feature flag', async () => {
    const isEnabled = Boolean(healthPayload?.data?.flags?.docsWorkspaceV1)
    const response = await requestText({ baseURL, pathname: '/api/v1/docs' })
    const expectedStatus = isEnabled ? 401 : 404
    const expectedCode = isEnabled ? 'UNAUTHORIZED' : 'NOT_FOUND'

    ensure(response.status === expectedStatus, `docs expected ${expectedStatus}, received ${response.status}`)
    ensure(response.json?.error?.code === expectedCode, `docs expected ${expectedCode}`)
    ensure(Boolean(response.json?.requestId), 'docs missing requestId')
  })

  await record('finance receipts respeita gate por feature flag', async () => {
    const isEnabled = Boolean(healthPayload?.data?.flags?.financeReceiptsV1)
    const checks = [
      { pathname: '/api/v1/transacoes/receipts/00000000-0000-0000-0000-000000000000', method: 'GET' },
      { pathname: '/api/v1/transacoes/receipts/intake', method: 'POST', body: {} },
    ]

    for (const check of checks) {
      const response = await requestText({
        baseURL,
        pathname: check.pathname,
        method: check.method,
        body: check.body,
      })

      const expectedStatus = isEnabled ? 401 : 404
      const expectedCode = isEnabled ? 'UNAUTHORIZED' : 'NOT_FOUND'

      ensure(
        response.status === expectedStatus,
        `${check.pathname} expected ${expectedStatus}, received ${response.status}`
      )
      ensure(response.json?.error?.code === expectedCode, `${check.pathname} expected ${expectedCode}`)
      ensure(Boolean(response.json?.requestId), `${check.pathname} missing requestId`)
    }
  })

  return results
}

async function main() {
  const port = Number(process.env.PORT || 3000)
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`
  const serverState = { exited: false, code: null }

  const serverProcess = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.on('exit', (code) => {
    serverState.exited = true
    serverState.code = code
  })

  let stdout = ''
  let stderr = ''
  serverProcess.stdout?.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  serverProcess.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const startup = await waitForBaseUrl({ baseURL, timeoutMs: 120_000, serverState })
  if (!startup.ok) {
    await stopServer(serverProcess, serverState)
    writeReport([
      '# Smoke Core HTTP Report',
      '',
      `- status: fail`,
      `- baseURL: ${baseURL}`,
      `- startup_error: ${startup.error}`,
      '',
      '## Server stdout',
      '```text',
      stdout.trim() || '(empty)',
      '```',
      '',
      '## Server stderr',
      '```text',
      stderr.trim() || '(empty)',
      '```',
    ])
    console.error(`Smoke core HTTP failed: ${startup.error}`)
    process.exit(1)
  }

  try {
    const results = await runChecks({ baseURL })
    writeReport([
      '# Smoke Core HTTP Report',
      '',
      '- status: pass',
      `- baseURL: ${baseURL}`,
      '',
      '## Checks',
      ...results.map((result) => `- ${result.status}: ${result.name}`),
    ])
    console.log(`Smoke core HTTP passed: ${reportPath}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeReport([
      '# Smoke Core HTTP Report',
      '',
      '- status: fail',
      `- baseURL: ${baseURL}`,
      `- error: ${message}`,
      '',
      '## Server stdout',
      '```text',
      stdout.trim() || '(empty)',
      '```',
      '',
      '## Server stderr',
      '```text',
      stderr.trim() || '(empty)',
      '```',
    ])
    console.error(`Smoke core HTTP failed: ${message}`)
    process.exit(1)
  } finally {
    await stopServer(serverProcess, serverState)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
