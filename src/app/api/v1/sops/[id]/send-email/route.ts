import { withApiAuth } from '@/lib/api/with-auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { sendNotificationEmail } from '@/lib/email/resend'
import { sendSopEmailSchema } from '@/shared/schemas/sops'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = withApiAuth('can_manage_projects', async (innerRequest, { supabase, orgId }) => {
    const parsed = sendSopEmailSchema.safeParse(await innerRequest.json().catch(() => null))
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
      .select('id, title, description, status')
      .eq('org_id', orgId)
      .eq('id', id)
      .single()

    if (error || !sop) {
      return fail(
        innerRequest,
        {
          code: error?.code === 'PGRST116' ? API_ERROR_CODES.NOT_FOUND : API_ERROR_CODES.DB_ERROR,
          message: error?.code === 'PGRST116' ? 'SOP não encontrado' : error?.message || 'Erro ao enviar e-mail',
        },
        error?.code === 'PGRST116' ? 404 : 500
      )
    }

    const subject = parsed.data.subject?.trim() || `SOP: ${sop.title}`
    const description = parsed.data.message?.trim() || sop.description || `Status atual: ${sop.status}`
    const result = await sendNotificationEmail(
      parsed.data.to,
      subject,
      sop.title,
      description,
      'https://strktr.vercel.app/sops'
    )

    if (!result) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.DB_ERROR,
          message: 'Falha no envio por e-mail. Verifique integração Resend.',
        },
        503
      )
    }

    return ok(innerRequest, { success: true, id: result.id }, { flag: 'NEXT_PUBLIC_FF_SOP_BUILDER_V1' }, 201)
  })
  return handler(request)
}
