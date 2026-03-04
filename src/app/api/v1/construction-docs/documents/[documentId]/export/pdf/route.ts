import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { emitProductEvent } from '@/lib/telemetry'
import { buildSimplePdf } from '@/server/services/cronograma/pdf-service'
import { ensureDocumentOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'
import { uploadConstructionPdf } from '@/server/services/construction-docs/storage-service'
import type { ConstructionDocsPdfPayload } from '@/shared/types/construction-docs'

function buildLines(document: {
  type: string
  status: string
  payload: Record<string, unknown>
}) {
  const lines: string[] = []
  lines.push('STRKTR - Construction Docs')
  lines.push(`Tipo: ${document.type}`)
  lines.push(`Status: ${document.status}`)
  lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)
  lines.push('----------------------------------------')

  const payload = document.payload || {}
  const summary = typeof payload.summary === 'string' ? payload.summary : null
  if (summary) {
    lines.push('Resumo:')
    lines.push(summary)
    lines.push('----------------------------------------')
  }

  if (Array.isArray(payload.findings)) {
    lines.push('Achados:')
    for (const item of payload.findings.slice(0, 30)) {
      lines.push(`- ${String(item)}`)
    }
    lines.push('----------------------------------------')
  }

  if (Array.isArray(payload.recommendations)) {
    lines.push('Recomendações:')
    for (const item of payload.recommendations.slice(0, 30)) {
      lines.push(`- ${String(item)}`)
    }
    lines.push('----------------------------------------')
  }

  if (Array.isArray(payload.tasks)) {
    lines.push('Cronograma:')
    for (const task of payload.tasks.slice(0, 60)) {
      const data = typeof task === 'object' && task ? (task as Record<string, unknown>) : {}
      lines.push(`- ${String(data.title || 'Tarefa')} (${String(data.startsAt || '-') } -> ${String(data.endsAt || '-')})`)
    }
  }

  return lines
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const { documentId } = await params
    const document = await ensureDocumentOwnership(supabase, orgId, documentId)
    if (!document) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Documento não encontrado' },
        404
      )
    }

    const lines = buildLines({
      type: document.type,
      status: document.status,
      payload: (document.payload as Record<string, unknown>) || {},
    })

    const pdfBuffer = buildSimplePdf(lines)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `construction-doc-${documentId}-${stamp}.pdf`
    const upload = await uploadConstructionPdf({
      orgId,
      documentId,
      fileName,
      content: pdfBuffer,
    })

    const pdfKey = upload ? `${upload.bucket}:${upload.storageKey}` : null
    await supabase
      .from('construction_docs_documents')
      .update({
        pdf_key: pdfKey,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('id', documentId)

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'document_exported_pdf',
      projectId: document.project_id,
      documentId,
      payload: {
        fallback: !upload,
      },
    }).catch(() => undefined)

    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'core_complete',
      entityType: 'construction_docs_document',
      entityId: documentId,
      payload: {
        source: 'web',
        outcome: 'success',
        action: 'export_pdf',
      },
      mirrorExternal: true,
    }).catch(() => undefined)

    const response: ConstructionDocsPdfPayload = {
      fileName,
      mimeType: 'application/pdf',
      bytes: pdfBuffer.byteLength,
      downloadUrl: upload?.downloadUrl || null,
      base64: upload?.downloadUrl ? null : pdfBuffer.toString('base64'),
      fallback: !upload?.downloadUrl,
    }

    return ok(innerRequest, response, getConstructionDocsFlagMeta(), 201)
  })

  return handler(request)
}
