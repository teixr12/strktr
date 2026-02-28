import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import type { UiIntegrationStatus } from '@/shared/types/ui'

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

export async function GET(request: Request) {
  const { user, supabase, error } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }

  const data: UiIntegrationStatus[] = [
    {
      code: 'whatsapp_business',
      label: 'WhatsApp Business',
      configured: hasAnyEnv([
        'WHATSAPP_VERIFY_TOKEN',
        'WHATSAPP_API_TOKEN',
        'WHATSAPP_PHONE_NUMBER_ID',
      ]),
      configuredBy: 'environment',
    },
    {
      code: 'google_calendar',
      label: 'Google Calendar',
      configured: hasAnyEnv([
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_CALENDAR_ID',
      ]),
      configuredBy: 'environment',
    },
    {
      code: 'sicoob_api',
      label: 'Sicoob API',
      configured: hasAnyEnv([
        'SICOOB_CLIENT_ID',
        'SICOOB_CLIENT_SECRET',
        'SICOOB_TOKEN_URL',
      ]),
      configuredBy: 'environment',
    },
  ]

  return ok(request, data)
}
