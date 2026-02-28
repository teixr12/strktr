import { legacyFail, legacyOk } from '@/lib/api/legacy-compat-response'

// GET — Meta webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp] Webhook verificado com sucesso')
    return new Response(challenge, { status: 200 })
  }

  return legacyFail(request, 'Verificação falhou', 403, 'WHATSAPP_VERIFY_FAILED')
}

// POST — Receive messages
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          entry?: Array<{
            changes?: Array<{
              field?: string
              value?: { messages?: Array<{ from?: string; text?: { body?: string }; type?: string }> }
            }>
          }>
        }
      | null
    if (!body) {
      return legacyFail(request, 'Payload inválido', 400, 'INVALID_PAYLOAD')
    }

    // Log received webhook
    console.log('[WhatsApp] Webhook recebido:', JSON.stringify(body).substring(0, 500))

    // Extract messages from webhook payload
    const entries = body?.entry || []
    let processedMessages = 0
    for (const entry of entries) {
      const changes = entry?.changes || []
      for (const change of changes) {
        if (change.field !== 'messages') continue
        const messages = change.value?.messages || []

        for (const msg of messages) {
          processedMessages += 1
          console.log(`[WhatsApp] Mensagem de ${msg.from}: ${msg.text?.body || msg.type}`)
          // Future: save to whatsapp_messages table and process
        }
      }
    }

    return legacyOk(
      request,
      { success: true },
      { success: true, processedMessages }
    )
  } catch (error) {
    console.error('[WhatsApp] Erro no webhook:', error)
    return legacyFail(request, 'Erro interno', 500, 'INTERNAL_ERROR')
  }
}
