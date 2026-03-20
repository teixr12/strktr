#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const BASE_URL = (process.env.STRKTR_BASE_URL || 'https://strktr.vercel.app').replace(/\/$/, '')
const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_FOREIGN_BEARER_TOKEN = process.env.E2E_FOREIGN_BEARER_TOKEN || ''
const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || ''
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || ''
const E2E_FOREIGN_EMAIL = process.env.E2E_FOREIGN_EMAIL || ''
const E2E_FOREIGN_PASSWORD = process.env.E2E_FOREIGN_PASSWORD || ''
const EXPECT_ENABLED = (process.env.BUREAUCRACY_V1_EXPECT_ENABLED || 'auto').trim().toLowerCase()
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `bureaucracy-v1-rollout-validate-${stamp}.md`)

function writeReport(lines) {
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')
}

function asJsonBlock(value) {
  return ['```json', JSON.stringify(value, null, 2), '```']
}

async function api(path, init = {}, token = E2E_BEARER_TOKEN) {
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }
  return { response, json }
}

async function fetchBearerToken(email, password) {
  if (!email || !password || !SUPABASE_URL || !SUPABASE_ANON_KEY) return ''
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Unable to mint foreign bearer token: ${response.status}`)
  }
  return payload.access_token
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableString(value) {
  return value === null || typeof value === 'string'
}

function validateBureaucracyRecord(record) {
  return Boolean(
    record &&
      typeof record.id === 'string' &&
      typeof record.org_id === 'string' &&
      typeof record.titulo === 'string' &&
      ['prefeitura', 'condominio', 'judicial', 'extrajudicial', 'cartorio', 'documentacao', 'licenciamento', 'outro'].includes(
        record.categoria
      ) &&
      ['draft', 'pending', 'in_review', 'waiting_external', 'scheduled', 'resolved', 'archived'].includes(record.status) &&
      ['low', 'medium', 'high', 'critical'].includes(record.prioridade) &&
      isNullableString(record.obra_id) &&
      isNullableString(record.obra_nome) &&
      isNullableString(record.projeto_id) &&
      isNullableString(record.projeto_nome) &&
      isNullableString(record.processo_codigo) &&
      isNullableString(record.orgao_nome) &&
      isNullableString(record.responsavel_nome) &&
      isNullableString(record.responsavel_email) &&
      isNullableString(record.proxima_acao) &&
      isNullableString(record.proxima_checagem_em) &&
      isNullableString(record.reuniao_em) &&
      isNullableString(record.link_externo) &&
      isNullableString(record.descricao) &&
      typeof record.created_at === 'string' &&
      typeof record.updated_at === 'string' &&
      typeof record.ultima_atualizacao_em === 'string'
  )
}

function validateListPayload(payload) {
  return Boolean(
    Array.isArray(payload?.data) &&
      payload.data.every(validateBureaucracyRecord) &&
      payload?.meta &&
      isNumber(payload.meta.count) &&
      isNumber(payload.meta.page) &&
      isNumber(payload.meta.pageSize) &&
      isNumber(payload.meta.total) &&
      typeof payload.meta.hasMore === 'boolean' &&
      payload.meta.summary &&
      isNumber(payload.meta.summary.total) &&
      isNumber(payload.meta.summary.open) &&
      isNumber(payload.meta.summary.urgent) &&
      isNumber(payload.meta.summary.overdue) &&
      isNumber(payload.meta.summary.waitingExternal) &&
      isNumber(payload.meta.summary.resolved)
  )
}

function getForeignExpectation(percent) {
  if (!isNumber(percent)) {
    return {
      label: 'unknown rollout percent',
      allowedStatuses: [],
      requiresConsistencyCheck: false,
    }
  }

  if (percent === 0) {
    return {
      label: 'expect 404 before percentage rollout',
      allowedStatuses: [404],
      requiresConsistencyCheck: false,
    }
  }

  if (percent === 100) {
    return {
      label: 'expect 200 at full rollout',
      allowedStatuses: [200],
      requiresConsistencyCheck: false,
    }
  }

  return {
    label: 'accept 200 or 404 during canary rollout; result must stay consistent for the org',
    allowedStatuses: [200, 404],
    requiresConsistencyCheck: true,
  }
}

async function runBrowserSmoke() {
  if (!E2E_USER_EMAIL || !E2E_USER_PASSWORD) {
    return {
      ok: false,
      reason: 'missing E2E_USER_EMAIL/E2E_USER_PASSWORD for browser smoke',
      pageErrors: [],
      consoleErrors: [],
      failedResponses: [],
    }
  }

  const browser = await chromium.launch({ headless: true })
  const pageErrors = []
  const consoleErrors = []
  const failedResponses = []

  try {
    const page = await browser.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('response', (response) => {
      if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`)
    })

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.readyState === 'complete')
    await page.waitForTimeout(500)
    await page.locator('input[type="email"]').fill(E2E_USER_EMAIL)
    await page.locator('input[type="password"]').fill(E2E_USER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30000 })
    await page.goto(`${BASE_URL}/burocracia`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.readyState === 'complete')
    await page.waitForTimeout(500)

    const bodyText = await page.locator('body').innerText()
    const ok =
      bodyText.includes('Burocracia') &&
      pageErrors.length === 0 &&
      consoleErrors.length === 0 &&
      failedResponses.length === 0

    return {
      ok,
      reason: ok ? null : 'browser smoke detected page/console/server errors or missing burocracia page content',
      pageErrors,
      consoleErrors,
      failedResponses,
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  const lines = [
    '# Bureaucracy V1 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
  ]

  if (!E2E_BEARER_TOKEN) {
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN')
    writeReport(lines)
    console.log(`Bureaucracy V1 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  const healthFlags = health.json?.data?.flags || {}
  const healthRollout = health.json?.data?.rollout || {}
  const bureaucracyRollout = healthRollout.bureaucracyV1Canary || null
  const rolloutPercent = bureaucracyRollout?.percent
  const foreignExpectation = getForeignExpectation(rolloutPercent)

  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagBureaucracyV1: ${String(Boolean(healthFlags.bureaucracyV1))}`)
  lines.push(`- HealthBureaucracyV1CanaryPresent: ${String(Boolean(bureaucracyRollout))}`)
  lines.push(`- HealthBureaucracyV1CanaryPercent: ${String(rolloutPercent ?? 'n/a')}`)
  lines.push(`- HealthBureaucracyV1AllowlistCount: ${String(bureaucracyRollout?.allowlistCount ?? 'n/a')}`)
  lines.push(`- ForeignOrgExpectedBehavior: ${foreignExpectation.label}`)
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  if (EXPECT_ENABLED === 'true' && !healthFlags.bureaucracyV1) {
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push('- Status: fail')
    lines.push('- Reason: bureaucracyV1 expected enabled but health flag is false')
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  if (!bureaucracyRollout) {
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push('- Status: fail')
    lines.push('- Reason: bureaucracyV1 rollout telemetry missing from health/ops')
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const list = await api('/api/v1/burocracia?page=1&pageSize=10')
  lines.push(`- BurocraciaListStatus: ${list.response.status}`)

  if (list.response.status === 404) {
    const hiddenButRequired = EXPECT_ENABLED === 'true'
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push(`- Status: ${hiddenButRequired ? 'fail' : 'skip'}`)
    lines.push(
      `- Reason: ${
        hiddenButRequired ? 'bureaucracyV1 hidden for validation org' : 'bureaucracyV1 hidden for org/token used'
      }`
    )
    lines.push('')
    lines.push('## Burocracia List Payload')
    lines.push(...asJsonBlock(list.json))
    writeReport(lines)
    if (hiddenButRequired) process.exit(1)
    console.log(`Bureaucracy V1 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (list.response.status !== 200 || !validateListPayload(list.json)) {
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push('- Status: fail')
    lines.push('- Reason: bureaucracy list failed contract validation')
    lines.push('')
    lines.push('## Burocracia List Payload')
    lines.push(...asJsonBlock(list.json))
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const createPayload = {
    titulo: 'Burocracia QA Rollout',
    categoria: 'prefeitura',
    status: 'pending',
    prioridade: 'medium',
    processo_codigo: `qa-buro-${stamp}`,
    orgao_nome: 'Prefeitura QA',
    responsavel_nome: 'Operacao QA',
    responsavel_email: `qa+burocracia-rollout-${stamp}@strktr.local`,
    proxima_acao: 'Validar documento inicial',
    proxima_checagem_em: '2026-03-25',
    descricao: 'Created by bureaucracy rollout validator',
  }

  const create = await api('/api/v1/burocracia', {
    method: 'POST',
    body: JSON.stringify(createPayload),
  })
  lines.push(`- BurocraciaCreateStatus: ${create.response.status}`)

  if (
    create.response.status !== 201 ||
    !validateBureaucracyRecord(create.json?.data) ||
    create.json?.data?.status !== 'pending'
  ) {
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push('- Status: fail')
    lines.push('- Reason: bureaucracy create failed contract validation')
    lines.push('')
    lines.push('## Burocracia Create Payload')
    lines.push(...asJsonBlock(create.json))
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const itemId = create.json.data.id

  const updatePayload = {
    status: 'waiting_external',
    prioridade: 'high',
    proxima_acao: 'Aguardar retorno do orgao',
    descricao: 'Updated by bureaucracy rollout validator',
  }

  const update = await api(`/api/v1/burocracia/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(updatePayload),
  })
  lines.push(`- BurocraciaUpdateStatus: ${update.response.status}`)

  if (
    update.response.status !== 200 ||
    !validateBureaucracyRecord(update.json?.data) ||
    update.json?.data?.status !== 'waiting_external' ||
    update.json?.data?.prioridade !== 'high'
  ) {
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push('- Status: fail')
    lines.push('- Reason: bureaucracy update failed contract validation')
    lines.push('')
    lines.push('## Burocracia Update Payload')
    lines.push(...asJsonBlock(update.json))
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const getById = await api(`/api/v1/burocracia/${itemId}`)
  lines.push(`- BurocraciaGetStatus: ${getById.response.status}`)

  if (
    getById.response.status !== 200 ||
    !validateBureaucracyRecord(getById.json?.data) ||
    getById.json?.data?.status !== 'waiting_external' ||
    getById.json?.data?.prioridade !== 'high'
  ) {
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push('- Status: fail')
    lines.push('- Reason: bureaucracy get-by-id failed contract validation')
    lines.push('')
    lines.push('## Burocracia Get Payload')
    lines.push(...asJsonBlock(getById.json))
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const foreignToken = E2E_FOREIGN_BEARER_TOKEN || (await fetchBearerToken(E2E_FOREIGN_EMAIL, E2E_FOREIGN_PASSWORD))
  if (!foreignToken) {
    lines.push('- ForeignBurocraciaListStatus: n/a')
    lines.push('- Status: fail')
    lines.push('- Reason: missing foreign-org credentials/token for bureaucracy validation')
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const foreignList = await api('/api/v1/burocracia?page=1&pageSize=5', {}, foreignToken)
  lines.push(`- ForeignBurocraciaListStatus: ${foreignList.response.status}`)
  let foreignConsistencyStatus = null

  if (foreignExpectation.requiresConsistencyCheck) {
    const repeatedForeignList = await api('/api/v1/burocracia?page=1&pageSize=5', {}, foreignToken)
    foreignConsistencyStatus = repeatedForeignList.response.status
    lines.push(`- ForeignBurocraciaListRepeatedStatus: ${foreignConsistencyStatus}`)

    if (foreignConsistencyStatus !== foreignList.response.status) {
      lines.push('- Status: fail')
      lines.push(
        `- Reason: foreign org bureaucracyV1 status changed within validation run (${foreignList.response.status} -> ${foreignConsistencyStatus})`
      )
      lines.push('')
      lines.push('## Foreign Burocracia Payload')
      lines.push(...asJsonBlock(foreignList.json))
      lines.push('')
      lines.push('## Foreign Burocracia Repeated Payload')
      lines.push(...asJsonBlock(repeatedForeignList.json))
      writeReport(lines)
      console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
      process.exit(1)
    }
  }

  if (!foreignExpectation.allowedStatuses.includes(foreignList.response.status)) {
    lines.push('- Status: fail')
    lines.push(
      `- Reason: foreign org bureaucracyV1 status ${foreignList.response.status} did not match expected behavior (${foreignExpectation.label})`
    )
    lines.push('')
    lines.push('## Foreign Burocracia Payload')
    lines.push(...asJsonBlock(foreignList.json))
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const browserSmoke = await runBrowserSmoke()
  lines.push(`- BrowserSmokeStatus: ${browserSmoke.ok ? 'pass' : 'fail'}`)
  lines.push(`- BrowserSmokePageErrors: ${String(browserSmoke.pageErrors.length)}`)
  lines.push(`- BrowserSmokeConsoleErrors: ${String(browserSmoke.consoleErrors.length)}`)
  lines.push(`- BrowserSmokeFailedResponses: ${String(browserSmoke.failedResponses.length)}`)

  if (!browserSmoke.ok) {
    lines.push('- Status: fail')
    lines.push(`- Reason: ${browserSmoke.reason}`)
    lines.push('')
    lines.push('## Browser Smoke')
    lines.push(...asJsonBlock(browserSmoke))
    writeReport(lines)
    console.error(`Bureaucracy V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  lines.push(`- CreatedBurocraciaItemId: ${itemId}`)
  lines.push('- Status: pass')
  lines.push('')
  lines.push('## Burocracia List Payload')
  lines.push(...asJsonBlock(list.json))
  lines.push('')
  lines.push('## Burocracia Create Payload')
  lines.push(...asJsonBlock(create.json))
  lines.push('')
  lines.push('## Burocracia Update Payload')
  lines.push(...asJsonBlock(update.json))
  lines.push('')
  lines.push('## Burocracia Get Payload')
  lines.push(...asJsonBlock(getById.json))
  lines.push('')
  lines.push('## Foreign Burocracia Payload')
  lines.push(...asJsonBlock(foreignList.json))
  lines.push('')
  lines.push('## Browser Smoke')
  lines.push(...asJsonBlock(browserSmoke))

  writeReport(lines)
  console.log(`Bureaucracy V1 rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Bureaucracy V1 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
