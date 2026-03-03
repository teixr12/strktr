import { withApiAuth } from '@/lib/api/with-auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { emitProductEvent } from '@/lib/telemetry'
import { sendTextMessage } from '@/lib/whatsapp'
import { shareSopWhatsAppSchema } from '@/shared/schemas/sops'

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, '')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = withApiAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = shareSopWhatsAppSchema.safeParse(await innerRequest.json().catch(() => null))
    if (!parsed.success) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: parsed.error.issues[0]?.message || 'Payload inválido',
        },
        400
      )
    }

    const { id } = await params
    const { data: sop, error } = await supabase
      .from('sops')
      .select('id, title, status')
      .eq('org_id', orgId)
      .eq('id', id)
      .single()

    if (error || !sop) {
      return fail(
        innerRequest,
        {
          code: error?.code === 'PGRST116' ? API_ERROR_CODES.NOT_FOUND : API_ERROR_CODES.DB_ERROR,
          message: error?.code === 'PGRST116' ? 'SOP não encontrado' : error?.message || 'Erro ao compartilhar',
        },
        error?.code === 'PGRST116' ? 404 : 500
      )
    }

    const normalizedPhone = normalizePhone(parsed.data.to)
    if (normalizedPhone.length < 8) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'Telefone inválido',
        },
        400
      )
    }

    const defaultMessage = `SOP STRKTR: ${sop.title} (status: ${sop.status}).`
    const message = parsed.data.message?.trim() || defaultMessage
    const external = await sendTextMessage(normalizedPhone, message)

    const fallbackUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    const success = Boolean(external)

    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'sop_shared_whatsapp',
      entityType: 'sop',
      entityId: id,
      payload: { to: normalizedPhone, outcome: success ? 'success' : 'fail', source: 'web' },
      mirrorExternal: true,
    }).catch(() => undefined)

    if (!success) {
      return ok(
        innerRequest,
        {
          success: false,
          fallbackUrl,
          message: 'WhatsApp API indisponível. Use o fallback link.',
        },
        { flag: 'NEXT_PUBLIC_FF_SOP_BUILDER_V1', fallback: true },
        202
      )
    }

    return ok(
      innerRequest,
      {
        success: true,
        provider: 'whatsapp_business',
      },
      { flag: 'NEXT_PUBLIC_FF_SOP_BUILDER_V1' },
      201
    )
  })
  return handler(request)
}
