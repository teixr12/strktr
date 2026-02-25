import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event, data } = body

    if (!event) {
      return NextResponse.json({ error: 'Campo event é obrigatório' }, { status: 400 })
    }

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
      return NextResponse.json({ success: true, dispatched: 0 })
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

    return NextResponse.json({ success: true, dispatched })
  } catch (error) {
    console.error('[Webhook] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
