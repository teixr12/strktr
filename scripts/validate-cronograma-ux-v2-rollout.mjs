#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.STRKTR_BASE_URL || 'https://strktr.vercel.app').replace(/\/$/, '')
const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''
const EXPECT_ENABLED = (process.env.CRONOGRAMA_UX_V2_EXPECT_ENABLED || 'auto').trim().toLowerCase()

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `cronograma-ux-v2-rollout-validate-${stamp}.md`)

function writeReport(lines) {
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')
}

function asJsonBlock(value) {
  return ['```json', JSON.stringify(value, null, 2), '```']
}

async function api(path, init = {}) {
  const headers = new Headers(init.headers || {})
  if (E2E_BEARER_TOKEN) headers.set('Authorization', `Bearer ${E2E_BEARER_TOKEN}`)
  const bodyIsJson = init.body && !(init.body instanceof FormData)
  if (bodyIsJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }
  return { response, json }
}

function validateCronogramaPayload(payload) {
  return Boolean(
    payload?.data?.obra &&
      payload?.data?.cronograma &&
      Array.isArray(payload?.data?.itens) &&
      payload?.data?.summary &&
      typeof payload.data.summary.totalItems === 'number' &&
      typeof payload.data.summary.delayedItems === 'number' &&
      typeof payload.data.summary.blockedItems === 'number'
  )
}

function buildNoopCalendarPatch(payload) {
  const calendario = payload?.data?.cronograma?.calendario || {}
  const diasUteis = Array.isArray(calendario.dias_uteis) && calendario.dias_uteis.length > 0
    ? calendario.dias_uteis
    : [1, 2, 3, 4, 5]
  const feriados = Array.isArray(calendario.feriados) ? calendario.feriados : []
  return {
    calendario: {
      dias_uteis: diasUteis,
      feriados,
    },
  }
}

function buildNoopItemPatch(item) {
  return {
    nome: item.nome,
    status: item.status,
    empresa_responsavel: item.empresa_responsavel || null,
    responsavel: item.responsavel || null,
    data_inicio_planejada: item.data_inicio_planejada || null,
    data_fim_planejada: item.data_fim_planejada || null,
    duracao_dias: item.duracao_dias,
    progresso: item.progresso,
  }
}

async function main() {
  const lines = [
    '# Cronograma UX V2 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
  ]

  if (!E2E_BEARER_TOKEN || !E2E_OBRA_ID) {
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN and/or E2E_OBRA_ID')
    writeReport(lines)
    console.log(`Cronograma UX V2 rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  const healthFlags = health.json?.data?.flags || {}
  const healthRollout = health.json?.data?.rollout || {}
  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagCronogramaUxV2: ${String(Boolean(healthFlags.cronogramaUxV2))}`)
  lines.push(`- HealthCronogramaUxV2CanaryPercent: ${String(healthRollout.cronogramaUxV2Canary?.percent ?? 'n/a')}`)
  lines.push(
    `- HealthCronogramaUxV2AllowlistCount: ${String(healthRollout.cronogramaUxV2Canary?.allowlistCount ?? 'n/a')}`
  )
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  if (EXPECT_ENABLED === 'true' && !healthFlags.cronogramaUxV2) {
    lines.push('- Status: fail')
    lines.push('- Reason: cronogramaUxV2 flag expected enabled but health flag is false')
    writeReport(lines)
    console.error(`Cronograma UX V2 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const cronograma = await api(`/api/v1/obras/${E2E_OBRA_ID}/cronograma`)
  lines.push(`- CronogramaGetStatus: ${cronograma.response.status}`)
  if (cronograma.response.status !== 200 || !validateCronogramaPayload(cronograma.json)) {
    lines.push('- Status: fail')
    lines.push('- Reason: cronograma payload failed contract validation')
    lines.push('')
    lines.push('## Cronograma Payload')
    lines.push(...asJsonBlock(cronograma.json))
    writeReport(lines)
    console.error(`Cronograma UX V2 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const calendarPatch = await api(`/api/v1/obras/${E2E_OBRA_ID}/cronograma`, {
    method: 'PATCH',
    body: JSON.stringify(buildNoopCalendarPatch(cronograma.json)),
  })
  lines.push(`- CalendarPatchStatus: ${calendarPatch.response.status}`)
  if (calendarPatch.response.status !== 200) {
    lines.push('- Status: fail')
    lines.push('- Reason: no-op calendar patch failed')
    lines.push('')
    lines.push('## Calendar Patch Payload')
    lines.push(...asJsonBlock(calendarPatch.json))
    writeReport(lines)
    console.error(`Cronograma UX V2 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const firstItem = cronograma.json?.data?.itens?.[0] || null
  let itemPatch = null
  if (firstItem?.id) {
    itemPatch = await api(`/api/v1/obras/${E2E_OBRA_ID}/cronograma/items/${firstItem.id}`, {
      method: 'PATCH',
      body: JSON.stringify(buildNoopItemPatch(firstItem)),
    })
    lines.push(`- ItemPatchStatus: ${itemPatch.response.status}`)
    if (itemPatch.response.status !== 200) {
      lines.push('- Status: fail')
      lines.push('- Reason: no-op item patch failed')
      lines.push('')
      lines.push('## Item Patch Payload')
      lines.push(...asJsonBlock(itemPatch.json))
      writeReport(lines)
      console.error(`Cronograma UX V2 rollout validation failed: ${reportPath}`)
      process.exit(1)
    }
  } else {
    lines.push('- ItemPatchStatus: skip')
    lines.push('- ItemPatchReason: no cronograma item available for no-op patch')
  }

  const recalc = await api(`/api/v1/obras/${E2E_OBRA_ID}/cronograma/recalculate`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  lines.push(`- RecalculateStatus: ${recalc.response.status}`)
  if (recalc.response.status !== 200) {
    lines.push('- Status: fail')
    lines.push('- Reason: recalculate failed')
    lines.push('')
    lines.push('## Recalculate Payload')
    lines.push(...asJsonBlock(recalc.json))
    writeReport(lines)
    console.error(`Cronograma UX V2 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const pdf = await api(`/api/v1/obras/${E2E_OBRA_ID}/cronograma/pdf`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  lines.push(`- PdfStatus: ${pdf.response.status}`)
  const pdfData = pdf.json?.data || {}
  const hasPdfOutput = Boolean(pdfData.downloadUrl || pdfData.base64)
  lines.push(`- PdfHasOutput: ${String(hasPdfOutput)}`)
  if (pdf.response.status !== 201 || !hasPdfOutput) {
    lines.push('- Status: fail')
    lines.push('- Reason: pdf generation failed')
    lines.push('')
    lines.push('## Pdf Payload')
    lines.push(...asJsonBlock(pdf.json))
    writeReport(lines)
    console.error(`Cronograma UX V2 rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  lines.push('- Status: pass')
  lines.push('')
  lines.push('## Cronograma Payload')
  lines.push(...asJsonBlock(cronograma.json))
  lines.push('')
  lines.push('## Calendar Patch Payload')
  lines.push(...asJsonBlock(calendarPatch.json))
  if (itemPatch) {
    lines.push('')
    lines.push('## Item Patch Payload')
    lines.push(...asJsonBlock(itemPatch.json))
  }
  lines.push('')
  lines.push('## Recalculate Payload')
  lines.push(...asJsonBlock(recalc.json))
  lines.push('')
  lines.push('## Pdf Payload')
  lines.push(...asJsonBlock(pdf.json))

  writeReport(lines)
  console.log(`Cronograma UX V2 rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Cronograma UX V2 Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
