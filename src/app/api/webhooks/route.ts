import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { legacyFail, legacyOk } from '@/lib/api/legacy-compat-response'

export async function POST(request: Request) {
  try {
    const dispatchToken = process.env.WEBHOOK_DISPATCH_TOKEN?.trim()
    if (dispatchToken) {
      const token = request.headers.get('x-strktr-webhook-token')
      if (token !== dispatchToken) {
        return legacyFail(request, 'Não autorizado', 403, 'UNAUTHORIZED')
      }
    }

    const body = (await request.json().catch(() => null)) as
      | { event?: string; data?: unknown }
      | null
    if (!body?.event) {
      return legacyFail(request, 'Campo event é obrigatório', 400, 'VALIDATION_ERROR')
    }
    const event = body.event
    const data = body.data

    // Log the webhook event
    console.log(`[Webhook] Evento recebido: ${event}`, data)

    // Find all active webhooks that subscribe to this event
    const supabase = await createClient()
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('*')
      .eq('ativo', true)
      .contains('eventos', [event])

    if (!webhooks || webhooks.length === 0) {
      return legacyOk(
        request,
        { success: true, dispatched: 0 },
        { dispatched: 0, failed: 0, total: 0 }
      )
    }

    // Dispatch to each webhook URL
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() })
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }

        // Add HMAC signature if secret exists
        if (webhook.secret) {
          const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(payload)
            .digest('hex')
          headers['X-Webhook-Signature'] = `sha256=${signature}`
        }

        return fetch(webhook.url, { method: 'POST', headers, body: payload })
      })
    )

    const dispatched = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - dispatched

    return legacyOk(
      request,
      { success: true, dispatched },
      { dispatched, failed, total: results.length }
    )
  } catch (error) {
    console.error('[Webhook] Erro:', error)
    return legacyFail(request, 'Erro interno', 500, 'INTERNAL_ERROR')
  }
}
