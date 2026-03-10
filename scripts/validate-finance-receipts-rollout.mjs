#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.STRKTR_BASE_URL || 'https://strktr.vercel.app').replace(/\/$/, '')
const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''
const EXPECT_ENABLED = (process.env.FINANCE_RECEIPTS_EXPECT_ENABLED || 'auto').trim().toLowerCase()

const RECEIPT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=='

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `finance-receipts-rollout-validate-${stamp}.md`)

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

async function main() {
  const lines = [
    '# Finance Receipts Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
  ]

  if (!E2E_BEARER_TOKEN || !E2E_OBRA_ID) {
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN and/or E2E_OBRA_ID')
    writeReport(lines)
    console.log(`Finance receipts rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagFinanceReceipts: ${String(Boolean(health.json?.data?.flags?.financeReceiptsV1))}`)
  lines.push(`- HealthRolloutPercent: ${String(health.json?.data?.rollout?.financeReceiptsCanary?.percent ?? 'n/a')}`)
  lines.push(`- HealthAllowlistCount: ${String(health.json?.data?.rollout?.financeReceiptsCanary?.allowlistCount ?? 'n/a')}`)
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  const form = new FormData()
  form.set('run_ai', 'false')
  form.set(
    'file',
    new File([Buffer.from(RECEIPT_PNG_BASE64, 'base64')], 'receipt-rollout.png', { type: 'image/png' })
  )

  const upload = await api('/api/v1/transacoes/receipts/intake', {
    method: 'POST',
    body: form,
  })

  lines.push(`- UploadStatus: ${upload.response.status}`)

  if (upload.response.status === 404) {
    const hidden = EXPECT_ENABLED === 'true'
    lines.push(`- Status: ${hidden ? 'fail' : 'skip'}`)
    lines.push(`- Reason: ${hidden ? 'rollout hidden for validation org' : 'rollout hidden for org/token used'}`)
    lines.push('')
    lines.push('## Upload Payload')
    lines.push(...asJsonBlock(upload.json))
    writeReport(lines)
    if (hidden) process.exit(1)
    console.log(`Finance receipts rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (upload.response.status !== 201) {
    lines.push('- Status: fail')
    lines.push('- Reason: upload failed')
    lines.push('')
    lines.push('## Upload Payload')
    lines.push(...asJsonBlock(upload.json))
    writeReport(lines)
    console.error(`Finance receipts rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const intake = upload.json?.data
  const create = await api('/api/v1/transacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      obra_id: E2E_OBRA_ID,
      receipt_intake_id: intake.id,
      tipo: 'Despesa',
      categoria: 'Materiais',
      descricao: `Recibo rollout ${Date.now()}`,
      valor: 19.9,
      data: new Date().toISOString().slice(0, 10),
      status: 'Confirmado',
      forma_pagto: 'PIX',
      notas: 'Fluxo operacional finance receipts',
    }),
  })

  lines.push(`- CreateTransactionStatus: ${create.response.status}`)
  if (create.response.status !== 201) {
    lines.push('- Status: fail')
    lines.push('- Reason: transaction create failed')
    lines.push('')
    lines.push('## Create Payload')
    lines.push(...asJsonBlock(create.json))
    writeReport(lines)
    console.error(`Finance receipts rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const createdTransaction = create.json?.data

  const intakeLookup = await api(`/api/v1/transacoes/receipts/${intake.id}`)
  const attachments = await api(`/api/v1/transacoes/${createdTransaction.id}/anexos`)
  const firstAttachment = attachments.json?.data?.items?.[0]

  lines.push(`- IntakeLookupStatus: ${intakeLookup.response.status}`)
  lines.push(`- AttachmentsStatus: ${attachments.response.status}`)
  lines.push(`- AttachmentCount: ${String((attachments.json?.data?.items || []).length)}`)

  let deleteAttachment = null
  let attachmentsAfterDelete = null
  if (firstAttachment?.id) {
    deleteAttachment = await api(`/api/v1/transacoes/${createdTransaction.id}/anexos/${firstAttachment.id}`, {
      method: 'DELETE',
    })
    attachmentsAfterDelete = await api(`/api/v1/transacoes/${createdTransaction.id}/anexos`)
    lines.push(`- DeleteAttachmentStatus: ${deleteAttachment.response.status}`)
    lines.push(`- AttachmentCountAfterDelete: ${String((attachmentsAfterDelete.json?.data?.items || []).length)}`)
  }

  const deleteTransaction = await api(`/api/v1/transacoes/${createdTransaction.id}`, {
    method: 'DELETE',
  })
  lines.push(`- DeleteTransactionStatus: ${deleteTransaction.response.status}`)

  const failed =
    intakeLookup.response.status !== 200 ||
    attachments.response.status !== 200 ||
    !firstAttachment?.id ||
    (deleteAttachment && deleteAttachment.response.status !== 200) ||
    (attachmentsAfterDelete && (attachmentsAfterDelete.json?.data?.items || []).length !== 0) ||
    deleteTransaction.response.status !== 200

  lines.push(`- Status: ${failed ? 'fail' : 'pass'}`)
  lines.push('')
  lines.push('## Upload Payload')
  lines.push(...asJsonBlock(upload.json))
  lines.push('')
  lines.push('## Create Payload')
  lines.push(...asJsonBlock(create.json))
  lines.push('')
  lines.push('## Intake Lookup Payload')
  lines.push(...asJsonBlock(intakeLookup.json))
  lines.push('')
  lines.push('## Attachments Payload')
  lines.push(...asJsonBlock(attachments.json))
  if (deleteAttachment) {
    lines.push('')
    lines.push('## Delete Attachment Payload')
    lines.push(...asJsonBlock(deleteAttachment.json))
  }
  if (attachmentsAfterDelete) {
    lines.push('')
    lines.push('## Attachments After Delete Payload')
    lines.push(...asJsonBlock(attachmentsAfterDelete.json))
  }
  lines.push('')
  lines.push('## Delete Transaction Payload')
  lines.push(...asJsonBlock(deleteTransaction.json))

  writeReport(lines)
  if (failed) {
    console.error(`Finance receipts rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  console.log(`Finance receipts rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Finance Receipts Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
