import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { sendNotificationEmail } from '@/lib/email/resend'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { buildSimplePdf } from '@/server/services/cronograma/pdf-service'
import { generateCronogramaPdfSchema } from '@/shared/schemas/cronograma-portal'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, orgId, role, requestId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = generateCronogramaPdfSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' }, 400)
  }

  const { id: obraId } = await params
  const [obraRes, cronogramaRes, itensRes] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, cliente, local, data_previsao')
      .eq('id', obraId)
      .eq('org_id', orgId)
      .single(),
    supabase
      .from('cronograma_obras')
      .select('id, nome, data_inicio_planejada, data_fim_planejada')
      .eq('obra_id', obraId)
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('cronograma_itens')
      .select('nome, status, empresa_responsavel, responsavel, data_inicio_planejada, data_fim_planejada, atraso_dias')
      .eq('obra_id', obraId)
      .eq('org_id', orgId)
      .order('ordem', { ascending: true }),
  ])

  if (obraRes.error || !obraRes.data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }
  if (itensRes.error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: itensRes.error.message }, 500)
  }

  const lines: string[] = []
  lines.push(`STRKTR - Cronograma da Obra`)
  lines.push(`Obra: ${obraRes.data.nome}`)
  lines.push(`Cliente: ${obraRes.data.cliente}`)
  lines.push(`Local: ${obraRes.data.local}`)
  lines.push(`Previsao da obra: ${obraRes.data.data_previsao || '-'}`)
  lines.push(`Cronograma: ${cronogramaRes.data?.nome || 'Principal'}`)
  lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)
  lines.push('----------------------------------------')

  for (const item of itensRes.data || []) {
    lines.push(
      `${item.nome} | ${item.status} | ${item.data_inicio_planejada || '-'} -> ${item.data_fim_planejada || '-'} | atraso ${item.atraso_dias || 0}d`
    )
    if (item.empresa_responsavel || item.responsavel) {
      lines.push(`  executor: ${item.empresa_responsavel || '-'} | responsavel: ${item.responsavel || '-'}`)
    }
  }

  const pdfBuffer = buildSimplePdf(lines)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `cronograma-${obraId}-${stamp}.pdf`
  const storagePath = `${orgId}/${obraId}/${fileName}`
  const bucket = 'cronograma-pdfs'

  const service = createServiceRoleClient()
  let downloadUrl: string | null = null
  let usedFallbackBase64 = false

  if (service) {
    const upload = await service.storage
      .from(bucket)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (!upload.error) {
      const signed = await service.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
      if (!signed.error && signed.data?.signedUrl) {
        downloadUrl = signed.data.signedUrl
      }
    } else {
      usedFallbackBase64 = true
      console.error('cronograma.pdf.storage_upload_failed', {
        requestId,
        orgId,
        obraId,
        error: upload.error.message,
      })
    }
  } else {
    usedFallbackBase64 = true
  }

  await supabase.from('cronograma_pdf_exports').insert({
    org_id: orgId,
    obra_id: obraId,
    cronograma_id: cronogramaRes.data?.id || null,
    gerado_por: user.id,
    file_name: fileName,
    file_size_bytes: pdfBuffer.byteLength,
    storage_path: downloadUrl ? storagePath : null,
  })

  let emailSent = false
  if (parsed.data.sendEmailTo) {
    const sent = await sendNotificationEmail(
      parsed.data.sendEmailTo,
      `Cronograma da obra ${obraRes.data.nome}`,
      'Cronograma gerado pelo STRKTR',
      'O PDF foi gerado e está disponível para download.',
      downloadUrl || undefined
    )
    emailSent = Boolean(sent)
  }

  return ok(
    request,
    {
      fileName,
      mimeType: 'application/pdf',
      bytes: pdfBuffer.byteLength,
      storagePath: downloadUrl ? storagePath : null,
      downloadUrl,
      emailSent,
      base64: usedFallbackBase64 ? pdfBuffer.toString('base64') : null,
      fallback: usedFallbackBase64,
    },
    {
      flag: 'NEXT_PUBLIC_FF_CRONOGRAMA_PDF',
      storage: downloadUrl ? 'signed_url' : 'base64_fallback',
    },
    201
  )
}
