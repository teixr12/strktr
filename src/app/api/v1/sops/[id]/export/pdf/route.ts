import { withApiAuth } from '@/lib/api/with-auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { emitProductEvent } from '@/lib/telemetry'
import { buildSimplePdf } from '@/server/services/cronograma/pdf-service'
import type { SopPdfPayload } from '@/shared/types/sops'

function buildSopPdfLines(sop: {
  title: string
  description: string | null
  status: string
  blocks: Array<{ type?: string; content?: string }>
  branding: Record<string, unknown> | null
}) {
  const branding = sop.branding || {}
  const lines: string[] = []
  lines.push('STRKTR - SOP')
  lines.push(`Titulo: ${sop.title}`)
  lines.push(`Status: ${sop.status}`)
  lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)
  if (typeof branding.company_name === 'string' && branding.company_name.trim()) {
    lines.push(`Empresa: ${branding.company_name}`)
  }
  if (typeof branding.company_document === 'string' && branding.company_document.trim()) {
    lines.push(`Documento: ${branding.company_document}`)
  }
  if (typeof branding.responsible_name === 'string' && branding.responsible_name.trim()) {
    lines.push(`Responsavel: ${branding.responsible_name}`)
  }
  lines.push('----------------------------------------')
  if (sop.description) {
    lines.push('Descricao:')
    lines.push(sop.description)
    lines.push('----------------------------------------')
  }
  for (const block of sop.blocks || []) {
    if (!block?.content) continue
    if (block.type === 'title') {
      lines.push(`## ${block.content}`)
    } else if (block.type === 'image') {
      lines.push(`[Imagem] ${block.content}`)
    } else {
      lines.push(block.content)
    }
  }
  return lines
}

async function tryUploadSignedUrl(args: {
  orgId: string
  sopId: string
  fileName: string
  pdfBuffer: Buffer
}) {
  const service = createServiceRoleClient()
  if (!service) {
    return { downloadUrl: null, storagePath: null, bucket: null }
  }

  const buckets = ['sop-pdfs', 'orcamento-pdfs', 'cronograma-pdfs']
  for (const bucket of buckets) {
    const storagePath = `${args.orgId}/${args.sopId}/${args.fileName}`
    const upload = await service.storage
      .from(bucket)
      .upload(storagePath, args.pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (upload.error) continue

    const signed = await service.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
    if (!signed.error && signed.data?.signedUrl) {
      return { downloadUrl: signed.data.signedUrl, storagePath, bucket }
    }
  }

  return { downloadUrl: null, storagePath: null, bucket: null }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = withApiAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const { id } = await params

    const { data: sop, error } = await supabase
      .from('sops')
      .select('id, org_id, title, description, status, blocks, branding')
      .eq('org_id', orgId)
      .eq('id', id)
      .single()

    if (error || !sop) {
      return fail(
        innerRequest,
        {
          code: error?.code === 'PGRST116' ? API_ERROR_CODES.NOT_FOUND : API_ERROR_CODES.DB_ERROR,
          message: error?.code === 'PGRST116' ? 'SOP não encontrado' : error?.message || 'Erro ao exportar SOP',
        },
        error?.code === 'PGRST116' ? 404 : 500
      )
    }

    const lines = buildSopPdfLines({
      title: sop.title,
      description: sop.description,
      status: sop.status,
      blocks: (sop.blocks as Array<{ type?: string; content?: string }>) || [],
      branding: (sop.branding as Record<string, unknown> | null) || {},
    })

    const pdfBuffer = buildSimplePdf(lines)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `sop-${id}-${stamp}.pdf`
    const upload = await tryUploadSignedUrl({
      orgId,
      sopId: id,
      fileName,
      pdfBuffer,
    })

    const responsePayload: SopPdfPayload = {
      fileName,
      mimeType: 'application/pdf',
      bytes: pdfBuffer.byteLength,
      downloadUrl: upload.downloadUrl,
      storagePath: upload.storagePath,
      storageBucket: upload.bucket,
      base64: upload.downloadUrl ? null : pdfBuffer.toString('base64'),
      fallback: !upload.downloadUrl,
    }

    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'sop_exported_pdf',
      entityType: 'sop',
      entityId: id,
      payload: { fallback: responsePayload.fallback, source: 'web' },
      mirrorExternal: true,
    }).catch(() => undefined)

    return ok(innerRequest, responsePayload, { flag: 'NEXT_PUBLIC_FF_SOP_BUILDER_V1' }, 201)
  })

  return handler(request)
}
