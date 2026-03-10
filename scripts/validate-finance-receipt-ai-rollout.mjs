#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.STRKTR_BASE_URL || 'https://strktr.vercel.app').replace(/\/$/, '')
const E2E_BEARER_TOKEN = process.env.E2E_BEARER_TOKEN || ''
const E2E_OBRA_ID = process.env.E2E_OBRA_ID || ''
const EXPECT_ENABLED = (process.env.FINANCE_RECEIPT_AI_EXPECT_ENABLED || 'auto').trim().toLowerCase()

const now = new Date()
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
  now.getUTCDate()
).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
  2,
  '0'
)}${String(now.getUTCSeconds()).padStart(2, '0')}`

const reportsDir = join(process.cwd(), 'docs', 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `finance-receipt-ai-rollout-validate-${stamp}.md`)

function writeReport(lines) {
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')
}

function asJsonBlock(value) {
  return ['```json', JSON.stringify(value, null, 2), '```']
}

function createReceiptPdfBuffer() {
  const lines = [
    'Fornecedor Exemplo LTDA',
    'CNPJ 12.345.678/0001-90',
    'Recibo de materiais',
    'Valor total R$ 219,90',
    'Data emissao 2026-03-08',
    'Forma de pagamento PIX',
    'Categoria sugerida Materiais',
  ]
  const pageStream = `BT
/F1 12 Tf
24 170 Td
(${lines[0]}) Tj
T*
(${lines[1]}) Tj
T*
(${lines[2]}) Tj
T*
(${lines[3]}) Tj
T*
(${lines[4]}) Tj
T*
(${lines[5]}) Tj
T*
(${lines[6]}) Tj
ET`

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 220] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj',
    `4 0 obj\n<< /Length ${Buffer.byteLength(pageStream, 'utf8')} >>\nstream\n${pageStream}\nendstream\nendobj`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${object}\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`

  return Buffer.from(pdf, 'utf8')
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

function isExpectedEnabled() {
  return EXPECT_ENABLED === 'true'
}

function isExpectedDisabled() {
  return EXPECT_ENABLED === 'false'
}

function countExtractedFields(reviewPayload) {
  if (!reviewPayload || reviewPayload.status !== 'ready_for_review') return 0
  const keys = [
    'fornecedor',
    'descricao',
    'valor_total',
    'data_emissao',
    'documento_fiscal',
    'categoria',
    'forma_pagamento',
  ]
  return keys.filter((key) => reviewPayload?.[key]?.value !== null && reviewPayload?.[key]?.value !== '').length
}

async function main() {
  const lines = [
    '# Finance Receipt AI Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    `- BaseUrl: ${BASE_URL}`,
    `- ExpectEnabled: ${EXPECT_ENABLED}`,
  ]

  if (!E2E_BEARER_TOKEN || !E2E_OBRA_ID) {
    lines.push('- Status: skip')
    lines.push('- Reason: missing E2E_BEARER_TOKEN and/or E2E_OBRA_ID')
    writeReport(lines)
    console.log(`Finance receipt AI rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  const health = await api('/api/v1/health/ops')
  const healthFlags = health.json?.data?.flags || {}
  const healthRollout = health.json?.data?.rollout || {}
  lines.push(`- HealthStatus: ${health.response.status}`)
  lines.push(`- HealthFlagFinanceReceipts: ${String(Boolean(healthFlags.financeReceiptsV1))}`)
  lines.push(`- HealthFlagFinanceReceiptAi: ${String(Boolean(healthFlags.financeReceiptAiV1))}`)
  lines.push(
    `- HealthFinanceReceiptAiCanaryPercent: ${String(healthRollout.financeReceiptAiCanary?.percent ?? 'n/a')}`
  )
  lines.push(
    `- HealthFinanceReceiptAiAllowlistCount: ${String(healthRollout.financeReceiptAiCanary?.allowlistCount ?? 'n/a')}`
  )
  lines.push('')
  lines.push('## Health Payload')
  lines.push(...asJsonBlock(health.json))
  lines.push('')

  const form = new FormData()
  form.set('run_ai', 'true')
  form.set(
    'file',
    new File([createReceiptPdfBuffer()], 'receipt-ai-rollout.pdf', { type: 'application/pdf' })
  )

  const upload = await api('/api/v1/transacoes/receipts/intake', {
    method: 'POST',
    body: form,
  })

  lines.push(`- UploadStatus: ${upload.response.status}`)

  if (upload.response.status === 404) {
    const hiddenButRequired = isExpectedEnabled()
    lines.push(`- Status: ${hiddenButRequired ? 'fail' : 'skip'}`)
    lines.push(
      `- Reason: ${
        hiddenButRequired ? 'financeReceiptAi hidden for validation org' : 'financeReceiptAi hidden for org/token used'
      }`
    )
    lines.push('')
    lines.push('## Upload Payload')
    lines.push(...asJsonBlock(upload.json))
    writeReport(lines)
    if (hiddenButRequired) process.exit(1)
    console.log(`Finance receipt AI rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (upload.response.status !== 201) {
    lines.push('- Status: fail')
    lines.push('- Reason: upload failed')
    lines.push('')
    lines.push('## Upload Payload')
    lines.push(...asJsonBlock(upload.json))
    writeReport(lines)
    console.error(`Finance receipt AI rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const intake = upload.json?.data
  const reviewPayload = intake?.review_payload || null
  const aiEnabledMeta = upload.json?.meta?.aiEnabled
  const extractedFieldCount = countExtractedFields(reviewPayload)

  lines.push(`- AiEnabledMeta: ${String(aiEnabledMeta)}`)
  lines.push(`- IntakeStatus: ${String(intake?.status || 'n/a')}`)
  lines.push(`- ReviewStatus: ${String(reviewPayload?.status || 'n/a')}`)
  lines.push(`- ReviewProvider: ${String(reviewPayload?.provider || 'n/a')}`)
  lines.push(`- ExtractedFieldCount: ${String(extractedFieldCount)}`)

  const hiddenForOrg =
    aiEnabledMeta === false ||
    reviewPayload?.status === 'manual_only' ||
    (!reviewPayload && !isExpectedEnabled())

  if (hiddenForOrg && !isExpectedEnabled()) {
    lines.push('- Status: skip')
    lines.push('- Reason: financeReceiptAi not enabled for org/token used')
    lines.push('')
    lines.push('## Upload Payload')
    lines.push(...asJsonBlock(upload.json))
    writeReport(lines)
    console.log(`Finance receipt AI rollout validation skipped: ${reportPath}`)
    process.exit(0)
  }

  if (isExpectedDisabled()) {
    lines.push('- Status: pass')
    lines.push('- Reason: financeReceiptAi expected disabled and remained non-extractive')
    lines.push('')
    lines.push('## Upload Payload')
    lines.push(...asJsonBlock(upload.json))
    writeReport(lines)
    console.log(`Finance receipt AI rollout validation passed: ${reportPath}`)
    process.exit(0)
  }

  const aiFailed =
    reviewPayload?.status !== 'ready_for_review' ||
    reviewPayload?.provider !== 'gemini'

  if (aiFailed) {
    lines.push('- Status: fail')
    lines.push('- Reason: financeReceiptAi did not return ready_for_review from gemini')
    lines.push('')
    lines.push('## Upload Payload')
    lines.push(...asJsonBlock(upload.json))
    writeReport(lines)
    console.error(`Finance receipt AI rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  const create = await api('/api/v1/transacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      obra_id: E2E_OBRA_ID,
      receipt_intake_id: intake.id,
      tipo: 'Despesa',
      categoria: reviewPayload?.categoria?.value || 'Materiais',
      descricao: reviewPayload?.descricao?.value || `Recibo AI rollout ${Date.now()}`,
      valor: typeof reviewPayload?.valor_total?.value === 'number' ? reviewPayload.valor_total.value : 219.9,
      data: reviewPayload?.data_emissao?.value || new Date().toISOString().slice(0, 10),
      status: 'Confirmado',
      forma_pagto: reviewPayload?.forma_pagamento?.value || 'PIX',
      notas: 'Fluxo operacional finance receipt AI',
    }),
  })

  lines.push(`- CreateTransactionStatus: ${create.response.status}`)
  if (create.response.status !== 201) {
    lines.push('- Status: fail')
    lines.push('- Reason: transaction create failed after AI extraction')
    lines.push('')
    lines.push('## Upload Payload')
    lines.push(...asJsonBlock(upload.json))
    lines.push('')
    lines.push('## Create Payload')
    lines.push(...asJsonBlock(create.json))
    writeReport(lines)
    console.error(`Finance receipt AI rollout validation failed: ${reportPath}`)
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
    intakeLookup.json?.data?.review_payload?.status !== 'ready_for_review' ||
    intakeLookup.json?.data?.review_payload?.provider !== 'gemini' ||
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
    console.error(`Finance receipt AI rollout validation failed: ${reportPath}`)
    process.exit(1)
  }

  console.log(`Finance receipt AI rollout validation passed: ${reportPath}`)
}

main().catch((error) => {
  writeReport([
    '# Finance Receipt AI Rollout Validation',
    '',
    `- GeneratedAt: ${new Date().toISOString()}`,
    '- Status: fail',
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  console.error(error)
  process.exit(1)
})
