import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { buildSimplePdf } from '@/server/services/cronograma/pdf-service'

async function tryUploadSignedUrl(args: {
  orgId: string
  orcamentoId: string
  fileName: string
  pdfBuffer: Buffer
}) {
  const service = createServiceRoleClient()
  if (!service) {
    return { downloadUrl: null, storagePath: null, bucket: null }
  }

  const buckets = ['orcamento-pdfs', 'cronograma-pdfs']
  for (const bucket of buckets) {
    const storagePath = `${args.orgId}/${args.orcamentoId}/${args.fileName}`
    const upload = await service.storage
      .from(bucket)
      .upload(storagePath, args.pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (upload.error) {
      continue
    }

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
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const { id } = await params
  const { data: orcamento, error: dbError } = await supabase
    .from('orcamentos')
    .select(
      'id, titulo, status, validade, observacoes, valor_total, created_at, leads(nome), obras(nome), orcamento_itens(descricao, unidade, quantidade, valor_unitario)'
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError || !orcamento) {
    return fail(
      request,
      {
        code: dbError?.code === 'PGRST116' ? API_ERROR_CODES.NOT_FOUND : API_ERROR_CODES.DB_ERROR,
        message: dbError?.code === 'PGRST116' ? 'Orçamento não encontrado' : dbError?.message || 'Erro ao gerar PDF',
      },
      dbError?.code === 'PGRST116' ? 404 : 500
    )
  }

  const lines: string[] = []
  const obrasRelation = orcamento.obras as { nome: string }[] | { nome: string } | null | undefined
  const leadsRelation = orcamento.leads as { nome: string }[] | { nome: string } | null | undefined
  const obraNome = Array.isArray(obrasRelation)
    ? obrasRelation[0]?.nome
    : obrasRelation?.nome
  const leadNome = Array.isArray(leadsRelation)
    ? leadsRelation[0]?.nome
    : leadsRelation?.nome

  lines.push('STRKTR - Orcamento')
  lines.push(`Titulo: ${orcamento.titulo}`)
  lines.push(`Status: ${orcamento.status}`)
  lines.push(`Obra: ${obraNome || '-'}`)
  lines.push(`Lead: ${leadNome || '-'}`)
  lines.push(`Validade: ${orcamento.validade || '-'}`)
  lines.push(`Criado em: ${new Date(orcamento.created_at).toLocaleString('pt-BR')}`)
  lines.push('----------------------------------------')

  for (const item of orcamento.orcamento_itens || []) {
    const subtotal = item.quantidade * item.valor_unitario
    lines.push(
      `${item.descricao} | ${item.quantidade} ${item.unidade} | R$ ${item.valor_unitario.toFixed(2)} | subtotal R$ ${subtotal.toFixed(2)}`
    )
  }
  lines.push('----------------------------------------')
  lines.push(`Total: R$ ${Number(orcamento.valor_total || 0).toFixed(2)}`)

  if (orcamento.observacoes) {
    lines.push('Observacoes:')
    lines.push(orcamento.observacoes)
  }

  const pdfBuffer = buildSimplePdf(lines)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `orcamento-${id}-${stamp}.pdf`

  const upload = await tryUploadSignedUrl({
    orgId,
    orcamentoId: id,
    fileName,
    pdfBuffer,
  })

  if (!upload.downloadUrl) {
    log('warn', 'orcamentos.pdf.storage_unavailable_fallback', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/orcamentos/[id]/pdf',
      orcamentoId: id,
    })
  }

  return ok(
    request,
    {
      fileName,
      mimeType: 'application/pdf',
      bytes: pdfBuffer.byteLength,
      downloadUrl: upload.downloadUrl,
      storagePath: upload.storagePath,
      storageBucket: upload.bucket,
      base64: upload.downloadUrl ? null : pdfBuffer.toString('base64'),
      fallback: !upload.downloadUrl,
    },
    {
      flag: 'NEXT_PUBLIC_FF_ORCAMENTO_PDF_V2',
      storage: upload.downloadUrl ? 'signed_url' : 'base64_fallback',
    },
    201
  )
}
