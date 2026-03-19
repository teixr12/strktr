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
const EXPECT_ENABLED = (process.env.SUPPLIER_MANAGEMENT_V1_EXPECT_ENABLED || 'auto').trim().toLowerCase()
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
const reportPath = join(reportsDir, `supplier-management-v1-rollout-validate-${stamp}.md`)

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

function validateSupplierRecord(record) {
  return Boolean(
    record &&
      typeof record.id === 'string' &&
      typeof record.org_id === 'string' &&
      typeof record.nome === 'string' &&
      ['active', 'watchlist', 'blocked'].includes(record.status) &&
      isNumber(record.score_manual) &&
      typeof record.created_at === 'string' &&
      typeof record.updated_at === 'string'
  )
}

function validateListPayload(payload) {
  return Boolean(
    Array.isArray(payload?.data) &&
      payload.data.every(validateSupplierRecord) &&
      payload?.meta &&
      isNumber(payload.meta.count) &&
      isNumber(payload.meta.page) &&
      isNumber(payload.meta.pageSize) &&
      isNumber(payload.meta.total) &&
      typeof payload.meta.hasMore === 'boolean' &&
      payload.meta.summary &&
      isNumber(payload.meta.summary.total) &&
      isNumber(payload.meta.summary.active) &&
      isNumber(payload.meta.summary.watchlist) &&
      isNumber(payload.meta.summary.blocked) &&
      isNumber(payload.meta.summary.averageScore)
  )
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
      if (response.status() >= 500) {
        failedResponses.push(`${response.status()} ${response.url()}`)
      }
    })

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.readyState === 'complete')
    await page.waitForTimeout(500)
    await page.locator('input[type="email"]').fill(E2E_USER_EMAIL)
    await page.locator('input[type="password"]').fill(E2E_USER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30000 })
    await page.goto(`${BASE_URL}/fornecedores`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.readyState === 'complete')
    await page.waitForTimeout(500)

    const bodyText = await page.locator('body').innerText()
    const ok =
      bodyText.includes('Fornecedores') && pageErrors.length === 0 && consoleErrors.length === 0 && failedResponses.length === 0

    return {
      ok,
      reason: ok ? null : 'browser smoke detected page/console/server errors or missing fornecedores page content',
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
    '# Supplier Management V1 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
  ]

  if (!E2E_BEARER_TOKEN) {
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN')
    writeReport(lines)
    console.log(`Supplier Management V1 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  const healthFlags = health.json?.data?.flags || {}
  const healthRollout = health.json?.data?.rollout || {}
  const supplierRollout = healthRollout.supplierManagementV1Canary || null

  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagSupplierManagementV1: ${String(Boolean(healthFlags.supplierManagementV1))}`)
  lines.push(`- HealthSupplierManagementV1CanaryPresent: ${String(Boolean(supplierRollout))}`)
  lines.push(`- HealthSupplierManagementV1CanaryPercent: ${String(supplierRollout?.percent ?? 'n/a')}`)
  lines.push(`- HealthSupplierManagementV1AllowlistCount: ${String(supplierRollout?.allowlistCount ?? 'n/a')}`)
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  if (EXPECT_ENABLED === 'true' && !healthFlags.supplierManagementV1) {
    lines.push('- Status: fail')
    lines.push('- Reason: supplierManagementV1 expected enabled but health flag is false')
    writeReport(lines)
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  if (!supplierRollout) {
    lines.push('- Status: fail')
    lines.push('- Reason: supplierManagementV1 rollout telemetry missing from health/ops')
    writeReport(lines)
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const list = await api('/api/v1/fornecedores?page=1&pageSize=10')
  lines.push(`- SuppliersListStatus: ${list.response.status}`)

  if (list.response.status === 404) {
    const hiddenButRequired = EXPECT_ENABLED === 'true'
    lines.push(`- Status: ${hiddenButRequired ? 'fail' : 'skip'}`)
    lines.push(
      `- Reason: ${
        hiddenButRequired
          ? 'supplierManagementV1 hidden for validation org'
          : 'supplierManagementV1 hidden for org/token used'
      }`
    )
    lines.push('')
    lines.push('## Suppliers List Payload')
    lines.push(...asJsonBlock(list.json))
    writeReport(lines)
    if (hiddenButRequired) process.exit(1)
    console.log(`Supplier Management V1 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (list.response.status !== 200 || !validateListPayload(list.json)) {
    lines.push('- Status: fail')
    lines.push('- Reason: supplier list failed contract validation')
    lines.push('')
    lines.push('## Suppliers List Payload')
    lines.push(...asJsonBlock(list.json))
    writeReport(lines)
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const createPayload = {
    nome: 'Fornecedor QA Rollout',
    documento: `qa-rollout-${stamp}`,
    email: `qa+supplier-rollout-${stamp}@strktr.local`,
    telefone: '11999999999',
    cidade: 'Sao Paulo',
    estado: 'SP',
    status: 'active',
    score_manual: 60,
    notas: 'Created by rollout validator',
  }

  const create = await api('/api/v1/fornecedores', {
    method: 'POST',
    body: JSON.stringify(createPayload),
  })
  lines.push(`- SupplierCreateStatus: ${create.response.status}`)

  if (create.response.status !== 201 || !validateSupplierRecord(create.json?.data)) {
    lines.push('- Status: fail')
    lines.push('- Reason: supplier create failed contract validation')
    lines.push('')
    lines.push('## Supplier Create Payload')
    lines.push(...asJsonBlock(create.json))
    writeReport(lines)
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const supplierId = create.json.data.id

  const patchPayload = {
    status: 'watchlist',
    score_manual: 75,
    notas: 'Updated by rollout validator',
  }

  const patch = await api(`/api/v1/fornecedores/${supplierId}`, {
    method: 'PATCH',
    body: JSON.stringify(patchPayload),
  })
  lines.push(`- SupplierPatchStatus: ${patch.response.status}`)

  if (
    patch.response.status !== 200 ||
    !validateSupplierRecord(patch.json?.data) ||
    patch.json?.data?.status !== 'watchlist' ||
    patch.json?.data?.score_manual !== 75
  ) {
    lines.push('- Status: fail')
    lines.push('- Reason: supplier patch failed contract validation')
    lines.push('')
    lines.push('## Supplier Patch Payload')
    lines.push(...asJsonBlock(patch.json))
    writeReport(lines)
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const getById = await api(`/api/v1/fornecedores/${supplierId}`)
  lines.push(`- SupplierGetStatus: ${getById.response.status}`)

  if (
    getById.response.status !== 200 ||
    !validateSupplierRecord(getById.json?.data) ||
    getById.json?.data?.status !== 'watchlist' ||
    getById.json?.data?.score_manual !== 75
  ) {
    lines.push('- Status: fail')
    lines.push('- Reason: supplier get-by-id failed contract validation')
    lines.push('')
    lines.push('## Supplier Get Payload')
    lines.push(...asJsonBlock(getById.json))
    writeReport(lines)
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const foreignToken = E2E_FOREIGN_BEARER_TOKEN || (await fetchBearerToken(E2E_FOREIGN_EMAIL, E2E_FOREIGN_PASSWORD))
  if (!foreignToken) {
    lines.push('- Status: fail')
    lines.push('- Reason: missing foreign-org credentials/token for supplier validation')
    writeReport(lines)
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const foreignList = await api('/api/v1/fornecedores?page=1&pageSize=5', {}, foreignToken)
  lines.push(`- ForeignSuppliersListStatus: ${foreignList.response.status}`)

  if (foreignList.response.status !== 404) {
    lines.push('- Status: fail')
    lines.push('- Reason: foreign org unexpectedly accessed supplierManagementV1 before rollout')
    lines.push('')
    lines.push('## Foreign Supplier Payload')
    lines.push(...asJsonBlock(foreignList.json))
    writeReport(lines)
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
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
    console.error(`Supplier Management V1 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  lines.push(`- CreatedSupplierId: ${supplierId}`)
  lines.push('- Status: pass')
  lines.push('')
  lines.push('## Suppliers List Payload')
  lines.push(...asJsonBlock(list.json))
  lines.push('')
  lines.push('## Supplier Create Payload')
  lines.push(...asJsonBlock(create.json))
  lines.push('')
  lines.push('## Supplier Patch Payload')
  lines.push(...asJsonBlock(patch.json))
  lines.push('')
  lines.push('## Supplier Get Payload')
  lines.push(...asJsonBlock(getById.json))
  lines.push('')
  lines.push('## Foreign Supplier Payload')
  lines.push(...asJsonBlock(foreignList.json))
  lines.push('')
  lines.push('## Browser Smoke')
  lines.push(...asJsonBlock(browserSmoke))

  writeReport(lines)
  console.log(`Supplier Management V1 rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Supplier Management V1 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
